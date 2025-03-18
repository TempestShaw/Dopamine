using System.Reflection;

namespace DopamineWin.Models;

public class DopamineInfo
{
    public string Name { get; set; } = "dopamine-win";
    public string Version { get; set; } = GetVersionString();
    public List<ConfigurableSettings.Schema> Settings { get; set; } = ConfigurableSettings.GetSchemas();

    public static string GetVersionString()
    {
        return Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? string.Empty;
    }
}