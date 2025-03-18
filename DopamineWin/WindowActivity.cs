namespace DopamineWin;

public record WindowActivity
{
    public required int Id { get; init; }
    public required long Timestamp { get; init; }
    public required string WindowTitle { get; init; }
    public required string ProcessName { get; init; }
}