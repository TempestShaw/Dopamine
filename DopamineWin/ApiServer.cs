using System.Reflection;
using System.Text.Json;
using DopamineWin.Models;

namespace DopamineWin;

/// <summary>
/// The local API the dashboard talks to (same routes as the macOS agent), plus the dashboard
/// itself, which is embedded in the exe.
/// </summary>
public sealed class ApiServer
{
    public const int Port = 26535;

    public static string DashboardUrl(string pairingCode) => $"http://localhost:{Port}/#pair={pairingCode}";

    private readonly DatabaseService _database;
    private readonly SettingsService _settings;
    private readonly HttpServer _server;
    private readonly Dictionary<string, string> _webFiles; // "/index.html" -> resource name

    public ApiServer(DatabaseService database, SettingsService settings)
    {
        _database = database;
        _settings = settings;
        _server = new HttpServer(Port, Handle);
        // Resource names look like "web/_next\static\x.js" (MSBuild keeps the OS separator).
        _webFiles = Assembly.GetExecutingAssembly().GetManifestResourceNames()
            .Where(n => n.StartsWith("web/", StringComparison.Ordinal))
            .ToDictionary(n => "/" + n["web/".Length..].Replace('\\', '/'), n => n, StringComparer.Ordinal);
    }

    public void Start() => _server.Start();

    public void Stop() => _server.Stop();

    private HttpResponse Handle(HttpRequest req)
    {
        var res = Route(req);
        res.Headers["Access-Control-Allow-Origin"] = "*";
        res.Headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
        res.Headers["Access-Control-Allow-Methods"] = "GET, PUT, OPTIONS";
        if (req.Header("access-control-request-private-network") != null)
            res.Headers["Access-Control-Allow-Private-Network"] = "true";
        return res;
    }

    private HttpResponse Route(HttpRequest req)
    {
        if (req.Method == "OPTIONS") return HttpResponse.Empty(204);

        switch (req.Path)
        {
            case "/identify":
                return HttpResponse.Json(JsonSerializer.Serialize(new AgentInfo(), Json.Default.AgentInfo));
            case "/pair" or "/titles" or "/apps" or "/settings":
                if (req.Header("authorization") != $"Bearer {_settings.Settings.PairingCode}") return HttpResponse.Empty(401);
                return Protected(req);
            default:
                return req.Method == "GET" ? ServeStatic(req.Path) : HttpResponse.Empty(404);
        }
    }

    private HttpResponse Protected(HttpRequest req)
    {
        switch (req.Method, req.Path)
        {
            case ("GET", "/pair"):
                return HttpResponse.Empty(200);

            case ("GET", "/titles"):
                if (!long.TryParse(req.Query.GetValueOrDefault("from"), out var from) ||
                    !long.TryParse(req.Query.GetValueOrDefault("to"), out var to))
                    return HttpResponse.Empty(400);
                return HttpResponse.Json(JsonSerializer.Serialize(_database.GetActivities(from, to), Json.Default.ListWindowActivity));

            case ("GET", "/apps"):
            {
                // Names are newline-separated; returns { processName: { icon, kind, description, publisher, path } }.
                var names = (req.Query.GetValueOrDefault("names") ?? string.Empty)
                    .Split('\n', StringSplitOptions.RemoveEmptyEntries).Take(200);
                var apps = _database.GetApps(names).ToDictionary(p => p.Key, p => new AppInfoDto
                {
                    Icon = p.Value.Png == null ? null : "data:image/png;base64," + Convert.ToBase64String(p.Value.Png),
                    Kind = p.Value.Kind,
                    Description = p.Value.Description,
                    Publisher = p.Value.Publisher,
                    Path = p.Value.Path,
                });
                return HttpResponse.Json(JsonSerializer.Serialize(apps, Json.Default.DictionaryStringAppInfoDto));
            }

            case ("GET", "/settings"):
                return HttpResponse.Json(JsonSerializer.Serialize(_settings.Settings.ToPublic(), Json.Default.PublicSettings));

            case ("PUT", "/settings"):
            {
                SettingsPatch? patch;
                try
                {
                    patch = JsonSerializer.Deserialize(req.Body, Json.Default.SettingsPatch);
                }
                catch (JsonException)
                {
                    return HttpResponse.Empty(400);
                }

                if (patch == null) return HttpResponse.Empty(400);
                return HttpResponse.Json(JsonSerializer.Serialize(_settings.Update(patch), Json.Default.PublicSettings));
            }

            default:
                return HttpResponse.Empty(405);
        }
    }

    private static readonly Dictionary<string, string> ContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".html"] = "text/html; charset=utf-8",
        [".js"] = "text/javascript; charset=utf-8",
        [".css"] = "text/css; charset=utf-8",
        [".json"] = "application/json",
        [".svg"] = "image/svg+xml",
        [".png"] = "image/png",
        [".ico"] = "image/x-icon",
        [".woff2"] = "font/woff2",
        [".txt"] = "text/plain; charset=utf-8",
    };

    private HttpResponse ServeStatic(string path)
    {
        if (_webFiles.Count == 0)
        {
            var html = """
                <!doctype html><meta charset="utf-8"><title>Dopamine</title>
                <body style="font:15px system-ui;padding:40px;max-width:560px">
                <h2>Dopamine is running</h2>
                <p>This build has no dashboard inside. Build DopamineWeb first (<code>bun run build</code>), then rebuild the agent.</p>
                """;
            var fallback = new HttpResponse { Body = System.Text.Encoding.UTF8.GetBytes(html) };
            fallback.Headers["Content-Type"] = "text/html; charset=utf-8";
            return fallback;
        }

        if (path.EndsWith('/')) path += "index.html";
        if (!_webFiles.TryGetValue(path, out var resource) && !_webFiles.TryGetValue(path + "/index.html", out resource))
            return HttpResponse.Empty(404);

        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(resource);
        if (stream == null) return HttpResponse.Empty(404);
        using var buffer = new MemoryStream();
        stream.CopyTo(buffer);

        var res = new HttpResponse { Body = buffer.ToArray() };
        res.Headers["Content-Type"] = ContentTypes.GetValueOrDefault(Path.GetExtension(resource), "application/octet-stream");
        res.Headers["Cache-Control"] = path.StartsWith("/_next/static/", StringComparison.Ordinal) ? "public, max-age=31536000, immutable" : "no-cache";
        return res;
    }
}
