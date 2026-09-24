namespace DopamineWin.Models;

/// <summary>
/// What the agent remembers about an app: its icon plus metadata the dashboard uses to categorise
/// apps no rule knows (Windows has no app category, but the publisher and install path go a long way,
/// e.g. anything under steamapps is a game).
/// </summary>
public record StoredApp(byte[]? Png, string? Kind, string? Description, string? Publisher, string? Path);
