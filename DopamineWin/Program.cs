using DopamineWin.Native;

namespace DopamineWin;

public static class Program
{
    [STAThread] // WebView2, which draws the dashboard window, needs a single-threaded apartment
    public static int Main()
    {
        Velopack.VelopackApp.Build().SetAutoApplyOnStartup(false).Run();
        // One tracker per user. Launching it again just opens the dashboard.
        using var single = new Mutex(true, @"Local\Dopamine", out var first);
        AppInfo.MigrateFromExeDirectory();
        if (!first)
        {
            try
            {
                OpenDashboardInRunningInstance();
            }
            catch (Exception ex)
            {
                Log.Error("Could not open the dashboard", ex);
            }

            return 0;
        }

        // Crisp text in the dashboard window and tray menu on scaled displays (Windows 10 1703+).
        try
        {
            Win32.SetProcessDpiAwarenessContext(Win32.DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
        }
        catch (EntryPointNotFoundException)
        {
        }

        Log.Info($"Dopamine {AppInfo.Version} starting");
        try
        {
            StartupEntry.Refresh();
        }
        catch (Exception ex)
        {
            Log.Error("Could not check the startup entry", ex);
        }

        DatabaseService database;
        try
        {
            database = new DatabaseService();
        }
        catch (Exception ex)
        {
            Log.Error("Could not open the database", ex);
            Win32.MessageBox(Strings.T(
                $"Dopamine couldn't open its database in {AppInfo.DataDirectory}.",
                $"Dopamine 无法打开位于 {AppInfo.DataDirectory} 的数据库。",
                $"Dopamine 無法開啟位於 {AppInfo.DataDirectory} 的資料庫。") + $"\n\n{ex.Message}", "Dopamine");
            return 1;
        }

        var settings = new SettingsService();
        using var tracker = new WindowTracker(database, settings);
        using var updates = new UpdateChecker(settings);
        var api = new ApiServer(database, settings, updates);
        try
        {
            api.Start();
        }
        catch (Exception ex)
        {
            Log.Error("Could not start the local API", ex);
            Win32.MessageBox(Strings.T(
                $"Dopamine couldn't listen on port {ApiServer.Port}. Is something else using it?",
                $"Dopamine 无法监听端口 {ApiServer.Port}，是不是被其他程序占用了？",
                $"Dopamine 無法監聽連接埠 {ApiServer.Port}，是不是被其他程式佔用了？") + $"\n\n{ex.Message}", "Dopamine");
            return 1;
        }

        tracker.Start();
        updates.Start();

        var stopped = 0;
        void Stop()
        {
            if (Interlocked.Exchange(ref stopped, 1) == 1) return;
            Log.Info("Exiting");
            tracker.Shutdown();
            api.Stop();
        }

        new TrayIcon(tracker, settings, database, updates, Stop).Run();
        Stop();
        database.Dispose();
        updates.ApplyOnExit();
        return 0;
    }

    /// <summary>Asks the tracker that's already running to show its dashboard window.</summary>
    private static unsafe void OpenDashboardInRunningInstance()
    {
        IntPtr tray;
        fixed (char* className = TrayIcon.WindowClass) tray = Win32.FindWindowW(className, null);
        if (tray == IntPtr.Zero)
        {
            // The tracker is still starting up: fall back to the browser.
            Win32.Open(ApiServer.DashboardUrl(new SettingsService().Settings.PairingCode));
            return;
        }

        // This process was just launched by the user, so it may hand the foreground to the window.
        Win32.AllowSetForegroundWindow(Win32.ASFW_ANY);
        Win32.PostMessageW(tray, TrayIcon.ShowDashboardMessage, IntPtr.Zero, IntPtr.Zero);
    }
}
