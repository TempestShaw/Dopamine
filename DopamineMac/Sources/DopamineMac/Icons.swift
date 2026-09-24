import AppKit

/// Captures app icons as small PNGs so the dashboard can show them, even after the app has quit.
enum AppIcons {
    /// Pixel size of stored icons: sharp at the dashboard's largest size (40pt) on Retina screens.
    static let size: CGFloat = 96

    static func png(for app: NSRunningApplication) -> Data? {
        if let icon = app.icon { return png(from: icon) }
        if let url = app.bundleURL { return png(from: NSWorkspace.shared.icon(forFile: url.path)) }
        return nil
    }

    /// For names recorded before icons were captured: look for a matching app bundle on disk.
    static func png(forAppNamed name: String) -> Data? {
        let dirs = ["/Applications", "/System/Applications", "/System/Applications/Utilities", "/Applications/Utilities",
                    NSHomeDirectory() + "/Applications"]
        for dir in dirs {
            let path = "\(dir)/\(name).app"
            if FileManager.default.fileExists(atPath: path) {
                return png(from: NSWorkspace.shared.icon(forFile: path))
            }
        }
        return nil
    }

    static func png(from image: NSImage) -> Data? {
        let px = Int(size)
        guard let rep = NSBitmapImageRep(
            bitmapDataPlanes: nil, pixelsWide: px, pixelsHigh: px, bitsPerSample: 8, samplesPerPixel: 4,
            hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
        ) else { return nil }
        rep.size = NSSize(width: size, height: size)
        NSGraphicsContext.saveGraphicsState()
        defer { NSGraphicsContext.restoreGraphicsState() }
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
        NSGraphicsContext.current?.imageInterpolation = .high
        image.draw(in: NSRect(x: 0, y: 0, width: size, height: size), from: .zero, operation: .copy, fraction: 1)
        return rep.representation(using: .png, properties: [:])
    }
}
