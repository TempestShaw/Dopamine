using System.Buffers.Binary;
using System.Diagnostics;
using System.IO.Compression;
using DopamineWin.Native;
using static DopamineWin.Native.Win32;

namespace DopamineWin;

/// <summary>What the tracker asks Windows about the window in front and the apps behind it.</summary>
public static unsafe class NativeMethods
{
    public readonly record struct ForegroundWindow(string Title, uint ProcessId);

    public static ForegroundWindow GetForegroundWindowInfo()
    {
        var hwnd = GetForegroundWindow();
        if (hwnd == IntPtr.Zero) return new ForegroundWindow(string.Empty, 0);

        uint pid;
        GetWindowThreadProcessId(hwnd, &pid);

        var length = Math.Min(GetWindowTextLengthW(hwnd), 4096);
        var title = string.Empty;
        if (length > 0)
        {
            var buffer = stackalloc char[length + 1];
            var copied = GetWindowTextW(hwnd, buffer, length + 1);
            title = new string(buffer, 0, Math.Max(copied, 0));
        }

        return new ForegroundWindow(title, pid);
    }

    /// <summary>Time since the last keyboard or mouse input in this session.</summary>
    public static TimeSpan GetIdleTime()
    {
        var info = new LASTINPUTINFO { cbSize = (uint)sizeof(LASTINPUTINFO) };
        if (GetLastInputInfo(&info) == 0) return TimeSpan.Zero;
        // Both are 32-bit tick counts; unchecked subtraction handles wrap-around.
        return TimeSpan.FromMilliseconds(unchecked((uint)Environment.TickCount - info.dwTime));
    }

