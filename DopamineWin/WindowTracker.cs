using System.Diagnostics;
using DopamineWin.Models;

namespace DopamineWin;

/// <summary>
/// Records the foreground app and window title whenever it changes. Time only counts while the user
/// is present: tracking suspends (writing a marker row) on lock, sleep and log-off, and after
/// IdleTimeout seconds without input. Same rules as the macOS agent.
/// </summary>
public sealed class WindowTracker : IDisposable
{
    private const string DopamineProcess = "<Dopamine>";
    private const string StoppedTitle = "<Stopped>";
    private const string IdleTitle = "<Idle>";

    private readonly DatabaseService _database;
    private readonly SettingsService _settings;
    private readonly object _gate = new();
    private readonly HashSet<string> _appsCaptured = [];
    private readonly Timer _timer;

    private string? _currentTitle;
    private string? _currentProcess;
    private DateTimeOffset _currentSince;
    private bool _userPaused;
    private bool _systemSuspended;
    private bool _idle;

    public WindowTracker(DatabaseService database, SettingsService settings)
    {
        _database = database;
        _settings = settings;
        _timer = new Timer(_ => Poll(), null, Timeout.Infinite, Timeout.Infinite);
        _settings.Changed += Reschedule;
    }

    public bool IsPaused
    {
        get
        {
            lock (_gate) return _userPaused;
        }
    }

    public bool IsIdle
    {
        get
        {
            lock (_gate) return _idle;
        }
    }

    public void Start()
    {
        Reschedule();
        Log.Info("Tracking started");
    }

    private void Reschedule()
    {
        var interval = _settings.Settings.TrackingInterval;
        _timer.Change(0, interval);
    }

    /// <summary>Pause or resume from the tray menu.</summary>
    public void SetUserPaused(bool paused)
    {
        lock (_gate)
        {
            if (paused == _userPaused) return;
            _userPaused = paused;
            if (paused) WriteMarker(StoppedTitle);
        }

        if (!paused) Poll();
    }

    /// <summary>Lock, sleep and log-off suspend tracking; unlock and wake resume it.</summary>
    public void SetSystemSuspended(bool suspended)
    {
        lock (_gate)
        {
            if (suspended == _systemSuspended) return;
            _systemSuspended = suspended;
            if (suspended) WriteMarker(StoppedTitle);
            Log.Info(suspended ? "Suspended (lock/sleep)" : "Resumed");
        }

        if (!suspended) Poll();
    }

    /// <summary>Writes a final marker so the last window doesn't keep counting after exit.</summary>
    public void Shutdown()
    {
        _timer.Change(Timeout.Infinite, Timeout.Infinite);
        lock (_gate) WriteMarker(StoppedTitle);
    }

    private void WriteMarker(string title)
    {
        if (_currentProcess == null) return;
        _database.InsertActivity(title, DopamineProcess);
        _currentTitle = null;
        _currentProcess = null;
    }

    private void Poll()
    {
        try
        {
            lock (_gate) PollLocked();
        }
        catch (Exception ex)
        {
            Log.Error("Poll failed", ex);
        }
    }

    private void PollLocked()
    {
        if (_userPaused || _systemSuspended) return;

        var idleTimeout = _settings.Settings.IdleTimeout;
        if (idleTimeout > 0)
        {
            var idle = NativeMethods.GetIdleTime();
            if (idle.TotalSeconds >= idleTimeout)
            {
                if (!_idle)
                {
                    _idle = true;
                    if (_currentProcess != null)
                    {
                        // Backdate the marker to when input actually stopped (but not before the current row).
                        var since = DateTimeOffset.Now - idle;
                        _database.InsertActivity(IdleTitle, DopamineProcess, since > _currentSince ? since : _currentSince);
                        _currentTitle = null;
                        _currentProcess = null;
                    }

                    Log.Info("Idle");
                }

                return;
            }

            _idle = false;
        }

        var window = NativeMethods.GetForegroundWindowInfo();
        if (window.ProcessId == 0) return;
        var path = NativeMethods.GetProcessPath(window.ProcessId);
        var process = NativeMethods.GetProcessName(window.ProcessId, path);
        if (string.IsNullOrWhiteSpace(window.Title) && string.IsNullOrWhiteSpace(process)) return;
        if (window.Title == _currentTitle && process == _currentProcess) return;

        _database.InsertActivity(window.Title, process);
        _currentTitle = window.Title;
        _currentProcess = process;
        _currentSince = DateTimeOffset.Now;

        CaptureApp(process, path);
    }

    /// <summary>Stores each app's icon and metadata once per launch for the dashboard and tray.</summary>
    private void CaptureApp(string process, string? path)
    {
        // UWP apps all run inside ApplicationFrameHost, whose icon would be misleading.
        if (path == null || process == "ApplicationFrameHost" || !_appsCaptured.Add(process)) return;
        try
        {
            var version = FileVersionInfo.GetVersionInfo(path);
            _database.SaveApp(process, new StoredApp(
                NativeMethods.ExtractIconPng(path),
                null,
                string.IsNullOrWhiteSpace(version.FileDescription) ? version.ProductName : version.FileDescription,
                version.CompanyName,
                path));
        }
        catch (Exception ex)
        {
            Log.Error($"Could not capture app info for {process}", ex);
        }
    }

    public void Dispose()
    {
        _timer.Dispose();
    }
}
