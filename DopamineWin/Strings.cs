using DopamineWin.Native;

namespace DopamineWin;

/// <summary>
/// Tray text in English, Simplified or Traditional Chinese, matching the dashboard. Chosen from the
/// Windows display language (the app runs with invariant globalization, so it asks Win32 directly).
/// </summary>
public enum Lang
{
    En,
    ZhHans,
    ZhHant,
}

public static class Strings
{
    public static readonly Lang Current = FromLangId(Win32.GetUserDefaultUILanguage());

    /// <summary>Chinese LANGIDs: sub-language 1 (Taiwan), 3 (Hong Kong), 5 (Macau) and 0x1F (Hant) are Traditional.</summary>
    public static Lang FromLangId(ushort langId)
    {
        if ((langId & 0x3FF) != 0x04) return Lang.En;
        return (langId >> 10) is 0x01 or 0x03 or 0x05 or 0x1F ? Lang.ZhHant : Lang.ZhHans;
    }

    public static string T(string en, string zhHans, string zhHant) => Current switch
    {
        Lang.ZhHans => zhHans,
        Lang.ZhHant => zhHant,
        _ => en,
    };
}
