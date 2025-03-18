using System.Text.Json;
using System.Text.Json.Serialization;
using DopamineWin.Models;

namespace DopamineWin;

public class SettingsService
{
    private readonly ILogger<SettingsService>? _logger;

    public string FilePath { get; init; } = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.json");
    public StoredSettings Settings { get; private set; }

    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        Converters =
        {
            new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)
        },
        WriteIndented = true
    };

    public SettingsService(ILogger<SettingsService>? logger)
    {
        _logger = logger;
        StoredSettings? loadedSettings = null;
        try
        {
            if (File.Exists(FilePath))
            {
                var json = File.ReadAllText(FilePath);
                loadedSettings = JsonSerializer.Deserialize<StoredSettings>(json, _jsonOptions);
            }
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Failed to load configuration file");
        }

        if (loadedSettings == null)
        {
            loadedSettings = StoredSettings.CreateDefault();
            Settings = loadedSettings;
            SaveSettings();
        }
        else
        {
            Settings = loadedSettings;
        }
    }

    public void SaveSettings()
    {
        try
        {
            var json = JsonSerializer.Serialize(Settings, _jsonOptions);
            File.WriteAllText(FilePath, json);
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Failed to save configuration file");
        }
    }
}