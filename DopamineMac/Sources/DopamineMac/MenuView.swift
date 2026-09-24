import SwiftUI

extension Category {
    var color: Color {
        switch self {
        case .work: return Color(red: 0.31, green: 0.43, blue: 0.97)
        case .study: return Color(red: 0.31, green: 0.71, blue: 0.54)
        case .social: return Color(red: 0.91, green: 0.47, blue: 0.62)
        case .entertainment: return Color(red: 0.93, green: 0.63, blue: 0.38)
        case .other: return Color(red: 0.70, green: 0.65, blue: 0.86)
        }
    }
}

final class MenuModel: ObservableObject {
    @Published var summary = DaySummary()
    @Published var icons: [String: NSImage] = [:]
    @Published var yesterdayTotal: TimeInterval = 0
    @Published var isRecording = true
    @Published var isIdle = false
    @Published var userPaused = false
    @Published var pairingCode = ""
    @Published var hasAccessibility = true
    @Published var launchAtLogin = false
    @Published var canLaunchAtLogin = false
    @Published var serverError: String?
}

struct MenuActions {
    var openDashboard: () -> Void
    var togglePause: () -> Void
    var grantAccessibility: () -> Void
    var setLaunchAtLogin: (Bool) -> Void
    var quit: () -> Void
}

struct MenuView: View {
    @ObservedObject var model: MenuModel
    let actions: MenuActions
    @State private var copied = false

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            header
            if model.summary.total > 0 {
                categoryBar
                appList
            } else {
                Text(model.userPaused ? "Tracking is paused." : "Nothing tracked yet today.")
                    .font(.callout)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 60)
            }
            if !model.hasAccessibility { accessibilityNotice }
            if let error = model.serverError {
                Label(error, systemImage: "exclamationmark.triangle.fill")
                    .font(.caption)
                    .foregroundColor(.orange)
            }
            Divider()
            footer
        }
        .padding(16)
        .frame(width: 320)
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Today").font(.caption).foregroundColor(.secondary)
                Text(formatDuration(model.summary.total))
                    .font(.system(size: 28, weight: .semibold, design: .rounded))
                    .monospacedDigit()
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                status
                if model.summary.total > 0 {
                    let share = model.summary.focus / model.summary.total
                    Text("\(Int((share * 100).rounded()))% focused")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
    }

    private var status: some View {
        let (text, color): (String, Color) = model.userPaused ? ("Paused", .orange) : model.isIdle ? ("Idle", .secondary) : model.isRecording ? ("Recording", .green) : ("Suspended", .secondary)
        return HStack(spacing: 5) {
            Circle().fill(color).frame(width: 7, height: 7)
            Text(text).font(.caption.weight(.medium))
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(Capsule().fill(Color.primary.opacity(0.06)))
    }

    private var categoryBar: some View {
        let cats = Category.allCases.filter { (model.summary.byCategory[$0] ?? 0) > 0 }
        return VStack(alignment: .leading, spacing: 8) {
            GeometryReader { geo in
                HStack(spacing: 2) {
                    ForEach(cats, id: \.self) { c in
                        c.color.frame(width: max(2, geo.size.width * (model.summary.byCategory[c] ?? 0) / model.summary.total - 2))
                    }
                }
            }
            .frame(height: 8)
            .clipShape(Capsule())

            HStack(spacing: 10) {
                ForEach(cats.prefix(4), id: \.self) { c in
                    HStack(spacing: 4) {
                        Circle().fill(c.color).frame(width: 6, height: 6)
                        Text("\(c.label) \(formatDuration(model.summary.byCategory[c] ?? 0))")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    }
                }
            }
        }
    }

    private var appList: some View {
        let top = model.summary.apps.prefix(5)
        let max = top.first?.duration ?? 1
        return VStack(spacing: 8) {
            ForEach(Array(top)) { app in
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        if let icon = model.icons[app.app] {
                            Image(nsImage: icon)
                                .resizable()
                                .interpolation(.high)
                                .frame(width: 18, height: 18)
                        }
                        Text(app.app).font(.callout).lineLimit(1)
                        Spacer()
                        Text(formatDuration(app.duration)).font(.callout).monospacedDigit().foregroundColor(.secondary)
                    }
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Color.primary.opacity(0.07))
                            Capsule().fill(app.category.color).frame(width: geo.size.width * app.duration / max)
                        }
                    }
                    .frame(height: 4)
                }
            }
        }
    }

    private var accessibilityNotice: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "lock.shield").foregroundColor(.orange)
            VStack(alignment: .leading, spacing: 4) {
                Text("Window titles need Accessibility access").font(.caption.weight(.semibold))
                Text("Without it Dopamine only sees app names.").font(.caption).foregroundColor(.secondary)
                Button("Open System Settings…", action: actions.grantAccessibility)
                    .buttonStyle(.link)
                    .font(.caption)
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 8).fill(Color.orange.opacity(0.1)))
    }

    private var footer: some View {
        VStack(spacing: 10) {
            Button(action: actions.openDashboard) {
                Label("Open Dashboard", systemImage: "chart.bar.xaxis")
                    .frame(maxWidth: .infinity)
            }
            .controlSize(.large)
            .buttonStyle(.borderedProminent)

            HStack {
                Button {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(model.pairingCode, forType: .string)
                    copied = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { copied = false }
                } label: {
                    HStack(spacing: 4) {
                        Text("Pairing code").foregroundColor(.secondary)
                        Text(model.pairingCode).font(.system(.caption, design: .monospaced).weight(.semibold))
                        Image(systemName: copied ? "checkmark" : "doc.on.doc").foregroundColor(.secondary)
                    }
                    .font(.caption)
                }
                .buttonStyle(.plain)
                .help("Copy pairing code")
                Spacer()
                Button(model.userPaused ? "Resume" : "Pause", action: actions.togglePause)
                    .buttonStyle(.link)
                    .font(.caption)
            }

            HStack {
                if model.canLaunchAtLogin {
                    Toggle("Open at login", isOn: Binding(get: { model.launchAtLogin }, set: actions.setLaunchAtLogin))
                        .toggleStyle(.checkbox)
                        .font(.caption)
                }
                Spacer()
                Text("v\(appVersion)").font(.caption2).foregroundColor(.secondary)
                Button("Quit", action: actions.quit)
                    .buttonStyle(.link)
                    .font(.caption)
            }
        }
    }
}
