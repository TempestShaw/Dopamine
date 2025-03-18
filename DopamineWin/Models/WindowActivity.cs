using System.Text.Json.Serialization;

namespace DopamineWin.Models;

public record WindowActivity
{
    [JsonPropertyName("id")] public required int Id { get; init; }
    [JsonPropertyName("timestamp")] public required long Timestamp { get; init; }
    [JsonPropertyName("windowTitle")] public required string WindowTitle { get; init; }
    [JsonPropertyName("processName")] public required string ProcessName { get; init; }
}