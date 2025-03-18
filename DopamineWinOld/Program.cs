using System;
using System.Windows.Forms;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Console;
using Microsoft.Data.Sqlite;
using System.Runtime.InteropServices;
using System.Text;
using System.Diagnostics;

namespace Dopamine
{
    public class Program
    {
        [STAThread]
        static void Main()
        {
            Application.SetHighDpiMode(HighDpiMode.SystemAware);
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            var loggerFactory = LoggerFactory.Create(builder =>
            {
                builder.AddConsole();
                builder.SetMinimumLevel(LogLevel.Information);
            });

            var logger = loggerFactory.CreateLogger<WindowTrackingService>();
            var service = new WindowTrackingService(logger);

            var appContext = new DopamineContext(service);
            Application.Run(appContext);
        }
    }

    public class WindowTrackingService
    {
        private readonly ILogger<WindowTrackingService> _logger;
        private readonly string _dbPath;
        private bool _isTracking;
        private static readonly SqliteConnection _connection;
        private static readonly object _lockObject = new object();
        private string _currentWindowTitle;
        private string _currentProcessName;
        private DateTime _currentWindowStartTime;

        static WindowTrackingService()
        {
            _connection = new SqliteConnection($"Data Source={Path.Combine(AppDomain.CurrentDomain.BaseDirectory, \"dopamine.db\")}");
            _connection.Open();
        }

        public WindowTrackingService(ILogger<WindowTrackingService> logger)
        {
            _logger = logger;
            _dbPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "dopamine.db");
            InitializeDatabase();
        }

        private void InitializeDatabase()
        {
            var command = _connection.CreateCommand();
            command.CommandText = @"
                CREATE TABLE IF NOT EXISTS WindowActivities (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    WindowTitle TEXT NOT NULL,
                    ProcessName TEXT NOT NULL,
                    StartTime TEXT NOT NULL,
                    EndTime TEXT,
                    IsWorkRelated INTEGER
                )";
            command.ExecuteNonQuery();
        }

        public void StartTracking()
        {
            if (_isTracking) return;

            _isTracking = true;
            _logger.LogInformation("Window tracking started");

            Task.Run(async () =>
            {
                while (_isTracking)
                {
                    try
                    {
                        var activeWindow = GetActiveWindowTitle();
                        var processName = GetActiveProcessName();
                        
                        if (!string.IsNullOrEmpty(activeWindow) && 
                            (activeWindow != _currentWindowTitle || processName != _currentProcessName))
                        {
                            if (!string.IsNullOrEmpty(_currentWindowTitle))
                            {
                                // Record the previous window session
                                RecordWindowActivity(_currentWindowTitle, _currentProcessName, _currentWindowStartTime, DateTime.UtcNow);
                            }

                            // Update current window info
                            _currentWindowTitle = activeWindow;
                            _currentProcessName = processName;
                            _currentWindowStartTime = DateTime.UtcNow;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error while tracking window activity");
                    }

                    await Task.Delay(1000);
                }
            });
        }

        public void StopTracking()
        {
            if (_isTracking && !string.IsNullOrEmpty(_currentWindowTitle))
            {
                // Record the last window session
                RecordWindowActivity(_currentWindowTitle, _currentProcessName, _currentWindowStartTime, DateTime.UtcNow);
            }
            _isTracking = false;
            _logger.LogInformation("Window tracking stopped");
        }

        private void RecordWindowActivity(string windowTitle, string processName, DateTime startTime, DateTime endTime)
        {
            lock (_lockObject)
            {
                var command = _connection.CreateCommand();
                command.CommandText = @"
                    INSERT INTO WindowActivities (WindowTitle, ProcessName, StartTime, EndTime, IsWorkRelated)
                    VALUES ($windowTitle, $processName, $startTime, $endTime, 0)";

                command.Parameters.AddWithValue("$windowTitle", windowTitle);
                command.Parameters.AddWithValue("$processName", processName);
                command.Parameters.AddWithValue("$startTime", startTime.ToString("o"));
                command.Parameters.AddWithValue("$endTime", endTime.ToString("o"));

                command.ExecuteNonQuery();
            }
        }
    }

    public class DopamineContext : ApplicationContext
    {
        private readonly NotifyIcon _trayIcon;
        private readonly WindowTrackingService _service;

        public DopamineContext(WindowTrackingService service)
        {
            _service = service;

            _trayIcon = new NotifyIcon()
            {
                Icon = SystemIcons.Application,
                ContextMenuStrip = new ContextMenuStrip(),
                Visible = true
            };

            _trayIcon.ContextMenuStrip.Items.Add("Start Tracking", null, (s, e) => _service.StartTracking());
            _trayIcon.ContextMenuStrip.Items.Add("Stop Tracking", null, (s, e) => _service.StopTracking());
            _trayIcon.ContextMenuStrip.Items.Add("Exit", null, Exit);

            _service.StartTracking(); // Start tracking automatically
        }

        private void Exit(object? sender, EventArgs e)
        {
            _service.StopTracking();
            _trayIcon.Visible = false;
            Application.Exit();
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                _trayIcon.Dispose();
            }

            base.Dispose(disposing);
        }
    }
}