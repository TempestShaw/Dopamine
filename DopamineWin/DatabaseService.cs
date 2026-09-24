using DopamineWin.Models;
using Microsoft.Data.Sqlite;

namespace DopamineWin;

public class DatabaseService : IDisposable, IAsyncDisposable
{
    public string FilePath { get; init; } = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "dopamine.db");

    private readonly ILogger<DatabaseService>? _logger;
    private readonly SqliteConnection _connection;

    // The tracker thread writes while API requests read; a single SqliteConnection is not thread-safe.
    private readonly object _lock = new();

    public DatabaseService(ILogger<DatabaseService>? logger = null)
    {
        _logger = logger;
        _connection = new SqliteConnection($"Data Source={FilePath}");
        _connection.Open();
        InitializeDatabase();
    }

    private void InitializeDatabase()
    {
        var command = _connection.CreateCommand();
        command.CommandText = @"
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
                );";
        command.ExecuteNonQuery();

        _logger?.LogInformation("Database initialized");
    }

    public void InsertActivity(string windowTitle, string processName, DateTimeOffset? at = null)
    {
        lock (_lock)
        {
            using var command = _connection.CreateCommand();
            command.CommandText = @"
                INSERT INTO WindowActivities (Timestamp, WindowTitle, ProcessName)
                VALUES ($Timestamp, $WindowTitle, $ProcessName)";
            command.Parameters.AddWithValue("$Timestamp", (at ?? DateTimeOffset.Now).ToUnixTimeSeconds());
            command.Parameters.AddWithValue("$WindowTitle", windowTitle);
            command.Parameters.AddWithValue("$ProcessName", processName);
            command.ExecuteNonQuery();
        }

        _logger?.LogDebug("Activity inserted");
    }

    public List<WindowActivity> GetActivities(long from, long to)
    {
        var activities = new List<WindowActivity>();
        lock (_lock)
        {
            using var command = _connection.CreateCommand();
            command.CommandText = @"
                SELECT Id, Timestamp, WindowTitle, ProcessName FROM WindowActivities
                WHERE Timestamp >= $Start AND Timestamp <= $End
                ORDER BY Timestamp, Id";
            command.Parameters.AddWithValue("$Start", from);
            command.Parameters.AddWithValue("$End", to);

            using var reader = command.ExecuteReader();
            while (reader.Read())
            {
                activities.Add(new WindowActivity
                {
                    Id = reader.GetInt32(0),
                    Timestamp = reader.GetInt64(1),
                    WindowTitle = reader.IsDBNull(2) ? string.Empty : reader.GetString(2),
                    ProcessName = reader.IsDBNull(3) ? string.Empty : reader.GetString(3)
                });
            }
        }

        _logger?.LogDebug("Retrieved {Count} activities", activities.Count);
        return activities;
    }

    public void SaveApp(string processName, StoredApp app)
    {
        lock (_lock)
        {
            using var command = _connection.CreateCommand();
            command.CommandText = @"
                INSERT OR REPLACE INTO AppInfo (ProcessName, Png, Kind, Description, Publisher, Path, UpdatedAt)
                VALUES ($ProcessName, $Png, $Kind, $Description, $Publisher, $Path, $UpdatedAt)";
            command.Parameters.AddWithValue("$ProcessName", processName);
            command.Parameters.AddWithValue("$Png", (object?)app.Png ?? DBNull.Value);
            command.Parameters.AddWithValue("$Kind", (object?)app.Kind ?? DBNull.Value);
            command.Parameters.AddWithValue("$Description", (object?)app.Description ?? DBNull.Value);
            command.Parameters.AddWithValue("$Publisher", (object?)app.Publisher ?? DBNull.Value);
            command.Parameters.AddWithValue("$Path", (object?)app.Path ?? DBNull.Value);
            command.Parameters.AddWithValue("$UpdatedAt", DateTimeOffset.Now.ToUnixTimeSeconds());
            command.ExecuteNonQuery();
        }
    }

    /// <summary>Stored icon/metadata for the given process names; unknown names are left out.</summary>
    public Dictionary<string, StoredApp> GetApps(IEnumerable<string> processNames)
    {
        var apps = new Dictionary<string, StoredApp>();
        lock (_lock)
        {
            using var command = _connection.CreateCommand();
            command.CommandText = "SELECT Png, Kind, Description, Publisher, Path FROM AppInfo WHERE ProcessName = $ProcessName";
            var parameter = command.Parameters.Add("$ProcessName", SqliteType.Text);
            foreach (var name in processNames.Distinct())
            {
                parameter.Value = name;
                using var reader = command.ExecuteReader();
                if (!reader.Read()) continue;
                string? Text(int i) => reader.IsDBNull(i) ? null : reader.GetString(i);
                apps[name] = new StoredApp(reader.IsDBNull(0) ? null : (byte[])reader[0], Text(1), Text(2), Text(3), Text(4));
            }
        }

        return apps;
    }

    public void Dispose()
    {
        _connection.Dispose();
    }

    public async ValueTask DisposeAsync()
    {
        await _connection.DisposeAsync();
    }
}