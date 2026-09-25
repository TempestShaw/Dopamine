using System.Runtime.InteropServices;
using DopamineWin.Models;
using static DopamineWin.Native.Win32;

namespace DopamineWin;

/// <summary>
/// The small panel that opens above the tray icon: today's total, the category mix and the top
/// apps, like the macOS menu bar popover. Drawn with plain GDI into one borderless window, so it
/// adds almost nothing to the exe. It closes when it loses focus.
/// </summary>
public sealed unsafe class TrayPanel
{
    private const int Width = 320; // logical pixels
    private const int IdOpen = 1, IdPause = 2;

    private static TrayPanel? _instance;

    private readonly IntPtr _trayWindow;
    private readonly WindowTracker _tracker;
    private readonly SettingsService _settings;
    private readonly DatabaseService _database;
    private readonly Action _openDashboard;
    private readonly IntPtr _hwnd;
    private readonly IntPtr _arrow = LoadCursorW(IntPtr.Zero, IDC_ARROW);
    private readonly IntPtr _hand = LoadCursorW(IntPtr.Zero, IDC_HAND);
    private readonly bool _rounded;
    private readonly List<(RECT Rect, int Id)> _hits = [];
    private readonly Dictionary<(string Path, int Size), IntPtr> _icons = new();

    private TodaySummary _data = new(0, new long[5], []);
    private Dictionary<string, StoredApp> _apps = new();
    private Palette _colors = Palette.Light;
    private double _scale = 1;
    private int _width, _height;
    private int _hover = -1;
    private long _hiddenAt;
    private IntPtr _caption, _body, _bodyBold, _big;

    public TrayPanel(IntPtr trayWindow, IntPtr module, WindowTracker tracker, SettingsService settings, DatabaseService database, Action openDashboard)
    {
        _instance = this;
        _trayWindow = trayWindow;
        _tracker = tracker;
        _settings = settings;
        _database = database;
        _openDashboard = openDashboard;

        fixed (char* className = "DopaminePanel")
        {
            var wc = new WNDCLASSEXW
            {
                cbSize = (uint)sizeof(WNDCLASSEXW),
                style = CS_DROPSHADOW,
                lpfnWndProc = &WndProc,
                hInstance = module,
                hCursor = _arrow,
                lpszClassName = className,
            };
            RegisterClassExW(&wc);
            _hwnd = CreateWindowExW(WS_EX_TOOLWINDOW | WS_EX_TOPMOST, className, className, WS_POPUP, 0, 0, 1, 1, IntPtr.Zero, IntPtr.Zero, module, IntPtr.Zero);
        }

        // Windows 11 rounds the corners and draws a hairline border; Windows 10 keeps them square.
        uint corner = DWMWCP_ROUND;
        _rounded = DwmSetWindowAttribute(_hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, &corner, sizeof(uint)) == 0;
    }

    /// <summary>Opens the panel above the tray icon, or closes it if it is open.</summary>
    public void Toggle()
    {
        if (IsWindowVisible(_hwnd) != 0)
        {
            Hide();
            return;
        }

        // The click that just closed it by taking focus away shouldn't reopen it.
        if (Environment.TickCount64 - _hiddenAt < 300) return;
        Show();
    }

