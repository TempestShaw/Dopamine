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
    }

    /// <summary>The part a paired dashboard may read (everything but the pairing code).</summary>
    public PublicSettings ToPublic() => new()
    {
        TrackingInterval = TrackingInterval,
        IdleTimeout = IdleTimeout,
        CategoryOverrides = CategoryOverrides,
        CommunitySharing = CommunitySharing,
        InstallId = string.IsNullOrEmpty(InstallId) ? null : InstallId,
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
}

public sealed class PublicSettings
{
    public int TrackingInterval { get; set; }
    public int IdleTimeout { get; set; }
    public Dictionary<string, string> CategoryOverrides { get; set; } = new();
    public string CommunitySharing { get; set; } = "ask";
    public string? InstallId { get; set; }
}

/// <summary>GET /identify: lets the dashboard find the agent and learn its settings.</summary>
public sealed class AgentInfo
{
    public string Name { get; set; } = "dopamine-win";
    public string Version { get; set; } = AppInfo.Version;
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
