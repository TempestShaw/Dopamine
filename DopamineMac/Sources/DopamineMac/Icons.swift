import AppKit

/// Captures app icons (as small PNGs) and metadata so the dashboard can show and categorise apps,
/// even after they have quit.
enum AppIcons {
    static func capture(_ app: NSRunningApplication) -> StoredApp {
        StoredApp(png: png(for: app), hint: hint(bundleURL: app.bundleURL, name: app.localizedName))
    }

    /// For names recorded before capture existed: look for a matching app bundle on disk.
    static func capture(appNamed name: String) -> StoredApp? {
        guard let url = bundleURL(named: name) else { return nil }
        return StoredApp(png: png(from: NSWorkspace.shared.icon(forFile: url.path)), hint: hint(bundleURL: url, name: name))
    }

    /// The app's own declaration of what it is (App Store category), plus name, publisher and path.
    static func hint(bundleURL: URL?, name: String?) -> AppHint {
        guard let url = bundleURL else { return AppHint(description: name) }
        let info = Bundle(url: url)?.infoDictionary ?? [:]
        return AppHint(
            kind: info["LSApplicationCategoryType"] as? String,
            description: (info["CFBundleDisplayName"] as? String) ?? (info["CFBundleName"] as? String) ?? name,
            publisher: info["NSHumanReadableCopyright"] as? String,
            path: url.path
        )
    }

    private static func bundleURL(named name: String) -> URL? {
        let dirs = ["/Applications", "/System/Applications", "/System/Applications/Utilities", "/Applications/Utilities",
                    NSHomeDirectory() + "/Applications"]
        return dirs.map { URL(fileURLWithPath: "\($0)/\(name).app") }.first { FileManager.default.fileExists(atPath: $0.path) }
    }

    /// Pixel size of stored icons: sharp at the dashboard's largest size (40pt) on Retina screens.
    static let size: CGFloat = 96

    static func png(for app: NSRunningApplication) -> Data? {
        if let icon = app.icon { return png(from: icon) }
        if let url = app.bundleURL { return png(from: NSWorkspace.shared.icon(forFile: url.path)) }
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
