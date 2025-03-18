using Microsoft.Data.Sqlite;

namespace DopamineWin;

public class DatabaseService : IDisposable, IAsyncDisposable
{
    public string FilePath { get; init; } = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "dopamine.db");

    private readonly ILogger<DatabaseService>? _logger;
    private readonly SqliteConnection _connection;

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
                CREATE TABLE IF NOT EXISTS WindowActivities (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    Timestamp INTEGER NOT NULL,
                    WindowTitle TEXT,
                    ProcessName TEXT
                )";
        command.ExecuteNonQuery();

        _logger?.LogInformation("Database initialized");
    }

    public void InsertActivity(string windowTitle, string processName)
    {
        var command = _connection.CreateCommand();
        command.CommandText = @"
                INSERT INTO WindowActivities (Timestamp, WindowTitle, ProcessName)
                VALUES ($Timestamp, $WindowTitle, $ProcessName)";
        command.Parameters.AddWithValue("$Timestamp", DateTimeOffset.Now.ToUnixTimeSeconds());
        command.Parameters.AddWithValue("$WindowTitle", windowTitle);
        command.Parameters.AddWithValue("$ProcessName", processName);
        command.ExecuteNonQuery();
        
        _logger?.LogInformation("Activity inserted");
    }
    
    public IEnumerable<WindowActivity> GetActivities(long start, long end)
    {
        var command = _connection.CreateCommand();
        command.CommandText = @"
                SELECT * FROM WindowActivities
                WHERE Timestamp >= $Start AND Timestamp <= $End
                ORDER BY Timestamp";
        command.Parameters.AddWithValue("$Start", start);
        command.Parameters.AddWithValue("$End", end);

        using var reader = command.ExecuteReader();
        
        while (reader.Read())
        {
            yield return new WindowActivity
            {
                Id = reader.GetInt32(0),
                Timestamp = reader.GetInt64(1),
                WindowTitle = reader.GetString(2),
                ProcessName = reader.GetString(3)
            };
        }
        
        _logger?.LogInformation("Retrieved activities");
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