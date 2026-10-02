using System.Runtime.InteropServices;
using DopamineWin.Native;
using static DopamineWin.Native.Win32;

namespace DopamineWin;

/// <summary>
/// The dashboard in its own window: a plain Win32 window hosting WebView2 (the Edge runtime that
/// ships with Windows 10 and 11), pointed at the same local dashboard a browser would show.
/// Closing it closes the browser engine too, so the tray agent goes back to its usual footprint.
/// If WebView2 isn't available, the dashboard opens in the default browser as before.
///
/// The window has no Windows title bar: the page draws its own, with the dashboard's buttons and
/// the minimise, maximise and close buttons, the way Discord or VS Code do. The page marks that bar
/// with the CSS <c>app-region: drag</c>, so it moves the window, snaps, and double-clicks to
/// maximise. The resize borders stay Windows' own. On a WebView2 runtime too old for <c>app-region</c>,
/// the window keeps its usual title bar.
/// </summary>
public sealed unsafe class DashboardWindow
{
    private const string ClassName = "DopamineDashboard";
    private const int ApplicationIconId = 32512;
    private const int Width = 1280, Height = 860, MinWidth = 420, MinHeight = 360; // at 96 dpi

    /// <summary>A strip along the top edge left uncovered by the page, so the window can be resized from there (at 96 dpi).</summary>
    private const int TopResizeBand = 4;

    /// <summary>Posted to the window when settings change, so it recolours for the dashboard's theme on its own thread.</summary>
    private const uint ThemeChangedMessage = WM_APP + 1;

    // The colour of the page's title bar and sidebar (--chrome in globals.css) and its ink (--ink),
    // so the window never flashes white while loading and its top edge matches the page.
    private static readonly (byte R, byte G, byte B) LightPaper = (0xeb, 0xe6, 0xdb), DarkPaper = (0x0f, 0x0e, 0x0c);
    private static readonly (byte R, byte G, byte B) LightInk = (0x22, 0x1f, 0x1b), DarkInk = (0xf1, 0xec, 0xe2);

    private static uint ColorRef((byte R, byte G, byte B) c) => (uint)(c.R | c.G << 8 | c.B << 16);

    private static DashboardWindow? _instance; // the window procedure is static; it reaches the window through this

    private readonly SettingsService _settings;
    private IntPtr _hwnd;
    private IntPtr _controller;
    private IntPtr _webview;
    private bool _creating;
    private bool _loggedLoad;
    private bool _frameless = true; // until the runtime turns out too old for app-region
    private WINDOWPLACEMENT? _placement; // where the window was last closed, for this run

    public DashboardWindow(SettingsService settings)
    {
        _settings = settings;
        _instance = this;
        // Raised on the API's threads; the window and WebView2 may only be touched on the tray's UI thread.
        _settings.Changed += () =>
        {
            var hwnd = _hwnd;
            if (hwnd != IntPtr.Zero) PostMessageW(hwnd, ThemeChangedMessage, IntPtr.Zero, IntPtr.Zero);
        };
    }

    private string Url => ApiServer.DashboardUrl(_settings.Settings.PairingCode);

    /// <summary>Tells the page to draw the title bar and window buttons itself.</summary>
    private string WindowUrl => _frameless ? ApiServer.DashboardUrl(_settings.Settings.PairingCode, customFrame: true) : Url;

    /// <summary>Opens the window, or brings it to the front if it's already open. Call on the tray's UI thread.</summary>
    public void Show()
    {
        if (_hwnd != IntPtr.Zero)
        {
            if (IsIconic(_hwnd) != 0) ShowWindow(_hwnd, SW_RESTORE);
            SetForegroundWindow(_hwnd);
            return;
        }

        if (_creating) return;
        _creating = true;

        int hr;
        var handler = WebView2.Handler(WebView2.IID_EnvironmentCompleted, OnEnvironmentCreated);
        try
        {
            fixed (char* data = AppInfo.DataFile("WebView2"))
                hr = WebView2.CreateCoreWebView2EnvironmentWithOptions(null, data, IntPtr.Zero, handler);
        }
        catch (Exception ex)
        {
            Log.Error("Could not load WebView2", ex);
            hr = Marshal.GetHRForException(ex);
        }
        finally
        {
            WebView2.Release(ref handler);
        }

        if (hr < 0) Fallback($"WebView2 is not available (0x{hr:X8})");
    }

