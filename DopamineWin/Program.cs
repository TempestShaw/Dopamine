namespace DopamineWin;

public class Program
{
    [STAThread]
    public static void Main(string[] args)
    {
        Application.SetHighDpiMode(HighDpiMode.SystemAware);
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        var loggerFactory = LoggerFactory.Create(builder =>
        {
            builder.AddConsole();
            builder.SetMinimumLevel(LogLevel.Debug);
        });

        var databaseService = new DatabaseService(loggerFactory.CreateLogger<DatabaseService>());
        var windowTracker = new WindowTracker(databaseService, loggerFactory.CreateLogger<WindowTracker>());
        var notificationIcon = new NotificationIcon(windowTracker);
        var apiServer = new ApiServer(databaseService, args);

        Application.Run(notificationIcon);
        apiServer.RunAsync();
    }
}