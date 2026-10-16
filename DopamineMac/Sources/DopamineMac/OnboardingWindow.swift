import AppKit
import SwiftUI

/// The first-run guide: what Dopamine does, the Accessibility permission it needs for window titles,
/// and opening at login. Access is checked live while the permission step is showing (System Settings
/// doesn't tell us when the switch flips), so the guide moves on by itself. See OnboardingFlow for
/// when it opens.
final class OnboardingWindow: NSObject, NSWindowDelegate {
    private static let size = NSSize(width: 760, height: 500)
    /// How often access is checked while the permission step waits for it.
    private static let pollInterval: TimeInterval = 0.75

    private let flow: OnboardingFlow
    private let model = OnboardingModel()
    private let actions: OnboardingActions
    private var window: NSWindow?
    private var poll: Timer?

    init(flow: OnboardingFlow = OnboardingFlow(), actions: OnboardingActions) {
        self.flow = flow
        self.actions = actions
        super.init()
    }

    var isOpen: Bool { window != nil }

    /// Opens the guide if setup isn't finished or access was lost; `force` (Getting started) always does.
    func start(force: Bool = false) {
        guard let step = flow.start(granted: AccessibilityAccess.isGranted, force: force) else { return }
        show(at: step)
    }

    private func show(at step: OnboardingFlow.Step) {
        let window = self.window ?? makeWindow()
        self.window = window
        go(to: step)
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
        window.makeKeyAndOrderFront(nil)
    }

    private func makeWindow() -> NSWindow {
        let window = NSWindow(
            contentRect: NSRect(origin: .zero, size: Self.size),
            styleMask: [.titled, .closable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.title = L("Welcome to Dopamine", "欢迎使用 Dopamine", "歡迎使用 Dopamine")
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.isMovableByWindowBackground = true
        window.isReleasedWhenClosed = false
        window.delegate = self
        window.contentView = NSHostingView(rootView: OnboardingView(model: model, actions: OnboardingViewActions(
            back: { [weak self] in self?.goBack() },
            next: { [weak self] in self?.goNext() },
            grant: { [weak self] in self?.grant() },
            setLaunchAtLogin: { [weak self] on in
                self?.actions.setLaunchAtLogin(on)
                self?.refresh()
            }
        )))
        window.center()
        return window
    }

    private func go(to step: OnboardingFlow.Step) {
        model.step = step
        refresh()
    }

    private func goBack() {
        if let previous = model.step.previous { go(to: previous) }
    }

    private func goNext() {
        refresh()
        guard model.step.canContinue(granted: model.granted) else { return }
        if let next = model.step.next { return go(to: next) }
        guard flow.complete(granted: model.granted) else { return go(to: .permission) }
        window?.close()
        actions.openDashboard()
    }

    private func grant() {
        AccessibilityAccess.ask()
        if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility") {
            NSWorkspace.shared.open(url)
        }
        refresh()
    }

    /// Reads access and the login item again, and keeps the guide on a step it can be on.
    private func refresh() {
        let wasGranted = model.granted
        model.granted = AccessibilityAccess.isGranted
        model.launchAtLogin = actions.launchAtLogin()
        if !model.granted && isOpen { flow.permissionLost() }
        let reachable = model.step.reachable(granted: model.granted)
        if reachable != model.step { model.step = reachable }
        if model.granted != wasGranted { actions.accessChanged() }
        updatePoll()
    }

    private func updatePoll() {
        let waiting = isOpen && model.step == .permission && !model.granted
        if waiting, poll == nil {
            let timer = Timer(timeInterval: Self.pollInterval, repeats: true) { [weak self] _ in self?.refresh() }
            RunLoop.main.add(timer, forMode: .common)
            poll = timer
        } else if !waiting {
            poll?.invalidate()
            poll = nil
        }
    }

    // MARK: NSWindowDelegate

    /// Coming back from System Settings: check straight away instead of at the next tick.
    func windowDidBecomeKey(_ notification: Notification) {
        refresh()
    }

    func windowWillClose(_ notification: Notification) {
        window?.delegate = nil
        window = nil
        updatePoll()
        actions.closed()
    }
}

/// What the guide asks of the rest of the app.
struct OnboardingActions {
    var openDashboard: () -> Void
    var launchAtLogin: () -> Bool?
    var setLaunchAtLogin: (Bool) -> Void
    /// Access was allowed or taken away: the menu's notice should follow.
    var accessChanged: () -> Void
    var closed: () -> Void
}

final class OnboardingModel: ObservableObject {
    @Published var step = OnboardingFlow.Step.welcome
    @Published var granted = false
    /// nil where opening at login isn't available (macOS 12, or running outside the .app).
    @Published var launchAtLogin: Bool?
}
