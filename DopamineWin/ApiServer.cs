using System.Text.Json;
using System.Text.Json.Serialization;
using DopamineWin.Models;

namespace DopamineWin;

public class ApiServer : IDisposable, IAsyncDisposable
{
    private readonly DatabaseService _database;
    private readonly SettingsService _settings;
    private readonly WebApplication _app;

    public ApiServer(DatabaseService database, SettingsService settings, string[] args)
    {
        _database = database;
        _settings = settings;

        // Content root next to the exe so wwwroot (the bundled dashboard) is found regardless of the working directory.
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            Args = args,
            ContentRootPath = AppContext.BaseDirectory
        });
        builder.Services.ConfigureHttpJsonOptions(options =>
        {
            options.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
        });
        builder.Services.AddCors(options =>
        {
            options.AddDefaultPolicy(policy => { policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod(); });
        });
        _app = builder.Build();
        
        _app.Use(async (ctx, next) =>
        {
            if (ctx.Request.Method.Equals("options", StringComparison.InvariantCultureIgnoreCase) && ctx.Request.Headers.ContainsKey("Access-Control-Request-Private-Network"))
            {
                ctx.Response.Headers.Append("Access-Control-Allow-Private-Network", "true");
            }

            await next();
        });
        _app.UseCors();

        // The dashboard (DopamineWeb's static export, copied to wwwroot at build time) is public;
        // the data behind it still requires the pairing code.
        if (Directory.Exists(Path.Combine(AppContext.BaseDirectory, "wwwroot")))
        {
            _app.UseDefaultFiles();
            _app.UseStaticFiles();
        }

        _app.Use(async (ctx, next) =>
        {
            if (ctx.Request.Path.StartsWithSegments("/identify") ||
                ctx.Request.Headers.TryGetValue("Authorization", out var value) &&
                value == $"Bearer {_settings.Settings.PairingCode}")
            {
                await next();
            }
            else
            {
                ctx.Response.StatusCode = 401;
            }
        });

        _app.MapGet("/identify", () => new DopamineInfo());

        _app.MapGet("/pair", () => Results.Ok());

        _app.MapGet("/titles", database.GetActivities);

        // Names are newline-separated; returns { processName: { icon, kind, description, publisher, path } }.
        _app.MapGet("/apps", (string? names) =>
        {
            var requested = (names ?? string.Empty).Split('\n', StringSplitOptions.RemoveEmptyEntries).Take(200);
            return database.GetApps(requested).ToDictionary(p => p.Key, p => new
            {
                icon = p.Value.Png == null ? null : "data:image/png;base64," + Convert.ToBase64String(p.Value.Png),
                kind = p.Value.Kind,
                description = p.Value.Description,
                publisher = p.Value.Publisher,
                path = p.Value.Path
            });
        });

        _app.MapGet("/settings", () => _settings.Settings.GetConfigurableSettings());

        _app.MapPut("/settings", (ConfigurableSettings.Partial newSettings) =>
        {
            _settings.Settings.Update(newSettings);
            _settings.SaveSettings();
            return _settings.Settings.GetConfigurableSettings();
        });
    }

    public const int Port = 26535;

    public static string DashboardUrl(string pairingCode) => $"http://localhost:{Port}/#pair={pairingCode}";

    public Task RunAsync()
    {
        return _app.RunAsync($"http://localhost:{Port}/");
    }

    public void Dispose()
    {
        _database.Dispose();
        ((IDisposable)_app).Dispose();
    }

    public async ValueTask DisposeAsync()
    {
        await _database.DisposeAsync();
        await _app.DisposeAsync();
    }
}