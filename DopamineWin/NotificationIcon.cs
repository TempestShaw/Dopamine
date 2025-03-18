using DopamineWin.Models;

namespace DopamineWin;

public class NotificationIcon : ApplicationContext
{
    private readonly WindowTracker _windowTracker;
    private readonly SettingsService _settings;
    private readonly NotifyIcon _trayIcon;
    private readonly ToolStripItem _trackingToggle;

    public NotificationIcon(WindowTracker windowTracker, SettingsService settings)
    {
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
            _windowTracker.StopTracking();
            _trayIcon.Visible = false;
        };
        _trayIcon.ContextMenuStrip.Items.Add("Exit", null, (sender, args) =>
        {
            onExit(sender, args);
            Application.Exit();
        });
        Application.ApplicationExit += onExit;
        AppDomain.CurrentDomain.ProcessExit += onExit;

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