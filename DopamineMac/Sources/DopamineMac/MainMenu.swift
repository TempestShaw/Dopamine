import AppKit

/// The menu bar menus shown while the dashboard window is open (a menu bar app has none otherwise):
/// the usual app, Edit, View and Window menus, so ⌘Q, ⌘W, ⌘C and friends work in the window.
enum MainMenu {
    static func make() -> NSMenu {
        let main = NSMenu()
        main.addItem(submenu(appMenu()))
        main.addItem(submenu(editMenu()))
        main.addItem(submenu(viewMenu()))
        let window = windowMenu()
        main.addItem(submenu(window))
        NSApp.windowsMenu = window
        return main
    }

    private static func appMenu() -> NSMenu {
        let menu = NSMenu(title: "Dopamine")
        menu.addItem(item(L("About Dopamine", "关于 Dopamine", "關於 Dopamine"), #selector(NSApplication.orderFrontStandardAboutPanel(_:))))
        menu.addItem(.separator())
        menu.addItem(item(L("Hide Dopamine", "隐藏 Dopamine", "隱藏 Dopamine"), #selector(NSApplication.hide(_:)), "h"))
        menu.addItem(item(L("Hide Others", "隐藏其他", "隱藏其他"), #selector(NSApplication.hideOtherApplications(_:)), "h", [.command, .option]))
        menu.addItem(item(L("Show All", "全部显示", "顯示全部"), #selector(NSApplication.unhideAllApplications(_:))))
        menu.addItem(.separator())
        menu.addItem(item(L("Quit Dopamine", "退出 Dopamine", "結束 Dopamine"), #selector(NSApplication.terminate(_:)), "q"))
        return menu
    }

    private static func editMenu() -> NSMenu {
        let menu = NSMenu(title: L("Edit", "编辑", "編輯"))
        menu.addItem(item(L("Undo", "撤销", "還原"), Selector(("undo:")), "z"))
        menu.addItem(item(L("Redo", "重做", "重做"), Selector(("redo:")), "z", [.command, .shift]))
        menu.addItem(.separator())
        menu.addItem(item(L("Cut", "剪切", "剪下"), #selector(NSText.cut(_:)), "x"))
        menu.addItem(item(L("Copy", "拷贝", "拷貝"), #selector(NSText.copy(_:)), "c"))
        menu.addItem(item(L("Paste", "粘贴", "貼上"), #selector(NSText.paste(_:)), "v"))
        menu.addItem(item(L("Select All", "全选", "全選"), #selector(NSText.selectAll(_:)), "a"))
        return menu
    }

    private static func viewMenu() -> NSMenu {
        let menu = NSMenu(title: L("View", "显示", "顯示方式"))
        menu.addItem(item(L("Enter Full Screen", "进入全屏幕", "進入全螢幕"), #selector(NSWindow.toggleFullScreen(_:)), "f", [.command, .control]))
        return menu
    }

    private static func windowMenu() -> NSMenu {
        let menu = NSMenu(title: L("Window", "窗口", "視窗"))
        menu.addItem(item(L("Minimize", "最小化", "縮到最小"), #selector(NSWindow.performMiniaturize(_:)), "m"))
        menu.addItem(item(L("Zoom", "缩放", "縮放"), #selector(NSWindow.performZoom(_:))))
        menu.addItem(.separator())
        menu.addItem(item(L("Close", "关闭", "關閉"), #selector(NSWindow.performClose(_:)), "w"))
        return menu
    }

    private static func submenu(_ menu: NSMenu) -> NSMenuItem {
        let holder = NSMenuItem(title: menu.title, action: nil, keyEquivalent: "")
        holder.submenu = menu
        return holder
    }

    private static func item(_ title: String, _ action: Selector, _ key: String = "", _ modifiers: NSEvent.ModifierFlags = .command) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
        item.keyEquivalentModifierMask = modifiers
        return item
    }
}