    private void Show()
    {
        try
        {
            _data = TodaySummary.Compute(_database, _settings.Settings);
            _apps = _database.GetApps(_data.Apps.Take(5).Select(a => a.Process));
        }
        catch (Exception ex)
        {
            Log.Error("Could not compute today's summary", ex);
        }

        _colors = Palette.Current();

        // Anchor on the tray icon (or the cursor when the icon is in the overflow area).
        var id = new NOTIFYICONIDENTIFIER { cbSize = (uint)sizeof(NOTIFYICONIDENTIFIER), hWnd = _trayWindow, uID = 1 };
        RECT anchor;
        if (Shell_NotifyIconGetRect(&id, &anchor) != 0)
        {
            POINT pt;
            GetCursorPos(&pt);
            anchor = new RECT(pt.X, pt.Y, pt.X + 1, pt.Y + 1);
        }

        var center = new POINT { X = (anchor.Left + anchor.Right) / 2, Y = (anchor.Top + anchor.Bottom) / 2 };
        var monitor = MonitorFromPoint(center, MONITOR_DEFAULTTONEAREST);
        var info = new MONITORINFO { cbSize = (uint)sizeof(MONITORINFO) };
        GetMonitorInfoW(monitor, &info);
        uint dpiX = 96, dpiY = 96;
        try
        {
            if (GetDpiForMonitor(monitor, 0, &dpiX, &dpiY) != 0) dpiX = 96;
        }
        catch (Exception)
        {
            // shcore.dll is missing on very old Windows: assume 100%.
        }

        SetScale(dpiX / 96.0);
        _width = S(Width);
        _height = Measure();

        var work = info.rcWork;
        var gap = S(12);
        int x = center.X - _width / 2, y;
        if (anchor.Top >= work.Bottom - 1) y = work.Bottom - _height - gap; // taskbar at the bottom
        else if (anchor.Bottom <= work.Top + 1) y = work.Top + gap; // top
        else if (anchor.Left >= work.Right - 1) (x, y) = (work.Right - _width - gap, center.Y - _height / 2); // right
        else if (anchor.Right <= work.Left + 1) (x, y) = (work.Left + gap, center.Y - _height / 2); // left
        else y = work.Bottom - _height - gap;
        x = Math.Clamp(x, work.Left + gap, Math.Max(work.Left + gap, work.Right - _width - gap));
        y = Math.Clamp(y, work.Top + gap, Math.Max(work.Top + gap, work.Bottom - _height - gap));

        _hover = -1;
        SetWindowPos(_hwnd, -1 /* HWND_TOPMOST */, x, y, _width, _height, SWP_SHOWWINDOW);
        SetForegroundWindow(_hwnd);
        InvalidateRect(_hwnd, null, 0);
    }

    private void Hide()
    {
        ShowWindow(_hwnd, SW_HIDE);
        _hiddenAt = Environment.TickCount64;
    }

    private int S(double logical) => (int)Math.Round(logical * _scale);

    private void SetScale(double scale)
    {
        if (_caption != IntPtr.Zero && Math.Abs(scale - _scale) < 0.001) return;
        _scale = scale;
        foreach (var f in new[] { _caption, _body, _bodyBold, _big })
            if (f != IntPtr.Zero) DeleteObject(f);
        _caption = Font(12, 400);
        _body = Font(13, 400);
        _bodyBold = Font(13, 600);
        _big = Font(28, 600);
    }

    private IntPtr Font(int px, int weight)
    {
        // Segoe UI; Windows links Microsoft YaHei / JhengHei in for Chinese.
        fixed (char* face = "Segoe UI")
            return CreateFontW(-S(px), 0, 0, 0, weight, 0, 0, 0, 1 /* DEFAULT_CHARSET */, 0, 0, 5 /* CLEARTYPE_QUALITY */, 0, face);
    }

    [UnmanagedCallersOnly]
    private static IntPtr WndProc(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam)
    {
        try
        {
            if (_instance is { } panel && panel.Handle(hwnd, msg, wParam, lParam) is { } result) return result;
        }
        catch (Exception ex)
        {
            Log.Error("Panel message failed", ex);
        }

        return DefWindowProcW(hwnd, msg, wParam, lParam);
    }

    private IntPtr? Handle(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam)
    {
        switch (msg)
        {
            case WM_ACTIVATE:
                if (((int)wParam & 0xFFFF) == WA_INACTIVE) Hide();
                return IntPtr.Zero;

            case WM_KEYDOWN:
                if ((int)wParam == VK_ESCAPE) Hide();
                return IntPtr.Zero;

            case WM_ERASEBKGND:
                return 1;

            case WM_PAINT:
            {
                PAINTSTRUCT ps;
                var dc = BeginPaint(hwnd, &ps);
                Paint(dc);
                EndPaint(hwnd, &ps);
                return IntPtr.Zero;
            }

            case WM_MOUSEMOVE:
            {
                var hit = HitTest(lParam);
                if (hit != _hover)
                {
                    _hover = hit;
                    InvalidateRect(hwnd, null, 0);
                }

                var track = new TRACKMOUSEEVENT { cbSize = (uint)sizeof(TRACKMOUSEEVENT), dwFlags = TME_LEAVE, hwndTrack = hwnd };
                TrackMouseEvent(&track);
                return IntPtr.Zero;
            }

            case WM_MOUSELEAVE:
                if (_hover != -1)
                {
                    _hover = -1;
                    InvalidateRect(hwnd, null, 0);
                }

                return IntPtr.Zero;

            case WM_SETCURSOR:
                SetCursor(_hover > 0 ? _hand : _arrow);
                return 1;

            case WM_LBUTTONUP:
                switch (HitTest(lParam))
                {
                    case IdOpen:
                        Hide();
                        _openDashboard();
                        break;
                    case IdPause:
                        _tracker.SetUserPaused(!_tracker.IsPaused);
                        InvalidateRect(hwnd, null, 0);
                        break;
                }

                return IntPtr.Zero;
        }

        return null;
    }

