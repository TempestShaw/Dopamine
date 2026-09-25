using System.Reflection;
using System.Text;
using System.Text.Json;
using DopamineWin.Models;

namespace DopamineWin;

public enum Category
{
    Work,
    Study,
    Social,
    Entertainment,
    Other,
}

/// <summary>
/// Port of DopamineWeb/src/lib/categories.ts and nlp.ts, for the tray panel. The rules and seed
/// titles are the same file (category-rules.json, embedded). Keywords are matched with plain string
/// search instead of Regex so the native exe stays small; `--selftest` checks it agrees with the web.
/// </summary>
public static class Categories
{
    public static readonly Category[] All = [Category.Work, Category.Study, Category.Social, Category.Entertainment, Category.Other];

    public static string Key(Category c) => c.ToString().ToLowerInvariant();

    public static Category? Parse(string? key) => key switch
    {
        "work" => Category.Work,
        "study" => Category.Study,
        "social" => Category.Social,
        "entertainment" => Category.Entertainment,
        "other" => Category.Other,
        _ => null,
    };

    public static bool IsProductive(Category c) => c is Category.Work or Category.Study;

    private sealed record Rules(
        HashSet<string> Browsers,
        List<(Category, Keywords)> Sites,
        Keywords AnySite,
        List<(Category, Keywords)> Apps,
        Keywords MixedApps,
        Dictionary<string, Category> PlatformKinds,
        Keywords GamePaths,
        Keywords GamePublishers,
        List<(Category, string)> Examples);

    private static readonly Lazy<Rules> Shared = new(Load);

    private static Rules Load()
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("category-rules.json")
            ?? throw new InvalidOperationException("category-rules.json is not embedded");
        using var doc = JsonDocument.Parse(stream);
        var root = doc.RootElement;

        static List<string> Strings(JsonElement e) => e.ValueKind == JsonValueKind.Array ? e.EnumerateArray().Select(x => x.GetString() ?? "").ToList() : [];
        List<(Category, Keywords)> RuleList(string name)
        {
            var list = new List<(Category, Keywords)>();
            if (!root.TryGetProperty(name, out var arr)) return list;
            foreach (var entry in arr.EnumerateArray())
            {
                if (Parse(entry[0].GetString()) is { } c) list.Add((c, new Keywords(Strings(entry[1]))));
            }

            return list;
        }

        JsonElement Prop(string name) => root.TryGetProperty(name, out var e) ? e : default;

        var sites = RuleList("sites");
        var kinds = new Dictionary<string, Category>();
        if (Prop("platformKinds") is { ValueKind: JsonValueKind.Object } k)
            foreach (var p in k.EnumerateObject())
                if (Parse(p.Value.GetString()) is { } c) kinds[p.Name] = c;

        var examples = new List<(Category, string)>();
        if (Prop("titleExamples") is { ValueKind: JsonValueKind.Object } ex)
            foreach (var p in ex.EnumerateObject())
                if (Parse(p.Name) is { } c) examples.AddRange(Strings(p.Value).Select(t => (c, t)));