    /// <summary>Full path of a process's executable. Works for most elevated processes too.</summary>
    public static string? GetProcessPath(uint processId)
    {
        if (processId == 0) return null;
        var handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, processId);
        if (handle == IntPtr.Zero) return null;
        try
        {
            var buffer = stackalloc char[1024];
            uint size = 1024;
            return QueryFullProcessImageNameW(handle, 0, buffer, &size) != 0 ? new string(buffer, 0, (int)size) : null;
        }
        finally
        {
            CloseHandle(handle);
        }
    }

    /// <summary>The process name as Windows shows it ("chrome", "Code"), the same as Process.ProcessName.</summary>
    public static string GetProcessName(uint processId, string? path)
    {
        if (path != null) return Path.GetFileNameWithoutExtension(path);
        if (processId == 0) return string.Empty;
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

    /// <summary>The executable's icon as a PNG, at <paramref name="size"/> pixels when the file has that resolution.</summary>
    public static byte[]? ExtractIconPng(string exePath, int size = 64)
    {
        IntPtr large = IntPtr.Zero, small = IntPtr.Zero;
        try
        {
            fixed (char* path = exePath)
            {
                if (SHDefExtractIconW(path, 0, 0, &large, &small, (uint)(size | (16 << 16))) != 0 || large == IntPtr.Zero)
                    return null;
            }

            return IconToPng(large);
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

    private static byte[]? IconToPng(IntPtr icon)
    {
        ICONINFO info;
        if (GetIconInfo(icon, &info) == 0) return null;
        var dc = GetDC(IntPtr.Zero);
        try
        {
            if (info.hbmColor == IntPtr.Zero) return null;
            BITMAP bm;
            if (GetObjectW(info.hbmColor, sizeof(BITMAP), &bm) == 0) return null;
            int w = bm.bmWidth, h = bm.bmHeight;
            if (w <= 0 || h <= 0 || w > 512 || h > 512) return null;

            var bgra = ReadBitmap(dc, info.hbmColor, w, h);
            if (bgra == null) return null;

            // Icons without an alpha channel carry transparency in the AND mask instead.
            var hasAlpha = false;
            for (var i = 3; i < bgra.Length; i += 4)
                if (bgra[i] != 0) { hasAlpha = true; break; }
            if (!hasAlpha && info.hbmMask != IntPtr.Zero)
            {
                var mask = ReadBitmap(dc, info.hbmMask, w, h);
                for (var i = 0; i < bgra.Length; i += 4)
                    bgra[i + 3] = mask != null && mask[i] != 0 ? (byte)0 : (byte)255;
            }

            // BGRA -> RGBA
            for (var i = 0; i < bgra.Length; i += 4)
                (bgra[i], bgra[i + 2]) = (bgra[i + 2], bgra[i]);

            return Png.Encode(w, h, bgra);
        }
        finally
        {
            ReleaseDC(IntPtr.Zero, dc);
            if (info.hbmColor != IntPtr.Zero) DeleteObject(info.hbmColor);
            if (info.hbmMask != IntPtr.Zero) DeleteObject(info.hbmMask);
        }
    }

    /// <summary>Reads a bitmap as top-down 32-bit BGRA.</summary>
    private static byte[]? ReadBitmap(IntPtr dc, IntPtr bitmap, int w, int h)
    {
        var bmi = new BITMAPINFO();
        bmi.bmiHeader.biSize = (uint)sizeof(BITMAPINFOHEADER);
        bmi.bmiHeader.biWidth = w;
        bmi.bmiHeader.biHeight = -h; // negative: top-down rows
        bmi.bmiHeader.biPlanes = 1;
        bmi.bmiHeader.biBitCount = 32;
        var pixels = new byte[w * h * 4];
        fixed (byte* p = pixels)
            return GetDIBits(dc, bitmap, 0, (uint)h, p, &bmi, 0) == h ? pixels : null;
    }
}

/// <summary>A tiny PNG writer (RGBA, no filtering) so icons can be sent to the dashboard.</summary>
internal static class Png
{
    private static readonly uint[] CrcTable = BuildCrcTable();

    public static byte[] Encode(int width, int height, byte[] rgba)
    {
        using var output = new MemoryStream();
        output.Write([0x89, (byte)'P', (byte)'N', (byte)'G', 0x0D, 0x0A, 0x1A, 0x0A]);

        var header = new byte[13];
        BinaryPrimitives.WriteInt32BigEndian(header.AsSpan(0), width);
        BinaryPrimitives.WriteInt32BigEndian(header.AsSpan(4), height);
        header[8] = 8; // bit depth
        header[9] = 6; // colour type: RGBA
        WriteChunk(output, "IHDR", header);

        using (var raw = new MemoryStream())
        {
            using (var z = new ZLibStream(raw, CompressionLevel.Optimal, leaveOpen: true))
            {
                var stride = width * 4;
                for (var y = 0; y < height; y++)
                {
                    z.WriteByte(0); // filter: none
                    z.Write(rgba, y * stride, stride);
                }
            }

            WriteChunk(output, "IDAT", raw.ToArray());
        }

        WriteChunk(output, "IEND", []);
        return output.ToArray();
    }

    private static void WriteChunk(Stream output, string type, byte[] data)
    {
        Span<byte> buffer = stackalloc byte[4];
        BinaryPrimitives.WriteInt32BigEndian(buffer, data.Length);
        output.Write(buffer);
        var typeBytes = new[] { (byte)type[0], (byte)type[1], (byte)type[2], (byte)type[3] };
        output.Write(typeBytes);
        output.Write(data);
        var crc = Crc(Crc(0xFFFFFFFF, typeBytes), data) ^ 0xFFFFFFFF;
        BinaryPrimitives.WriteUInt32BigEndian(buffer, crc);
        output.Write(buffer);
    }

    private static uint Crc(uint crc, byte[] data)
    {
        foreach (var b in data) crc = CrcTable[(crc ^ b) & 0xFF] ^ (crc >> 8);
        return crc;
    }

    private static uint[] BuildCrcTable()
    {
        var table = new uint[256];
        for (uint n = 0; n < 256; n++)
        {
            var c = n;
            for (var k = 0; k < 8; k++) c = (c & 1) != 0 ? 0xEDB88320 ^ (c >> 1) : c >> 1;
            table[n] = c;
        }

        return table;
    }
}