    /// <summary>Closes the window, if open. Used when Dopamine exits.</summary>
    public void Close()
    {
        if (_hwnd != IntPtr.Zero) DestroyWindow(_hwnd);
    }

    private void OnEnvironmentCreated(IntPtr result, IntPtr environment)
    {
        var hr = WebView2.HResult(result);
        if (hr < 0 || environment == IntPtr.Zero)
        {
            Fallback($"Could not start WebView2 (0x{hr:X8})");
            return;
        }

        if (!CreateWindow())
        {
            Fallback("Could not create the dashboard window");
            return;
        }

        var handler = WebView2.Handler(WebView2.IID_ControllerCompleted, OnControllerCreated);
        hr = WebView2.CreateController(environment, _hwnd, handler);
        WebView2.Release(ref handler);
        if (hr < 0)
        {
            DestroyWindow(_hwnd);
            Fallback($"Could not create the WebView2 controller (0x{hr:X8})");
        }
    }

    private void OnControllerCreated(IntPtr result, IntPtr controller)
    {
        _creating = false;
        var hr = WebView2.HResult(result);
        if (hr < 0 || controller == IntPtr.Zero)
        {
            if (_hwnd != IntPtr.Zero) DestroyWindow(_hwnd);
            Fallback($"Could not create the WebView2 controller (0x{hr:X8})");
            return;
        }

        if (_hwnd == IntPtr.Zero)
        {
            WebView2.Close(controller); // closed while loading
            return;
        }

        WebView2.AddRef(controller); // the callback only lends it
        _controller = controller;
        _webview = WebView2.GetCoreWebView2(controller);

        ApplyTheme();

        ConfigureSettings();

        AddHandler(WebView2.IID_NewWindowRequested, OnNewWindowRequested, WebView2.AddNewWindowRequested);
        AddHandler(WebView2.IID_NavigationStarting, OnNavigationStarting, WebView2.AddNavigationStarting);
        AddHandler(WebView2.IID_NavigationCompleted, OnNavigationCompleted, WebView2.AddNavigationCompleted);
        AddHandler(WebView2.IID_WebMessageReceived, OnWebMessageReceived, WebView2.AddWebMessageReceived);

        Resize();
        WebView2.SetVisible(_controller, true);
        WebView2.Navigate(_webview, WindowUrl);
        WebView2.MoveFocus(_controller);
    }

    /// <summary>Makes the page behave like an app rather than a browser tab.</summary>
    private void ConfigureSettings()
    {
        var settings = WebView2.GetSettings(_webview);
        if (settings == IntPtr.Zero)
        {
            UseWindowsTitleBar();
            return;
        }

        WebView2.SetStatusBarEnabled(settings, false); // no link previews in the corner, as in a browser
#if !DEBUG
        WebView2.SetDevToolsEnabled(settings, false);

        // No reload, find, print or zoom keys. Copy, paste and the other editing keys still work.
        var settings3 = WebView2.QueryInterface(settings, WebView2.IID_Settings3);
        if (settings3 != IntPtr.Zero)
        {
            WebView2.SetBrowserAcceleratorKeysEnabled(settings3, false);
            WebView2.Release(ref settings3);
        }
#endif

        var settings9 = WebView2.QueryInterface(settings, WebView2.IID_Settings9);
        var dragRegions = settings9 != IntPtr.Zero && WebView2.SetNonClientRegionSupportEnabled(settings9, true) >= 0;
        WebView2.Release(ref settings9);
        WebView2.Release(ref settings);
        if (!dragRegions)
        {
            Log.Info("This WebView2 runtime has no app-region support; the dashboard window keeps the Windows title bar");
            UseWindowsTitleBar();
        }
    }

    /// <summary>Gives the window back its usual title bar, for runtimes that can't drag it by the page's.</summary>
    private void UseWindowsTitleBar()
    {
        if (!_frameless) return;
        _frameless = false;
        SetWindowPos(_hwnd, IntPtr.Zero, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED);
        Resize();
    }

