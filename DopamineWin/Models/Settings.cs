namespace DopamineWin.Models;

/// <summary>Everything the agent keeps in config.json.</summary>
public sealed class StoredSettings
{
    /// <summary>Required on protected API endpoints as <c>Authorization: Bearer &lt;code&gt;</c>.</summary>
    public string PairingCode { get; set; } = string.Empty;

    /// <summary>How often (ms) to check the foreground window.</summary>
    public int TrackingInterval { get; set; } = 5000;

    /// <summary>Seconds without keyboard or mouse input before time stops counting. 0 disables it.</summary>
    public int IdleTimeout { get; set; } = 300;

    /// <summary>The user's category choices, keyed by process name ("work", "study", …).</summary>
    public Dictionary<string, string> CategoryOverrides { get; set; } = new();

    /// <summary>"ask", "on" or "off": whether category choices are shared (decided in the dashboard).</summary>
    public string CommunitySharing { get; set; } = "ask";

    /// <summary>Random id sent with shared choices so one install counts once. Empty until sharing is on.</summary>
    public string InstallId { get; set; } = string.Empty;

    /// <summary>Process names left out of every figure. Null until the user changes it, meaning <see cref="DefaultHidden"/>.</summary>
    public List<string>? HiddenApps { get; set; }

    /// <summary>The user's per-window category rules (read by the dashboard; they beat <see cref="CategoryOverrides"/>).</summary>
    public List<TitleRule> TitleRules { get; set; } = [];

    /// <summary>Look for a new release on GitHub once a day.</summary>
    public bool CheckForUpdates { get; set; } = true;

    /// <summary>Dopamine's own tray menu doesn't count as screen time unless the user asks.</summary>
    public static readonly string[] DefaultHidden = ["DopamineWin"];

    public IReadOnlyList<string> Hidden => HiddenApps ?? [.. DefaultHidden];

    private static readonly HashSet<string> Categories = ["work", "study", "social", "entertainment", "other"];
    private static readonly HashSet<string> SharingStates = ["ask", "on", "off"];

    public void Apply(SettingsPatch patch)
    {
        if (patch.TrackingInterval is { } interval) TrackingInterval = Math.Clamp(interval, 100, 3_600_000);
        if (patch.IdleTimeout is { } idle) IdleTimeout = Math.Clamp(idle, 0, 7200);
        if (patch.CategoryOverrides != null)
            CategoryOverrides = patch.CategoryOverrides.Where(p => Categories.Contains(p.Value)).ToDictionary(p => p.Key, p => p.Value);
        if (patch.CommunitySharing != null && SharingStates.Contains(patch.CommunitySharing)) CommunitySharing = patch.CommunitySharing;
        if (patch.InstallId != null && Guid.TryParse(patch.InstallId, out _)) InstallId = patch.InstallId;
        if (patch.HiddenApps != null)
            HiddenApps = patch.HiddenApps.Where(p => !string.IsNullOrEmpty(p) && p.Length <= 256).Take(500).ToList();
        if (patch.TitleRules != null)
            TitleRules = patch.TitleRules
                .Where(r => r != null)
                .Select(r => new TitleRule { Contains = (r.Contains ?? string.Empty).Trim(), Category = r.Category ?? string.Empty, Scope = r.Scope ?? string.Empty })
                .Where(r => r.Contains.Length is > 0 and <= TitleRule.MaxText && Categories.Contains(r.Category) && r.Scope.Length is > 0 and <= 256)
                .Take(TitleRule.MaxCount)
                .ToList();
        if (patch.CheckForUpdates is { } check) CheckForUpdates = check;
    }

    /// <summary>The part a paired dashboard may read (everything but the pairing code).</summary>
    public PublicSettings ToPublic() => new()
    {
        TrackingInterval = TrackingInterval,
        IdleTimeout = IdleTimeout,
        CategoryOverrides = CategoryOverrides,
        CommunitySharing = CommunitySharing,
        InstallId = string.IsNullOrEmpty(InstallId) ? null : InstallId,
        HiddenApps = [.. Hidden],
        TitleRules = TitleRules,
        CheckForUpdates = CheckForUpdates,
    };
}

/// <summary>Body of PUT /settings: only the fields present are changed.</summary>
public sealed class SettingsPatch
{
    public int? TrackingInterval { get; set; }
    public int? IdleTimeout { get; set; }
    public Dictionary<string, string>? CategoryOverrides { get; set; }
    public string? CommunitySharing { get; set; }
    public string? InstallId { get; set; }
    public List<string>? HiddenApps { get; set; }
    public List<TitleRule>? TitleRules { get; set; }
    public bool? CheckForUpdates { get; set; }
}

/// <summary>"Windows whose title contains <see cref="Contains"/> count as <see cref="Category"/>", in every browser ("browsers") or one app.</summary>
public sealed class TitleRule
{
    public const int MaxCount = 500;
    public const int MaxText = 200;

    public string Contains { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Scope { get; set; } = string.Empty;
}

public sealed class PublicSettings
{
    public int TrackingInterval { get; set; }
    public int IdleTimeout { get; set; }
    public Dictionary<string, string> CategoryOverrides { get; set; } = new();
    public string CommunitySharing { get; set; } = "ask";
    public string? InstallId { get; set; }
    public List<string> HiddenApps { get; set; } = [];
    public List<TitleRule> TitleRules { get; set; } = [];
    public bool CheckForUpdates { get; set; } = true;
}

/// <summary>POST /forget: rows the user wants erased.</summary>
public sealed class ForgetRequest
{
    public List<long> Ids { get; set; } = [];
}

/// <summary>Reply to POST /forget.</summary>
public sealed class ForgetResult
{
    public int Forgotten { get; set; }
}

/// <summary>GET /identify: lets the dashboard find the agent and learn its settings.</summary>
public sealed class AgentInfo
{
    public string Name { get; set; } = "dopamine-win";
    public string Version { get; set; } = AppInfo.Version;
    /// <summary>A newer release found on GitHub; left out when there is none.</summary>
    public UpdateDto? Update { get; set; }
    public List<SettingSchema> Settings { get; set; } =
    [
        new()
        {
            Id = "trackingInterval", Name = "Tracking Interval", Type = "integer", Min = 100, Max = 3_600_000, Default = 5000,
            Description = "The interval in milliseconds at which Dopamine should check for the active window.",
        },
        new()
        {
            Id = "idleTimeout", Name = "Idle Timeout", Type = "integer", Min = 0, Max = 7200, Default = 300,
            Description = "Seconds without keyboard or mouse input before Dopamine stops counting time. 0 disables it.",
        },
    ];
}

public sealed class UpdateDto
{
    public string Version { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
}

public sealed class SettingSchema
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public int Min { get; set; }
    public int Max { get; set; }
    public int Default { get; set; }
}

/// <summary>One entry of GET /apps.</summary>
public sealed class AppInfoDto
{
    public string? Icon { get; set; }
    public string? Kind { get; set; }
    public string? Description { get; set; }
    public string? Publisher { get; set; }
    public string? Path { get; set; }
}
