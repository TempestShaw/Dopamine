using System.Text.Json.Serialization;

namespace DopamineWin.Models;

public class ConfigurableSettings
{
    /**
     * The interval in milliseconds at which the tracking service should check for the active window.
     */
    public int TrackingInterval { get; set; } = 5000;

    /**
     * Seconds without keyboard or mouse input after which time stops counting. 0 disables idle detection.
     */
    public int IdleTimeout { get; set; } = 300;

    /**
     * The user's category choices, keyed by process name ("work", "study", "social", "entertainment", "other").
     */
    public Dictionary<string, string> CategoryOverrides { get; set; } = new();

    /**
     * "ask", "on" or "off": whether category choices are shared with the community (decided in the dashboard).
     */
    public string CommunitySharing { get; set; } = "ask";

    /**
     * Random id sent with shared choices so one install counts once. Empty until sharing is turned on.
     */
    public string InstallId { get; set; } = string.Empty;

    private static readonly HashSet<string> Categories = ["work", "study", "social", "entertainment", "other"];
    private static readonly HashSet<string> SharingStates = ["ask", "on", "off"];

    public void Update(Partial partialSettings)
    {
        if (partialSettings.TrackingInterval.HasValue)
        {
            TrackingInterval = Math.Clamp(partialSettings.TrackingInterval.Value, 100, 1000 * 60 * 60);
        }

        if (partialSettings.IdleTimeout.HasValue)
        {
            IdleTimeout = Math.Clamp(partialSettings.IdleTimeout.Value, 0, 7200);
        }

        if (partialSettings.CategoryOverrides != null)
        {
            CategoryOverrides = partialSettings.CategoryOverrides
                .Where(p => Categories.Contains(p.Value))
                .ToDictionary(p => p.Key, p => p.Value);
        }

        if (partialSettings.CommunitySharing != null && SharingStates.Contains(partialSettings.CommunitySharing))
        {
            CommunitySharing = partialSettings.CommunitySharing;
        }

        if (partialSettings.InstallId != null && Guid.TryParse(partialSettings.InstallId, out _))
        {
            InstallId = partialSettings.InstallId;
        }
    }

    public static List<Schema> GetSchemas()
    {
        return
        [
            new IntegerSchema
            {
                Id = "trackingInterval",
                Name = "Tracking Interval",
                Description =
                    "The interval in milliseconds at which Dopamine should check for the active window.",
                Type = SchemaType.Integer,
                Min = 100,
                Max = 1000 * 60 * 60,
                Default = 5000
            },
            new IntegerSchema
            {
                Id = "idleTimeout",
                Name = "Idle Timeout",
                Description =
                    "Seconds without keyboard or mouse input before Dopamine stops counting time. 0 disables it.",
                Type = SchemaType.Integer,
                Min = 0,
                Max = 7200,
                Default = 300
            }
        ];
    }

    public class Partial
    {
        /**
         * The interval in milliseconds at which the tracking service should check for the active window.
         */
        public int? TrackingInterval { get; set; } = null;

        public int? IdleTimeout { get; set; } = null;

        public Dictionary<string, string>? CategoryOverrides { get; set; } = null;

        public string? CommunitySharing { get; set; } = null;

        public string? InstallId { get; set; } = null;
    }

    public enum SchemaType
    {
        Integer,
        String,
        Boolean
    }

    [JsonDerivedType(typeof(IntegerSchema))]
    [JsonDerivedType(typeof(StringSchema))]
    [JsonDerivedType(typeof(BooleanSchema))]
    public class Schema
    {
        public required string Id { get; set; }
        public required string Name { get; set; }
        public required string Description { get; set; }
        public required SchemaType Type { get; set; }
    }

    public class IntegerSchema : Schema
    {
        public int Min { get; set; }
        public int Max { get; set; }
        public required int Default { get; set; }
    }

    public class StringSchema : Schema
    {
        public int MinLength { get; set; }
        public int MaxLength { get; set; }
        public required string Default { get; set; }
    }

    public class BooleanSchema : Schema
    {
        public required bool Default { get; set; }
    }
}