    /// <summary>The page's window buttons: "minimize", "maximize" (which restores a maximised window), "close"; "state" asks for <see cref="PostWindowState"/>.</summary>
    private void OnWebMessageReceived(IntPtr sender, IntPtr args)
    {
        if (!IsDashboard(WebView2.GetUri(args))) return;
        switch (WebView2.GetWebMessageAsString(args))
        {
            case "minimize":
                ShowWindow(_hwnd, SW_MINIMIZE);
                break;
            case "maximize":
                ShowWindow(_hwnd, IsZoomed(_hwnd) != 0 ? SW_RESTORE : SW_MAXIMIZE);
                break;
            case "close":
                PostMessageW(_hwnd, WM_CLOSE, IntPtr.Zero, IntPtr.Zero);
                break;
            case "state":
                PostWindowState();
                break;
        }
    }

    /// <summary>Tells the page whether the window is maximised, so its maximise button shows the right glyph.</summary>
    private void PostWindowState()
    {
        if (_webview == IntPtr.Zero) return;
        WebView2.PostWebMessageAsJson(_webview, IsZoomed(_hwnd) != 0 ? """{"maximized":true}""" : """{"maximized":false}""");
    }

    private void AddHandler(Guid iid, Action<IntPtr, IntPtr> invoke, Func<IntPtr, IntPtr, int> add)
    {
        var handler = WebView2.Handler(iid, invoke);
        add(_webview, handler);
        WebView2.Release(ref handler);
    }

    /// <summary>Links that open a new window (release notes, the source code) go to the default browser.</summary>
    private static void OnNewWindowRequested(IntPtr sender, IntPtr args)
    {
        var uri = WebView2.GetUri(args);
        WebView2.SetNewWindowHandled(args);
        OpenExternally(uri);
    }

    /// <summary>The window only ever shows the local dashboard; anything else opens in the browser.</summary>
    private static void OnNavigationStarting(IntPtr sender, IntPtr args)
    {
        var uri = WebView2.GetUri(args);
        if (IsDashboard(uri)) return;
        WebView2.CancelNavigation(args);
        OpenExternally(uri);
    }

    private void OnNavigationCompleted(IntPtr sender, IntPtr args)
    {
        var success = WebView2.NavigationSucceeded(args);
        if (success && _loggedLoad) return;
        _loggedLoad |= success;
        Log.Info(success ? "Dashboard window loaded" : "Dashboard window failed to load");
    }

    private static bool IsDashboard(string uri) =>
        Uri.TryCreate(uri, UriKind.Absolute, out var u) && u.Scheme == "http" && u.Port == ApiServer.Port &&
        (u.Host == "localhost" || u.Host == "127.0.0.1");

    private static void OpenExternally(string uri)
    {
        if (Uri.TryCreate(uri, UriKind.Absolute, out var u) && (u.Scheme == "https" || u.Scheme == "http" || u.Scheme == "mailto"))
            Win32.Open(uri);
    }

    private void Fallback(string reason)
    {
        _creating = false;
        Log.Error($"{reason}; opening the dashboard in the browser instead");
        Win32.Open(Url);
    }

