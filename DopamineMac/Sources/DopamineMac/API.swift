import Foundation

let apiPort: UInt16 = 26535
let appVersion = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.6"

/// Routes compatible with DopamineWin's ApiServer, plus static hosting of the web dashboard.
final class API {
    private let database: Database
    private let settings: SettingsStore
    private let webRoot: URL?
    private let update: () -> Release?
    private let installUpdate: () -> Bool

    init(database: Database, settings: SettingsStore, webRoot: URL?, update: @escaping () -> Release? = { nil }, installUpdate: @escaping () -> Bool = { false }) {
        self.database = database
        self.settings = settings
        self.webRoot = webRoot
        self.update = update
        self.installUpdate = installUpdate
    }

    func handle(_ req: HTTPRequest) -> HTTPResponse {
        let origin = req.headers["origin"]
        guard LocalOnly.allows(host: req.headers["host"]), LocalOnly.allows(origin: origin) else { return .empty(403) }
        var res = route(req)
        // The dashboard is served from here, so only `bun dev` and the like ever call from another origin.
        if let origin {
            res.headers["Access-Control-Allow-Origin"] = origin
            res.headers["Vary"] = "Origin"
            res.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
            res.headers["Access-Control-Allow-Methods"] = "GET, PUT, POST, OPTIONS"
        }
        return res
    }

    private func route(_ req: HTTPRequest) -> HTTPResponse {
        if req.method == "OPTIONS" { return .empty(204) }

        switch req.path {
        case "/identify":
            var info: [String: Any] = ["name": "dopamine-mac", "version": appVersion, "settings": ConfigurableSettings.schemas]
            if let release = update() { info["update"] = ["version": release.version, "url": release.url.absoluteString, "automatic": true, "ready": release.ready] as [String: Any] }
            return .jsonObject(info)
        case "/pair", "/titles", "/settings", "/apps", "/forget", "/update":
            guard req.headers["authorization"] == "Bearer \(settings.settings.pairingCode)" else { return .empty(401) }
            return protected(req)
        default:
            return req.method == "GET" ? serveStatic(req.path) : .empty(404)
        }
    }

    private func protected(_ req: HTTPRequest) -> HTTPResponse {
        switch (req.method, req.path) {
        case ("GET", "/pair"):
            return .empty(200)
        case ("GET", "/titles"):
            guard let from = Int64(req.query["from"] ?? ""), let to = Int64(req.query["to"] ?? "") else { return .empty(400) }
            return .json(database.activities(from: from, to: to))
        case ("GET", "/apps"):
            let names = (req.query["names"] ?? "").split(separator: "\n").map(String.init).filter { !$0.isEmpty }
            return .jsonObject(apps(for: Array(names.prefix(200))))
        case ("GET", "/settings"):
            return .json(current())
        case ("PUT", "/settings"):
            guard let patch = try? JSONDecoder().decode(ConfigurableSettings.self, from: req.body) else { return .empty(400) }
            settings.update { s in
                if let v = patch.trackingInterval { s.trackingInterval = v }
                if let v = patch.idleTimeout { s.idleTimeout = v }
                if let v = patch.categoryOverrides { s.categoryOverrides = v.filter { Category(rawValue: $0.value) != nil } }
                if let v = patch.hiddenApps { s.hiddenApps = Array(v.filter { !$0.isEmpty && $0.count <= 256 }.prefix(500)) }
                if let v = patch.titleRules { s.titleRules = TitleRule.sanitized(v) }
                if let v = patch.checkForUpdates { s.checkForUpdates = v }
            }
            return .json(current())
        case ("POST", "/update"):
            return .empty(installUpdate() ? 202 : 409)
        case ("POST", "/forget"):
            guard let body = try? JSONDecoder().decode(ForgetRequest.self, from: req.body), body.ids.count <= API.maxForget else { return .empty(400) }
            return .jsonObject(["forgotten": database.forget(ids: body.ids)])
        default:
            return .empty(405)
        }
    }

    /// Larger requests are split by the dashboard; this keeps one request's transaction short.
    private static let maxForget = 50_000

    private struct ForgetRequest: Decodable {
        let ids: [Int64]
    }

