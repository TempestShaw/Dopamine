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

    public static string GetActiveWindowTitle()
    {
        const int nChars = 256;
        var buff = new StringBuilder(nChars);
        var handle = GetForegroundWindow();

        return GetWindowText(handle, buff, nChars) > 0 ? buff.ToString() : string.Empty;
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