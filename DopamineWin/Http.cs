using System.Net;
using System.Net.Sockets;
using System.Text;

namespace DopamineWin;

public sealed class HttpRequest
{
    public required string Method { get; init; }
    public required string Path { get; init; }
    public required Dictionary<string, string> Query { get; init; }
    public required Dictionary<string, string> Headers { get; init; } // lower-case names
    public required byte[] Body { get; init; }

    public string? Header(string name) => Headers.TryGetValue(name, out var v) ? v : null;

    /// <summary>Parses a complete request, or returns null if more bytes are needed.</summary>
    public static HttpRequest? Parse(ReadOnlySpan<byte> data)
    {
        var headerEnd = data.IndexOf("\r\n\r\n"u8);
        if (headerEnd < 0) return null;

        var head = Encoding.UTF8.GetString(data[..headerEnd]);
        var lines = head.Split("\r\n");
        var requestLine = lines[0].Split(' ');
        if (requestLine.Length < 2) throw new FormatException("Bad request line");

        var headers = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var line in lines.Skip(1))
        {
            var colon = line.IndexOf(':');
            if (colon <= 0) continue;
            headers[line[..colon].Trim().ToLowerInvariant()] = line[(colon + 1)..].Trim();
        }

        var length = headers.TryGetValue("content-length", out var cl) && int.TryParse(cl, out var n) ? n : 0;
        var bodyStart = headerEnd + 4;
        if (data.Length - bodyStart < length) return null;

        var target = requestLine[1];
        var q = target.IndexOf('?');
        var path = Uri.UnescapeDataString(q < 0 ? target : target[..q]);
        var query = new Dictionary<string, string>(StringComparer.Ordinal);
        if (q >= 0)
        {
            foreach (var pair in target[(q + 1)..].Split('&', StringSplitOptions.RemoveEmptyEntries))
            {
                var eq = pair.IndexOf('=');
                var key = Decode(eq < 0 ? pair : pair[..eq]);
                query[key] = eq < 0 ? string.Empty : Decode(pair[(eq + 1)..]);
            }
        }

        return new HttpRequest
        {
            Method = requestLine[0].ToUpperInvariant(),
            Path = path,
            Query = query,
            Headers = headers,
            Body = data.Slice(bodyStart, length).ToArray(),
        };
    }

    private static string Decode(string s) => Uri.UnescapeDataString(s.Replace('+', ' '));
}

public sealed class HttpResponse
{
    public int Status { get; init; } = 200;
    public Dictionary<string, string> Headers { get; } = new(StringComparer.OrdinalIgnoreCase);
    public byte[] Body { get; init; } = [];

    public static HttpResponse Empty(int status) => new() { Status = status };

    public static HttpResponse Json(string json, int status = 200)
    {
        var res = new HttpResponse { Status = status, Body = Encoding.UTF8.GetBytes(json) };
        res.Headers["Content-Type"] = "application/json; charset=utf-8";
        return res;
    }

    public byte[] Serialize()
    {
        var head = new StringBuilder();
        head.Append("HTTP/1.1 ").Append(Status).Append(' ').Append(Reason(Status)).Append("\r\n");
        foreach (var (k, v) in Headers) head.Append(k).Append(": ").Append(v).Append("\r\n");
        head.Append("Content-Length: ").Append(Body.Length).Append("\r\n");
        head.Append("Connection: close\r\n\r\n");
        var headBytes = Encoding.ASCII.GetBytes(head.ToString());
        var output = new byte[headBytes.Length + Body.Length];
        headBytes.CopyTo(output, 0);
        Body.CopyTo(output, headBytes.Length);
        return output;
    }

    private static string Reason(int status) => status switch
    {
        200 => "OK",
        204 => "No Content",
        400 => "Bad Request",
        401 => "Unauthorized",
        404 => "Not Found",
        405 => "Method Not Allowed",
        _ => "Status",
    };
}

/// <summary>Minimal HTTP/1.1 server (one request per connection) listening on loopback only.</summary>
public sealed class HttpServer
{
    private const int MaxRequestSize = 1 << 20;
    private readonly int _port;
    private readonly Func<HttpRequest, HttpResponse> _handler;
    private readonly List<TcpListener> _listeners = [];

    public HttpServer(int port, Func<HttpRequest, HttpResponse> handler)
    {
        _port = port;
        _handler = handler;
    }

    public void Start()
    {
        // Browsers may resolve "localhost" to either address family.
        foreach (var address in new[] { IPAddress.Loopback, IPAddress.IPv6Loopback })
        {
            try
            {
                var listener = new TcpListener(address, _port);
                listener.Start();
                _listeners.Add(listener);
                _ = AcceptLoop(listener);
            }
            catch (SocketException ex) when (address.Equals(IPAddress.IPv6Loopback))
            {
                Log.Error("IPv6 loopback unavailable", ex);
            }
        }

        Log.Info($"API listening on http://localhost:{_port}");
    }

    public void Stop()
    {
        foreach (var l in _listeners) l.Stop();
    }

    private async Task AcceptLoop(TcpListener listener)
    {
        while (true)
        {
            TcpClient client;
            try
            {
                client = await listener.AcceptTcpClientAsync();
            }
            catch (ObjectDisposedException)
            {
                return;
            }
            catch (SocketException)
            {
                return;
            }

            _ = Task.Run(() => Serve(client));
        }
    }

    private async Task Serve(TcpClient client)
    {
        using var _ = client;
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(15));
        try
        {
            var stream = client.GetStream();
            var buffer = new byte[64 * 1024];
            var data = new MemoryStream();
            HttpRequest? request = null;
            while (request == null)
            {
                var read = await stream.ReadAsync(buffer, timeout.Token);
                if (read == 0) return;
                data.Write(buffer, 0, read);
                if (data.Length > MaxRequestSize) return;
                request = HttpRequest.Parse(data.GetBuffer().AsSpan(0, (int)data.Length));
            }

            HttpResponse response;
            try
            {
                response = _handler(request);
            }
            catch (Exception ex)
            {
                Log.Error($"{request.Method} {request.Path} failed", ex);
                response = HttpResponse.Empty(500);
            }

            await stream.WriteAsync(response.Serialize(), timeout.Token);
        }
        catch (Exception ex) when (ex is IOException or OperationCanceledException or FormatException or SocketException)
        {
            // Client went away, timed out or sent garbage.
        }
    }
}
