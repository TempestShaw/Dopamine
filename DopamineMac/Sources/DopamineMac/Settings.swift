import Foundation
import os

enum Log {
    private static let logger = Logger(subsystem: "app.dopamine.mac", category: "general")
    static func info(_ message: String) { logger.info("\(message, privacy: .public)") }
    static func error(_ message: String) { logger.error("\(message, privacy: .public)") }
}

enum Paths {
    static var supportDirectory: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return base.appendingPathComponent("Dopamine", isDirectory: true)
    }

    static var database: URL { supportDirectory.appendingPathComponent("dopamine.db") }
    static var config: URL { supportDirectory.appendingPathComponent("config.json") }
}

struct StoredSettings: Codable, Equatable {
    /// Required on protected API endpoints as `Authorization: Bearer <code>`.
    var pairingCode: String
    /// How often (ms) to check the frontmost window. App switches are also caught immediately.
    var trackingInterval: Int = 5000
    /// Seconds without keyboard/mouse input before time stops counting. 0 disables idle detection.
    var idleTimeout: Int = 300
    /// Shows today's total next to the menu bar icon.
    var showTimeInMenuBar: Bool = true
    /// The user's category choices, keyed by process name ("work", "study", …).
    var categoryOverrides: [String: String] = [:]
    /// "ask", "on" or "off": whether category choices are shared with the community (decided in the dashboard).
    var communitySharing: String = "ask"
    /// Random id sent with shared choices so one install counts once. Empty until sharing is turned on.
    var installId: String = ""
    /// Process names left out of every figure. nil until the user changes it, meaning `defaultHidden`.
    var hiddenApps: [String]?

    /// Dopamine's own popover and windows don't count as screen time unless the user asks.
    static let defaultHidden = ["Dopamine"]

    var hidden: [String] { hiddenApps ?? StoredSettings.defaultHidden }

    /// The user's rules for windows: a title containing the keyword (any case) counts as the category.
    var titleRules: [String: String] = [:]

    init(pairingCode: String) {
        self.pairingCode = pairingCode
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        pairingCode = try c.decode(String.self, forKey: .pairingCode)
        trackingInterval = try c.decodeIfPresent(Int.self, forKey: .trackingInterval) ?? 5000
        idleTimeout = try c.decodeIfPresent(Int.self, forKey: .idleTimeout) ?? 300
        showTimeInMenuBar = try c.decodeIfPresent(Bool.self, forKey: .showTimeInMenuBar) ?? true
        categoryOverrides = try c.decodeIfPresent([String: String].self, forKey: .categoryOverrides) ?? [:]
        communitySharing = try c.decodeIfPresent(String.self, forKey: .communitySharing) ?? "ask"
        installId = try c.decodeIfPresent(String.self, forKey: .installId) ?? ""
        hiddenApps = try c.decodeIfPresent([String].self, forKey: .hiddenApps)
        titleRules = try c.decodeIfPresent([String: String].self, forKey: .titleRules) ?? [:]
    }

    static func generatePairingCode(length: Int = 6) -> String {
        let allowed = Array("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
        var rng = SystemRandomNumberGenerator()
        return String((0..<length).map { _ in allowed[Int(rng.next(upperBound: UInt(allowed.count)))] })
    }
}

/// The settings a paired dashboard may read and change, mirroring DopamineWin's ConfigurableSettings.
struct ConfigurableSettings: Codable {
    var trackingInterval: Int?
    var idleTimeout: Int?
    var categoryOverrides: [String: String]?
    var communitySharing: String?
    var installId: String?
    var hiddenApps: [String]?
    var titleRules: [String: String]?

    static let schemas: [[String: Any]] = [
        [
            "id": "trackingInterval", "name": "Tracking Interval", "type": "integer",
            "description": "The interval in milliseconds at which Dopamine should check for the active window.",
            "min": 100, "max": 3_600_000, "default": 5000,
        ],
        [
            "id": "idleTimeout", "name": "Idle Timeout", "type": "integer",
            "description": "Seconds without keyboard or mouse input before Dopamine stops counting time. 0 disables it.",
            "min": 0, "max": 7200, "default": 300,
        ],
    ]
}

final class SettingsStore {
    private let url: URL
    private let lock = NSLock()
    private var value: StoredSettings

    init(url: URL = Paths.config) {
        self.url = url
        if let data = try? Data(contentsOf: url), let loaded = try? JSONDecoder().decode(StoredSettings.self, from: data) {
            value = loaded
        } else {
            value = StoredSettings(pairingCode: StoredSettings.generatePairingCode())
            save()
        }
    }

    var settings: StoredSettings {
        lock.lock()
        defer { lock.unlock() }
        return value
    }

    func update(_ change: (inout StoredSettings) -> Void) {
        lock.lock()
        change(&value)
        value.trackingInterval = min(max(value.trackingInterval, 100), 3_600_000)
        value.idleTimeout = min(max(value.idleTimeout, 0), 7200)
        lock.unlock()
        save()
        NotificationCenter.default.post(name: .settingsChanged, object: nil)
    }

    private func save() {
        do {
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            try encoder.encode(settings).write(to: url, options: .atomic)
        } catch {
            Log.error("Failed to save settings: \(error)")
        }
    }
}

extension Notification.Name {
    static let settingsChanged = Notification.Name("DopamineSettingsChanged")
}
