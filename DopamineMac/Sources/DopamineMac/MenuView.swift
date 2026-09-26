import SwiftUI

extension PauseLength {
    var label: String {
        switch self {
        case .minutes15: return L("For 15 minutes", "暂停 15 分钟", "暫停 15 分鐘")
        case .hour1: return L("For 1 hour", "暂停 1 小时", "暫停 1 小時")
        case .untilTomorrow: return L("Until tomorrow", "暂停到明天", "暫停到明天")
        case .indefinitely: return L("Until I resume", "直到我手动继续", "直到我手動繼續")
        }
    }
}

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
    @Published var pausedUntil: Date?
    @Published var update: Release?
    @Published var pairingCode = ""
    @Published var hasAccessibility = true
    @Published var launchAtLogin = false
    @Published var canLaunchAtLogin = false
    @Published var serverError: String?
}

struct MenuActions {
    var openDashboard: () -> Void
    var pause: (PauseLength) -> Void
    var resume: () -> Void
    var grantAccessibility: () -> Void
    var setLaunchAtLogin: (Bool) -> Void
    var openUpdate: () -> Void
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
                Text(model.userPaused ? pauseNote : L("Nothing tracked yet today.", "今天还没有记录。", "今天還沒有紀錄。"))
                    .font(.callout)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 60)
            }
            if model.userPaused && model.summary.total > 0 {
                Text(pauseNote).font(.caption).foregroundColor(.secondary)
            }
            if !model.hasAccessibility { accessibilityNotice }
            if let update = model.update { updateNotice(update) }
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
                Text(L("Today", "今天", "今天")).font(.caption).foregroundColor(.secondary)
                Text(formatDuration(model.summary.total))
                    .font(.system(size: 28, weight: .semibold, design: .rounded))
                    .monospacedDigit()
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                status
                if model.summary.total > 0 {
                    let share = model.summary.focus / model.summary.total
                    Text(L("\(Int((share * 100).rounded()))% focused", "专注 \(Int((share * 100).rounded()))%", "專注 \(Int((share * 100).rounded()))%"))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
    }

    private var status: some View {
        let text: String
        let color: Color
        switch (model.userPaused, model.isIdle, model.isRecording) {
        case (true, _, _): text = pausedLabel; color = .orange
        case (_, true, _): text = L("Idle", "闲置", "閒置"); color = .secondary
        case (_, _, true): text = L("Recording", "记录中", "記錄中"); color = .green
        default: text = L("Suspended", "已挂起", "已暫止"); color = .secondary
        }
        return HStack(spacing: 5) {
            Circle().fill(color).frame(width: 7, height: 7)
            Text(text).font(.caption.weight(.medium))
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(Capsule().fill(Color.primary.opacity(0.06)))
    }

    /// "Paused until 3:45 PM", or "until tomorrow" for a pause that ends at midnight.
    private var pausedLabel: String {
        guard let end = model.pausedUntil else { return L("Paused", "已暂停", "已暫停") }
        if end == Calendar.current.startOfDay(for: end) { return L("Paused until tomorrow", "暂停到明天", "暫停到明天") }
        let time = end.formatted(date: .omitted, time: .shortened)
        return L("Paused until \(time)", "暂停到 \(time)", "暫停到 \(time)")
    }

    private var pauseNote: String {
        model.pausedUntil == nil
            ? L("Nothing is recorded until you resume.", "在你点“继续”之前不会记录任何内容。", "在你按「繼續」之前不會記錄任何內容。")
            : L("Nothing is recorded; it resumes by itself.", "期间不会记录任何内容，到时会自动继续。", "期間不會記錄任何內容，到時會自動繼續。")
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

    private func updateNotice(_ update: Release) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "arrow.down.circle").foregroundColor(.accentColor)
            Text(L("Dopamine \(update.version) is out.", "Dopamine \(update.version) 已发布。", "Dopamine \(update.version) 已發布。"))
                .font(.caption)
            Spacer()
            Button(L("Download", "去下载", "前往下載"), action: actions.openUpdate)
                .buttonStyle(.link)
                .font(.caption.weight(.semibold))
        }
        .padding(10)
        .background(RoundedRectangle(cornerRadius: 8).fill(Color.accentColor.opacity(0.08)))
    }

    private var accessibilityNotice: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "lock.shield").foregroundColor(.orange)
            VStack(alignment: .leading, spacing: 4) {
                Text(L("Window titles need Accessibility access", "读取窗口标题需要“辅助功能”权限", "讀取視窗標題需要「輔助使用」權限")).font(.caption.weight(.semibold))
                Text(L("Without it Dopamine only sees app names.", "没有权限时 Dopamine 只能看到应用名称。", "沒有權限時 Dopamine 只能看到應用程式名稱。")).font(.caption).foregroundColor(.secondary)
                Button(L("Open System Settings…", "打开系统设置…", "打開系統設定…"), action: actions.grantAccessibility)
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
                Label(L("Open Dashboard", "打开仪表板", "打開儀表板"), systemImage: "chart.bar.xaxis")
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
                        Text(L("Pairing code", "配对码", "配對碼")).foregroundColor(.secondary)
                        Text(model.pairingCode).font(.system(.caption, design: .monospaced).weight(.semibold))
                        Image(systemName: copied ? "checkmark" : "doc.on.doc").foregroundColor(.secondary)
                    }
                    .font(.caption)
                }
                .buttonStyle(.plain)
                .help(L("Copy pairing code", "复制配对码", "拷貝配對碼"))
                Spacer()
                if model.userPaused {
                    Button(L("Resume", "继续", "繼續"), action: actions.resume)
                        .buttonStyle(.link)
                        .font(.caption)
                } else {
                    Menu(L("Pause", "暂停", "暫停")) {
                        ForEach(PauseLength.allCases, id: \.self) { length in
                            Button(length.label) { actions.pause(length) }
                        }
                    }
                    .menuStyle(.borderlessButton)
                    .fixedSize()
                    .font(.caption)
                }
            }

            HStack {
                if model.canLaunchAtLogin {
                    Toggle(L("Open at login", "登录时打开", "登入時打開"), isOn: Binding(get: { model.launchAtLogin }, set: actions.setLaunchAtLogin))
                        .toggleStyle(.checkbox)
                        .font(.caption)
                }
                Spacer()
                Text("v\(appVersion)").font(.caption2).foregroundColor(.secondary)
                Button(L("Quit", "退出", "結束"), action: actions.quit)
                    .buttonStyle(.link)
                    .font(.caption)
            }
        }
    }
}
