import AppKit
import WebKit

/// The dashboard in its own window: a WKWebView (WebKit ships with macOS) pointed at the same
/// local dashboard a browser would show, the macOS twin of DopamineWin/DashboardWindow.cs.
/// Closing it tears the web view down, so the menu bar agent goes back to its usual footprint.
///
/// The window has no visible title bar: the page draws its own (`?frame=mac`) under the native
/// traffic lights, which sit centred in it. WebKit ignores CSS `app-region`, so the page asks
/// through the `dopamine` message handler to move the window or zoom it, and reports its theme so
/// the frosted glass behind the title bar and sidebar (an NSVisualEffectView the page lets through)
/// matches it. The window appears as soon as the page has painted, with the system's own document-window
/// animation (drawn by the window server at the display's full refresh rate). While it's
/// open, Dopamine shows in the Dock and the app switcher like any other app; closing it leaves just
/// the menu bar icon.
final class DashboardWindow: NSObject {
    /// The height of the page's title bar (`h-10` in DopamineWeb/src/components/TitleBar.tsx).
    static let titleBarHeight: CGFloat = 40
    private static let trafficLightInset: CGFloat = 14
    private static let trafficLightSpacing: CGFloat = 20
    private static let defaultSize = NSSize(width: 1280, height: 860)
    private static let minimumSize = NSSize(width: 420, height: 360)
    private static let autosaveName = "DopamineDashboard"
    private static let themeKey = "dashboardTheme"
    private static let messageHandler = "dopamine"
    /// The longest the window waits for the page to paint before appearing anyway.
    private static let revealTimeout: TimeInterval = 0.5

    private let url: () -> URL
    private let defaults: UserDefaults
    private var window: NSWindow?
    private var webView: WKWebView?
    private var glass: NSVisualEffectView?
    private var fullScreen = false
    private var revealed = false

    /// - Parameter url: the dashboard address, asked each time the window opens (the pairing code can change).
    init(url: @escaping () -> URL, defaults: UserDefaults = .standard) {
        self.url = url
        self.defaults = defaults
    }

    var isOpen: Bool { window != nil }

    /// Opens the window, or brings it to the front if it's already open.
    func show() {
        if let window {
            if window.isMiniaturized { window.deminiaturize(nil) }
            bringToFront(window)
            return
        }

        let config = WKWebViewConfiguration()
        config.userContentController.add(WeakMessageHandler(self), name: Self.messageHandler)
        let webView = WKWebView(frame: .zero, configuration: config)
        // The page is transparent where the glass shows through, and never flashes white.
        webView.setValue(false, forKey: "drawsBackground")
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.autoresizingMask = [.width, .height]

        let theme = storedTheme
        let glass = NSVisualEffectView()
        glass.material = .sidebar
        glass.blendingMode = .behindWindow
        glass.state = .followsWindowActiveState
        glass.appearance = theme.appearance
        webView.frame = glass.bounds
        glass.addSubview(webView)

        let window = NSWindow(
            contentRect: NSRect(origin: .zero, size: Self.defaultSize),
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.title = "Dopamine"
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.isReleasedWhenClosed = false
        window.tabbingMode = .disallowed
        window.minSize = Self.minimumSize
        window.backgroundColor = theme.chrome
        window.animationBehavior = .documentWindow
        window.contentView = glass
        window.delegate = self
        if !window.setFrameUsingName(Self.autosaveName) { placeFirstTime(window) }
        window.setFrameAutosaveName(Self.autosaveName)

        self.window = window
        self.webView = webView
        self.glass = glass
        fullScreen = false
        revealed = false
        placeTrafficLights()
        webView.load(URLRequest(url: url()))
        // Shown when the page says it has painted ("ready"), so it animates in complete, or after a
        // moment if it's slow. Waiting for `didFinish` would also wait for web fonts.
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.revealTimeout) { [weak self] in self?.reveal() }
    }

    private func reveal() {
        guard let window, !revealed else { return }
        revealed = true
        bringToFront(window)
    }

    func close() {
        window?.close()
    }

    private func bringToFront(_ window: NSWindow) {
        DevIcon.applyIfUnbundled()
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
        window.makeKeyAndOrderFront(nil)
    }

