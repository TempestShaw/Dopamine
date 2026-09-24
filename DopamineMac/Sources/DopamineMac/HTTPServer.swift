import Foundation
import Network

struct HTTPRequest {
    var method: String
    var path: String
    var query: [String: String]
    var headers: [String: String] // lower-cased names
    var body: Data

    /// Parses a complete request from `data`, or returns nil if more bytes are needed.
    static func parse(_ data: Data) -> HTTPRequest? {
        let separator = Data("\r\n\r\n".utf8)
        guard let headerEnd = data.range(of: separator) else { return nil }
        guard let head = String(data: data[data.startIndex..<headerEnd.lowerBound], encoding: .utf8) else { return nil }
        var lines = head.components(separatedBy: "\r\n")
        let requestLine = lines.removeFirst().split(separator: " ")
        guard requestLine.count >= 2 else { return nil }

        var headers: [String: String] = [:]
        for line in lines {
            guard let colon = line.firstIndex(of: ":") else { continue }
            let name = line[..<colon].trimmingCharacters(in: .whitespaces).lowercased()
            headers[name] = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
        }

        let length = Int(headers["content-length"] ?? "0") ?? 0
        let bodyStart = headerEnd.upperBound
        guard data.distance(from: bodyStart, to: data.endIndex) >= length else { return nil }
        let body = data[bodyStart..<data.index(bodyStart, offsetBy: length)]

        let target = String(requestLine[1])
        let components = URLComponents(string: target)
        var query: [String: String] = [:]
        for item in components?.queryItems ?? [] { query[item.name] = item.value ?? "" }

        return HTTPRequest(
            method: String(requestLine[0]).uppercased(),
            path: components?.percentEncodedPath.removingPercentEncoding ?? target,
            query: query,
            headers: headers,
            body: Data(body)
        )
    }
}

struct HTTPResponse {
    var status: Int
    var headers: [String: String] = [:]
    var body = Data()

    static func json<T: Encodable>(_ value: T, status: Int = 200) -> HTTPResponse {
        let data = (try? JSONEncoder().encode(value)) ?? Data("null".utf8)
        return HTTPResponse(status: status, headers: ["Content-Type": "application/json; charset=utf-8"], body: data)
    }

    static func jsonObject(_ value: Any, status: Int = 200) -> HTTPResponse {
        let data = (try? JSONSerialization.data(withJSONObject: value)) ?? Data("null".utf8)
        return HTTPResponse(status: status, headers: ["Content-Type": "application/json; charset=utf-8"], body: data)
    }

    static func empty(_ status: Int) -> HTTPResponse { HTTPResponse(status: status) }

    func serialized() -> Data {
        var head = "HTTP/1.1 \(status) \(HTTPResponse.reason(status))\r\n"
        var all = headers
        all["Content-Length"] = String(body.count)
        all["Connection"] = "close"
        for (k, v) in all { head += "\(k): \(v)\r\n" }
        head += "\r\n"
        var out = Data(head.utf8)
        out.append(body)
        return out
    }

    private static func reason(_ status: Int) -> String {
        switch status {
        case 200: return "OK"
        case 204: return "No Content"
        case 400: return "Bad Request"
        case 401: return "Unauthorized"
        case 404: return "Not Found"
        case 405: return "Method Not Allowed"
        default: return "Status"
        }
    }
}

/// Minimal HTTP/1.1 server (one request per connection) bound to the loopback interface only.
final class HTTPServer {
    typealias Handler = (HTTPRequest) -> HTTPResponse

    private let port: NWEndpoint.Port
    private let handler: Handler
    private let queue = DispatchQueue(label: "dopamine.http", attributes: .concurrent)
    private var listeners: [NWListener] = []
    private static let maxRequestSize = 1 << 20

    init(port: UInt16, handler: @escaping Handler) {
        self.port = NWEndpoint.Port(rawValue: port)!
        self.handler = handler
    }

    func start() throws {
        // Browsers may resolve "localhost" to either address family.
        for host in ["127.0.0.1", "::1"] {
            let params = NWParameters.tcp
            params.allowLocalEndpointReuse = true
            params.requiredLocalEndpoint = .hostPort(host: NWEndpoint.Host(host), port: port)
            do {
                let listener = try NWListener(using: params)
                listener.newConnectionHandler = { [weak self] conn in self?.accept(conn) }
                listener.stateUpdateHandler = { state in
                    if case .failed(let error) = state { Log.error("HTTP listener on \(host) failed: \(error)") }
                }
                listener.start(queue: queue)
                listeners.append(listener)
            } catch {
                if host == "127.0.0.1" { throw error }
                Log.error("IPv6 loopback unavailable: \(error)")
            }
        }
        Log.info("API listening on http://localhost:\(port.rawValue)")
    }

    func stop() {
        listeners.forEach { $0.cancel() }
        listeners.removeAll()
    }

    private func accept(_ conn: NWConnection) {
        conn.start(queue: queue)
        receive(conn, buffer: Data())
    }

    private func receive(_ conn: NWConnection, buffer: Data) {
        conn.receive(minimumIncompleteLength: 1, maximumLength: 64 * 1024) { [weak self] data, _, isComplete, error in
            guard let self else { return conn.cancel() }
            var buffer = buffer
            if let data { buffer.append(data) }
            if let request = HTTPRequest.parse(buffer) {
                let response = self.handler(request)
                conn.send(content: response.serialized(), completion: .contentProcessed { _ in conn.cancel() })
            } else if isComplete || error != nil || buffer.count > HTTPServer.maxRequestSize {
                conn.cancel()
            } else {
                self.receive(conn, buffer: buffer)
            }
        }
    }
}
