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

    public static TodaySummary Compute(IReadOnlyList<WindowActivity> rows, long from, long now)
    {
        var perApp = new Dictionary<string, long>();
        long total = 0;
        for (var i = 0; i < rows.Count; i++)
        {
            var row = rows[i];
            if (row.ProcessName == "<Dopamine>") continue;
            var next = i + 1 < rows.Count ? rows[i + 1].Timestamp : now;
            var end = Math.Min(Math.Min(next, row.Timestamp + (long)MaxSegment.TotalSeconds), now);
            var seconds = end - Math.Max(row.Timestamp, from);
            if (seconds <= 0) continue;
            total += seconds;
            perApp[row.ProcessName] = perApp.GetValueOrDefault(row.ProcessName) + seconds;
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