    private bool CreateWindow()
    {
        var module = GetModuleHandleW(null);
        fixed (char* className = ClassName)
        fixed (char* title = "Dopamine")
        {
            var paper = IsDark() ? DarkPaper : LightPaper;
            var wc = new WNDCLASSEXW
            {
                cbSize = (uint)sizeof(WNDCLASSEXW),
                lpfnWndProc = &WndProc,
                hInstance = module,
                lpszClassName = className,
                hIcon = LoadImageW(module, ApplicationIconId, IMAGE_ICON, GetSystemMetrics(SM_CXICON), GetSystemMetrics(SM_CYICON), LR_DEFAULTCOLOR),
                hIconSm = LoadImageW(module, ApplicationIconId, IMAGE_ICON, GetSystemMetrics(SM_CXSMICON), GetSystemMetrics(SM_CYSMICON), LR_DEFAULTCOLOR),
                hCursor = LoadCursorW(IntPtr.Zero, IDC_ARROW),
                hbrBackground = CreateSolidBrush(ColorRef(paper)),
            };
            RegisterClassExW(&wc); // fails harmlessly once the class exists

            _hwnd = CreateWindowExW(0, className, title, WS_OVERLAPPEDWINDOW, CW_USEDEFAULT, CW_USEDEFAULT, CW_USEDEFAULT, CW_USEDEFAULT,
                IntPtr.Zero, IntPtr.Zero, module, IntPtr.Zero);
        }

        if (_hwnd == IntPtr.Zero) return false;

        // WM_NCCALCSIZE arrived during CreateWindowExW, before _hwnd was known: ask again without the title bar.
        SetWindowPos(_hwnd, IntPtr.Zero, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED);
        ApplyTheme();

        if (_placement is { } saved)
        {
            saved.showCmd = saved.showCmd == SW_SHOWMAXIMIZED ? SW_SHOWMAXIMIZED : SW_SHOWNORMAL;
            SetWindowPlacement(_hwnd, &saved);
        }
        else
        {
            // Centre a comfortable size on the monitor Windows picked, without overflowing a small screen.
            var scale = GetDpiForWindow(_hwnd) / 96.0;
            var monitor = new MONITORINFO { cbSize = (uint)sizeof(MONITORINFO) };
            GetMonitorInfoW(MonitorFromWindow(_hwnd, MONITOR_DEFAULTTONEAREST), &monitor);
            var work = monitor.rcWork;
            var w = Math.Min((int)(Width * scale), (work.Right - work.Left) * 9 / 10);
            var h = Math.Min((int)(Height * scale), (work.Bottom - work.Top) * 9 / 10);
            SetWindowPos(_hwnd, IntPtr.Zero, work.Left + (work.Right - work.Left - w) / 2, work.Top + (work.Bottom - work.Top - h) / 2, w, h,
                SWP_NOZORDER | SWP_NOACTIVATE);
            ShowWindow(_hwnd, SW_SHOWNORMAL);
        }

        SetForegroundWindow(_hwnd);
        return true;
    }

    /// <summary>
    /// Colours the title bar, the window background and WebView2's own background for the theme the
    /// dashboard shows, so its light/dark toggle recolours the whole window at once.
    /// </summary>
    private void ApplyTheme()
    {
        if (_hwnd == IntPtr.Zero) return;
        var isDark = IsDark();
        var paper = isDark ? DarkPaper : LightPaper;
        var dark = isDark ? 1 : 0;
        DwmSetWindowAttribute(_hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE, &dark, sizeof(int));
        // Paper-coloured title bar with ink text. Windows 11 only; Windows 10 ignores these and keeps
        // the light or dark system title bar set above.
        var caption = ColorRef(paper);
        var captionText = ColorRef(isDark ? DarkInk : LightInk);
        DwmSetWindowAttribute(_hwnd, DWMWA_CAPTION_COLOR, &caption, sizeof(uint));
        DwmSetWindowAttribute(_hwnd, DWMWA_TEXT_COLOR, &captionText, sizeof(uint));

        var previous = SetClassLongPtrW(_hwnd, GCLP_HBRBACKGROUND, CreateSolidBrush(ColorRef(paper)));
        if (previous != IntPtr.Zero) DeleteObject(previous);

        if (_controller == IntPtr.Zero) return;
        var controller2 = WebView2.QueryInterface(_controller, WebView2.IID_Controller2);
        if (controller2 == IntPtr.Zero) return;
        WebView2.SetDefaultBackgroundColor(controller2, paper.R, paper.G, paper.B);
        WebView2.Release(ref controller2);
    }

    private void Resize()
    {
        if (_controller == IntPtr.Zero) return;
        RECT bounds;
        GetClientRect(_hwnd, &bounds);
        bounds.Top += TopBand();
        WebView2.SetBounds(_controller, bounds);
    }

    /// <summary>The resize strip above the page: none with a Windows title bar, or when maximised.</summary>
    private int TopBand() => _frameless && IsZoomed(_hwnd) == 0 ? (int)Math.Ceiling(TopResizeBand * GetDpiForWindow(_hwnd) / 96.0) : 0;

    /// <summary>How far a maximised window hangs over the screen edge: its resize border.</summary>
    private int FrameThickness()
    {
        var dpi = GetDpiForWindow(_hwnd);
        return GetSystemMetricsForDpi(SM_CYFRAME, dpi) + GetSystemMetricsForDpi(SM_CXPADDEDBORDER, dpi);
    }

