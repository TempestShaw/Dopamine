import AppKit
import ApplicationServices

/// The choices offered by the menu's Pause button.
enum PauseLength: CaseIterable {
    case minutes15, hour1, untilTomorrow, indefinitely

    /// When a pause started at `now` ends by itself; nil means it waits for the user.
    func end(from now: Date, calendar: Calendar = .current) -> Date? {
        switch self {
        case .minutes15: return now.addingTimeInterval(15 * 60)
        case .hour1: return now.addingTimeInterval(60 * 60)
        case .untilTomorrow: return calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now))
        case .indefinitely: return nil
        }
    }
}

/// Records the frontmost app and window title whenever it changes.
///
/// Time only counts while the user is present: tracking suspends (writing a marker row) on
/// sleep, screen lock, fast user switching and after `idleTimeout` seconds without input.
final class Tracker {
    private let database: Database
    private let settings: SettingsStore
    private var timer: Timer?
    private var observers: [NSObjectProtocol] = []

    private var current: (title: String, process: String, since: Date)?
    /// Processes whose icon has been stored during this run.
    private var iconsCaptured = Set<String>()
    private(set) var isIdle = false
    private var systemSuspended = false

    /// Pause requested by the user from the menu.
    private(set) var userPaused = false
    /// When the current pause ends by itself; nil while recording or until the user resumes.
    private(set) var pausedUntil: Date?

    var isRecording: Bool { !userPaused && !systemSuspended && !isIdle }

    /// Called on the main thread whenever `isRecording` may have changed.
    var onStateChange: (() -> Void)?

    init(database: Database, settings: SettingsStore) {
        self.database = database
        self.settings = settings
    }

    static var hasAccessibilityAccess: Bool { AXIsProcessTrusted() }

    /// Shows the system prompt asking for Accessibility access (needed to read window titles).
    static func requestAccessibilityAccess() {
        let key = kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String
        _ = AXIsProcessTrustedWithOptions([key: true] as CFDictionary)
    }

    func start() {
        let ws = NSWorkspace.shared.notificationCenter
        observe(ws, NSWorkspace.didActivateApplicationNotification) { [weak self] _ in self?.poll() }
        for name in [NSWorkspace.willSleepNotification, NSWorkspace.screensDidSleepNotification, NSWorkspace.sessionDidResignActiveNotification] {
            observe(ws, name) { [weak self] _ in self?.setSystemSuspended(true) }
        }
        for name in [NSWorkspace.didWakeNotification, NSWorkspace.screensDidWakeNotification, NSWorkspace.sessionDidBecomeActiveNotification] {
            observe(ws, name) { [weak self] _ in self?.setSystemSuspended(false) }
        }
        let dnc = DistributedNotificationCenter.default()
        observe(dnc, Notification.Name("com.apple.screenIsLocked")) { [weak self] _ in self?.setSystemSuspended(true) }
        observe(dnc, Notification.Name("com.apple.screenIsUnlocked")) { [weak self] _ in self?.setSystemSuspended(false) }
        observe(NotificationCenter.default, .settingsChanged) { [weak self] _ in self?.scheduleTimer() }

        scheduleTimer()
        poll()
        Log.info("Tracking started")
    }

    /// Writes a final marker so the last window doesn't keep counting after quit.
    func shutdown() {
        timer?.invalidate()
        if current != nil { writeMarker(Marker.stopped) }
        database.flush()
    }

    /// Stops recording, until `end` or (nil) until `resume()`. Choosing again replaces the end time.
    func pause(until end: Date?) {
        pausedUntil = end
        if userPaused { onStateChange?() } else { setUserPaused(true) }
    }

    func resume() {
        pausedUntil = nil
        setUserPaused(false)
    }

    /// Ends a timed pause whose time is up. Returns true if it did.
    @discardableResult
    func resumeIfPauseEnded(now: Date = Date()) -> Bool {
        guard userPaused, let end = pausedUntil, now >= end else { return false }
        resume()
        return true
    }

    private func setUserPaused(_ paused: Bool) {
        guard paused != userPaused else { return }
        userPaused = paused
        if paused { suspend(marker: Marker.stopped) } else { poll() }
        onStateChange?()
    }

    private func observe(_ center: NotificationCenter, _ name: Notification.Name, _ block: @escaping (Notification) -> Void) {
        observers.append(center.addObserver(forName: name, object: nil, queue: .main, using: block))
    }

    private func scheduleTimer() {
        timer?.invalidate()
        let interval = Double(settings.settings.trackingInterval) / 1000
        let t = Timer(timeInterval: interval, repeats: true) { [weak self] _ in self?.poll() }
        t.tolerance = interval * 0.2 // lets macOS coalesce wake-ups; saves energy
        RunLoop.main.add(t, forMode: .common)
        timer = t
    }

    private func setSystemSuspended(_ suspended: Bool) {
        guard suspended != systemSuspended else { return }
        systemSuspended = suspended
        if suspended { suspend(marker: Marker.stopped) } else { poll() }
        onStateChange?()
    }

    private func suspend(marker: String) {
        guard current != nil else { return }
        writeMarker(marker)
    }

    private func writeMarker(_ title: String) {
        database.insert(windowTitle: title, processName: Marker.process)
        current = nil
    }

    private func poll() {
        // The timer keeps running while paused, so a timed pause ends on the next tick.
        if resumeIfPauseEnded() { return }
        guard !userPaused, !systemSuspended else { return }

        let idleLimit = settings.settings.idleTimeout
        if idleLimit > 0 {
            let idleFor = Tracker.secondsSinceLastInput()
            if idleFor >= Double(idleLimit) {
                if !isIdle {
                    isIdle = true
                    if let current {
                        // Backdate the marker to when input actually stopped (but not before the current row).
                        let since = max(current.since, Date().addingTimeInterval(-idleFor))
                        database.insert(windowTitle: Marker.idle, processName: Marker.process, at: since)
                        self.current = nil
                    }
                    onStateChange?()
                }
                return
            }
            if isIdle {
                isIdle = false
                onStateChange?()
            }
        }

        guard let app = NSWorkspace.shared.frontmostApplication else { return }
        let process = app.localizedName ?? app.bundleIdentifier ?? "Unknown"
        let title = Tracker.focusedWindowTitle(pid: app.processIdentifier) ?? ""
        if let current, current.title == title, current.process == process { return }

        database.insert(windowTitle: title, processName: process)
        current = (title, process, Date())

        // Refresh each app's icon and metadata once per launch (apps update now and then).
        if !iconsCaptured.contains(process) {
            iconsCaptured.insert(process)
            database.saveApp(process: process, info: AppIcons.capture(app))
        }
    }

    static func secondsSinceLastInput() -> Double {
        // ~0 is kCGAnyInputEventType.
        guard let any = CGEventType(rawValue: ~0) else { return 0 }
        return CGEventSource.secondsSinceLastEventType(.combinedSessionState, eventType: any)
    }

    static func focusedWindowTitle(pid: pid_t) -> String? {
        guard AXIsProcessTrusted() else { return nil }
        let app = AXUIElementCreateApplication(pid)
        var window: CFTypeRef?
        guard AXUIElementCopyAttributeValue(app, kAXFocusedWindowAttribute as CFString, &window) == .success,
              let window, CFGetTypeID(window) == AXUIElementGetTypeID() else { return nil }
        var title: CFTypeRef?
        guard AXUIElementCopyAttributeValue(window as! AXUIElement, kAXTitleAttribute as CFString, &title) == .success else { return nil }
        return title as? String
    }
}
