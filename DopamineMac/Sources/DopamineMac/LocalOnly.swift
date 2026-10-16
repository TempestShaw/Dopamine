import Foundation

/// Who may talk to the local API: pages and tools on this computer, never a website open in a browser.
///
/// The listener is bound to loopback, but every website runs inside the user's browser, on this computer.
/// A foreign `Origin` is such a website; a foreign `Host` is DNS rebinding (a website's own name pointed
/// at 127.0.0.1 so the browser treats it as same-origin). Requests without the header (curl, scripts,
/// same-origin GETs) are let through; browsers always send `Host`, and `Origin` on every cross-origin call.
enum LocalOnly {
    private static let loopbackNames: Set<String> = ["localhost", "127.0.0.1", "[::1]"]

    /// `localhost`, `127.0.0.1:26535`, `[::1]:3000`, … or no header at all.
    static func allows(host: String?) -> Bool {
        guard let host else { return true }
        return isLoopback(hostAndPort: host.lowercased())
    }

    /// `http://localhost:3000`, `http://127.0.0.1:26535`, … or no header at all.
    static func allows(origin: String?) -> Bool {
        guard let origin else { return true }
        let prefix = "http://"
        guard origin.lowercased().hasPrefix(prefix) else { return false }
        return isLoopback(hostAndPort: String(origin.lowercased().dropFirst(prefix.count)))
    }

    private static func isLoopback(hostAndPort: String) -> Bool {
        let name: Substring
        let rest: Substring
        if hostAndPort.hasPrefix("["), let close = hostAndPort.firstIndex(of: "]") {
            name = hostAndPort[...close]
            rest = hostAndPort[hostAndPort.index(after: close)...]
        } else {
            let colon = hostAndPort.firstIndex(of: ":") ?? hostAndPort.endIndex
            name = hostAndPort[..<colon]
            rest = hostAndPort[colon...]
        }
        guard loopbackNames.contains(String(name)) else { return false }
        return rest.isEmpty || (rest.hasPrefix(":") && rest.count > 1 && rest.dropFirst().allSatisfy(\.isNumber))
    }
}
