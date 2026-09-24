using System.Runtime.InteropServices;

namespace DopamineWin.Native;

/// <summary>
/// The Win32 calls Dopamine needs, declared with blittable signatures only (pointers and integers),
/// so Native AOT can call them directly without runtime marshalling.
/// </summary>
internal static unsafe class Win32
{
    // Window messages
    public const uint WM_NULL = 0x0000;
    public const uint WM_DESTROY = 0x0002;
    public const uint WM_CLOSE = 0x0010;
    public const uint WM_QUERYENDSESSION = 0x0011;
    public const uint WM_ENDSESSION = 0x0016;
    public const uint WM_CONTEXTMENU = 0x007B;
    public const uint WM_POWERBROADCAST = 0x0218;
    public const uint WM_WTSSESSION_CHANGE = 0x02B1;
    public const uint WM_LBUTTONDBLCLK = 0x0203;
    public const uint WM_RBUTTONUP = 0x0205;
    public const uint WM_APP = 0x8000;

    // Session and power events
    public const int WTS_SESSION_LOGON = 5;
    public const int WTS_SESSION_LOGOFF = 6;
    public const int WTS_SESSION_LOCK = 7;
    public const int WTS_SESSION_UNLOCK = 8;
    public const int PBT_APMSUSPEND = 0x4;
    public const int PBT_APMRESUMESUSPEND = 0x7;
    public const int PBT_APMRESUMEAUTOMATIC = 0x12;
    public const uint NOTIFY_FOR_THIS_SESSION = 0;

    // Tray icon
    public const uint NIM_ADD = 0, NIM_MODIFY = 1, NIM_DELETE = 2;
    public const uint NIF_MESSAGE = 0x1, NIF_ICON = 0x2, NIF_TIP = 0x4;

    // Menus
    public const uint MF_STRING = 0x0, MF_GRAYED = 0x1, MF_SEPARATOR = 0x800;
    public const uint TPM_RIGHTBUTTON = 0x2, TPM_RETURNCMD = 0x100, TPM_NONOTIFY = 0x80;

    // Misc
    public const uint IMAGE_ICON = 1;
    public const uint LR_DEFAULTCOLOR = 0;
    public const int SM_CXSMICON = 49, SM_CYSMICON = 50;
    public const int SW_SHOWNORMAL = 1;
    public const uint MB_ICONERROR = 0x10;
    public const uint PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;

