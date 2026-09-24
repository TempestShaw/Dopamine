using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace DopamineWin;

public static partial class NativeMethods
{
    [LibraryImport("user32.dll")]
    private static partial IntPtr GetForegroundWindow();

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

    [LibraryImport("user32.dll", SetLastError = true)]
    private static partial uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [StructLayout(LayoutKind.Sequential)]
    private struct LastInputInfo
    {
        public uint cbSize;
        public uint dwTime;
    }

    [DllImport("user32.dll")]
    private static extern bool GetLastInputInfo(ref LastInputInfo plii);

    /// <summary>Time since the last keyboard or mouse input in this session.</summary>
    public static TimeSpan GetIdleTime()
    {
        var info = new LastInputInfo { cbSize = (uint)Marshal.SizeOf<LastInputInfo>() };
        if (!GetLastInputInfo(ref info)) return TimeSpan.Zero;
        // Both values are 32-bit tick counts; unchecked subtraction handles wrap-around.
        var idleMs = unchecked((uint)Environment.TickCount - info.dwTime);
        return TimeSpan.FromMilliseconds(idleMs);
    }

    public static string GetActiveWindowTitle()
    {
        const int nChars = 256;
        var buff = new StringBuilder(nChars);
        var handle = GetForegroundWindow();

        return GetWindowText(handle, buff, nChars) > 0 ? buff.ToString() : string.Empty;
    }

    private const uint ProcessQueryLimitedInformation = 0x1000;

    [LibraryImport("kernel32.dll", SetLastError = true)]
    private static partial IntPtr OpenProcess(uint access, [MarshalAs(UnmanagedType.Bool)] bool inherit, uint processId);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool QueryFullProcessImageName(IntPtr process, uint flags, StringBuilder name, ref uint size);

    [LibraryImport("kernel32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static partial bool CloseHandle(IntPtr handle);

    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    private static extern int SHDefExtractIcon(string iconFile, int index, uint flags, out IntPtr large, out IntPtr small, uint iconSize);

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static partial bool DestroyIcon(IntPtr icon);

    /// <summary>Full path of the foreground window's executable. Works for most elevated processes too.</summary>
    public static string? GetActiveProcessPath()
    {
        var hWnd = GetForegroundWindow();
        if (GetWindowThreadProcessId(hWnd, out var processId) == 0) return null;

        var handle = OpenProcess(ProcessQueryLimitedInformation, false, processId);
        if (handle == IntPtr.Zero) return null;
        try
        {
            var buffer = new StringBuilder(1024);
            var size = (uint)buffer.Capacity;
            return QueryFullProcessImageName(handle, 0, buffer, ref size) ? buffer.ToString() : null;
        }
        finally
        {
            CloseHandle(handle);
        }
    }

    /// <summary>The executable's icon as a PNG, at <paramref name="size"/> pixels when the file has that resolution.</summary>
    public static byte[]? ExtractIconPng(string exePath, int size = 64)
    {
        IntPtr large = IntPtr.Zero, small = IntPtr.Zero;
        try
        {
            if (SHDefExtractIcon(exePath, 0, 0, out large, out small, (uint)(size | (16 << 16))) == 0 && large != IntPtr.Zero)
            {
                using var icon = Icon.FromHandle(large);
                using var bitmap = icon.ToBitmap();
                return ToPng(bitmap);
            }

            using var associated = Icon.ExtractAssociatedIcon(exePath);
            if (associated == null) return null;
            using var fallback = associated.ToBitmap();
            return ToPng(fallback);
        }
        catch
        {
            return null;
        }
        finally
        {
            if (large != IntPtr.Zero) DestroyIcon(large);
            if (small != IntPtr.Zero) DestroyIcon(small);
        }
    }

    private static byte[] ToPng(Bitmap bitmap)
    {
        using var stream = new MemoryStream();
        bitmap.Save(stream, System.Drawing.Imaging.ImageFormat.Png);
        return stream.ToArray();
    }

    public static string GetActiveProcessName()
    {
        var hWnd = GetForegroundWindow();
        if (GetWindowThreadProcessId(hWnd, out var processId) == 0)
            return string.Empty;

        try
        {
            using var process = Process.GetProcessById((int)processId);
            return process.ProcessName;
        }
        catch
        {
            return string.Empty;
        }
    }
}