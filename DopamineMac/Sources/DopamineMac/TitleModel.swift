import Foundation

/// Port of DopamineWeb/src/lib/nlp.ts: naive Bayes over title words (Latin scripts) and character
/// pairs (Chinese, Japanese, Korean), trained from the seed examples in category-rules.json plus the
/// user's title rules. Keep the two in step; the tests on both sides share cases.
final class TitleModel {
    static let minConfidence = 0.6

    /// Trained on the seed examples only.
    static let seed: TitleModel = {
        let model = TitleModel()
        model.addSeed()
        return model
    }()

    private static let categories = Category.allCases
    private static let stop: Set<String> = ["the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "by", "at", "is", "are", "my", "your", "how", "what", "new"]
    private static let word = try! NSRegularExpression(pattern: #"[\p{L}\p{N}][\p{L}\p{N}+#'-]*"#)

    private var counts: [String: [Double]] = [:]
    private var totals = [Double](repeating: 0, count: Category.allCases.count)

    /// The seed plus what the user's rules teach: each keyword counts three times, and the titles it
    /// matched add the words around it.
    static func user(rules: [String: String], ruledTitles: [(String, Category)]) -> TitleModel {
        if rules.isEmpty { return seed }
        let model = TitleModel()
        model.addSeed()
        for (keyword, name) in rules { if let c = Category(rawValue: name) { model.add(keyword, c, weight: 3) } }
        for (title, c) in ruledTitles { model.add(title, c) }
        return model
    }

    private func addSeed() {
        for (c, titles) in CategoryRules.shared.titleExamples { for t in titles { add(t, c) } }
    }

    func add(_ text: String, _ category: Category, weight: Double = 1) {
        guard let c = TitleModel.categories.firstIndex(of: category) else { return }
        for tok in TitleModel.tokenize(text) {
            counts[tok, default: [Double](repeating: 0, count: TitleModel.categories.count)][c] += weight
            totals[c] += weight
        }
    }

    /// The likeliest category, or nil when the title shares no word with anything learned. Priors are uniform.
    func guess(_ text: String) -> (category: Category, p: Double)? {
        let alpha = 0.1
        let vocab = Double(counts.count)
        var scores = [Double](repeating: 0, count: TitleModel.categories.count)
        var known = 0
        for tok in TitleModel.tokenize(text) {
            guard let row = counts[tok] else { continue }
            known += 1
            for c in scores.indices { scores[c] += log((row[c] + alpha) / (totals[c] + alpha * vocab)) }
        }
        guard known > 0, let max = scores.max() else { return nil }
        let weights = scores.map { exp($0 - max) }
        let sum = weights.reduce(0, +)
        let best = weights.indices.max { weights[$0] < weights[$1] }!
        return (TitleModel.categories[best], weights[best] / sum)
    }

    /// "Python 零基础入门" → ["python", "零基", "基础", "础入", "入门"].
    static func tokenize(_ text: String) -> [String] {
        let lower = text.precomposedStringWithCompatibilityMapping.lowercased()
        var out: [String] = []
        for m in word.matches(in: lower, range: NSRange(lower.startIndex..., in: lower)) {
            guard let range = Range(m.range, in: lower) else { continue }
            // A run can mix scripts ("mv音乐"): split it into Latin words and CJK runs.
            var parts: [(text: [Character], cjk: Bool)] = []
            for ch in lower[range] {
                let cjk = isCJK(ch)
                if let last = parts.last, last.cjk == cjk { parts[parts.count - 1].text.append(ch) } else { parts.append(([ch], cjk)) }
            }
            for part in parts {
                if part.cjk {
                    // Pairs carry the meaning; a lone character only stands for itself.
                    if part.text.count == 1 { out.append(String(part.text)) }
                    if part.text.count > 1 { for i in 0..<(part.text.count - 1) { out.append(String(part.text[i...i + 1])) } }
                } else {
                    var w = String(part.text)
                    while let last = w.last, last == "'" || last == "-" { w.removeLast() }
                    if w.count > 1 && !stop.contains(w) && !w.allSatisfy({ $0.isASCII && $0.isNumber }) { out.append(w) }
                }
            }
        }
        return out
    }

    private static func isCJK(_ ch: Character) -> Bool {
        guard let v = ch.unicodeScalars.first?.value else { return false }
        switch v {
        case 0x3040...0x30FF, 0x31F0...0x31FF, // Hiragana, Katakana
             0x3400...0x4DBF, 0x4E00...0x9FFF, 0xF900...0xFAFF, 0x20000...0x2EBEF, // Han
             0x1100...0x11FF, 0x3130...0x318F, 0xAC00...0xD7AF: // Hangul
            return true
        default:
            return false
        }
    }
}

/// Strips what browsers add to a page title ("Doc - Google Chrome" → "Doc"). Mirrors cleanTitle on the web.
func cleanTitle(_ title: String) -> String {
    var t = title.trimmingCharacters(in: .whitespaces)
    t = t.replacingOccurrences(
        of: #"\s+[-–—|]\s+(Google Chrome|Microsoft\x{200b}? ?Edge|Mozilla Firefox|Safari|Visual Studio Code|Brave|Arc|Opera)$"#,
        with: "", options: [.regularExpression, .caseInsensitive]
    )
    return t.replacingOccurrences(of: #"\s+-\s+(Personal|Work|Profile \d+)$"#, with: "", options: [.regularExpression, .caseInsensitive])
}