    [StructLayout(LayoutKind.Sequential)]
    public struct WNDCLASSEXW
    {
        public uint cbSize;
        public uint style;
        public delegate* unmanaged<IntPtr, uint, IntPtr, IntPtr, IntPtr> lpfnWndProc;
        public int cbClsExtra;
        public int cbWndExtra;
        public IntPtr hInstance;
        public IntPtr hIcon;
        public IntPtr hCursor;
        public IntPtr hbrBackground;
        public char* lpszMenuName;
        public char* lpszClassName;
        public IntPtr hIconSm;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MSG
    {
        public IntPtr hwnd;
        public uint message;
        public IntPtr wParam;
        public IntPtr lParam;
        public uint time;
        public int ptX;
        public int ptY;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT
    {
        public int X;
        public int Y;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct NOTIFYICONDATAW
    {
        public uint cbSize;
        public IntPtr hWnd;
        public uint uID;
        public uint uFlags;
        public uint uCallbackMessage;
        public IntPtr hIcon;
        public fixed char szTip[128];
        public uint dwState;
        public uint dwStateMask;
        public fixed char szInfo[256];
        public uint uVersion;
        public fixed char szInfoTitle[64];
        public uint dwInfoFlags;
        public Guid guidItem;
        public IntPtr hBalloonIcon;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct LASTINPUTINFO
    {
        public uint cbSize;
        public uint dwTime;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct ICONINFO
    {
        public int fIcon;
        public uint xHotspot;
        public uint yHotspot;
        public IntPtr hbmMask;
        public IntPtr hbmColor;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct BITMAP
    {
        public int bmType;
        public int bmWidth;
        public int bmHeight;
        public int bmWidthBytes;
        public ushort bmPlanes;
        public ushort bmBitsPixel;
        public IntPtr bmBits;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct BITMAPINFOHEADER
    {
        public uint biSize;
        public int biWidth;
        public int biHeight;
        public ushort biPlanes;
        public ushort biBitCount;
        public uint biCompression;
        public uint biSizeImage;
        public int biXPelsPerMeter;
        public int biYPelsPerMeter;
        public uint biClrUsed;
        public uint biClrImportant;
    }

    /// <summary>A BITMAPINFO with room for a small colour table GetDIBits may write.</summary>
    [StructLayout(LayoutKind.Sequential)]
    public struct BITMAPINFO
    {
        public BITMAPINFOHEADER bmiHeader;
        public fixed uint bmiColors[4];
    }

    // user32 ---------------------------------------------------------------------------------
    [DllImport("user32.dll")] public static extern ushort RegisterClassExW(WNDCLASSEXW* wc);
    [DllImport("user32.dll")] public static extern IntPtr CreateWindowExW(uint exStyle, char* className, char* windowName, uint style, int x, int y, int w, int h, IntPtr parent, IntPtr menu, IntPtr instance, IntPtr param);
    [DllImport("user32.dll")] public static extern IntPtr DefWindowProcW(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] public static extern int GetMessageW(MSG* msg, IntPtr hwnd, uint min, uint max);
    [DllImport("user32.dll")] public static extern int TranslateMessage(MSG* msg);
    [DllImport("user32.dll")] public static extern IntPtr DispatchMessageW(MSG* msg);
    [DllImport("user32.dll")] public static extern void PostQuitMessage(int exitCode);
    [DllImport("user32.dll")] public static extern int PostMessageW(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] public static extern int DestroyWindow(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern uint RegisterWindowMessageW(char* name);
    [DllImport("user32.dll")] public static extern IntPtr CreatePopupMenu();
    [DllImport("user32.dll")] public static extern int AppendMenuW(IntPtr menu, uint flags, nuint id, char* text);
    [DllImport("user32.dll")] public static extern int SetMenuDefaultItem(IntPtr menu, uint item, uint byPosition);
    [DllImport("user32.dll")] public static extern int TrackPopupMenu(IntPtr menu, uint flags, int x, int y, int reserved, IntPtr hwnd, IntPtr rect);
    [DllImport("user32.dll")] public static extern int DestroyMenu(IntPtr menu);
    [DllImport("user32.dll")] public static extern int GetCursorPos(POINT* point);
    [DllImport("user32.dll")] public static extern int SetForegroundWindow(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern IntPtr LoadImageW(IntPtr instance, IntPtr name, uint type, int cx, int cy, uint flags);
    [DllImport("user32.dll")] public static extern IntPtr LoadIconW(IntPtr instance, IntPtr name);
    [DllImport("user32.dll")] public static extern int GetSystemMetrics(int index);
    [DllImport("user32.dll")] public static extern int MessageBoxW(IntPtr hwnd, char* text, char* caption, uint type);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern int GetWindowTextW(IntPtr hwnd, char* text, int max);
    [DllImport("user32.dll")] public static extern int GetWindowTextLengthW(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, uint* processId);
    [DllImport("user32.dll")] public static extern int GetLastInputInfo(LASTINPUTINFO* info);
    [DllImport("user32.dll")] public static extern int DestroyIcon(IntPtr icon);
    [DllImport("user32.dll")] public static extern int GetIconInfo(IntPtr icon, ICONINFO* info);
    [DllImport("user32.dll")] public static extern IntPtr GetDC(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern int ReleaseDC(IntPtr hwnd, IntPtr dc);

    // gdi32 ----------------------------------------------------------------------------------
    [DllImport("gdi32.dll")] public static extern int GetObjectW(IntPtr obj, int size, void* buffer);
    [DllImport("gdi32.dll")] public static extern int GetDIBits(IntPtr dc, IntPtr bitmap, uint start, uint lines, void* bits, BITMAPINFO* info, uint usage);
    [DllImport("gdi32.dll")] public static extern int DeleteObject(IntPtr obj);

    // kernel32 -------------------------------------------------------------------------------
    [DllImport("kernel32.dll")] public static extern IntPtr GetModuleHandleW(char* name);
    [DllImport("kernel32.dll")] public static extern IntPtr OpenProcess(uint access, int inherit, uint processId);
    [DllImport("kernel32.dll")] public static extern int QueryFullProcessImageNameW(IntPtr process, uint flags, char* name, uint* size);
    [DllImport("kernel32.dll")] public static extern int CloseHandle(IntPtr handle);

    // shell32 / wtsapi32 ---------------------------------------------------------------------
    [DllImport("shell32.dll")] public static extern int Shell_NotifyIconW(uint message, NOTIFYICONDATAW* data);
    [DllImport("shell32.dll")] public static extern IntPtr ShellExecuteW(IntPtr hwnd, char* operation, char* file, char* parameters, char* directory, int show);
    [DllImport("shell32.dll")] public static extern int SHDefExtractIconW(char* iconFile, int index, uint flags, IntPtr* large, IntPtr* small, uint iconSize);
    [DllImport("wtsapi32.dll")] public static extern int WTSRegisterSessionNotification(IntPtr hwnd, uint flags);

    public static void MessageBox(string text, string caption)
    {
        fixed (char* t = text)
        fixed (char* c = caption)
            MessageBoxW(IntPtr.Zero, t, c, MB_ICONERROR);
    }

    /// <summary>Opens a URL (or file) with its default handler.</summary>
    public static void Open(string target)
    {
        fixed (char* op = "open")
        fixed (char* file = target)
            ShellExecuteW(IntPtr.Zero, op, file, null, null, SW_SHOWNORMAL);
    }
}
