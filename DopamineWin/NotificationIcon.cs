namespace DopamineWin;

public class NotificationIcon : ApplicationContext
{
    private readonly WindowTracker _windowTracker;
    private readonly NotifyIcon _trayIcon;
    private readonly ToolStripItem _trackingToggle;

    public NotificationIcon(WindowTracker windowTracker)
    {
        _windowTracker = windowTracker;

        _trayIcon = new NotifyIcon
        {
            Icon = SystemIcons.Application,
            ContextMenuStrip = new ContextMenuStrip(),
            Visible = true
        };

        _trackingToggle = new ToolStripButton
        {
            Text = "Stop Tracking",
            Image = null
        };
        _trackingToggle.Click += (sender, args) =>
        {
            if (_windowTracker.IsTracking)
            {
                _windowTracker.StopTracking();
                _trackingToggle.Text = "Start Tracking";
            }
            else
            {
                _windowTracker.StartTracking();
                _trackingToggle.Text = "Stop Tracking";
            }
        };

        _trayIcon.ContextMenuStrip.Items.Add(_trackingToggle);
        _trayIcon.ContextMenuStrip.Items.Add("Exit", null, (sender, args) =>
        {
            _windowTracker.StopTracking();
            _trayIcon.Visible = false;
            Application.Exit();
        });

        _windowTracker.StartTracking();
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