import Foundation

// Swift port of DopamineWeb/src/lib/categories.ts and the core of analytics.ts, used for the
// menu bar summary. Keep the rules in sync with the web version.

enum Category: String, CaseIterable {
    case work, study, social, entertainment, other

    var label: String {
        switch self {
        case .work: return "Work"
        case .study: return "Study"
        case .social: return "Social"
        case .entertainment: return "Entertainment"
        case .other: return "Other"
        }
    }

    var isProductive: Bool { self == .work || self == .study }

    private static let rules: [(Category, NSRegularExpression)] = ([
        (.entertainment, #"youtube|bilibili|netflix|twitch|prime video|disney\+|hulu|spotify|apple music|music\b|steam|epic games|battle\.net|minecraft|roblox|league of legends|genshin|tiktok|douyin|iqiyi|youku"#),
        (.social, #"discord|whatsapp|telegram|signal|wechat|weixin|\bqq\b|line\b|messenger|facebook|instagram|twitter|\bx\.com|reddit|weibo|xiaohongshu|threads|mastodon|bluesky"#),
        (.study, #"coursera|udemy|edx|khan academy|kindle|books\b|\.pdf|preview|acrobat|notion|obsidian|evernote|onenote|anki|quizlet|canvas|blackboard|moodle|gradescope|piazza|scholar|arxiv|researchgate|wikipedia|zotero|mendeley|overleaf|latex|wolfram|leetcode|duolingo"#),
        (.work, #"code|visual studio|xcode|intellij|webstorm|pycharm|goland|rider|clion|android studio|sublime|vim|emacs|cursor|zed|terminal|iterm|warp|powershell|cmd\b|windowsterminal|github|gitlab|bitbucket|jira|linear|confluence|slack|teams|zoom|meet\b|webex|outlook|mail\b|calendar|excel|powerpoint|winword|\bword\b|keynote|pages|numbers|figma|sketch|photoshop|illustrator|docker|postman|insomnia|tableplus|datagrip|dbeaver|chatgpt|claude|stack overflow|localhost"#),
    ] as [(Category, String)]).map { ($0.0, try! NSRegularExpression(pattern: $0.1, options: [.caseInsensitive])) }

    static func of(title: String, app: String) -> Category {
        let haystack = "\(title) \(app)"
        let range = NSRange(haystack.startIndex..., in: haystack)
        for (category, regex) in rules where regex.firstMatch(in: haystack, range: range) != nil {
            return category
        }
        return .other
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

    /// Mirrors buildSegments + summarize on the web: each row lasts until the next one;
    /// marker rows end a segment; everything is clipped to [start, end).
    static func compute(rows: [WindowActivity], start: Date, end: Date, now: Date = Date()) -> DaySummary {
        var summary = DaySummary()
        var perApp: [String: [Category: TimeInterval]] = [:]
        let lo = start.timeIntervalSince1970
        let hi = min(end, now).timeIntervalSince1970

        for (i, row) in rows.enumerated() where row.processName != Marker.process {
            let s = TimeInterval(row.timestamp)
            let next = i + 1 < rows.count ? TimeInterval(rows[i + 1].timestamp) : now.timeIntervalSince1970
            let e = min(next, s + maxSegment, now.timeIntervalSince1970)
            let d = min(e, hi) - max(s, lo)
            guard d > 0 else { continue }
            let category = Category.of(title: row.windowTitle, app: row.processName)
            summary.total += d
            summary.byCategory[category, default: 0] += d
            perApp[row.processName, default: [:]][category, default: 0] += d
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

func formatDuration(_ seconds: TimeInterval) -> String {
    let minutes = Int(seconds / 60)
    if minutes < 1 { return seconds >= 1 ? "\(Int(seconds))s" : "0m" }
    let h = minutes / 60
    let m = minutes % 60
    if h == 0 { return "\(m)m" }
    return m == 0 ? "\(h)h" : "\(h)h \(m)m"
}