    private int HitTest(IntPtr lParam)
    {
        int x = (short)((long)lParam & 0xFFFF), y = (short)(((long)lParam >> 16) & 0xFFFF);
        foreach (var (rect, id) in _hits)
            if (rect.Contains(x, y)) return id;
        return -1;
    }

    // ---- Drawing --------------------------------------------------------------------------------

    private int Measure()
    {
        var screen = GetDC(IntPtr.Zero);
        var dc = CreateCompatibleDC(screen);
        var bitmap = CreateCompatibleBitmap(screen, _width, 1);
        var old = SelectObject(dc, bitmap);
        var height = Draw(dc);
        SelectObject(dc, old);
        DeleteObject(bitmap);
        DeleteDC(dc);
        ReleaseDC(IntPtr.Zero, screen);
        return height;
    }

    /// <summary>Double-buffered: everything is drawn off-screen, then copied in one go.</summary>
    private void Paint(IntPtr target)
    {
        var dc = CreateCompatibleDC(target);
        var bitmap = CreateCompatibleBitmap(target, _width, _height);
        var old = SelectObject(dc, bitmap);
        Draw(dc);
        BitBlt(target, 0, 0, _width, _height, dc, 0, 0, SRCCOPY);
        SelectObject(dc, old);
        DeleteObject(bitmap);
        DeleteDC(dc);
    }

