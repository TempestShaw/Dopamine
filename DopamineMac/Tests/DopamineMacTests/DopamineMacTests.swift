import AppKit
import XCTest
@testable import DopamineMac

final class DopamineMacTests: XCTestCase {
    private var tmp: URL!

    override func setUpWithError() throws {
        tmp = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: tmp, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: tmp)
    }

    func testParsesRequestsIncrementally() {
        let raw = "PUT /settings?x=1 HTTP/1.1\r\nAuthorization: Bearer ABC123\r\nContent-Length: 4\r\n\r\n{\"a\""
        XCTAssertNil(HTTPRequest.parse(Data(raw.dropLast(2).utf8)))
        let req = HTTPRequest.parse(Data(raw.utf8))
        XCTAssertEqual(req?.method, "PUT")
        XCTAssertEqual(req?.path, "/settings")
        XCTAssertEqual(req?.query["x"], "1")
        XCTAssertEqual(req?.headers["authorization"], "Bearer ABC123")
        XCTAssertEqual(req?.body.count, 4)
    }

    func testDatabaseRoundTrip() throws {
        let db = try Database(url: tmp.appendingPathComponent("t.db"))
        db.insert(windowTitle: "a.swift", processName: "Xcode", at: Date(timeIntervalSince1970: 100))
        db.insert(windowTitle: "YouTube", processName: "Safari", at: Date(timeIntervalSince1970: 200))
        db.flush()
        let rows = db.activities(from: 0, to: 150)
        XCTAssertEqual(rows.count, 1)
        XCTAssertEqual(rows.first?.processName, "Xcode")
    }

    func testAppInfoRoundTrip() throws {
        let db = try Database(url: tmp.appendingPathComponent("t.db"))
        let png = try XCTUnwrap(AppIcons.png(from: NSImage(size: NSSize(width: 8, height: 8))))
        let app = StoredApp(png: png, hint: AppHint(kind: "public.app-category.developer-tools", description: "Xcode", path: "/Applications/Xcode.app"))
        db.saveApp(process: "Xcode", info: app)
        db.flush()
        XCTAssertEqual(db.apps(for: ["Xcode", "Missing"]), ["Xcode": app])
    }

    func testDaySummary() {
        let rows = [
            WindowActivity(id: 1, timestamp: 1000, windowTitle: "main.swift", processName: "Xcode"),
            WindowActivity(id: 2, timestamp: 1600, windowTitle: "YouTube", processName: "Safari"),
            WindowActivity(id: 3, timestamp: 1900, windowTitle: Marker.stopped, processName: Marker.process),
            WindowActivity(id: 4, timestamp: 5000, windowTitle: "Discord", processName: "Discord"),
        ]
        let s = DaySummary.compute(rows: rows, start: Date(timeIntervalSince1970: 0), end: Date(timeIntervalSince1970: 10_000), now: Date(timeIntervalSince1970: 5060))
        XCTAssertEqual(s.total, 600 + 300 + 60)
        XCTAssertEqual(s.byCategory[.work], 600)
        XCTAssertEqual(s.byCategory[.entertainment], 300)
        XCTAssertEqual(s.apps.first?.app, "Xcode")
        XCTAssertEqual(s.focus, 600)
    }

    func testBriefGlancesGoToPreviousWindow() {
        let rows = [
            WindowActivity(id: 1, timestamp: 1000, windowTitle: "main.swift", processName: "Xcode"),
            WindowActivity(id: 2, timestamp: 1600, windowTitle: "chat", processName: "Discord"),
            WindowActivity(id: 3, timestamp: 1603, windowTitle: "main.swift", processName: "Xcode"),
            WindowActivity(id: 4, timestamp: 2000, windowTitle: Marker.stopped, processName: Marker.process),
        ]
        let s = DaySummary.compute(rows: rows, start: Date(timeIntervalSince1970: 0), end: Date(timeIntervalSince1970: 10_000), now: Date(timeIntervalSince1970: 5000))
        XCTAssertEqual(s.apps.map(\.app), ["Xcode"])
        XCTAssertEqual(s.total, 1000)
    }

    // Mirrors cases from DopamineWeb/src/lib/__fixtures__/categorize-corpus.ts.
    func testHiddenAppsDropOutOfTheSummary() {
        let rows = [
            WindowActivity(id: 1, timestamp: 1000, windowTitle: "main.swift", processName: "Xcode"),
            WindowActivity(id: 2, timestamp: 1600, windowTitle: "Dopamine", processName: "Dopamine"),
            WindowActivity(id: 3, timestamp: 1700, windowTitle: "main.swift", processName: "Xcode"),
            WindowActivity(id: 4, timestamp: 2000, windowTitle: Marker.stopped, processName: Marker.process),
        ]
        let s = DaySummary.compute(
            rows: rows, start: Date(timeIntervalSince1970: 0), end: Date(timeIntervalSince1970: 10_000),
            now: Date(timeIntervalSince1970: 5000), hidden: StoredSettings.defaultHidden
        )
        XCTAssertEqual(s.total, 900) // the 100 s in Dopamine are not handed to Xcode
        XCTAssertEqual(s.apps.map(\.app), ["Xcode"])
        XCTAssertEqual(StoredSettings(pairingCode: "ABC123").hidden, ["Dopamine"])
    }

    func testLanguagesAndDurations() {
        XCTAssertEqual(Lang.from(["zh-Hans-CN", "en"]), .zhHans)
        XCTAssertEqual(Lang.from(["zh-Hant-TW"]), .zhHant)
        XCTAssertEqual(Lang.from(["zh-HK"]), .zhHant)
        XCTAssertEqual(Lang.from(["de-DE", "en-GB"]), .en)
        XCTAssertEqual(formatDuration(192 * 60, lang: .en), "3h 12m")
        XCTAssertEqual(formatDuration(192 * 60, lang: .zhHans), "3小时12分")
        XCTAssertEqual(formatDuration(45 * 60, lang: .zhHant), "45分鐘")
    }

    func testCategories() {
        XCTAssertEqual(Category.of(title: "Bilibili", app: "Google Chrome"), .entertainment)
        XCTAssertEqual(Category.of(title: "", app: "Xcode"), .work)
        XCTAssertEqual(Category.of(title: "New Tab", app: "Safari"), .other)
        XCTAssertEqual(Category.of(title: "Free Barcode Generator - Google Chrome", app: "chrome"), .other)
        XCTAssertEqual(Category.of(title: "C:\\Users\\me\\Code", app: "explorer"), .other)
        XCTAssertEqual(Category.of(title: "Dopamine – Main.java", app: "idea64"), .work)
        XCTAssertEqual(Category.of(title: "VALORANT", app: "VALORANT-Win64-Shipping"), .entertainment)
        XCTAssertEqual(Category.of(title: "zsh", app: "iTerm2"), .work)
        XCTAssertEqual(Category.of(title: "小红书 - 你的生活指南", app: "Google Chrome"), .social)
        XCTAssertEqual(Category.of(title: "Minecraft 1.20.1", app: "javaw"), .entertainment)
    }

    func testHintsCategoriseUnknownApps() {
        XCTAssertEqual(Category.of(title: "Balatro", app: "Balatro", hint: AppHint(kind: "public.app-category.card-games")), .entertainment)
        XCTAssertEqual(Category.of(title: "x", app: "Hollow Knight", hint: AppHint(path: "D:\\SteamLibrary\\steamapps\\common\\Hollow Knight")), .entertainment)
        XCTAssertEqual(Category.of(title: "x", app: "Ivory", hint: AppHint(kind: "public.app-category.social-networking")), .social)
        XCTAssertEqual(Category.of(title: "x", app: "SomeGame", hint: AppHint(publisher: "Valve Corporation")), .entertainment)
    }

    func testRulesLoaded() {
        XCTAssertFalse(CategoryRules.shared.apps.isEmpty)
        XCTAssertFalse(CategoryRules.shared.sites.isEmpty)
        XCTAssertTrue(CategoryRules.shared.browsers.contains("google chrome"))
    }

    func testAPIRequiresPairingCodeAndStaysInWebRoot() throws {
        let settings = SettingsStore(url: tmp.appendingPathComponent("config.json"))
        let db = try Database(url: tmp.appendingPathComponent("t.db"))
        let web = tmp.appendingPathComponent("web")
        try FileManager.default.createDirectory(at: web, withIntermediateDirectories: true)
        try Data("<html>".utf8).write(to: web.appendingPathComponent("index.html"))
        let api = API(database: db, settings: settings, webRoot: web)

        func get(_ path: String, code: String? = nil) -> HTTPResponse {
            var headers: [String: String] = [:]
            if let code { headers["authorization"] = "Bearer \(code)" }
            return api.handle(HTTPRequest(method: "GET", path: path, query: ["from": "0", "to": "1"], headers: headers, body: Data()))
        }

        XCTAssertEqual(get("/identify").status, 200)
        XCTAssertEqual(get("/titles").status, 401)
        XCTAssertEqual(get("/titles", code: "WRONG1").status, 401)
        XCTAssertEqual(get("/titles", code: settings.settings.pairingCode).status, 200)
        XCTAssertEqual(get("/").status, 200)
        XCTAssertEqual(get("/../config.json").status, 404)
        XCTAssertEqual(settings.settings.pairingCode.count, 6)

        let put = api.handle(HTTPRequest(
            method: "PUT", path: "/settings", query: [:],
            headers: ["authorization": "Bearer \(settings.settings.pairingCode)"],
            body: Data(#"{"hiddenApps":["Steam",""]}"#.utf8)
        ))
        XCTAssertEqual(put.status, 200)
        XCTAssertEqual(settings.settings.hidden, ["Steam"])

        let rules = api.handle(HTTPRequest(
            method: "PUT", path: "/settings", query: [:],
            headers: ["authorization": "Bearer \(settings.settings.pairingCode)"],
            body: Data(#"{"titleRules":{"CMU":"study","x":"nope"}}"#.utf8)
        ))
        XCTAssertEqual(rules.status, 200)
        XCTAssertEqual(settings.settings.titleRules, ["CMU": "study"])
        XCTAssertEqual(Category.fromTitleRules("cmu Database Systems", ["CMU": "study", "cmu database": "work"]), .work)
        XCTAssertNil(Category.fromTitleRules("YouTube", ["CMU": "study"]))
    }
}
