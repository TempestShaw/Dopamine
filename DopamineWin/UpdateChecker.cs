using System.Runtime.InteropServices;
using System.Text.Json;

namespace DopamineWin;

/// <summary>
/// Asks GitHub once a day whether a newer release is out. Uses WinINet, which ships with Windows,
/// so the exe carries no HTTP stack of its own. The request says nothing about the user, and the
/// link shown is always built here, never taken from the reply.
/// </summary>
public sealed unsafe class UpdateChecker : IDisposable
{
    public sealed record Release(string Version, string Url);

    private const string Repo = "TempestShaw/Dopamine";
    private const string LatestUrl = $"https://api.github.com/repos/{Repo}/releases/latest";
    private const int MaxReply = 1 << 20;

    private readonly SettingsService _settings;
    private readonly Timer _timer;
    private readonly object _gate = new();
    private Release? _found;
    private bool _wasEnabled;

    public UpdateChecker(SettingsService settings)
    {
        _settings = settings;
        _wasEnabled = settings.Settings.CheckForUpdates;
        _timer = new Timer(_ => Check(), null, Timeout.Infinite, Timeout.Infinite);
        _settings.Changed += OnSettingsChanged;
    }

    public Release? Available
    {
        get
        {
            lock (_gate) return _found;
        }
    }

    /// <summary>First check a minute after launch (leaving login alone), then daily.</summary>
    public void Start() => _timer.Change(TimeSpan.FromMinutes(1), TimeSpan.FromHours(24));

    /// <summary>Turned on or off from the dashboard: check right away, or forget what was found.</summary>
    private void OnSettingsChanged()
    {
        var enabled = _settings.Settings.CheckForUpdates;
        lock (_gate)
        {
            if (enabled == _wasEnabled) return;
            _wasEnabled = enabled;
        }

        ThreadPool.QueueUserWorkItem(_ => Check());
    }

    private void Check()
    {
        try
        {
            var release = _settings.Settings.CheckForUpdates && Download(LatestUrl) is { } reply ? Parse(reply, AppInfo.Version) : null;
            lock (_gate) _found = release;
        }
        catch (Exception ex)
        {
            Log.Error("Update check failed", ex);
        }
    }

    /// <summary>The release described by GitHub's JSON, if it is a plain version newer than <paramref name="current"/>.</summary>
    internal static Release? Parse(byte[] json, string current)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Object ||
                !doc.RootElement.TryGetProperty("tag_name", out var tagElement) ||
                tagElement.GetString() is not { } tag ||
                !tag.StartsWith('v'))
                return null;
            var version = tag[1..];
            if (Numbers(version) == null || !IsNewer(version, current)) return null;
            return new Release(version, $"https://github.com/{Repo}/releases/tag/{tag}");
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>Compares "1.2.10" and "1.2.9" number by number.</summary>
    internal static bool IsNewer(string a, string b)
    {
        var x = Numbers(a) ?? [0, 0, 0];
        var y = Numbers(b) ?? [0, 0, 0];
        for (var i = 0; i < 3; i++)
            if (x[i] != y[i]) return x[i] > y[i];
        return false;
    }

    /// <summary>"1.2.3" → [1, 2, 3]; anything else (pre-release tags, junk) → null.</summary>
    private static int[]? Numbers(string version)
    {
        var parts = version.Split('.');
        if (parts.Length != 3) return null;
        var numbers = new int[3];
        for (var i = 0; i < 3; i++)
        {
            if (parts[i].Length is 0 or > 6 || !parts[i].All(char.IsAsciiDigit)) return null;
            numbers[i] = int.Parse(parts[i]);
        }

        return numbers;
    }

    private static byte[]? Download(string url)
    {
        var agent = $"Dopamine/{AppInfo.Version}";
        const string headers = "Accept: application/vnd.github+json\r\n";
        IntPtr session, request;
        fixed (char* a = agent) session = InternetOpenW(a, INTERNET_OPEN_TYPE_PRECONFIG, null, null, 0);
        if (session == IntPtr.Zero) return null;
        try
        {
            fixed (char* u = url)
            fixed (char* h = headers)
                request = InternetOpenUrlW(session, u, h, (uint)headers.Length, Flags, IntPtr.Zero);
            if (request == IntPtr.Zero) return null;
            try
            {
                using var body = new MemoryStream();
                var buffer = new byte[16 * 1024];
                while (body.Length <= MaxReply)
                {
                    uint read;
                    fixed (byte* b = buffer)
                        if (InternetReadFile(request, b, (uint)buffer.Length, &read) == 0) return null;
                    if (read == 0) return body.ToArray();
                    body.Write(buffer, 0, (int)read);
                }

                return null;
            }
            finally
            {
                InternetCloseHandle(request);
            }
        }
        finally
        {
            InternetCloseHandle(session);
        }
    }

    public void Dispose()
    {
        _settings.Changed -= OnSettingsChanged;
        _timer.Dispose();
    }

    // WinINet, with blittable signatures like the rest of the interop (no runtime marshalling under AOT).
    private const uint INTERNET_OPEN_TYPE_PRECONFIG = 0;
    private const uint Flags =
        0x80000000 | // INTERNET_FLAG_RELOAD: never answer from the cache
        0x04000000 | // INTERNET_FLAG_NO_CACHE_WRITE
        0x00080000 | // INTERNET_FLAG_NO_COOKIES
        0x00000200;  // INTERNET_FLAG_NO_UI

    [DllImport("wininet.dll")] private static extern IntPtr InternetOpenW(char* agent, uint accessType, char* proxy, char* proxyBypass, uint flags);
    [DllImport("wininet.dll")] private static extern IntPtr InternetOpenUrlW(IntPtr internet, char* url, char* headers, uint headersLength, uint flags, IntPtr context);
    [DllImport("wininet.dll")] private static extern int InternetReadFile(IntPtr file, byte* buffer, uint toRead, uint* read);
    [DllImport("wininet.dll")] private static extern int InternetCloseHandle(IntPtr handle);
}
