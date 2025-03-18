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

        var builder = WebApplication.CreateBuilder(args);
        builder.Services.ConfigureHttpJsonOptions(options =>
        {
            options.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
        });
        builder.Services.AddCors(options =>
        {
            options.AddDefaultPolicy(policy => { policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod(); });
        });
        _app = builder.Build();

        _app.UseCors();
        _app.Use(async (context, next) =>
        {
            if (context.Request.Path.StartsWithSegments("/identify") ||
                context.Request.Headers.TryGetValue("Authorization", out var value) &&
                value == $"Bearer {_settings.Settings.PairingCode}")
            {
                await next();
            }
            else
            {
                context.Response.StatusCode = 401;
            }
        });

        _app.MapGet("/identify", () => new DopamineInfo());

        _app.MapGet("/pair", () => Results.Ok());

        _app.MapGet("/titles", database.GetActivities);

        _app.MapGet("/settings", () => _settings.Settings.GetConfigurableSettings());

        _app.MapPut("/settings", (ConfigurableSettings.Partial newSettings) =>
        {
            _settings.Settings.Update(newSettings);
            _settings.SaveSettings();
            return _settings.Settings.GetConfigurableSettings();
        });
    }

    public Task RunAsync()
    {
        return _app.RunAsync();
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