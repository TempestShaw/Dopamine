import AppKit
import ServiceManagement
import SwiftUI

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var settings: SettingsStore!
    private var database: Database!
    private var tracker: Tracker!
    private var server: HTTPServer?
    private var api: API!

    private var statusItem: NSStatusItem!
    private let popover = NSPopover()
    private let model = MenuModel()
    private var refreshTimer: Timer?
    private let summaryQueue = DispatchQueue(label: "dopamine.summary", qos: .utility)

    func applicationDidFinishLaunching(_ notification: Notification) {
        settings = SettingsStore()
        do {
            database = try Database(url: Paths.database)
        } catch {
            let alert = NSAlert()
            alert.messageText = "Dopamine couldn't open its database"
            alert.informativeText = "\(error)"
            alert.runModal()
            NSApp.terminate(nil)
            return
        }

        tracker = Tracker(database: database, settings: settings)
        tracker.onStateChange = { [weak self] in self?.refresh() }

        let api = API(database: database, settings: settings, webRoot: API.locateWebRoot())
        self.api = api
        let server = HTTPServer(port: apiPort) { req in api.handle(req) }
        do {
            try server.start()
            self.server = server
        } catch {
            model.serverError = "Port \(apiPort) is busy — is another copy of Dopamine running?"
            Log.error("Could not start API: \(error)")
        }

        setUpStatusItem()
        tracker.start()

        if !Tracker.hasAccessibilityAccess && !UserDefaults.standard.bool(forKey: "askedForAccessibility") {
            UserDefaults.standard.set(true, forKey: "askedForAccessibility")
            Tracker.requestAccessibilityAccess()
        }

        refresh()
        let timer = Timer(timeInterval: 60, repeats: true) { [weak self] _ in self?.refresh() }
        timer.tolerance = 10
        RunLoop.main.add(timer, forMode: .common)
        refreshTimer = timer
    }

    func applicationWillTerminate(_ notification: Notification) {
        tracker?.shutdown()
        server?.stop()
    }

    // MARK: Status item

    private func setUpStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            button.imagePosition = .imageLeading
            button.action = #selector(togglePopover)
            button.target = self
        }
        popover.behavior = .transient
        popover.animates = true
        popover.contentViewController = NSHostingController(rootView: MenuView(model: model, actions: MenuActions(
            openDashboard: { [weak self] in self?.openDashboard() },
            togglePause: { [weak self] in self?.togglePause() },
            grantAccessibility: { [weak self] in self?.openAccessibilitySettings() },
            setLaunchAtLogin: { [weak self] on in self?.setLaunchAtLogin(on) },
            quit: { NSApp.terminate(nil) }
        )))
        updateStatusButton()
    }

    @objc private func togglePopover() {
        guard let button = statusItem.button else { return }
        if popover.isShown {
            popover.performClose(nil)
        } else {
            refresh()
            popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
            popover.contentViewController?.view.window?.makeKey()
            NSApp.activate(ignoringOtherApps: true)
        }
    }

    private func updateStatusButton() {
        guard let button = statusItem?.button else { return }
        let symbol = model.userPaused ? "pause.circle" : "hourglass"
        let image = NSImage(systemSymbolName: symbol, accessibilityDescription: "Dopamine")
        image?.isTemplate = true
        button.image = image
        let showTime = settings.settings.showTimeInMenuBar && model.summary.total >= 60 && !model.userPaused
        button.title = showTime ? " " + formatDuration(model.summary.total) : ""
        button.font = NSFont.monospacedDigitSystemFont(ofSize: NSFont.systemFontSize, weight: .regular)
    }

    // MARK: Data

    private func refresh() {
        let db = database!
        let settings = self.settings.settings
        summaryQueue.async { [weak self] in
            let now = Date()
            let cal = Calendar.current
            let today = cal.startOfDay(for: now)
            let yesterday = cal.date(byAdding: .day, value: -1, to: today)!
            let lookback = Int64(yesterday.timeIntervalSince1970 - DaySummary.maxSegment)
            let rows = db.activities(from: lookback, to: Int64(now.timeIntervalSince1970) + 60)
            // Same evidence as the dashboard: the user's choice, then rules, then the app's metadata.
            let known = db.apps(for: Array(Set(rows.map(\.processName))))
            let overrides = settings.categoryOverrides.compactMapValues(Category.init(rawValue:))
            var cache: [String: Category] = [:]
            let classify: (String, String) -> Category = { title, process in
                if let chosen = overrides[process] { return chosen }
                let key = process + "\u{0}" + title
                if let hit = cache[key] { return hit }
                let c = Category.of(title: title, app: process, hint: known[process]?.hint)
                cache[key] = c
                return c
            }
            let todaySummary = DaySummary.compute(rows: rows, start: today, end: now, now: now, classify: classify)
            let yesterdaySummary = DaySummary.compute(rows: rows, start: yesterday, end: today, now: now, classify: classify)
            let iconData = todaySummary.apps.prefix(5).reduce(into: [String: Data]()) { out, app in
                if let png = known[app.app]?.png { out[app.app] = png }
            }
            DispatchQueue.main.async {
                guard let self else { return }
                self.model.summary = todaySummary
                self.model.icons = iconData.compactMapValues { NSImage(data: $0) }
                self.model.yesterdayTotal = yesterdaySummary.total
                self.model.isRecording = self.tracker.isRecording
                self.model.isIdle = self.tracker.isIdle
                self.model.userPaused = self.tracker.userPaused
                self.model.pairingCode = self.settings.settings.pairingCode
                self.model.hasAccessibility = Tracker.hasAccessibilityAccess
                self.refreshLoginItemState()
                self.updateStatusButton()
            }
        }
    }

    // MARK: Actions

    private func openDashboard() {
        popover.performClose(nil)
        let code = settings.settings.pairingCode
        if let url = URL(string: "http://localhost:\(apiPort)/#pair=\(code)") {
            NSWorkspace.shared.open(url)
        }
    }

    private func togglePause() {
        tracker.setUserPaused(!tracker.userPaused)
    }

    private func openAccessibilitySettings() {
        Tracker.requestAccessibilityAccess()
        if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility") {
            NSWorkspace.shared.open(url)
        }
    }

    private func refreshLoginItemState() {
        guard #available(macOS 13.0, *), Bundle.main.bundleURL.pathExtension == "app" else {
            model.canLaunchAtLogin = false
            return
        }
        model.canLaunchAtLogin = true
        model.launchAtLogin = SMAppService.mainApp.status == .enabled
    }

    private func setLaunchAtLogin(_ on: Bool) {
        guard #available(macOS 13.0, *) else { return }
        do {
            if on { try SMAppService.mainApp.register() } else { try SMAppService.mainApp.unregister() }
        } catch {
            Log.error("Login item change failed: \(error)")
        }
        refreshLoginItemState()
    }
}
