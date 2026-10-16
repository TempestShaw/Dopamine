namespace DopamineWin;

/// <summary>
/// Who may talk to the local API: pages and tools on this computer, never a website open in a browser.
/// </summary>
/// <remarks>
/// The listener is bound to loopback, but every website runs inside the user's browser, on this computer.
/// A foreign <c>Origin</c> is such a website; a foreign <c>Host</c> is DNS rebinding (a website's own name
/// pointed at 127.0.0.1 so the browser treats it as same-origin). Requests without the header (curl,
/// scripts, same-origin GETs) are let through; browsers always send <c>Host</c>, and <c>Origin</c> on every
/// cross-origin call. Mirrors DopamineMac's LocalOnly.
/// </remarks>
public static class LocalOnly
{
    private static readonly HashSet<string> LoopbackNames = new(StringComparer.Ordinal) { "localhost", "127.0.0.1", "[::1]" };

    /// <summary><c>localhost</c>, <c>127.0.0.1:26535</c>, <c>[::1]:3000</c>, … or no header at all.</summary>
    public static bool AllowsHost(string? host) => host == null || IsLoopback(host.ToLowerInvariant());

    /// <summary><c>http://localhost:3000</c>, <c>http://127.0.0.1:26535</c>, … or no header at all.</summary>
    public static bool AllowsOrigin(string? origin)
    {
        if (origin == null) return true;
        const string prefix = "http://";
        var lower = origin.ToLowerInvariant();
        return lower.StartsWith(prefix, StringComparison.Ordinal) && IsLoopback(lower[prefix.Length..]);
    }

    private static bool IsLoopback(string hostAndPort)
    {
        string name, rest;
        var close = hostAndPort.StartsWith('[') ? hostAndPort.IndexOf(']') : -1;
        if (close >= 0)
        {
            name = hostAndPort[..(close + 1)];
            rest = hostAndPort[(close + 1)..];
        }
        else
        {
            var colon = hostAndPort.IndexOf(':');
            name = colon < 0 ? hostAndPort : hostAndPort[..colon];
            rest = colon < 0 ? "" : hostAndPort[colon..];
        }

        if (!LoopbackNames.Contains(name)) return false;
        return rest.Length == 0 || (rest.Length > 1 && rest[0] == ':' && rest[1..].All(char.IsAsciiDigit));
    }
}