    /// 1280 × 860, or 90% of a smaller screen, centred.
    private func placeFirstTime(_ window: NSWindow) {
        guard let visible = (NSScreen.main ?? NSScreen.screens.first)?.visibleFrame else { return window.center() }
        let size = NSSize(width: min(Self.defaultSize.width, visible.width * 0.9), height: min(Self.defaultSize.height, visible.height * 0.9))
        window.setFrame(NSRect(x: visible.midX - size.width / 2, y: visible.midY - size.height / 2, width: size.width, height: size.height), display: false)
    }

    /// Centres the traffic lights in the page's title bar, which is taller than the system's. AppKit
    /// lays them out again on resize and full screen, so this runs after those too.
    private func placeTrafficLights() {
        guard let window, !fullScreen,
              let close = window.standardWindowButton(.closeButton),
              let container = close.superview?.superview else { return }
        let height = Self.titleBarHeight
        container.frame = NSRect(x: container.frame.minX, y: window.frame.height - height, width: container.frame.width, height: height)
        let buttons: [NSWindow.ButtonType] = [.closeButton, .miniaturizeButton, .zoomButton]
        for (i, type) in buttons.enumerated() {
            guard let button = window.standardWindowButton(type) else { continue }
            button.setFrameOrigin(NSPoint(x: Self.trafficLightInset + CGFloat(i) * Self.trafficLightSpacing, y: ((height - button.frame.height) / 2).rounded()))
        }
    }

    // MARK: Theme

    private var storedTheme: DashboardTheme {
        if let raw = defaults.string(forKey: Self.themeKey), let theme = DashboardTheme(rawValue: raw) { return theme }
        return NSApp.effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua ? .dark : .light
    }

    private func apply(_ theme: DashboardTheme) {
        defaults.set(theme.rawValue, forKey: Self.themeKey)
        window?.backgroundColor = theme.chrome
        glass?.appearance = theme.appearance
    }

    // MARK: Messages

    fileprivate func receive(_ body: Any) {
        guard let message = body as? [String: Any], let type = message["type"] as? String, let window else { return }
        switch type {
        case "drag":
            // The page posts this once the pressed mouse moves; if the button is already up, the
            // drag would wait for the next click instead.
            if NSEvent.pressedMouseButtons & 1 != 0, let event = NSApp.currentEvent, event.type == .leftMouseDown || event.type == .leftMouseDragged {
                window.performDrag(with: event)
            }
        case "zoom":
            switch TitleBarDoubleClick.current(defaults: .standard) {
            case .zoom: window.zoom(nil)
            case .minimize: window.miniaturize(nil)
            case .none: break
            }
        case "theme":
            if let raw = message["theme"] as? String, let theme = DashboardTheme(rawValue: raw) { apply(theme) }
        case "ready":
            reveal()
        case "state":
            sendState()
        default:
            Log.error("Dashboard window: unknown message \(type)")
        }
    }

    /// Tells the page whether the traffic lights are showing (they hide in full screen).
    private func sendState() {
        webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('dopamine:host',{detail:{fullScreen:\(fullScreen)}}))")
    }
}

// MARK: - Window

extension DashboardWindow: NSWindowDelegate {
    func windowDidResize(_ notification: Notification) { placeTrafficLights() }
    func windowDidBecomeKey(_ notification: Notification) { placeTrafficLights() }

    func windowWillEnterFullScreen(_ notification: Notification) {
        fullScreen = true
        sendState()
    }

    func windowDidExitFullScreen(_ notification: Notification) {
        fullScreen = false
        placeTrafficLights()
        sendState()
    }

    func windowWillClose(_ notification: Notification) {
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: Self.messageHandler)
        webView?.stopLoading()
        window?.delegate = nil
        window = nil
        webView = nil
        glass = nil
        // Back to a menu bar app: no Dock icon or menu.
        NSApp.setActivationPolicy(.accessory)
    }
}

// MARK: - Navigation

