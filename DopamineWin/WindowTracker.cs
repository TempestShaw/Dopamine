using DopamineWin.Models;

namespace DopamineWin;

public class WindowTracker : IDisposable, IAsyncDisposable
{
    private const string DopamineProcess = "<Dopamine>";
    private const string StoppedTitle = "<Stopped>";
    private const string IdleTitle = "<Idle>";

    private readonly DatabaseService _database;
    private readonly SettingsService _settings;
    private readonly ILogger<WindowTracker>? _logger;

    private CancellationTokenSource? _trackingReference;
    private string? _currentWindowTitle;
    private string? _currentProcessName;
    private DateTimeOffset _currentSince;
    private readonly HashSet<string> _iconsCaptured = new();

    public bool IsTracking => _trackingReference != null;

    /// <summary>True while tracking is on but the user has been away longer than the idle timeout.</summary>
    public bool IsIdle { get; private set; }

    public WindowTracker(DatabaseService database, SettingsService settings, ILogger<WindowTracker>? logger = null)
    {
        _database = database;
        _settings = settings;
        _logger = logger;
    }

    public void StartTracking()
    {
        if (_trackingReference != null) return;

        _trackingReference = new CancellationTokenSource();
        _logger?.LogInformation("Window tracking started");

        var token = _trackingReference.Token;
        Task.Factory.StartNew(async () =>
        {
            while (!token.IsCancellationRequested)
            {
                try
                {
                    Poll();
                }
                catch (Exception ex)
                {
                    _logger?.LogError(ex, "Failed to get active window title");
                }

                try
                {
                    await Task.Delay(_settings.Settings.TrackingInterval, token);
                }
                catch (TaskCanceledException)
                {
                    break;
                }
            }
        }, token, TaskCreationOptions.LongRunning, TaskScheduler.Current);
    }

    private void Poll()
    {
        var idleTimeout = _settings.Settings.IdleTimeout;
        if (idleTimeout > 0)
        {
            var idle = NativeMethods.GetIdleTime();
            if (idle.TotalSeconds >= idleTimeout)
            {
                if (!IsIdle)
                {
                    IsIdle = true;
                    if (_currentProcessName != null)
                    {
                        // Backdate the marker to when input actually stopped (but not before the current row).
                        var since = DateTimeOffset.Now - idle;
                        _database.InsertActivity(IdleTitle, DopamineProcess, since > _currentSince ? since : _currentSince);
                        ResetCurrent();
                    }

                    _logger?.LogInformation("User idle");
                }

                return;
            }

            IsIdle = false;
        }

        var activeWindow = NativeMethods.GetActiveWindowTitle();
        var processName = NativeMethods.GetActiveProcessName();

        _logger?.LogDebug("Window: {ActiveWindow}, Process: {ProcessName}", activeWindow, processName);

        if ((!string.IsNullOrWhiteSpace(activeWindow) || !string.IsNullOrWhiteSpace(processName)) &&
            (activeWindow != _currentWindowTitle || processName != _currentProcessName))
        {
            _database.InsertActivity(activeWindow, processName);

            _currentWindowTitle = activeWindow;
            _currentProcessName = processName;
            _currentSince = DateTimeOffset.Now;

            CaptureIcon(processName);
        }
    }

    /// <summary>Stores each app's icon and metadata once per launch for the dashboard and tray.</summary>
    private void CaptureIcon(string processName)
    {
        // UWP apps all run inside ApplicationFrameHost, whose icon would be misleading.
        if (string.IsNullOrEmpty(processName) || processName == "ApplicationFrameHost" || !_iconsCaptured.Add(processName)) return;
        try
        {
            var path = NativeMethods.GetActiveProcessPath();
            if (path == null) return;
            var version = System.Diagnostics.FileVersionInfo.GetVersionInfo(path);
            _database.SaveApp(processName, new StoredApp(
                NativeMethods.ExtractIconPng(path),
                null,
                string.IsNullOrWhiteSpace(version.FileDescription) ? version.ProductName : version.FileDescription,
                version.CompanyName,
                path));
        }
        catch (Exception ex)
        {
            _logger?.LogDebug(ex, "Could not capture icon for {ProcessName}", processName);
        }
    }

    private void ResetCurrent()
    {
        // Forces the next poll to record the foreground window again.
        _currentWindowTitle = null;
        _currentProcessName = null;
    }

    public void StopTracking()
    {
        if (_trackingReference == null) return;

        _trackingReference.Cancel();
        _trackingReference.Dispose();
        _trackingReference = null;

        _database.InsertActivity(StoppedTitle, DopamineProcess);
        ResetCurrent();
        IsIdle = false;

        _logger?.LogInformation("Window tracking stopped");
    }

    public void Dispose()
    {
        _database.Dispose();
    }

    public async ValueTask DisposeAsync()
    {
        await _database.DisposeAsync();
    }
}