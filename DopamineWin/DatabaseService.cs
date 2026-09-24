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
                CREATE TABLE IF NOT EXISTS AppIcons (
                    ProcessName TEXT PRIMARY KEY,
                    Png BLOB NOT NULL,
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

    public void SaveIcon(string processName, byte[] png)
    {
        lock (_lock)
        {
            using var command = _connection.CreateCommand();
            command.CommandText = @"
                INSERT OR REPLACE INTO AppIcons (ProcessName, Png, UpdatedAt)
                VALUES ($ProcessName, $Png, $UpdatedAt)";
            command.Parameters.AddWithValue("$ProcessName", processName);
            command.Parameters.AddWithValue("$Png", png);
            command.Parameters.AddWithValue("$UpdatedAt", DateTimeOffset.Now.ToUnixTimeSeconds());
            command.ExecuteNonQuery();
        }
    }

    /// <summary>Stored icons for the given process names; names without an icon are left out.</summary>
    public Dictionary<string, byte[]> GetIcons(IEnumerable<string> processNames)
    {
        var icons = new Dictionary<string, byte[]>();
        lock (_lock)
        {
            using var command = _connection.CreateCommand();
            command.CommandText = "SELECT Png FROM AppIcons WHERE ProcessName = $ProcessName";
            var parameter = command.Parameters.Add("$ProcessName", SqliteType.Text);
            foreach (var name in processNames.Distinct())
            {
                parameter.Value = name;
                if (command.ExecuteScalar() is byte[] png) icons[name] = png;
            }
        }

        return icons;
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