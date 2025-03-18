namespace DopamineWin;

public class ApiServer : IDisposable, IAsyncDisposable
{
    private readonly DatabaseService _databaseService;
    private readonly WebApplication _app;

    public ApiServer(DatabaseService databaseService, string[] args)
    {
        _databaseService = databaseService;

        var builder = WebApplication.CreateBuilder(args);
        _app = builder.Build();
        _app.MapGet("/", () => "Hello World!");
    }

    public Task RunAsync()
    {
        return _app.RunAsync();
    }

    public void Dispose()
    {
        _databaseService.Dispose();
        ((IDisposable)_app).Dispose();
    }

    public async ValueTask DisposeAsync()
    {
        await _databaseService.DisposeAsync();
        await _app.DisposeAsync();
    }
}