    /// `{ processName: { icon: "data:image/png;base64,…", kind, description, publisher, path } }`.
    private func apps(for names: [String]) -> [String: [String: String]] {
        var found = database.apps(for: names)
        for name in names where found[name] == nil {
            // Apps seen before capture existed: try to find the bundle by name (AppKit on the main thread).
            let lookup = { AppIcons.capture(appNamed: name) }
            if let app = Thread.isMainThread ? lookup() : DispatchQueue.main.sync(execute: lookup) {
                database.saveApp(process: name, info: app)
                found[name] = app
            }
        }
        return found.mapValues { app in
            var out: [String: String] = [:]
            if let png = app.png { out["icon"] = "data:image/png;base64,\(png.base64EncodedString())" }
            out["kind"] = app.hint.kind
            out["description"] = app.hint.description
            out["publisher"] = app.hint.publisher
            out["path"] = app.hint.path
            return out
        }
    }

    private func current() -> ConfigurableSettings {
        let s = settings.settings
        return ConfigurableSettings(
            trackingInterval: s.trackingInterval, idleTimeout: s.idleTimeout, categoryOverrides: s.categoryOverrides,
            hiddenApps: s.hidden, titleRules: s.titleRules, checkForUpdates: s.checkForUpdates
        )
    }

    // MARK: Static dashboard

    private static let contentTypes = [
        "html": "text/html; charset=utf-8", "js": "text/javascript; charset=utf-8", "css": "text/css; charset=utf-8",
        "json": "application/json", "svg": "image/svg+xml", "png": "image/png", "ico": "image/x-icon",
        "woff2": "font/woff2", "txt": "text/plain; charset=utf-8", "map": "application/json",
    ]

    private func serveStatic(_ path: String) -> HTTPResponse {
        guard let root = webRoot else {
            let html = """
                <!doctype html><meta charset="utf-8"><title>Dopamine</title>
                <body style="font:15px -apple-system;padding:40px;max-width:560px">
                <h2>Dopamine is running</h2>
                <p>The dashboard files aren't bundled with this build. Run <code>bun run build</code> in
                <code>DopamineWeb</code> and restart, or run <code>bun dev</code> there and open
                <a href="http://localhost:3000">localhost:3000</a>.</p>
                """
            return HTTPResponse(status: 200, headers: ["Content-Type": "text/html; charset=utf-8"], body: Data(html.utf8))
        }

        var relative = path
        if relative.hasSuffix("/") { relative += "index.html" }
        let file = root.appendingPathComponent(String(relative.drop(while: { $0 == "/" }))).standardizedFileURL
        // Refuse anything that escapes the web root (e.g. "/../config.json").
        guard file.path.hasPrefix(root.standardizedFileURL.path + "/") else { return .empty(404) }

        var isDir: ObjCBool = false
        var target = file
        if FileManager.default.fileExists(atPath: target.path, isDirectory: &isDir), isDir.boolValue {
            target = target.appendingPathComponent("index.html")
        }
        guard let data = try? Data(contentsOf: target) else { return .empty(404) }

        let type = API.contentTypes[target.pathExtension.lowercased()] ?? "application/octet-stream"
        let cache = target.path.contains("/_next/static/") ? "public, max-age=31536000, immutable" : "no-cache"
        return HTTPResponse(status: 200, headers: ["Content-Type": type, "Cache-Control": cache], body: data)
    }

    /// Where the built dashboard (DopamineWeb/out) lives: inside the app bundle, or next to the repo when running `swift run`.
    static func locateWebRoot() -> URL? {
        var candidates: [URL] = []
        if let env = ProcessInfo.processInfo.environment["DOPAMINE_WEB_DIR"] { candidates.append(URL(fileURLWithPath: env)) }
        if let res = Bundle.main.resourceURL { candidates.append(res.appendingPathComponent("web")) }
        let exe = URL(fileURLWithPath: CommandLine.arguments[0]).resolvingSymlinksInPath().deletingLastPathComponent()
        candidates.append(exe.appendingPathComponent("../../../../DopamineWeb/out"))
        candidates.append(URL(fileURLWithPath: FileManager.default.currentDirectoryPath).appendingPathComponent("../DopamineWeb/out"))
        return candidates
            .map { $0.standardizedFileURL }
            .first { FileManager.default.fileExists(atPath: $0.appendingPathComponent("index.html").path) }
    }
}
