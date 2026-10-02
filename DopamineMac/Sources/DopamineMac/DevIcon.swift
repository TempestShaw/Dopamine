import AppKit

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