        return new Rules(
            Strings(Prop("browsers")).ToHashSet(),
            sites,
            new Keywords(sites.SelectMany(s => s.Item2.Words)),
            RuleList("apps"),
            new Keywords(Strings(Prop("mixedApps"))),
            kinds,
            new Keywords(Strings(Prop("gamePaths"))),
            new Keywords(Strings(Prop("gamePublishers"))),
            examples);
    }

    private static Category? Match(List<(Category, Keywords)> rules, string text)
    {
        var lower = text.ToLowerInvariant();
        foreach (var (c, k) in rules)
            if (k.Matches(lower)) return c;
        return null;
    }

    private static string StripExtension(string process) =>
        process.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) || process.EndsWith(".app", StringComparison.OrdinalIgnoreCase) ? process[..^4] : process;

    public static bool IsBrowser(string process) => Shared.Value.Browsers.Contains(StripExtension(process).ToLowerInvariant());

    /// <summary>"idea64" → also "idea 64"; "LeagueClientUx" → also "league client ux".</summary>
    public static string Haystack(string process)
    {
        var raw = new StringBuilder();
        foreach (var ch in StripExtension(process))
        {
            if (ch is '-' or '_' or '.')
            {
                if (raw.Length == 0 || raw[^1] != ' ') raw.Append(' ');
            }
            else
            {
                raw.Append(ch);
            }
        }

        var digits = new StringBuilder();
        for (var i = 0; i < raw.Length; i++)
        {
            if (i > 0 && char.IsAsciiDigit(raw[i]) && char.IsAsciiLetter(raw[i - 1])) digits.Append(' ');
            digits.Append(raw[i]);
        }

        var d = digits.ToString();
        var camel = new StringBuilder();
        for (var i = 0; i < d.Length; i++)
        {
            var c = d[i];
            if (i > 0 && char.IsAsciiLetterUpper(c))
            {
                var prev = d[i - 1];
                var next = i + 1 < d.Length ? d[i + 1] : '\0';
                if (char.IsAsciiLetterLower(prev) || (char.IsAsciiLetterUpper(prev) && char.IsAsciiLetterLower(next))) camel.Append(' ');
            }

            camel.Append(c);
        }

        return $"{raw} | {d} | {camel}".ToLowerInvariant();
    }

    private static Category? FromHint(StoredApp? hint)
    {
        if (hint == null) return null;
        var rules = Shared.Value;
        if (hint.Kind is { } kind)
        {
            var k = kind.ToLowerInvariant();
            if (rules.PlatformKinds.TryGetValue(k, out var c)) return c;
            if (k.EndsWith("-games", StringComparison.Ordinal)) return Category.Entertainment;
        }

        if (hint.Path is { } path && rules.GamePaths.Matches(path.Replace('\\', ' ').Replace('/', ' ').ToLowerInvariant())) return Category.Entertainment;
        if (hint.Publisher is { } publisher && rules.GamePublishers.Matches(publisher.ToLowerInvariant())) return Category.Entertainment;
        foreach (var text in new[] { hint.Description, hint.Publisher })
        {
            if (text != null && Match(rules.Apps, Haystack(text)) is { } c && c != Category.Other) return c;
        }

        return null;
    }

    private const double MinConfidence = 0.6;
    private const double Sure = 0.8;

    /// <summary>Same order of evidence as `categorize` on the web.</summary>
    public static Category Categorize(string title, string process, StoredApp? hint, TitleModel model)
    {
        var rules = Shared.Value;
        TitleModel.Guess? Read(string text) => model.Classify(CleanTitle(text, process));

        var browser = IsBrowser(process);
        var haystack = Haystack(process);
        var byName = Match(rules.Apps, haystack);

        // Note apps and AI chats are used for anything; the page or chat title says what.
        if (!browser && byName == null && rules.MixedApps.Matches(haystack))
        {
            var g = Read(title);
            return g is { } m && m.P >= MinConfidence ? m.Category : FromHint(hint) ?? Category.Other;
        }

        var known = browser ? Match(rules.Sites, title) : byName ?? FromHint(hint) ?? Match(rules.Sites, title);

        // Video sites carry lectures and talks as well as entertainment: read the title without the platform's name.
        if (known == Category.Entertainment && browser)
        {
            if (Read(rules.AnySite.RemoveAll(title.ToLowerInvariant())) is { } g && g.Category is Category.Study or Category.Work && g.P >= Sure) return g.Category;
        }

        if (known is { } k) return k;
        return Read(title) is { } guess && guess.P >= MinConfidence ? guess.Category : Category.Other;
    }

    /// <summary>The seed model, or one that also learned from the user's labelled windows and title rules.</summary>
    public static TitleModel Model(IReadOnlyDictionary<string, string> labels, IReadOnlyDictionary<string, string> rules, IEnumerable<(string Title, Category Category)> ruledTitles)
    {
        var model = new TitleModel();
        foreach (var (c, t) in Shared.Value.Examples) model.Add(t, c);
        foreach (var (t, name) in labels)
            if (Parse(name) is { } c) model.Add(t, c, 3);
        foreach (var (t, name) in rules)
            if (Parse(name) is { } c) model.Add(t, c, 3);
        foreach (var (t, c) in ruledTitles) model.Add(t, c);
        return model;
    }

    /// <summary>The user's rule a title falls under: longest keyword it contains, any case.</summary>
    public static Category? FromTitleRules(string title, IReadOnlyDictionary<string, string> rules)
    {
        if (rules.Count == 0) return null;
        var t = title.ToLowerInvariant();
        string? best = null;
        foreach (var k in rules.Keys)
            if (k.Length > 0 && t.Contains(k.ToLowerInvariant(), StringComparison.Ordinal) && (best == null || k.Length > best.Length)) best = k;
        return best == null ? null : Parse(rules[best]);
    }

    private static readonly string[] BrowserSuffixes =
        ["Google Chrome", "Microsoft​ Edge", "Microsoft​Edge", "Microsoft Edge", "MicrosoftEdge", "Mozilla Firefox", "Safari", "Visual Studio Code", "Brave", "Arc", "Opera"];

    /// <summary>Mirrors cleanTitle on the web ("Doc - Google Chrome" → "Doc").</summary>
    public static string CleanTitle(string title, string process)
    {
        var t = title.Trim();
        if (t.Length == 0) return DisplayApp(process);
        foreach (var suffix in BrowserSuffixes)
        {
            if (StripSuffix(t, suffix, "-–—|") is { } stripped)
            {
                t = stripped;
                break;
            }
        }

        foreach (var suffix in new[] { "Personal", "Work" })
        {
            if (StripSuffix(t, suffix, "-") is { } stripped)
            {
                t = stripped;
                break;
            }
        }

        // "… - Profile 2"
        var profile = t.LastIndexOf("Profile ", StringComparison.OrdinalIgnoreCase);
        if (profile > 0 && t.Length > profile + 8 && t[(profile + 8)..].All(char.IsAsciiDigit) && StripSuffix(t, t[profile..], "-") is { } p) t = p;

        var isPath = (t.Length >= 3 && char.IsAsciiLetter(t[0]) && t[1] == ':' && t[2] == '\\') || t.StartsWith('/');
        if (isPath && !t.Contains(" - ", StringComparison.Ordinal))
        {
            var parts = t.Split('\\', '/', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length > 0) t = parts[^1];
        }

        return t;
    }

    /// <summary>Removes "&lt;spaces&gt;&lt;separator&gt;&lt;spaces&gt;&lt;suffix&gt;" from the end (case-insensitive), or null.</summary>
    private static string? StripSuffix(string t, string suffix, string separators)
    {
        if (!t.EndsWith(suffix, StringComparison.OrdinalIgnoreCase)) return null;
        var i = t.Length - suffix.Length;
        var j = i;
        while (j > 0 && char.IsWhiteSpace(t[j - 1])) j--;
        if (j == i || j == 0 || !separators.Contains(t[j - 1])) return null;
        var k = j - 1;
        var end = k;
        while (k > 0 && char.IsWhiteSpace(t[k - 1])) k--;
        return k == end ? null : t[..k];
    }

    private static readonly Dictionary<string, string> AppNames = new()
    {
        ["chrome"] = "Chrome", ["msedge"] = "Edge", ["firefox"] = "Firefox", ["explorer"] = "File Explorer", ["code"] = "VS Code",
        ["devenv"] = "Visual Studio", ["windowsterminal"] = "Terminal", ["winword"] = "Word", ["excel"] = "Excel",
        ["powerpnt"] = "PowerPoint", ["outlook"] = "Outlook", ["ms-teams"] = "Teams", ["teams"] = "Teams",
        ["applicationframehost"] = "Windows App", ["searchhost"] = "Windows Search", ["shellexperiencehost"] = "Windows Shell",
        ["lockapp"] = "Lock Screen", ["finder"] = "Finder", ["dopaminewin"] = "Dopamine",
    };

    /// <summary>Mirrors displayApp on the web ("msedge" → "Edge", "vivaldi" → "Vivaldi").</summary>
    public static string DisplayApp(string process)
    {
        if (AppNames.TryGetValue(process.ToLowerInvariant(), out var known)) return known;
        return process.Length > 0 ? char.ToUpperInvariant(process[0]) + process[1..] : "Unknown";
    }

    /// <summary>
    /// A set of keywords matched the way category-rules.json intends: case-insensitive; Latin keywords
    /// only on word boundaries ("code" is not in "barcode"), others anywhere. Text must be lower case.
    /// </summary>
    private sealed class Keywords
    {
        public readonly string[] Words;

        public Keywords(IEnumerable<string> words) => Words = words.Where(w => w.Length > 0).Select(w => w.ToLowerInvariant()).ToArray();

        public bool Matches(string text)
        {
            foreach (var w in Words)
                if (Find(text, w, 0) >= 0) return true;
            return false;
        }

        /// <summary>The text with every keyword replaced by a space.</summary>
        public string RemoveAll(string text)
        {
            foreach (var w in Words)
            {
                int i;
                while ((i = Find(text, w, 0)) >= 0) text = string.Concat(text.AsSpan(0, i), " ", text.AsSpan(i + w.Length));
            }

            return text;
        }

        private static bool IsWordChar(char c) => char.IsAsciiLetterOrDigit(c);

        private static int Find(string text, string word, int from)
        {
            var ascii = word.All(char.IsAscii);
            var i = from;
            while ((i = text.IndexOf(word, i, StringComparison.Ordinal)) >= 0)
            {
                if (!ascii) return i;
                var startOk = !IsWordChar(word[0]) || i == 0 || !IsWordChar(text[i - 1]);
                var end = i + word.Length;
                var endOk = !IsWordChar(word[^1]) || end == text.Length || !IsWordChar(text[end]);
                if (startOk && endOk) return i;
                i++;
            }

            return -1;
        }
    }
}

