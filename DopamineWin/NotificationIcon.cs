using DopamineWin.Models;
using Microsoft.Win32;

namespace DopamineWin;

public class NotificationIcon : ApplicationContext
{
    private readonly ILogger<NotificationIcon>? _logger;
    private readonly WindowTracker _windowTracker;
    private readonly SettingsService _settings;
    private readonly DatabaseService _database;
    private readonly NotifyIcon _trayIcon;
    private readonly ToolStripItem _trackingToggle;
    private readonly ToolStripLabel _todayLabel;
    private readonly ToolStripLabel[] _topAppLabels;
    private readonly Dictionary<string, Image> _iconCache = new();

    public NotificationIcon(WindowTracker windowTracker, SettingsService settings, DatabaseService database,
        ILogger<NotificationIcon>? logger = null)
    {
        _logger = logger;
        _windowTracker = windowTracker;
        _settings = settings;
        _database = database;

        _trayIcon = new NotifyIcon
        {
            Icon = SystemIcons.Application,
            ContextMenuStrip = new ContextMenuStrip(),
            Visible = true
        };

        _trayIcon.ContextMenuStrip.Items.Add(
            new ToolStripLabel($"Dopamine {DopamineInfo.GetVersionString()}")
            {
                Margin = new Padding { Top = 5, Bottom = 5 },
                ForeColor = Color.Gray
            }
        );
        _trayIcon.ContextMenuStrip.Items.Add(
            new ToolStripLabel($"Pairing code: {_settings.Settings.PairingCode}")
            {
                Margin = new Padding { Top = 5, Bottom = 5 },
                ForeColor = Color.Gray
            }
        );
        _trayIcon.ContextMenuStrip.Items.Add("-");

        _todayLabel = new ToolStripLabel("Today: –") { Font = new Font(SystemFonts.MenuFont ?? Control.DefaultFont, FontStyle.Bold) };
        _trayIcon.ContextMenuStrip.Items.Add(_todayLabel);
        _topAppLabels = Enumerable.Range(0, 3)
            .Select(_ => new ToolStripLabel { ForeColor = Color.Gray, Visible = false })
            .ToArray();
        foreach (var label in _topAppLabels) _trayIcon.ContextMenuStrip.Items.Add(label);
        _trayIcon.ContextMenuStrip.Items.Add("Open Dashboard", null, (_, _) => OpenDashboard());
        _trayIcon.ContextMenuStrip.Items.Add("-");
        _trayIcon.ContextMenuStrip.Opening += (_, _) => UpdateSummary();
        _trayIcon.DoubleClick += (_, _) => OpenDashboard();
        _trayIcon.Text = "Dopamine";

        _trackingToggle = _trayIcon.ContextMenuStrip.Items.Add("Stop Tracking", null, (sender, args) =>
        {
            if (_windowTracker.IsTracking)
                _windowTracker.StopTracking();
            else
                _windowTracker.StartTracking();

            UpdateToolStrip();
        });
        EventHandler onExit = (sender, args) =>
        {
            _logger?.LogInformation("Exiting application");
            _windowTracker.StopTracking();
            _trayIcon.Visible = false;
        };
        _trayIcon.ContextMenuStrip.Items.Add("Exit", null, (sender, args) =>
        {
            onExit(sender, args);
            Application.Exit();
        });
        Application.ApplicationExit += onExit;
        AppDomain.CurrentDomain.DomainUnload += onExit;
        SystemEvents.SessionEnding += (sender, args) => { onExit(sender, args); };
        SystemEvents.SessionSwitch += (sender, args) =>
        {
            switch (args.Reason)
            {
                case SessionSwitchReason.SessionLock:
                case SessionSwitchReason.SessionLogoff:
                    _logger?.LogInformation("Stopping tracking due to session lock or logoff");
                    _windowTracker.StopTracking();
                    break;
                case SessionSwitchReason.SessionUnlock:
                case SessionSwitchReason.SessionLogon:
                    _logger?.LogInformation("Starting tracking due to session lock or logon");
                    _windowTracker.StartTracking();
                    break;
            }
        };

        _windowTracker.StartTracking();
    }

    private void OpenDashboard()
    {
        try
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = ApiServer.DashboardUrl(_settings.Settings.PairingCode),
                UseShellExecute = true
            });
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Failed to open dashboard");
        }
    }

    private void UpdateSummary()
    {
        try
        {
            var summary = TodaySummary.Compute(_database);
            var state = !_windowTracker.IsTracking ? " (paused)" : _windowTracker.IsIdle ? " (idle)" : "";
            _todayLabel.Text = $"Today: {TodaySummary.Format(summary.Total)}{state}";
            var missing = summary.TopApps.Select(a => a.Process).Where(p => !_iconCache.ContainsKey(p)).ToList();
            foreach (var (process, app) in _database.GetApps(missing))
            {
                if (app.Png == null) continue;
                using var stream = new MemoryStream(app.Png);
                using var full = Image.FromStream(stream);
                _iconCache[process] = new Bitmap(full, new Size(16, 16));
            }

            for (var i = 0; i < _topAppLabels.Length; i++)
            {
                var visible = i < summary.TopApps.Count;
                _topAppLabels[i].Visible = visible;
                if (!visible) continue;
                var (process, duration) = summary.TopApps[i];
                _topAppLabels[i].Text = $"{process}  {TodaySummary.Format(duration)}";
                _topAppLabels[i].Image = _iconCache.GetValueOrDefault(process);
            }
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Failed to compute today's summary");
        }
    }

    private void UpdateToolStrip()
    {
        _trackingToggle.Text = _windowTracker.IsTracking ? "Stop Tracking" : "Start Tracking";
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