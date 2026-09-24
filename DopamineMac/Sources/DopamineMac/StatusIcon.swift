import AppKit

/// The logo's four paint dabs as a menu bar template image. The bar shows it in one colour, so
/// each dab is cut out of the ones beneath it by a thin gap to stay readable.
enum StatusIcon {
    /// Circles of the logo (centre x, centre y, radius) in its 40-unit drawing; the icon shows 4…36.
    private static let dabs: [(x: CGFloat, y: CGFloat, r: CGFloat)] = [(15, 15, 10), (26, 16, 9), (18, 26, 9.5), (28, 27, 6)]

    static let image: NSImage = {
        let side: CGFloat = 18
        let image = NSImage(size: NSSize(width: side, height: side), flipped: true) { rect in
            guard let ctx = NSGraphicsContext.current?.cgContext else { return false }
            let scale = rect.width / 32
            let gap: CGFloat = 1.1
            for dab in dabs {
                let c = CGPoint(x: (dab.x - 4) * scale, y: (dab.y - 4) * scale)
                let r = dab.r * scale
                ctx.setBlendMode(.clear)
                ctx.fillEllipse(in: CGRect(x: c.x - r - gap, y: c.y - r - gap, width: 2 * (r + gap), height: 2 * (r + gap)))
                ctx.setBlendMode(.normal)
                ctx.setFillColor(NSColor.black.cgColor)
                ctx.fillEllipse(in: CGRect(x: c.x - r, y: c.y - r, width: 2 * r, height: 2 * r))
            }
            return true
        }
        image.isTemplate = true
        image.accessibilityDescription = "Dopamine"
        return image
    }()
}