extension DashboardWindow: WKNavigationDelegate, WKUIDelegate {
    /// The window only ever shows the local dashboard; anything else opens in the browser.
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let target = action.request.url, !DashboardWindow.isDashboard(target, base: url()) else { return decisionHandler(.allow) }
        decisionHandler(.cancel)
        NSWorkspace.shared.open(target)
    }

    /// Links that open a new window (release notes, the source code) go to the default browser.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let target = action.request.url { NSWorkspace.shared.open(target) }
        return nil
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        Log.info("Dashboard window loaded")
        reveal() // a page that never says "ready", such as the unreachable page
    }

    /// The dashboard couldn't be reached: say so instead of leaving an empty window, with a way to retry.
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        Log.error("Dashboard window failed to load: \(error)")
        webView.loadHTMLString(DashboardWindow.unreachablePage(retry: url()), baseURL: nil)
    }

    static func unreachablePage(retry: URL) -> String {
        let title = L("Can't reach the dashboard", "无法连接仪表板", "無法連線儀表板")
        let detail = L("Dopamine's local server didn't answer.", "Dopamine 的本地服务没有响应。", "Dopamine 的本機服務沒有回應。")
        let again = L("Try again", "重试", "重試")
        let link = retry.absoluteString.replacingOccurrences(of: "\"", with: "%22")
        return """
            <!doctype html><meta charset="utf-8"><style>
            html{height:100%;display:grid;place-items:center;font:14px -apple-system,sans-serif;color:#221f1b;color-scheme:light dark}
            @media (prefers-color-scheme:dark){html{color:#f1ece2}}
            p{margin:.4em 0;text-align:center} a{color:inherit;font-weight:600}
            </style><body><p><b>\(title)</b></p><p>\(detail)</p><p><a href="\(link)">\(again)</a></p></body>
            """
    }

    /// WebKit's page process can be killed under memory pressure; bring the dashboard back.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        Log.error("Dashboard window: web content process ended, reloading")
        webView.reload()
    }

    /// Same origin as the dashboard (scheme, host and port), or a page WebKit makes up itself.
    static func isDashboard(_ target: URL, base: URL) -> Bool {
        if target.scheme == "about" { return true }
        return target.scheme == base.scheme && target.host == base.host && target.port == base.port
    }

    /// The dashboard address for the window: `base` with `?frame=mac`, pairing itself with `code`.
    static func url(base: URL, pairingCode code: String) -> URL? {
        guard var parts = URLComponents(url: base, resolvingAgainstBaseURL: false) else { return nil }
        if parts.path.isEmpty { parts.path = "/" }
        parts.queryItems = (parts.queryItems ?? []).filter { $0.name != "frame" } + [URLQueryItem(name: "frame", value: "mac")]
        parts.fragment = "pair=\(code)"
        return parts.url
    }
}

// MARK: - Helpers

/// The dashboard's two themes and the colour of its title bar and sidebar (`--chrome` in globals.css).
enum DashboardTheme: String {
    case light, dark

    var chrome: NSColor {
        switch self {
        case .light: return NSColor(srgbRed: 0xeb / 255, green: 0xe6 / 255, blue: 0xdb / 255, alpha: 1)
        case .dark: return NSColor(srgbRed: 0x0f / 255, green: 0x0e / 255, blue: 0x0c / 255, alpha: 1)
        }
    }

    /// The glass behind the title bar and sidebar takes the dashboard's theme, not the system's.
    var appearance: NSAppearance? { NSAppearance(named: self == .dark ? .darkAqua : .aqua) }
}

/// What double-clicking a title bar does, as chosen in System Settings › Desktop & Dock.
enum TitleBarDoubleClick: Equatable {
    case zoom, minimize, none

    static func current(defaults: UserDefaults) -> TitleBarDoubleClick {
        from(action: defaults.string(forKey: "AppleActionOnDoubleClick"), minimizeOnDoubleClick: defaults.object(forKey: "AppleMiniaturizeOnDoubleClick") as? Bool)
    }

    /// `AppleActionOnDoubleClick` is "Maximize", "Minimize" or "None"; older systems only set `AppleMiniaturizeOnDoubleClick`.
    static func from(action: String?, minimizeOnDoubleClick: Bool?) -> TitleBarDoubleClick {
        switch action {
        case "Minimize": return .minimize
        case "None": return .none
        case "Maximize": return .zoom
        default: return minimizeOnDoubleClick == true ? .minimize : .zoom
        }
    }
}

/// WKUserContentController keeps its handlers alive; this keeps the window from being one of them.
private final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    private weak var target: DashboardWindow?

    init(_ target: DashboardWindow) {
        self.target = target
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.receive(message.body)
    }
}
