import Foundation

struct Release: Equatable {
    let version: String
    let url: URL
}

/// Asks GitHub once a day whether a newer release is out. The request carries nothing about the
/// user or their activity, and the link shown is always built here, never taken from the reply.
final class UpdateChecker {
    static let repo = "TempestShaw/Dopamine"
    private static let latest = URL(string: "https://api.github.com/repos/\(repo)/releases/latest")!
    private static let interval: TimeInterval = 24 * 3600
    /// Leaves launch (and login) alone; the answer is rarely urgent.
    private static let firstDelay: TimeInterval = 60

    private let current: String
    private let isEnabled: () -> Bool
    private let session = URLSession(configuration: .ephemeral)
    private var timer: Timer?
    private var observer: NSObjectProtocol?
    private var wasEnabled: Bool
    private let lock = NSLock()
    private var found: Release?

    /// Called on the main thread when `available` changes.
    var onChange: (() -> Void)?

    var available: Release? {
        lock.lock()
        defer { lock.unlock() }
        return found
    }

    init(current: String, isEnabled: @escaping () -> Bool) {
        self.current = current
        self.isEnabled = isEnabled
        wasEnabled = isEnabled()
    }

    func start() {
        let t = Timer(timeInterval: UpdateChecker.interval, repeats: true) { [weak self] _ in self?.check() }
        t.tolerance = 3600
        RunLoop.main.add(t, forMode: .common)
        timer = t
        DispatchQueue.main.asyncAfter(deadline: .now() + UpdateChecker.firstDelay) { [weak self] in self?.check() }
        // Turned on or off from the dashboard: check right away, or forget what was found.
        observer = NotificationCenter.default.addObserver(forName: .settingsChanged, object: nil, queue: .main) { [weak self] _ in
            guard let self else { return }
            let enabled = self.isEnabled()
            if enabled != self.wasEnabled { self.check() }
            self.wasEnabled = enabled
        }
    }

    func check() {
        guard isEnabled() else { return set(nil) }
        var request = URLRequest(url: UpdateChecker.latest, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 20)
        request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        request.setValue("Dopamine/\(current)", forHTTPHeaderField: "User-Agent")
        session.dataTask(with: request) { [weak self] data, response, error in
            guard let self else { return }
            guard let data, (response as? HTTPURLResponse)?.statusCode == 200 else {
                Log.info("Update check skipped: \(error?.localizedDescription ?? "status \((response as? HTTPURLResponse)?.statusCode ?? 0)")")
                return
            }
            let release = UpdateChecker.release(from: data, current: self.current)
            DispatchQueue.main.async { self.set(release) }
        }.resume()
    }

    private func set(_ release: Release?) {
        lock.lock()
        let changed = found != release
        found = release
        lock.unlock()
        if changed { onChange?() }
    }

    /// The release described by GitHub's JSON, if it is a plain version newer than `current`.
    static func release(from data: Data, current: String) -> Release? {
        guard let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let tag = obj["tag_name"] as? String,
              tag.range(of: #"^v\d+\.\d+\.\d+$"#, options: .regularExpression) != nil else { return nil }
        let version = String(tag.dropFirst())
        guard isNewer(version, than: current),
              let url = URL(string: "https://github.com/\(repo)/releases/tag/\(tag)") else { return nil }
        return Release(version: version, url: url)
    }

    /// Compares "1.2.10" and "1.2.9" number by number.
    static func isNewer(_ a: String, than b: String) -> Bool {
        let x = a.split(separator: ".").map { Int($0) ?? 0 }
        let y = b.split(separator: ".").map { Int($0) ?? 0 }
        for i in 0..<max(x.count, y.count) {
            let l = i < x.count ? x[i] : 0
            let r = i < y.count ? y[i] : 0
            if l != r { return l > r }
        }
        return false
    }
}
