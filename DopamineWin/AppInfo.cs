using System.Reflection;
using System.Text.Json.Serialization;
using DopamineWin.Models;

namespace DopamineWin;

public static class AppInfo
{
    public static readonly string Version =
        typeof(AppInfo).Assembly.GetName().Version is { } v ? $"{v.Major}.{v.Minor}.{v.Build}" : "0.0.0";

    /// <summary>%LOCALAPPDATA%\Dopamine: config.json, dopamine.db and dopamine.log.</summary>
    public static readonly string DataDirectory =
        System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Dopamine");

    public static string DataFile(string name) => System.IO.Path.Combine(DataDirectory, name);

    /// <summary>
    /// v0.0.1 kept its data next to the exe. Copy it to the data directory the first time this
    /// version runs, so history and the pairing code carry over.
    /// </summary>
    public static void MigrateFromExeDirectory()
    {
        Directory.CreateDirectory(DataDirectory);
        foreach (var name in new[] { "dopamine.db", "config.json" })
        {
            var from = System.IO.Path.Combine(AppContext.BaseDirectory, name);
            var to = DataFile(name);
            if (File.Exists(to) || !File.Exists(from)) continue;
            try
            {
                File.Copy(from, to);
                Log.Info($"Moved {name} to {DataDirectory}");
            }
            catch (Exception ex)
            {
                Log.Error($"Could not move {name}", ex);
            }
        }
    }
}

/// <summary>Minimal file logger; the agent has no console.</summary>
public static class Log
{
    private static readonly object Gate = new();
    private static readonly string File = AppInfo.DataFile("dopamine.log");

    static Log()
    {
        try
        {
            Directory.CreateDirectory(AppInfo.DataDirectory);
            if (System.IO.File.Exists(File) && new FileInfo(File).Length > 1_000_000) System.IO.File.Delete(File);
        }
        catch
        {
            // Logging must never take the agent down.
        }
    }

    public static void Info(string message) => Write("INFO", message);

    public static void Error(string message, Exception? ex = null) =>
        Write("ERROR", ex == null ? message : $"{message}: {ex.GetType().Name}: {ex.Message}");

    private static void Write(string level, string message)
    {
        try
        {
            lock (Gate)
                System.IO.File.AppendAllText(File, $"{DateTimeOffset.Now:yyyy-MM-dd HH:mm:ss} {level} {message}{Environment.NewLine}");
        }
        catch
        {
            // Ignore: disk full or locked file.
        }
    }
}

/// <summary>
/// JSON for the API and config file, generated at compile time (Native AOT has no reflection-based
/// serialisation). Reads are case-insensitive so v0.0.1's PascalCase config.json still loads.
/// </summary>
[JsonSourceGenerationOptions(
    PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase,
    PropertyNameCaseInsensitive = true,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    WriteIndented = false)]
[JsonSerializable(typeof(StoredSettings))]
[JsonSerializable(typeof(SettingsPatch))]
[JsonSerializable(typeof(PublicSettings))]
[JsonSerializable(typeof(AgentInfo))]
[JsonSerializable(typeof(List<WindowActivity>))]
[JsonSerializable(typeof(Dictionary<string, AppInfoDto>))]
[JsonSerializable(typeof(ForgetRequest))]
[JsonSerializable(typeof(ForgetResult))]
internal partial class Json : JsonSerializerContext;
