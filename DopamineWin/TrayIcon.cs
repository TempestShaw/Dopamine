using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using DopamineWin.Native;
using static DopamineWin.Native.Win32;

namespace DopamineWin;

/// <summary>
/// The notification-area icon and its menu, drawn with plain Win32 (no WinForms). A hidden window
/// receives the icon's clicks plus lock/unlock, sleep/wake and shutdown notifications.
/// </summary>
public sealed unsafe class TrayIcon
{
    private const uint CallbackMessage = WM_APP + 1;
    private const int CmdOpen = 1, CmdResume = 2, CmdExit = 3, CmdPause15 = 4, CmdPause60 = 5, CmdPauseTomorrow = 6, CmdPauseOpen = 7, CmdUpdate = 8;
    private const int ApplicationIconId = 32512; // resource id the SDK gives <ApplicationIcon>

    private static TrayIcon? _instance; // the window procedure is static; it reaches the tray through this

    private readonly WindowTracker _tracker;
    private readonly SettingsService _settings;
    private readonly DatabaseService _database;
    private readonly UpdateChecker _updates;
    private readonly Action _onExit;
    private IntPtr _hwnd;
    private IntPtr _icon;
    private uint _taskbarCreated;

    public TrayIcon(WindowTracker tracker, SettingsService settings, DatabaseService database, UpdateChecker updates, Action onExit)
    {
        _tracker = tracker;
        _settings = settings;
        _database = database;
        _updates = updates;
        _onExit = onExit;
    }

