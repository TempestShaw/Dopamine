import AppKit

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
// Menu bar only: no Dock icon or main menu (LSUIElement does the same inside the .app bundle).
app.setActivationPolicy(.accessory)
app.run()
