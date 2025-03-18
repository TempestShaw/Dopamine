using System.Text.Json.Serialization;

namespace DopamineWin.Models;

public class ConfigurableSettings
{
    /**
     * The interval in milliseconds at which the tracking service should check for the active window.
     */
    public int TrackingInterval { get; set; } = 5000;

    public void Update(Partial partialSettings)
    {
        if (partialSettings.TrackingInterval.HasValue)
        {
            TrackingInterval = partialSettings.TrackingInterval.Value;
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
            }
        ];
    }

    public class Partial
    {
        /**
         * The interval in milliseconds at which the tracking service should check for the active window.
         */
        public int? TrackingInterval { get; set; } = null;
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