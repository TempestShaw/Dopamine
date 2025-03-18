using System.Security.Cryptography;
using System.Text.Json.Serialization;

namespace DopamineWin.Models;

public class StoredSettings : ConfigurableSettings
{
    /**
     * The code required to access protected API endpoints.
     */
    public required string PairingCode { get; set; }

    public ConfigurableSettings GetConfigurableSettings()
    {
        return new ConfigurableSettings
        {
            TrackingInterval = TrackingInterval
        };
    }
    
    public static StoredSettings CreateDefault()
    {
        return new StoredSettings
        {
            PairingCode = GeneratePairingCode(6)
        };
    }

    private static string GeneratePairingCode(int length)
    {
        const string allowed = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        var randomChars = new char[length];

        for (var i = 0; i < length; i++)
        {
            randomChars[i] = allowed[RandomNumberGenerator.GetInt32(0, allowed.Length)];
        }

        return new string(randomChars);
    }
}