namespace DopamineWin;

public class WindowTracker : IDisposable, IAsyncDisposable
{
    private const int TrackingDelay = 5000;
    private const string DopamineProcess = "<Dopamine>";
    private const string IdleTitle = "<Idle>";
    private const string ShutdownTitle = "<Shutdown>";

    private readonly DatabaseService _database;
    private readonly ILogger<WindowTracker>? _logger;

    private CancellationTokenSource? _trackingReference;
    private string _currentWindowTitle;
    private string _currentProcessName;

    public bool IsTracking => _trackingReference != null;

    public WindowTracker(DatabaseService database, ILogger<WindowTracker>? logger = null)
    {
        _database = database;
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
                    var activeWindow = NativeMethods.GetActiveWindowTitle();
                    var processName = NativeMethods.GetActiveProcessName();

                    _logger?.LogDebug("Window: {ActiveWindow}, Process: {ProcessName}", activeWindow, processName);

                    if ((!string.IsNullOrWhiteSpace(activeWindow) || !string.IsNullOrWhiteSpace(processName)) &&
                        (activeWindow != _currentWindowTitle || processName != _currentProcessName))
                    {
                        // Record the previous window session
                        _database.InsertActivity(activeWindow, processName);

                        // Update current window info
                        _currentWindowTitle = activeWindow;
                        _currentProcessName = processName;
                    }
                }
                catch (Exception ex)
                {
                    _logger?.LogError(ex, "Failed to get active window title");
                }

                await Task.Delay(TrackingDelay, token);
            }
        }, token, TaskCreationOptions.LongRunning, TaskScheduler.Current);
    }

    public void StopTracking()
    {
        if (_trackingReference == null) return;

        _trackingReference.Cancel();
        _trackingReference.Dispose();
        _trackingReference = null;

        _database.InsertActivity(ShutdownTitle, DopamineProcess);

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