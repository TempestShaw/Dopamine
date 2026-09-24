using DopamineWin.Models;
using DopamineWin.Native;

namespace DopamineWin;

/// <summary>
/// The activity log and per-app info, in the same schema as the macOS agent. The tracker writes
/// while API requests read, so every call takes the same lock.
/// </summary>
public sealed class DatabaseService : IDisposable
{
    private readonly object _gate = new();
    private readonly Sqlite _db;
    private readonly Sqlite.Statement _insert;

    public DatabaseService()
    {
        _db = new Sqlite(AppInfo.DataFile("dopamine.db"));
        _db.Execute("""
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS WindowActivities (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Timestamp INTEGER NOT NULL,
                WindowTitle TEXT,
                ProcessName TEXT
            );
            CREATE INDEX IF NOT EXISTS IX_WindowActivities_Timestamp ON WindowActivities (Timestamp);
            CREATE TABLE IF NOT EXISTS AppInfo (
                ProcessName TEXT PRIMARY KEY,
                Png BLOB,
                Kind TEXT,
                Description TEXT,
                Publisher TEXT,
                Path TEXT,
                UpdatedAt INTEGER NOT NULL
            );
            """);
        _insert = _db.Prepare("INSERT INTO WindowActivities (Timestamp, WindowTitle, ProcessName) VALUES (?1, ?2, ?3)");
    }

    public void InsertActivity(string windowTitle, string processName, DateTimeOffset? at = null)
    {
        lock (_gate)
        {
            _insert.Reset();
            _insert.Bind(1, (at ?? DateTimeOffset.Now).ToUnixTimeSeconds()).Bind(2, windowTitle).Bind(3, processName).Run();
        }
    }

    /// <summary>Rows with <c>from &lt;= Timestamp &lt;= to</c>, oldest first.</summary>
    public List<WindowActivity> GetActivities(long from, long to)
    {
        var rows = new List<WindowActivity>();
        lock (_gate)
        {
            using var query = _db.Prepare(
                "SELECT Id, Timestamp, WindowTitle, ProcessName FROM WindowActivities WHERE Timestamp >= ?1 AND Timestamp <= ?2 ORDER BY Timestamp, Id");
            query.Bind(1, from).Bind(2, to);
            while (query.Step())
            {
                rows.Add(new WindowActivity
                {
                    Id = (int)query.Int64(0),
                    Timestamp = query.Int64(1),
                    WindowTitle = query.Text(2) ?? string.Empty,
                    ProcessName = query.Text(3) ?? string.Empty,
                });
            }
        }

        return rows;
    }

    public void SaveApp(string processName, StoredApp app)
    {
        lock (_gate)
        {
            using var upsert = _db.Prepare("""
                INSERT OR REPLACE INTO AppInfo (ProcessName, Png, Kind, Description, Publisher, Path, UpdatedAt)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                """);
            upsert.Bind(1, processName).Bind(2, app.Png).Bind(3, app.Kind).Bind(4, app.Description).Bind(5, app.Publisher)
                .Bind(6, app.Path).Bind(7, DateTimeOffset.Now.ToUnixTimeSeconds()).Run();
        }
    }

    /// <summary>Stored icon/metadata for the given process names; unknown names are left out.</summary>
    public Dictionary<string, StoredApp> GetApps(IEnumerable<string> processNames)
    {
        var apps = new Dictionary<string, StoredApp>();
        lock (_gate)
        {
            using var query = _db.Prepare("SELECT Png, Kind, Description, Publisher, Path FROM AppInfo WHERE ProcessName = ?1");
            foreach (var name in processNames.Distinct())
            {
                query.Reset();
                query.Bind(1, name);
                if (query.Step())
                    apps[name] = new StoredApp(query.Blob(0), query.Text(1), query.Text(2), query.Text(3), query.Text(4));
            }
        }

        return apps;
    }

    public void Dispose()
    {
        lock (_gate)
        {
            _insert.Dispose();
            _db.Dispose();
        }
    }
}
