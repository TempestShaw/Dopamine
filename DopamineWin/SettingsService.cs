using System.Security.Cryptography;
using System.Text.Json;
using DopamineWin.Models;

namespace DopamineWin;

public sealed class SettingsService
{
    private readonly object _gate = new();
    private readonly string _path = AppInfo.DataFile("config.json");
    private StoredSettings _settings;

    /// <summary>Raised after settings change (e.g. a new tracking interval from the dashboard).</summary>
    public event Action? Changed;

    public SettingsService()
    {
        StoredSettings? loaded = null;
        try
        {
            if (File.Exists(_path)) loaded = JsonSerializer.Deserialize(File.ReadAllText(_path), Json.Default.StoredSettings);
        }
        catch (Exception ex)
        {
            Log.Error("Failed to read config.json", ex);
        }

        if (loaded == null || string.IsNullOrWhiteSpace(loaded.PairingCode))
        {
            loaded ??= new StoredSettings();
            loaded.PairingCode = GeneratePairingCode(6);
            _settings = loaded;
            Save();
        }
        else
        {
            _settings = loaded;
        }
    }

    public StoredSettings Settings
    {
        get
        {
            lock (_gate) return _settings;
        }
    }

    public PublicSettings Update(SettingsPatch patch)
    {
        PublicSettings result;
        lock (_gate)
        {
            _settings.Apply(patch);
            result = _settings.ToPublic();
        }

        Save();
        Changed?.Invoke();
        return result;
    }

    private void Save()
    {
        try
        {
            string json;
            lock (_gate) json = JsonSerializer.Serialize(_settings, Json.Default.StoredSettings);
            Directory.CreateDirectory(AppInfo.DataDirectory);
            var temp = _path + ".tmp";
            File.WriteAllText(temp, json);
            File.Move(temp, _path, overwrite: true);
        }
        catch (Exception ex)
        {
            Log.Error("Failed to save config.json", ex);
        }
    }

    private static string GeneratePairingCode(int length)
    {
        const string allowed = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        var chars = new char[length];
        for (var i = 0; i < length; i++) chars[i] = allowed[RandomNumberGenerator.GetInt32(allowed.Length)];
        return new string(chars);
    }
}
