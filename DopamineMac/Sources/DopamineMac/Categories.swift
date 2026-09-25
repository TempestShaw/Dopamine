import Foundation

// Swift port of DopamineWeb/src/lib/categories.ts, used for the menu bar summary. The rules
// themselves are shared: CategoryRules.swift embeds DopamineWeb/src/lib/category-rules.json.

enum Category: String, CaseIterable {
    case work, study, social, entertainment, other

    var label: String {
        switch self {
        case .work: return L("Work", "工作", "工作")
        case .study: return L("Study", "学习", "學習")
        case .social: return L("Social", "社交", "社交")
        case .entertainment: return L("Entertainment", "娱乐", "娛樂")
        case .other: return L("Other", "其他", "其他")
        }
    }

    var isProductive: Bool { self == .work || self == .study }

    /// The user's title rule a window falls under: longest matching keyword, any case. Mirrors
    /// matchTitleRule in DopamineWeb/src/lib/categories.ts.
    static func fromTitleRules(_ title: String, _ rules: [String: String]) -> Category? {
        guard !rules.isEmpty else { return nil }
        let t = title.lowercased()
        let best = rules.keys.filter { !$0.isEmpty && t.contains($0.lowercased()) }.max { $0.count < $1.count }
        return best.flatMap { rules[$0] }.flatMap(Category.init(rawValue:))
    }

    /// Same order of evidence as the web: browsers by site, then app name, then the app's own
    /// metadata, then the window title.
    static func of(title: String, app: String, hint: AppHint? = nil) -> Category {
        let rules = CategoryRules.shared
        let name = app.replacingOccurrences(of: #"\.(exe|app)$"#, with: "", options: [.regularExpression, .caseInsensitive]).lowercased()
        if rules.browsers.contains(name) { return rules.match(rules.sites, title) ?? .other }
        return rules.match(rules.apps, CategoryRules.haystack(app)) ?? rules.fromHint(hint) ?? rules.match(rules.sites, title) ?? .other
    }
}

/// Metadata read from the app itself (Info.plist on macOS), used for apps no rule knows.
struct AppHint: Codable, Equatable {
    var kind: String?
    var description: String?
    var publisher: String?
    var path: String?
}

struct CategoryRules {
    typealias RuleList = [(Category, NSRegularExpression)]

    static let shared = CategoryRules(json: categoryRulesJSON)

    let browsers: Set<String>
    let sites: RuleList
    let apps: RuleList
    let platformKinds: [String: Category]
    let gamePaths: NSRegularExpression
    let gamePublishers: NSRegularExpression

    init(json: String) {
        let obj = (try? JSONSerialization.jsonObject(with: Data(json.utf8))) as? [String: Any] ?? [:]
        func list(_ key: String) -> RuleList {
            ((obj[key] as? [[Any]]) ?? []).compactMap { entry in
                guard entry.count == 2, let name = entry[0] as? String, let category = Category(rawValue: name),
                      let keywords = entry[1] as? [String] else { return nil }
                return (category, CategoryRules.compile(keywords))
            }
        }
        browsers = Set((obj["browsers"] as? [String]) ?? [])
        sites = list("sites")
        apps = list("apps")
        platformKinds = ((obj["platformKinds"] as? [String: String]) ?? [:]).compactMapValues(Category.init(rawValue:))
        gamePaths = CategoryRules.compile((obj["gamePaths"] as? [String]) ?? [])
        gamePublishers = CategoryRules.compile((obj["gamePublishers"] as? [String]) ?? [])
    }

    /// Latin keywords must match whole words ("code" is not in "barcode"); others match anywhere.
    static func compile(_ keywords: [String]) -> NSRegularExpression {
        let parts = keywords.map { k -> String in
            let escaped = NSRegularExpression.escapedPattern(for: k)
            guard k.allSatisfy(\.isASCII) else { return escaped }
            let start = k.first.map { $0.isLetter || $0.isNumber } == true ? "(?<![a-z0-9])" : ""
            let end = k.last.map { $0.isLetter || $0.isNumber } == true ? "(?![a-z0-9])" : ""
            return start + escaped + end
        }
        let pattern = parts.isEmpty ? "(?!)" : parts.joined(separator: "|")
        // The keywords come from our own rules file, so a failure here is a bug worth crashing on in tests.
        return try! NSRegularExpression(pattern: pattern, options: [.caseInsensitive])
    }

    /// "idea64" → also "idea 64"; "LeagueClientUx" → also "league client ux".
    static func haystack(_ process: String) -> String {
        let raw = process
            .replacingOccurrences(of: #"\.(exe|app)$"#, with: "", options: [.regularExpression, .caseInsensitive])
            .replacingOccurrences(of: "[-_.]+", with: " ", options: .regularExpression)
        let digits = raw.replacingOccurrences(of: "([a-zA-Z])([0-9])", with: "$1 $2", options: .regularExpression)
        let camel = digits
            .replacingOccurrences(of: "([a-z])([A-Z])", with: "$1 $2", options: .regularExpression)
            .replacingOccurrences(of: "([A-Z]+)([A-Z][a-z])", with: "$1 $2", options: .regularExpression)
        return "\(raw) | \(digits) | \(camel)".lowercased()
    }

    func match(_ rules: RuleList, _ text: String) -> Category? {
        let range = NSRange(text.startIndex..., in: text)
        return rules.first { $0.1.firstMatch(in: text, range: range) != nil }?.0
    }

    private func matches(_ re: NSRegularExpression, _ text: String) -> Bool {
        re.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) != nil
    }

