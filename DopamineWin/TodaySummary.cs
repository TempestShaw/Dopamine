using DopamineWin.Models;

namespace DopamineWin;

/// <summary>One app's share of today.</summary>
public readonly record struct AppUsage(string Process, string Name, long Seconds, Category Category);

/// <summary>
/// Today's screen time for the tray panel and menu. Mirrors the web dashboard's calculation: each
/// row lasts until the next one, marker rows (process "&lt;Dopamine&gt;") end a segment, a single row
/// never counts for more than two hours, glances under five seconds go to the window before, and
/// hidden apps drop out. Windows are categorised the same way as on the web (Categories.cs).
/// </summary>
public sealed record TodaySummary(long Total, long[] ByCategory, IReadOnlyList<AppUsage> Apps)
{
    private static readonly TimeSpan MaxSegment = TimeSpan.FromHours(2);

    /// <summary>
    /// Windows in front for less than this many seconds are accidental; their time stays with the
    /// previous window. Matches MIN_DWELL on the web and DaySummary.minDwell on macOS.
    /// </summary>
    public const long MinDwell = 5;

    public long Focus => ByCategory[(int)Category.Work] + ByCategory[(int)Category.Study];

    public static TodaySummary Compute(DatabaseService database, StoredSettings settings)
    {
        var now = DateTimeOffset.Now;
        var start = new DateTimeOffset(now.Date, now.Offset);
        var rows = database.GetActivities((start - MaxSegment).ToUnixTimeSeconds(), now.ToUnixTimeSeconds() + 60);
        var apps = database.GetApps(rows.Select(r => r.ProcessName).Distinct());
        return Compute(rows, start.ToUnixTimeSeconds(), now.ToUnixTimeSeconds(), settings, p => apps.GetValueOrDefault(p));
    }

    public static TodaySummary Compute(IReadOnlyList<WindowActivity> rows, long from, long now, StoredSettings settings, Func<string, StoredApp?> app)
    {
        var classify = Classifier(rows, settings, app);
        var hiddenKeys = settings.Hidden.Select(HiddenKey).ToHashSet();

        // First pass on unclipped times: drop glances, extending the window that was in front before.
        var kept = new List<(WindowActivity Row, long Start, long End)>();
        for (var i = 0; i < rows.Count; i++)
        {
            var row = rows[i];
            if (row.ProcessName == "<Dopamine>") continue;
            var hasNext = i + 1 < rows.Count;
            var next = hasNext ? rows[i + 1].Timestamp : now;
            var end = Math.Min(Math.Min(next, row.Timestamp + (long)MaxSegment.TotalSeconds), now);
            if (end <= row.Timestamp) continue;
            if (hasNext && end - row.Timestamp < MinDwell)
            {
                if (kept.Count > 0 && kept[^1].End == row.Timestamp) kept[^1] = kept[^1] with { End = end };
                continue;
            }

            kept.Add((row, row.Timestamp, end));
        }

        var byCategory = new long[Categories.All.Length];
        var perApp = new Dictionary<string, long[]>();
        long total = 0;
        foreach (var (row, start, end) in kept)
        {
            if (hiddenKeys.Contains(HiddenKey(row.ProcessName))) continue;
            var seconds = end - Math.Max(start, from);
            if (seconds <= 0) continue;
            var c = (int)classify(row.WindowTitle, row.ProcessName);
            total += seconds;
            byCategory[c] += seconds;
            if (!perApp.TryGetValue(row.ProcessName, out var cats)) perApp[row.ProcessName] = cats = new long[Categories.All.Length];
            cats[c] += seconds;
        }

        var apps = perApp
            .Select(p => new AppUsage(p.Key, Categories.DisplayApp(p.Key), p.Value.Sum(), (Category)Array.IndexOf(p.Value, p.Value.Max())))
            .OrderByDescending(a => a.Seconds)
            .ToList();
        return new TodaySummary(total, byCategory, apps);
    }

    /// <summary>
    /// The user's corrections first (a window sorted by hand, then title rules, then a choice for
    /// the whole app), then the rules and the title model. Same order as makeClassifier on the web.
    /// </summary>
    private static Func<string, string, Category> Classifier(IReadOnlyList<WindowActivity> rows, StoredSettings settings, Func<string, StoredApp?> app)
    {
        var labels = settings.TitleLabels;
        var rules = settings.TitleRules;
        var ruled = new List<(string, Category)>();
        if (rules.Count > 0)
        {
            foreach (var row in rows.DistinctBy(r => r.WindowTitle))
                if (Categories.FromTitleRules(row.WindowTitle, rules) is { } c) ruled.Add((Categories.CleanTitle(row.WindowTitle, row.ProcessName), c));
        }

        var model = Categories.Model(labels, rules, ruled);
        var cache = new Dictionary<(string, string), Category>();
        return (title, process) =>
        {
            if (cache.TryGetValue((title, process), out var hit)) return hit;
            var c = (labels.Count > 0 && labels.TryGetValue(Categories.CleanTitle(title, process), out var l) ? Categories.Parse(l) : null)
                ?? Categories.FromTitleRules(title, rules)
                ?? Categories.Parse(settings.CategoryOverrides.GetValueOrDefault(process))
                ?? Categories.Categorize(title, process, app(process), model);
            cache[(title, process)] = c;
            return c;
        };
    }

    /// <summary>"DopamineWin.exe" and "dopaminewin" are the same app when matching the hidden list.</summary>
    public static string HiddenKey(string process) =>
        (process.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) ? process[..^4] : process).ToLowerInvariant();

    /// <summary>"3h 12m", "45m", "30s" (or "3小时12分", "45分钟" …): same as formatDuration on the web.</summary>
    public static string Format(long seconds, Lang? lang = null)
    {
        var (h, m, mOnly, s, sep) = (lang ?? Strings.Current) switch
        {
            Lang.ZhHans => ("小时", "分", "分钟", "秒", ""),
            Lang.ZhHant => ("小時", "分", "分鐘", "秒", ""),
            _ => ("h", "m", "m", "s", " "),
        };
        var minutes = seconds / 60;
        if (minutes < 1) return seconds > 0 ? $"{seconds}{s}" : $"0{mOnly}";
        if (minutes < 60) return $"{minutes}{mOnly}";
        return minutes % 60 == 0 ? $"{minutes / 60}{h}" : $"{minutes / 60}{h}{sep}{minutes % 60}{m}";
    }
}
