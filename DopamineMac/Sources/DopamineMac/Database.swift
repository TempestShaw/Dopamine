import Foundation
import SQLite3

/// One "the foreground window changed" row. Field names match the Windows agent's JSON.
struct WindowActivity: Codable, Equatable {
    let id: Int64
    let timestamp: Int64 // unix seconds
    let windowTitle: String
    let processName: String
}

/// What the agent remembers about an app: its icon and metadata used to categorise it.
struct StoredApp: Equatable {
    var png: Data?
    var hint: AppHint
}

enum Marker {
    static let process = "<Dopamine>"
    static let stopped = "<Stopped>"
    static let idle = "<Idle>"
}

/// Thin SQLite wrapper using the same schema as DopamineWin. All access goes through a serial queue.
final class Database {
    private var db: OpaquePointer?
    private let queue = DispatchQueue(label: "dopamine.database")
    private static let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

    init(url: URL) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        guard sqlite3_open_v2(url.path, &db, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK else {
            throw DatabaseError.open(String(cString: sqlite3_errmsg(db)))
        }
        try exec("PRAGMA journal_mode=WAL")
        try exec("""
            CREATE TABLE IF NOT EXISTS WindowActivities (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Timestamp INTEGER NOT NULL,
                WindowTitle TEXT,
                ProcessName TEXT
            )
            """)
        try exec("CREATE INDEX IF NOT EXISTS IX_WindowActivities_Timestamp ON WindowActivities (Timestamp)")
        // Icon + metadata per process name, captured the first time the app is seen (same table on Windows).
        try exec("""
            CREATE TABLE IF NOT EXISTS AppInfo (
                ProcessName TEXT PRIMARY KEY,
                Png BLOB,
                Kind TEXT,
                Description TEXT,
                Publisher TEXT,
                Path TEXT,
                UpdatedAt INTEGER NOT NULL
            )
            """)
    }

    deinit {
        sqlite3_close(db)
    }

    private func exec(_ sql: String) throws {
        var err: UnsafeMutablePointer<CChar>?
        if sqlite3_exec(db, sql, nil, nil, &err) != SQLITE_OK {
            let message = err.map { String(cString: $0) } ?? "unknown error"
            sqlite3_free(err)
            throw DatabaseError.query(message)
        }
    }

    func insert(windowTitle: String, processName: String, at date: Date = Date()) {
        queue.async { [self] in
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            let sql = "INSERT INTO WindowActivities (Timestamp, WindowTitle, ProcessName) VALUES (?, ?, ?)"
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
            sqlite3_bind_int64(stmt, 1, Int64(date.timeIntervalSince1970))
            sqlite3_bind_text(stmt, 2, windowTitle, -1, Database.transient)
            sqlite3_bind_text(stmt, 3, processName, -1, Database.transient)
            if sqlite3_step(stmt) != SQLITE_DONE {
                Log.error("Insert failed: \(String(cString: sqlite3_errmsg(db)))")
            }
        }
    }

    /// Rows with `from <= Timestamp <= to`, oldest first.
    func activities(from: Int64, to: Int64) -> [WindowActivity] {
        queue.sync {
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            let sql = """
                SELECT Id, Timestamp, WindowTitle, ProcessName FROM WindowActivities
                WHERE Timestamp >= ? AND Timestamp <= ? ORDER BY Timestamp, Id
                """
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return [] }
            sqlite3_bind_int64(stmt, 1, from)
            sqlite3_bind_int64(stmt, 2, to)
            var rows: [WindowActivity] = []
            while sqlite3_step(stmt) == SQLITE_ROW {
                rows.append(WindowActivity(
                    id: sqlite3_column_int64(stmt, 0),
                    timestamp: sqlite3_column_int64(stmt, 1),
                    windowTitle: Database.text(stmt, 2),
                    processName: Database.text(stmt, 3)
                ))
            }
            return rows
        }
    }

    func saveApp(process: String, info: StoredApp) {
        queue.async { [self] in
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            let sql = """
                INSERT OR REPLACE INTO AppInfo (ProcessName, Png, Kind, Description, Publisher, Path, UpdatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
            sqlite3_bind_text(stmt, 1, process, -1, Database.transient)
            if let png = info.png {
                _ = png.withUnsafeBytes { sqlite3_bind_blob(stmt, 2, $0.baseAddress, Int32($0.count), Database.transient) }
            } else {
                sqlite3_bind_null(stmt, 2)
            }
            for (i, value) in [info.hint.kind, info.hint.description, info.hint.publisher, info.hint.path].enumerated() {
                if let value { sqlite3_bind_text(stmt, Int32(3 + i), value, -1, Database.transient) } else { sqlite3_bind_null(stmt, Int32(3 + i)) }
            }
            sqlite3_bind_int64(stmt, 7, Int64(Date().timeIntervalSince1970))
            if sqlite3_step(stmt) != SQLITE_DONE {
                Log.error("Saving app info failed: \(String(cString: sqlite3_errmsg(db)))")
            }
        }
    }

    /// Stored icon/metadata for the given process names; unknown names are left out.
    func apps(for processes: [String]) -> [String: StoredApp] {
        queue.sync {
            var out: [String: StoredApp] = [:]
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            let sql = "SELECT Png, Kind, Description, Publisher, Path FROM AppInfo WHERE ProcessName = ?"
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return out }
            for name in Set(processes) {
                sqlite3_reset(stmt)
                sqlite3_bind_text(stmt, 1, name, -1, Database.transient)
                guard sqlite3_step(stmt) == SQLITE_ROW else { continue }
                var png: Data?
                if let bytes = sqlite3_column_blob(stmt, 0) {
                    png = Data(bytes: bytes, count: Int(sqlite3_column_bytes(stmt, 0)))
                }
                func text(_ col: Int32) -> String? { sqlite3_column_text(stmt, col).map { String(cString: $0) } }
                out[name] = StoredApp(png: png, hint: AppHint(kind: text(1), description: text(2), publisher: text(3), path: text(4)))
            }
            return out
        }
    }

    /// Blocks until queued writes have been applied.
    func flush() {
        queue.sync {}
    }

    private static func text(_ stmt: OpaquePointer?, _ col: Int32) -> String {
        guard let c = sqlite3_column_text(stmt, col) else { return "" }
        return String(cString: c)
    }
}

enum DatabaseError: Error {
    case open(String)
    case query(String)
}
