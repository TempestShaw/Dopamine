import Foundation

/// Where the first-run guide opens, and whether it may move on. The guide can't be finished until
/// Accessibility is allowed; an unfinished setup, or a build macOS no longer trusts, reopens it at
/// that step. The window itself is OnboardingWindow.
final class OnboardingFlow {
    enum Step: Int, CaseIterable {
        case welcome, permission, finish

        static var count: Int { allCases.count }

        var next: Step? { Step(rawValue: rawValue + 1) }
        var previous: Step? { Step(rawValue: rawValue - 1) }

        /// Steps after the permission wait until access is allowed.
        func reachable(granted: Bool) -> Step {
            rawValue > Step.permission.rawValue && !granted ? .permission : self
        }

        func canContinue(granted: Bool) -> Bool { self != .permission || granted }
    }

    private static let completedKey = "onboardingCompleted"
    private static let seenKey = "onboardingSeen"
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    /// The step to open at, or nil when Dopamine is set up and still allowed.
    /// - Parameter force: Getting started from the menu, which always starts over.
    func start(granted: Bool, force: Bool = false) -> Step? {
        if !force && defaults.bool(forKey: Self.completedKey) && granted { return nil }
        let returning = defaults.bool(forKey: Self.seenKey)
        defaults.set(true, forKey: Self.seenKey)
        return returning && !force ? .permission : .welcome
    }

    /// Marks setup finished, if access is allowed.
    func complete(granted: Bool) -> Bool {
        guard granted else { return false }
        defaults.set(true, forKey: Self.completedKey)
        return true
    }

    /// Access was switched off while the guide was open: show it again next launch.
    func permissionLost() {
        defaults.set(false, forKey: Self.completedKey)
    }
}
