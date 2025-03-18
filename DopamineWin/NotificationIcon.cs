using DopamineWin.Models;
using Microsoft.Win32;

namespace DopamineWin;

public class NotificationIcon : ApplicationContext
{
    private readonly ILogger<NotificationIcon>? _logger;
    private readonly WindowTracker _windowTracker;
    private readonly SettingsService _settings;
    private readonly NotifyIcon _trayIcon;
    private readonly ToolStripItem _trackingToggle;

    public NotificationIcon(WindowTracker windowTracker, SettingsService settings,
        ILogger<NotificationIcon>? logger = null)
    {
        _logger = logger;
        _windowTracker = windowTracker;
        _settings = settings;

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