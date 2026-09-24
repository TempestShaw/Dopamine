using DopamineWin.Models;

namespace DopamineWin;

/// <summary>
/// Today's screen time for the tray menu. Mirrors the web dashboard's calculation: each row lasts
/// until the next one, marker rows (process "&lt;Dopamine&gt;") end a segment, and a single row
/// never counts for more than two hours.
/// </summary>
public record TodaySummary(TimeSpan Total, IReadOnlyList<(string Process, TimeSpan Duration)> TopApps)
{
    private static readonly TimeSpan MaxSegment = TimeSpan.FromHours(2);

    public static TodaySummary Compute(DatabaseService database)
    {
        var now = DateTimeOffset.Now;
        var start = new DateTimeOffset(now.Date, now.Offset);
        var rows = database.GetActivities((start - MaxSegment).ToUnixTimeSeconds(), now.ToUnixTimeSeconds() + 60);
        return Compute(rows, start.ToUnixTimeSeconds(), now.ToUnixTimeSeconds());
    }

    /// <summary>
    /// Windows in front for less than this many seconds are accidental; their time stays with the
    /// previous window. Matches MIN_DWELL on the web and DaySummary.minDwell on macOS.
    /// </summary>
    public const long MinDwell = 5;

    public static TodaySummary Compute(IReadOnlyList<WindowActivity> rows, long from, long now)
    {
        // First pass on unclipped times: drop glances, extending the window that was in front before.
        var kept = new List<(string Process, long Start, long End)>();
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

            kept.Add((row.ProcessName, row.Timestamp, end));
        }

        var perApp = new Dictionary<string, long>();
        long total = 0;
        foreach (var (process, start, end) in kept)
        {
            var seconds = end - Math.Max(start, from);
            if (seconds <= 0) continue;
            total += seconds;
            perApp[process] = perApp.GetValueOrDefault(process) + seconds;
        }

        var top = perApp.OrderByDescending(p => p.Value).Take(3)
            .Select(p => (p.Key, TimeSpan.FromSeconds(p.Value))).ToList();
        return new TodaySummary(TimeSpan.FromSeconds(total), top);
    }

    public static string Format(TimeSpan t)
    {
        var minutes = (int)t.TotalMinutes;
        if (minutes < 60) return $"{minutes}m";
        return minutes % 60 == 0 ? $"{minutes / 60}h" : $"{minutes / 60}h {minutes % 60}m";
    }
}