    [UnmanagedCallersOnly]
    private static IntPtr WndProc(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam)
    {
        try
        {
            var window = _instance;
            if (window != null && window._hwnd == hwnd && window.Handle(msg, wParam, lParam) is { } result) return result;
        }
        catch (Exception ex)
        {
            Log.Error("Dashboard window message failed", ex);
        }

        return DefWindowProcW(hwnd, msg, wParam, lParam);
    }

    private IntPtr? Handle(uint msg, IntPtr wParam, IntPtr lParam)
    {
        switch (msg)
        {
            case WM_SIZE:
                Resize();
                PostWindowState();
                return IntPtr.Zero;

            // No title bar: the client area starts at the top edge. The side and bottom resize borders
            // stay as Windows draws them; a maximised window still keeps its top border off screen.
            case WM_NCCALCSIZE when _frameless && wParam != IntPtr.Zero:
            {
                var p = (NCCALCSIZE_PARAMS*)lParam;
                var top = p->rgrc0.Top;
                DefWindowProcW(_hwnd, msg, wParam, lParam);
                p->rgrc0.Top = top + (IsZoomed(_hwnd) != 0 ? FrameThickness() : 0);
                return IntPtr.Zero;
            }

            // The strip above the page resizes the window from the top edge and corners. Windows
            // would still find a caption and its buttons there, so it isn't asked.
            case WM_NCHITTEST when _frameless && IsZoomed(_hwnd) == 0:
            {
                var point = new POINT { X = (short)(long)lParam, Y = (short)((long)lParam >> 16) };
                ScreenToClient(_hwnd, &point);
                if (point.Y >= TopBand()) return null; // the side and bottom borders, as usual
                RECT client;
                GetClientRect(_hwnd, &client);
                var corner = FrameThickness();
                return point.X < corner ? HTTOPLEFT : point.X >= client.Right - corner ? HTTOPRIGHT : HTTOP;
            }

            case ThemeChangedMessage:
                ApplyTheme();
                return IntPtr.Zero;

            case WM_MOVE:
                if (_controller != IntPtr.Zero) WebView2.NotifyParentWindowPositionChanged(_controller);
                return IntPtr.Zero;

            case WM_SETFOCUS:
                if (_controller != IntPtr.Zero) WebView2.MoveFocus(_controller);
                return IntPtr.Zero;

            case WM_GETMINMAXINFO:
            {
                var scale = GetDpiForWindow(_hwnd) / 96.0;
                var info = (MINMAXINFO*)lParam;
                info->ptMinTrackSize.X = (int)(MinWidth * scale);
                info->ptMinTrackSize.Y = (int)(MinHeight * scale);
                return IntPtr.Zero;
            }

            case WM_DPICHANGED:
            {
                // Per-monitor DPI: take the size Windows suggests for the new monitor.
                var r = (RECT*)lParam;
                SetWindowPos(_hwnd, IntPtr.Zero, r->Left, r->Top, r->Right - r->Left, r->Bottom - r->Top, SWP_NOZORDER | SWP_NOACTIVATE);
                return IntPtr.Zero;
            }

            case WM_DESTROY:
            {
                var placement = new WINDOWPLACEMENT { length = (uint)sizeof(WINDOWPLACEMENT) };
                if (GetWindowPlacement(_hwnd, &placement) != 0) _placement = placement;
                if (_controller != IntPtr.Zero) WebView2.Close(_controller);
                WebView2.Release(ref _webview);
                WebView2.Release(ref _controller);
                _hwnd = IntPtr.Zero;
                return IntPtr.Zero;
            }
        }

        return null;
    }

    /// <summary>The dashboard's theme as it last reported it, or Windows' app mode until it has.</summary>
    private bool IsDark() => _settings.Settings.Theme switch
    {
        "dark" => true,
        "light" => false,
        _ => IsDarkMode(),
    };

    /// <summary>Whether Windows is set to dark mode for apps, which the dashboard follows by default.</summary>
    private static bool IsDarkMode()
    {
        uint value = 1, size = sizeof(uint);
        fixed (char* key = @"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize")
        fixed (char* name = "AppsUseLightTheme")
            return RegGetValueW(HKEY_CURRENT_USER, key, name, RRF_RT_REG_DWORD, IntPtr.Zero, &value, &size) == 0 && value == 0;
    }
}
