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

    func testCategories() {
        XCTAssertEqual(Category.of(title: "Bilibili", app: "Google Chrome"), .entertainment)
        XCTAssertEqual(Category.of(title: "", app: "Xcode"), .work)
        XCTAssertEqual(Category.of(title: "New Tab", app: "Safari"), .other)
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
    }
}