    func fromHint(_ hint: AppHint?) -> Category? {
        guard let hint else { return nil }
        if let kind = hint.kind?.lowercased() {
            if let c = platformKinds[kind] { return c }
            if kind.hasSuffix("-games") { return .entertainment }
        }
        if let path = hint.path, matches(gamePaths, path.replacingOccurrences(of: #"[\\/]+"#, with: " ", options: .regularExpression)) {
            return .entertainment
        }
        if let publisher = hint.publisher, matches(gamePublishers, publisher) { return .entertainment }
        for text in [hint.description, hint.publisher].compactMap({ $0 }) {
            if let c = match(apps, CategoryRules.haystack(text)), c != .other { return c }
        }
        return nil
    }
}

struct AppUsage: Identifiable {
    var id: String { app }
    let app: String
    let duration: TimeInterval
    let category: Category
}

struct DaySummary {
    var total: TimeInterval = 0
    var byCategory: [Category: TimeInterval] = [:]
    var apps: [AppUsage] = []

    var focus: TimeInterval { byCategory.filter { $0.key.isProductive }.values.reduce(0, +) }

    /// Longest a single row may count for, matching MAX_SEGMENT on the web.
    static let maxSegment: TimeInterval = 2 * 3600

    /// Windows in front for less than this are accidental; their time stays with the previous
    /// window. Matches MIN_DWELL on the web and TodaySummary.MinDwell on Windows.
    static let minDwell: TimeInterval = 5

    /// "Dopamine.app" and "dopamine" are the same app when matching the hidden list.
    static func hiddenKey(_ process: String) -> String {
        process.replacingOccurrences(of: #"\.(exe|app)$"#, with: "", options: [.regularExpression, .caseInsensitive]).lowercased()
    }

    /// Mirrors buildSegments + summarize on the web: each row lasts until the next one;
    /// marker rows end a segment; brief glances are merged back; everything is clipped to [start, end).
    /// Hidden apps are dropped after that, so their time isn't handed to the window before them.
    static func compute(
        rows: [WindowActivity], start: Date, end: Date, now: Date = Date(), hidden: [String] = [],
        classify: (_ title: String, _ process: String) -> Category = { Category.of(title: $0, app: $1) }
    ) -> DaySummary {
        let hiddenKeys = Set(hidden.map(hiddenKey))
        let nowSec = now.timeIntervalSince1970

        // First pass on unclipped times: drop glances, extending the window that was in front before.
        var kept: [(row: WindowActivity, start: TimeInterval, end: TimeInterval)] = []
        for (i, row) in rows.enumerated() where row.processName != Marker.process {
            let s = TimeInterval(row.timestamp)
            let hasNext = i + 1 < rows.count
            let next = hasNext ? TimeInterval(rows[i + 1].timestamp) : nowSec
            let e = min(next, s + maxSegment, nowSec)
            guard e > s else { continue }
            if hasNext && e - s < minDwell {
                if let last = kept.last, last.end == s { kept[kept.count - 1].end = e }
                continue
            }
            kept.append((row, s, e))
        }

        var summary = DaySummary()
        var perApp: [String: [Category: TimeInterval]] = [:]
        let lo = start.timeIntervalSince1970
        let hi = min(end, now).timeIntervalSince1970
        for item in kept where !hiddenKeys.contains(hiddenKey(item.row.processName)) {
            let d = min(item.end, hi) - max(item.start, lo)
            guard d > 0 else { continue }
            let category = classify(item.row.windowTitle, item.row.processName)
            summary.total += d
            summary.byCategory[category, default: 0] += d
            perApp[item.row.processName, default: [:]][category, default: 0] += d
        }

        summary.apps = perApp.map { app, cats in
            AppUsage(
                app: app,
                duration: cats.values.reduce(0, +),
                category: cats.max { $0.value < $1.value }?.key ?? .other
            )
        }.sorted { $0.duration > $1.duration }
        return summary
    }
}

/// "3h 12m", "3小时12分", "3小時12分": same units as the dashboard.
func formatDuration(_ seconds: TimeInterval, lang: Lang = Lang.current) -> String {
    let (h, m, mOnly, s, sep): (String, String, String, String, String) = {
        switch lang {
        case .en: return ("h", "m", "m", "s", " ")
        case .zhHans: return ("小时", "分", "分钟", "秒", "")
        case .zhHant: return ("小時", "分", "分鐘", "秒", "")
        }
    }()
    let minutes = Int(seconds / 60)
    if minutes < 1 { return seconds >= 1 ? "\(Int(seconds))\(s)" : "0\(mOnly)" }
    let hours = minutes / 60
    let rest = minutes % 60
    if hours == 0 { return "\(rest)\(mOnly)" }
    return rest == 0 ? "\(hours)\(h)" : "\(hours)\(h)\(sep)\(rest)\(m)"
}
