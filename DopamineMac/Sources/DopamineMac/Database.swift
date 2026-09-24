import Foundation
import SQLite3

/// One "the foreground window changed" row. Field names match the Windows agent's JSON.
struct WindowActivity: Codable, Equatable {
    let id: Int64
    let timestamp: Int64 // unix seconds
    let windowTitle: String
    let processName: String
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