    /// <summary>Draws the panel and returns its height.</summary>
    private int Draw(IntPtr dc)
    {
        _hits.Clear();
        var c = _colors;
        var pad = S(16);
        var right = _width - pad;
        var y = pad;

        Fill(dc, new RECT(0, 0, _width, Math.Max(_height, 1)), c.Background);
        if (!_rounded) Frame(dc, new RECT(0, 0, _width, _height), c.Line);
        SetBkMode(dc, TRANSPARENT);

        // Today · status
        Text(dc, Strings.T("Today", "今天", "今天"), _caption, c.Muted, new RECT(pad, y, right, y + S(16)), 0);
        var paused = _tracker.IsPaused;
        var (status, statusColor) = paused ? (Strings.T("Paused", "已暂停", "已暫停"), Palette.Entertainment)
            : _tracker.IsIdle ? (Strings.T("Idle", "闲置", "閒置"), c.Muted)
            : (Strings.T("Recording", "记录中", "記錄中"), Palette.Study);
        var statusWidth = Measure(dc, status, _caption);
        Text(dc, status, _caption, c.Ink, new RECT(right - statusWidth, y, right, y + S(16)), 0);
        Fill(dc, Box(right - statusWidth - S(12), y + S(5), S(7)), statusColor);
        y += S(18);

        // Total · focus share
        var total = _data.Total;
        Text(dc, TodaySummary.Format(total), _big, c.Ink, new RECT(pad, y, right, y + S(38)), 0);
        if (total > 0)
        {
            var share = (int)Math.Round(100.0 * _data.Focus / total);
            Text(dc, Strings.T($"{share}% focused", $"专注 {share}%", $"專注 {share}%"), _caption, c.Muted, new RECT(pad, y + S(16), right, y + S(34)), DT_RIGHT);
        }

        y += S(44);

        if (total > 0)
        {
            // One bar split by category, then a legend for the biggest four.
            var order = Categories.All.Where(k => _data.ByCategory[(int)k] > 0).OrderByDescending(k => _data.ByCategory[(int)k]).ToList();
            var barWidth = right - pad;
            long before = 0;
            for (var i = 0; i < order.Count; i++)
            {
                var seconds = _data.ByCategory[(int)order[i]];
                var x0 = pad + (int)(barWidth * before / total);
                var x1 = pad + (int)(barWidth * (before + seconds) / total) - (i < order.Count - 1 ? S(2) : 0);
                Fill(dc, new RECT(x0, y, Math.Max(x1, x0 + 1), y + S(6)), Palette.Of(order[i]));
                before += seconds;
            }

            y += S(14);
            var lx = pad;
            foreach (var k in order.Take(4))
            {
                var label = $"{Name(k)} {TodaySummary.Format(_data.ByCategory[(int)k])}";
                var w = Measure(dc, label, _caption);
                if (lx + S(11) + w > right) break;
                Fill(dc, Box(lx, y + S(5), S(7)), Palette.Of(k));
                Text(dc, label, _caption, c.Muted, new RECT(lx + S(11), y, lx + S(11) + w + 1, y + S(16)), 0);
                lx += S(11) + w + S(14);
            }

            y += S(28);

            // Top apps: icon, name, time, and a thin bar against the busiest one.
            var top = _data.Apps.Take(5).ToList();
            var max = Math.Max(1, top[0].Seconds);
            foreach (var app in top)
            {
                DrawIcon(dc, app, pad, y + S(1), S(20));
                var time = TodaySummary.Format(app.Seconds);
                var timeWidth = Measure(dc, time, _body);
                var textLeft = pad + S(30);
                Text(dc, app.Name, _body, c.Ink, new RECT(textLeft, y, right - timeWidth - S(10), y + S(20)), DT_END_ELLIPSIS);
                Text(dc, time, _body, c.Muted, new RECT(right - timeWidth, y, right, y + S(20)), 0);
                var barTop = y + S(25);
                Fill(dc, new RECT(textLeft, barTop, right, barTop + S(3)), c.Track);
                Fill(dc, new RECT(textLeft, barTop, textLeft + Math.Max(S(3), (int)((right - textLeft) * app.Seconds / max)), barTop + S(3)), Palette.Of(app.Category));
                y += S(38);
            }
        }
        else
        {
            var empty = paused ? Strings.T("Tracking is paused.", "已暂停记录。", "已暫停記錄。") : Strings.T("Nothing tracked yet today.", "今天还没有记录。", "今天還沒有紀錄。");
            Text(dc, empty, _body, c.Muted, new RECT(pad, y, right, y + S(40)), DT_CENTER);
            y += S(48);
        }

        // Divider, the main button, and a footer with the pairing code and pause.
        Fill(dc, new RECT(pad, y, right, y + 1), c.Line);
        y += S(12);

        var button = new RECT(pad, y, right, y + S(34));
        Fill(dc, button, _hover == IdOpen ? c.InkHover : c.Ink);
        Text(dc, Strings.T("Open Dashboard", "打开仪表板", "打開儀表板"), _bodyBold, c.Background, button, DT_CENTER);
        _hits.Add((button, IdOpen));
        y += S(34) + S(12);

        var codeLabel = Strings.T("Pairing code", "配对码", "配對碼") + "  ";
        var codeLabelWidth = Measure(dc, codeLabel, _caption);
        Text(dc, codeLabel, _caption, c.Muted, new RECT(pad, y, right, y + S(18)), 0);
        var code = _settings.Settings.PairingCode;
        Text(dc, code, _bodyBold, c.Ink, new RECT(pad + codeLabelWidth, y, right, y + S(18)), 0);

        var pause = paused ? Strings.T("Resume", "继续", "繼續") : Strings.T("Pause", "暂停", "暫停");
        var pauseWidth = Measure(dc, pause, _caption);
        var pauseRect = new RECT(right - pauseWidth, y, right, y + S(18));
        Text(dc, pause, _caption, c.Ink, pauseRect, 0);
        if (_hover == IdPause) Fill(dc, new RECT(pauseRect.Left, pauseRect.Bottom - 1, pauseRect.Right, pauseRect.Bottom), c.Ink);
        _hits.Add((new RECT(pauseRect.Left - S(6), pauseRect.Top - S(4), pauseRect.Right + S(6), pauseRect.Bottom + S(4)), IdPause));
        y += S(18);

        return y + pad;
    }

    private static string Name(Category k) => k switch
    {
        Category.Work => Strings.T("Work", "工作", "工作"),
        Category.Study => Strings.T("Study", "学习", "學習"),
        Category.Social => Strings.T("Social", "社交", "社交"),
        Category.Entertainment => Strings.T("Entertainment", "娱乐", "娛樂"),
        _ => Strings.T("Other", "其他", "其他"),
    };

