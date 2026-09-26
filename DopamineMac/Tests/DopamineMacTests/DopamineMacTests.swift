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
    }

    func testForgetOverwritesRowsAndLeavesNoTraceOnDisk() throws {
        let url = tmp.appendingPathComponent("t.db")
        let db = try Database(url: url)
        db.insert(windowTitle: "Lectures", processName: "Arc", at: Date(timeIntervalSince1970: 100))
        db.insert(windowTitle: "very-private-title", processName: "Arc", at: Date(timeIntervalSince1970: 200))
        db.insert(windowTitle: Marker.stopped, processName: Marker.process, at: Date(timeIntervalSince1970: 300))
        db.flush()
        let ids = db.activities(from: 0, to: 1000).map(\.id)

        // Marker rows are left alone, so only the one real row counts.
        XCTAssertEqual(db.forget(ids: [ids[1], ids[2], 999]), 1)

        let rows = db.activities(from: 0, to: 1000)
        XCTAssertEqual(rows.map(\.windowTitle), ["Lectures", Marker.forgotten, Marker.stopped])
        XCTAssertEqual(rows[1].processName, Marker.process)
        XCTAssertEqual(rows[1].timestamp, 200, "the row keeps its place so the window before it doesn't absorb its time")

        for file in [url, URL(fileURLWithPath: url.path + "-wal")] {
            guard let bytes = try? Data(contentsOf: file) else { continue }
            XCTAssertNil(bytes.range(of: Data("very-private-title".utf8)), "\(file.lastPathComponent) still holds the title")
        }
    }

    func testForgetEndpoint() throws {
        let settings = SettingsStore(url: tmp.appendingPathComponent("config.json"))
        let db = try Database(url: tmp.appendingPathComponent("t.db"))
        db.insert(windowTitle: "secret", processName: "Arc", at: Date(timeIntervalSince1970: 100))
        db.flush()
        let api = API(database: db, settings: settings, webRoot: nil)
        func post(_ body: String, code: String?) -> HTTPResponse {
            var headers: [String: String] = [:]
            if let code { headers["authorization"] = "Bearer \(code)" }
            return api.handle(HTTPRequest(method: "POST", path: "/forget", query: [:], headers: headers, body: Data(body.utf8)))
        }
        let id = try XCTUnwrap(db.activities(from: 0, to: 1000).first?.id)

        XCTAssertEqual(post(#"{"ids":[\#(id)]}"#, code: nil).status, 401)
        XCTAssertEqual(post(#"{"ids":"nope"}"#, code: settings.settings.pairingCode).status, 400)
        let ok = post(#"{"ids":[\#(id)]}"#, code: settings.settings.pairingCode)
        XCTAssertEqual(ok.status, 200)
        XCTAssertEqual(String(data: ok.body, encoding: .utf8), #"{"forgotten":1}"#)
        XCTAssertEqual(db.activities(from: 0, to: 1000).first?.windowTitle, Marker.forgotten)
        XCTAssertEqual(ok.headers["Access-Control-Allow-Methods"], "GET, PUT, POST, OPTIONS")
    }

    func testPauseLengths() {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "America/New_York")!
        let now = cal.date(from: DateComponents(year: 2026, month: 9, day: 26, hour: 22, minute: 10))!
        XCTAssertEqual(PauseLength.minutes15.end(from: now, calendar: cal), now.addingTimeInterval(15 * 60))
        XCTAssertEqual(PauseLength.hour1.end(from: now, calendar: cal), now.addingTimeInterval(3600))
        XCTAssertEqual(PauseLength.untilTomorrow.end(from: now, calendar: cal), cal.date(from: DateComponents(year: 2026, month: 9, day: 27)))
        XCTAssertNil(PauseLength.indefinitely.end(from: now, calendar: cal))
    }

    func testTimedPauseResumesByItself() throws {
        let settings = SettingsStore(url: tmp.appendingPathComponent("config.json"))
        let db = try Database(url: tmp.appendingPathComponent("t.db"))
        let tracker = Tracker(database: db, settings: settings)
        let start = Date()

        tracker.pause(until: start.addingTimeInterval(60))
        XCTAssertTrue(tracker.userPaused)
        tracker.resumeIfPauseEnded(now: start.addingTimeInterval(59))
        XCTAssertTrue(tracker.userPaused)
        tracker.resumeIfPauseEnded(now: start.addingTimeInterval(60))
        XCTAssertFalse(tracker.userPaused)
        XCTAssertNil(tracker.pausedUntil)

        tracker.pause(until: nil)
        tracker.resumeIfPauseEnded(now: start.addingTimeInterval(1_000_000))
        XCTAssertTrue(tracker.userPaused, "an open-ended pause waits for the user")
        tracker.resume()
        XCTAssertFalse(tracker.userPaused)
    }

    func testPluralKeywordsAndCourseCodes() {
        XCTAssertEqual(Category.of(title: "15-445/645 F'26 Lectures", app: "Arc"), .study)
        XCTAssertEqual(Category.of(title: "Assignments", app: "Arc"), .study)
        XCTAssertEqual(Category.of(title: "CS 61A Fall 2026 - Google Chrome", app: "Google Chrome"), .study)
        XCTAssertEqual(Category.of(title: "Order 12-345678 shipped", app: "Safari"), .other)
    }

    func testTitleRulesBeatTheAppChoiceAndStayInScope() {
        let rules = [
            TitleRule(contains: "bilibili", category: "entertainment", scope: TitleRule.browsers),
            TitleRule(contains: "15-213 lecture", category: "study", scope: TitleRule.browsers),
            TitleRule(contains: "readme", category: "study", scope: "Code"),
        ]
        XCTAssertEqual(TitleRule.category(in: rules, title: "15-213 Lecture 5 - bilibili", process: "Arc"), .study)
        XCTAssertEqual(TitleRule.category(in: rules, title: "凡人修仙传 - bilibili", process: "Google Chrome"), .entertainment)
        XCTAssertEqual(TitleRule.category(in: rules, title: "README.md", process: "Code.app"), .study)
        XCTAssertNil(TitleRule.category(in: rules, title: "README.md", process: "Zed"))
        XCTAssertNil(TitleRule.category(in: rules, title: "bilibili", process: "Preview"))
    }

    func testSettingsKeepOnlyValidTitleRules() throws {
        let settings = SettingsStore(url: tmp.appendingPathComponent("config.json"))
        let api = API(database: try Database(url: tmp.appendingPathComponent("t.db")), settings: settings, webRoot: nil)
        let body = #"{"titleRules":[{"contains":" Lectures ","category":"study","scope":"browsers"},{"contains":"","category":"work","scope":"x"},{"contains":"a","category":"nope","scope":"x"}],"checkForUpdates":false}"#
        let res = api.handle(HTTPRequest(method: "PUT", path: "/settings", query: [:], headers: ["authorization": "Bearer \(settings.settings.pairingCode)"], body: Data(body.utf8)))
        XCTAssertEqual(res.status, 200)
        XCTAssertEqual(settings.settings.titleRules, [TitleRule(contains: "Lectures", category: "study", scope: "browsers")])
        XCTAssertFalse(settings.settings.checkForUpdates)
    }

    func testReleaseParsing() {
        func json(_ tag: String) -> Data { Data(#"{"tag_name":"\#(tag)","html_url":"https://evil.example/"}"#.utf8) }
        XCTAssertEqual(
            UpdateChecker.release(from: json("v0.0.3"), current: "0.0.2"),
            Release(version: "0.0.3", url: URL(string: "https://github.com/TempestShaw/Dopamine/releases/tag/v0.0.3")!)
        )
        XCTAssertNil(UpdateChecker.release(from: json("v0.0.2"), current: "0.0.2"))
        XCTAssertNil(UpdateChecker.release(from: json("v0.0.1"), current: "0.0.2"))
        XCTAssertNil(UpdateChecker.release(from: json("v1.0.0-beta"), current: "0.0.2"))
        XCTAssertNil(UpdateChecker.release(from: Data("nope".utf8), current: "0.0.2"))
        XCTAssertTrue(UpdateChecker.isNewer("0.0.10", than: "0.0.9"))
        XCTAssertFalse(UpdateChecker.isNewer("0.1.0", than: "0.1.0"))
    }

    func testIdentifyMentionsANewRelease() throws {
        let settings = SettingsStore(url: tmp.appendingPathComponent("config.json"))
        let release = Release(version: "9.9.9", url: URL(string: "https://github.com/TempestShaw/Dopamine/releases/tag/v9.9.9")!)
        let api = API(database: try Database(url: tmp.appendingPathComponent("t.db")), settings: settings, webRoot: nil, update: { release })
        let res = api.handle(HTTPRequest(method: "GET", path: "/identify", query: [:], headers: [:], body: Data()))
        let obj = try XCTUnwrap(JSONSerialization.jsonObject(with: res.body) as? [String: Any])
        XCTAssertEqual(obj["update"] as? [String: String], ["version": "9.9.9", "url": "https://github.com/TempestShaw/Dopamine/releases/tag/v9.9.9"])
    }
}
