using DopamineWin.Native;

namespace DopamineWin;

public static class Program
{
    public static int Main()
    {
        // One tracker per user. Launching it again just opens the dashboard.
        using var single = new Mutex(true, @"Local\Dopamine", out var first);
        AppInfo.MigrateFromExeDirectory();
        if (!first)
        {
            try
            {
                Win32.Open(ApiServer.DashboardUrl(new SettingsService().Settings.PairingCode));
            }
            catch (Exception ex)
            {
                Log.Error("Could not open the dashboard", ex);
            }

            return 0;
        }

        Log.Info($"Dopamine {AppInfo.Version} starting");
        DatabaseService database;
        try
        {
            database = new DatabaseService();
        }
        catch (Exception ex)
        {
            Log.Error("Could not open the database", ex);
            Win32.MessageBox($"Dopamine couldn't open its database in {AppInfo.DataDirectory}.\n\n{ex.Message}", "Dopamine");
            return 1;
        }

        var settings = new SettingsService();
        using var tracker = new WindowTracker(database, settings);
        var api = new ApiServer(database, settings);
        try
        {
            api.Start();
        }
        catch (Exception ex)
        {
            Log.Error("Could not start the local API", ex);
            Win32.MessageBox($"Dopamine couldn't listen on port {ApiServer.Port}. Is something else using it?\n\n{ex.Message}", "Dopamine");
            return 1;
        }

        tracker.Start();

        var stopped = 0;
        void Stop()
        {
            if (Interlocked.Exchange(ref stopped, 1) == 1) return;
            Log.Info("Exiting");
            tracker.Shutdown();
            api.Stop();
        }

        new TrayIcon(tracker, settings, database, Stop).Run();
        Stop();
        database.Dispose();
        return 0;
    }
}
