import Foundation

/// Menu bar text in English, Simplified or Traditional Chinese, matching the dashboard's
/// languages. Picked from the user's preferred languages, first match wins.
enum Lang {
    case en, zhHans, zhHant

    static let current: Lang = from(Locale.preferredLanguages)

    static func from(_ tags: [String]) -> Lang {
        for tag in tags {
            let t = tag.lowercased()
            if t.hasPrefix("zh") {
                let traditional = !t.contains("hans") && ["hant", "-tw", "-hk", "-mo"].contains { t.contains($0) }
                return traditional ? .zhHant : .zhHans
            }
            if t.hasPrefix("en") { return .en }
        }
        return .en
    }
}

/// The string for the current language: `L("Today", "今天", "今天")`.
func L(_ en: String, _ zhHans: String, _ zhHant: String, lang: Lang = Lang.current) -> String {
    switch lang {
    case .en: return en
    case .zhHans: return zhHans
    case .zhHant: return zhHant
    }
}
