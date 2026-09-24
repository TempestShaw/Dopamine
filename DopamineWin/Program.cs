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

        var settingsService = new SettingsService(loggerFactory.CreateLogger<SettingsService>());
        var databaseService = new DatabaseService(loggerFactory.CreateLogger<DatabaseService>());
        var windowTracker =
            new WindowTracker(databaseService, settingsService, loggerFactory.CreateLogger<WindowTracker>());
        var notificationIcon =
            new NotificationIcon(windowTracker, settingsService, databaseService,
                loggerFactory.CreateLogger<NotificationIcon>());
        var apiServer = new ApiServer(databaseService, settingsService, args);

        apiServer.RunAsync();
        Application.Run(notificationIcon);
    }
}