    /// <summary>Creates the icon and runs the message loop until Exit is chosen or Windows ends the session.</summary>
    public void Run()
    {
        _instance = this;
        var module = GetModuleHandleW(null);
        _icon = LoadImageW(module, ApplicationIconId, IMAGE_ICON, GetSystemMetrics(SM_CXSMICON), GetSystemMetrics(SM_CYSMICON), LR_DEFAULTCOLOR);
        if (_icon == IntPtr.Zero) _icon = LoadIconW(IntPtr.Zero, ApplicationIconId); // IDI_APPLICATION

        fixed (char* className = "DopamineTray")
        {
            var wc = new WNDCLASSEXW
            {
                cbSize = (uint)sizeof(WNDCLASSEXW),
                lpfnWndProc = &WndProc,
                hInstance = module,
                lpszClassName = className,
            };
            RegisterClassExW(&wc);
            // A hidden top-level window (not message-only) so it also receives broadcasts such as TaskbarCreated.
            _hwnd = CreateWindowExW(0, className, className, 0, 0, 0, 0, 0, IntPtr.Zero, IntPtr.Zero, module, IntPtr.Zero);
        }

        if (_hwnd == IntPtr.Zero)
        {
            Log.Error("Could not create the tray window");
            return;
        }

        fixed (char* name = "TaskbarCreated") _taskbarCreated = RegisterWindowMessageW(name);
        WTSRegisterSessionNotification(_hwnd, NOTIFY_FOR_THIS_SESSION);
        AddIcon();

        MSG msg;
        while (GetMessageW(&msg, IntPtr.Zero, 0, 0) > 0)
        {
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    }

    private void AddIcon()
    {
        var data = IconData();
        data.uFlags = NIF_MESSAGE | NIF_ICON | NIF_TIP;
        if (Shell_NotifyIconW(NIM_ADD, &data) == 0) Log.Error("Could not add the tray icon (no notification area?)");
    }

    private void RemoveIcon()
    {
        var data = IconData();
        Shell_NotifyIconW(NIM_DELETE, &data);
    }

    private NOTIFYICONDATAW IconData()
    {
        var data = new NOTIFYICONDATAW
        {
            cbSize = (uint)sizeof(NOTIFYICONDATAW),
            hWnd = _hwnd,
            uID = 1,
            uCallbackMessage = CallbackMessage,
            hIcon = _icon,
        };
        const string tip = "Dopamine";
        for (var i = 0; i < tip.Length; i++) data.szTip[i] = tip[i];
        return data;
    }

    [UnmanagedCallersOnly]
    private static IntPtr WndProc(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam)
    {
        try
        {
            var tray = _instance;
            if (tray != null && tray.Handle(msg, wParam, lParam) is { } result) return result;
        }
        catch (Exception ex)
        {
            Log.Error("Window message failed", ex);
        }

        return DefWindowProcW(hwnd, msg, wParam, lParam);
    }

    private IntPtr? Handle(uint msg, IntPtr wParam, IntPtr lParam)
    {
        if (msg == CallbackMessage)
        {
            switch ((uint)lParam)
            {
                case WM_RBUTTONUP or WM_CONTEXTMENU:
                    ShowMenu();
                    break;
                case WM_LBUTTONDBLCLK:
                    OpenDashboard();
                    break;
            }

            return IntPtr.Zero;
        }

        if (msg == _taskbarCreated && _taskbarCreated != 0)
        {
            AddIcon(); // Explorer restarted
            return IntPtr.Zero;
        }

        switch (msg)
        {
            case WM_WTSSESSION_CHANGE:
                switch ((int)wParam)
                {
                    case WTS_SESSION_LOCK or WTS_SESSION_LOGOFF:
                        _tracker.SetSystemSuspended(true);
                        break;
                    case WTS_SESSION_UNLOCK or WTS_SESSION_LOGON:
                        _tracker.SetSystemSuspended(false);
                        break;
                }

                return IntPtr.Zero;

            case WM_POWERBROADCAST:
                switch ((int)wParam)
                {
                    case PBT_APMSUSPEND:
                        _tracker.SetSystemSuspended(true);
                        break;
                    case PBT_APMRESUMESUSPEND or PBT_APMRESUMEAUTOMATIC:
                        _tracker.SetSystemSuspended(false);
                        break;
                }

                return 1;

            case WM_QUERYENDSESSION:
                return 1;

            case WM_ENDSESSION:
                if (wParam != IntPtr.Zero) _onExit();
                return IntPtr.Zero;

            case WM_DESTROY:
                RemoveIcon();
                PostQuitMessage(0);
                return IntPtr.Zero;
        }

        return null;
    }

    private void ShowMenu()
    {
        var menu = CreatePopupMenu();
        try
        {
            var settings = _settings.Settings;
            Add(menu, $"Dopamine {AppInfo.Version}", 0, MF_GRAYED);
            Add(menu, $"{Strings.T("Pairing code", "配对码", "配對碼")}: {settings.PairingCode}", 0, MF_GRAYED);
            Separator(menu);
            var update = _updates.Available;
            if (update != null)
            {
                Add(menu, Strings.T($"Dopamine {update.Version} is out: download", $"Dopamine {update.Version} 已发布：去下载", $"Dopamine {update.Version} 已發布：前往下載"), CmdUpdate, MF_STRING);
                Separator(menu);
            }


            try
            {
                var today = TodaySummary.Compute(_database, settings.Hidden);
                var state = _tracker.IsPaused ? PausedLabel(_tracker.PausedUntil)
                    : _tracker.IsIdle ? Strings.T(" (idle)", "（闲置）", "（閒置）") : "";
                Add(menu, $"{Strings.T("Today", "今天", "今天")}: {TodaySummary.Format(today.Total)}{state}", 0, MF_GRAYED);
                foreach (var (process, duration) in today.TopApps)
                    Add(menu, $"      {process}   {TodaySummary.Format(duration)}", 0, MF_GRAYED);
            }
            catch (Exception ex)
            {
                Log.Error("Could not compute today's summary", ex);
            }

            Add(menu, Strings.T("Open Dashboard", "打开仪表板", "打開儀表板"), CmdOpen, MF_STRING);
            SetMenuDefaultItem(menu, CmdOpen, 0);
            Separator(menu);
            if (_tracker.IsPaused)
            {
                Add(menu, Strings.T("Resume Tracking", "继续记录", "繼續記錄"), CmdResume, MF_STRING);
            }
            else
            {
                // Destroyed together with the parent menu.
                var pause = CreatePopupMenu();
                Add(pause, Strings.T("For 15 minutes", "暂停 15 分钟", "暫停 15 分鐘"), CmdPause15, MF_STRING);
                Add(pause, Strings.T("For 1 hour", "暂停 1 小时", "暫停 1 小時"), CmdPause60, MF_STRING);
                Add(pause, Strings.T("Until tomorrow", "暂停到明天", "暫停到明天"), CmdPauseTomorrow, MF_STRING);
                Add(pause, Strings.T("Until I resume", "直到我手动继续", "直到我手動繼續"), CmdPauseOpen, MF_STRING);
                fixed (char* t = Strings.T("Pause Tracking", "暂停记录", "暫停記錄")) AppendMenuW(menu, MF_POPUP, (nuint)pause, t);
            }

            Add(menu, Strings.T("Exit", "退出", "結束"), CmdExit, MF_STRING);

            POINT pt;
            GetCursorPos(&pt);
            // Required so the menu closes when the user clicks elsewhere.
            SetForegroundWindow(_hwnd);
            var command = TrackPopupMenu(menu, TPM_RETURNCMD | TPM_RIGHTBUTTON | TPM_NONOTIFY, pt.X, pt.Y, 0, _hwnd, IntPtr.Zero);
            PostMessageW(_hwnd, WM_NULL, IntPtr.Zero, IntPtr.Zero);

            switch (command)
            {
                case CmdOpen:
                    OpenDashboard();
                    break;
                case CmdUpdate when update != null:
                    Win32.Open(update.Url);
                    break;
                case CmdResume:
                    _tracker.Resume();
                    break;
                case CmdPause15:
                    _tracker.Pause(DateTimeOffset.Now.AddMinutes(15));
                    break;
                case CmdPause60:
                    _tracker.Pause(DateTimeOffset.Now.AddHours(1));
                    break;
                case CmdPauseTomorrow:
                    _tracker.Pause(new DateTimeOffset(DateTime.Today.AddDays(1)));
                    break;
                case CmdPauseOpen:
                    _tracker.Pause(null);
                    break;
                case CmdExit:
                    _onExit();
                    DestroyWindow(_hwnd);
                    break;
            }
        }
        finally
        {
            DestroyMenu(menu);
        }
    }

    /// <summary>" (paused until 15:45)", or "until tomorrow" for a pause that ends at midnight.</summary>
    private static string PausedLabel(DateTimeOffset? until)
    {
        if (until is not { } end) return Strings.T(" (paused)", "（已暂停）", "（已暫停）");
        var local = end.ToLocalTime();
        if (local.TimeOfDay == TimeSpan.Zero) return Strings.T(" (paused until tomorrow)", "（暂停到明天）", "（暫停到明天）");
        var time = local.ToString("HH:mm", System.Globalization.CultureInfo.InvariantCulture);
        return Strings.T($" (paused until {time})", $"（暂停到 {time}）", $"（暫停到 {time}）");
    }

    private void OpenDashboard() => Win32.Open(ApiServer.DashboardUrl(_settings.Settings.PairingCode));

    private static void Add(IntPtr menu, string text, int id, uint flags)
    {
        fixed (char* t = text) AppendMenuW(menu, flags, (nuint)id, t);
    }

    private static void Separator(IntPtr menu) => AppendMenuW(menu, MF_SEPARATOR, 0, null);
}