/// <summary>Port of TitleModel in DopamineWeb/src/lib/nlp.ts: naive Bayes over words and CJK character pairs.</summary>
public sealed class TitleModel
{
    public readonly record struct Guess(Category Category, double P);

    private static readonly HashSet<string> Stop = ["the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "by", "at", "is", "are", "my", "your", "how", "what", "new"];
    private readonly Dictionary<string, double[]> _counts = new();
    private readonly double[] _totals = new double[5];

    public void Add(string text, Category category, double weight = 1)
    {
        var c = (int)category;
        foreach (var tok in Tokenize(text))
        {
            if (!_counts.TryGetValue(tok, out var row)) _counts[tok] = row = new double[5];
            row[c] += weight;
            _totals[c] += weight;
        }
    }

    /// <summary>The likeliest category, or null when the title shares no word with anything learned. Priors are uniform.</summary>
    public Guess? Classify(string text)
    {
        const double alpha = 0.1;
        double vocab = _counts.Count;
        var scores = new double[5];
        var known = 0;
        foreach (var tok in Tokenize(text))
        {
            if (!_counts.TryGetValue(tok, out var row)) continue;
            known++;
            for (var c = 0; c < 5; c++) scores[c] += Math.Log((row[c] + alpha) / (_totals[c] + alpha * vocab));
        }

        if (known == 0) return null;
        var max = scores.Max();
        var sum = 0.0;
        var best = 0;
        for (var c = 0; c < 5; c++)
        {
            scores[c] = Math.Exp(scores[c] - max);
            sum += scores[c];
            if (scores[c] > scores[best]) best = c;
        }

        return new Guess((Category)best, scores[best] / sum);
    }

    /// <summary>"Python 零基础入门" → ["python", "零基", "基础", "础入", "入门"].</summary>
    public static List<string> Tokenize(string text)
    {
        var s = Fold(text).ToLowerInvariant();
        var out_ = new List<string>();
        var i = 0;
        while (i < s.Length)
        {
            if (!char.IsLetterOrDigit(s[i]))
            {
                i++;
                continue;
            }

            // A word: a letter or digit, then letters, digits and + # ' -
            var start = i++;
            while (i < s.Length && (char.IsLetterOrDigit(s[i]) || s[i] is '+' or '#' or '\'' or '-')) i++;
            var run = s[start..i];

            // Split it into Latin words and CJK runs ("mv音乐").
            var p = 0;
            while (p < run.Length)
            {
                var cjk = IsCjk(run[p]);
                var q = p + 1;
                while (q < run.Length && IsCjk(run[q]) == cjk) q++;
                var part = run[p..q];
                if (cjk)
                {
                    if (part.Length == 1) out_.Add(part);
                    for (var k = 0; k + 1 < part.Length; k++) out_.Add(part.Substring(k, 2));
                }
                else
                {
                    var w = part.TrimEnd('\'', '-');
                    if (w.Length > 1 && !Stop.Contains(w) && !w.All(char.IsAsciiDigit)) out_.Add(w);
                }

                p = q;
            }
        }

        return out_;
    }

    /// <summary>The part of NFKC that matters for titles: full-width letters, digits and spaces.</summary>
    private static string Fold(string text)
    {
        var chars = text.ToCharArray();
        for (var i = 0; i < chars.Length; i++)
        {
            if (chars[i] is >= '！' and <= '～') chars[i] = (char)(chars[i] - 0xFEE0);
            else if (chars[i] == '　') chars[i] = ' ';
        }

        return new string(chars);
    }

    private static bool IsCjk(char c) => c is (>= '぀' and <= 'ヿ') or (>= 'ㇰ' and <= 'ㇿ') or (>= '㐀' and <= '䶿')
        or (>= '一' and <= '鿿') or (>= '豈' and <= '﫿') or (>= 'ᄀ' and <= 'ᇿ') or (>= '㄰' and <= '㆏')
        or (>= '가' and <= '힯');
}