    private void DrawIcon(IntPtr dc, AppUsage app, int x, int y, int size)
    {
        var path = _apps.GetValueOrDefault(app.Process)?.Path;
        if (path != null)
        {
            if (!_icons.TryGetValue((path, size), out var icon))
            {
                IntPtr large = IntPtr.Zero, small = IntPtr.Zero;
                fixed (char* p = path)
                    if (SHDefExtractIconW(p, 0, 0, &large, &small, (uint)(size | (size << 16))) != 0) large = IntPtr.Zero;
                if (small != IntPtr.Zero) DestroyIcon(small);
                _icons[(path, size)] = icon = large;
            }

            if (icon != IntPtr.Zero && DrawIconEx(dc, x, y, icon, size, size, 0, IntPtr.Zero, DI_NORMAL) != 0) return;
        }

        // No icon (e.g. Store apps): a dab of the category colour with the first letter.
        Fill(dc, Box(x, y, size), Palette.Of(app.Category));
        Text(dc, app.Name.Length > 0 ? app.Name[..1].ToUpperInvariant() : "?", _bodyBold, 0xFFFFFF, new RECT(x, y, x + size, y + size), DT_CENTER);
    }

    private static RECT Box(int x, int y, int size) => new(x, y, x + size, y + size);

    private static void Fill(IntPtr dc, RECT rect, uint color)
    {
        var brush = CreateSolidBrush(color);
        FillRect(dc, &rect, brush);
        DeleteObject(brush);
    }

    private static void Frame(IntPtr dc, RECT r, uint color)
    {
        Fill(dc, new RECT(r.Left, r.Top, r.Right, r.Top + 1), color);
        Fill(dc, new RECT(r.Left, r.Bottom - 1, r.Right, r.Bottom), color);
        Fill(dc, new RECT(r.Left, r.Top, r.Left + 1, r.Bottom), color);
        Fill(dc, new RECT(r.Right - 1, r.Top, r.Right, r.Bottom), color);
    }

    private static void Text(IntPtr dc, string text, IntPtr font, uint color, RECT rect, uint align)
    {
        var old = SelectObject(dc, font);
        SetTextColor(dc, color);
        fixed (char* t = text)
            DrawTextW(dc, t, text.Length, &rect, align | DT_SINGLELINE | DT_VCENTER | DT_NOPREFIX);
        SelectObject(dc, old);
    }

    private static int Measure(IntPtr dc, string text, IntPtr font)
    {
        var old = SelectObject(dc, font);
        SIZE size;
        fixed (char* t = text)
            GetTextExtentPoint32W(dc, t, text.Length, &size);
        SelectObject(dc, old);
        return size.cx;
    }

    /// <summary>The dashboard's paper and ink, as GDI colours (0x00BBGGRR).</summary>
    private readonly record struct Palette(uint Background, uint Ink, uint InkHover, uint Muted, uint Line, uint Track)
    {
        public static readonly Palette Light = new(Rgb(0xf6f3ec), Rgb(0x221f1b), Rgb(0x3a352f), Rgb(0x7a7266), Rgb(0xe2dccf), Rgb(0xebe6db));
        public static readonly Palette Dark = new(Rgb(0x1c1b18), Rgb(0xf1ece2), Rgb(0xd9d3c7), Rgb(0xa39b8f), Rgb(0x34302a), Rgb(0x2a2723));

        public static readonly uint Work = Rgb(0x2f6bff), Study = Rgb(0x4fb58a), Social = Rgb(0xe8799f), Entertainment = Rgb(0xeea062), Other = Rgb(0xb3a6dc);

        public static uint Of(Category c) => c switch
        {
            Category.Work => Work,
            Category.Study => Study,
            Category.Social => Social,
            Category.Entertainment => Entertainment,
            _ => Other,
        };

        private static uint Rgb(uint hex) => ((hex & 0xFF) << 16) | (hex & 0xFF00) | ((hex >> 16) & 0xFF);

        /// <summary>Follows "Choose your app mode" in Windows settings.</summary>
        public static Palette Current()
        {
            uint value = 1, size = sizeof(uint);
            fixed (char* key = @"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize")
            fixed (char* name = "AppsUseLightTheme")
            {
                // HKEY_CURRENT_USER, RRF_RT_REG_DWORD
                if (RegGetValueW(unchecked((IntPtr)(int)0x80000001), key, name, 0x10, null, &value, &size) != 0) value = 1;
            }

            return value == 0 ? Dark : Light;
        }
    }
}
