import AppKit

/// How the dashboard window comes and goes: a quick fade with a small rise on the way in, and a
/// quicker fade on the way out. With Reduce Motion on, it only fades.
enum WindowMotion {
    static let appearDuration: TimeInterval = 0.18
    static let disappearDuration: TimeInterval = 0.12
    /// Points the window rises while it fades in.
    static let rise: CGFloat = 8
    /// The longest the window waits for the page before showing anyway.
    static let revealTimeout: TimeInterval = 0.8

    static func fadeIn(_ window: NSWindow) {
        let end = window.frame
        let move = !NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
        if move { window.setFrameOrigin(NSPoint(x: end.minX, y: end.minY - rise)) }
        NSAnimationContext.runAnimationGroup { context in
            context.duration = appearDuration
            context.timingFunction = CAMediaTimingFunction(name: .easeOut)
            window.animator().alphaValue = 1
            if move { window.animator().setFrame(end, display: true) }
        }
    }

    static func fadeOut(_ window: NSWindow, then done: @escaping () -> Void) {
        NSAnimationContext.runAnimationGroup({ context in
            context.duration = disappearDuration
            context.timingFunction = CAMediaTimingFunction(name: .easeIn)
            window.animator().alphaValue = 0
        }, completionHandler: done)
    }
}

/// `swift run` builds a bare executable, which the Dock shows with a generic icon; this gives it
/// Dopamine's icon from the source tree. The bundled app gets its icon from Info.plist.
enum DevIcon {
    private static var applied = false

    static func applyIfUnbundled() {
        guard !applied, Bundle.main.bundleURL.pathExtension != "app" else { return }
        applied = true
        let exe = URL(fileURLWithPath: CommandLine.arguments[0]).resolvingSymlinksInPath().deletingLastPathComponent()
        let icon = exe.appendingPathComponent("../../../Resources/AppIcon.icns").standardizedFileURL
        if let image = NSImage(contentsOf: icon) { NSApp.applicationIconImage = image }
    }
}
