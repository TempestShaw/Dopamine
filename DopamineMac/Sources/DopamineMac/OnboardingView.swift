import SwiftUI

struct OnboardingViewActions {
    var back: () -> Void
    var next: () -> Void
    var grant: () -> Void
    var setLaunchAtLogin: (Bool) -> Void
}

/// The guide's pages: a painted panel on the left, the step on the right, Back / Continue below.
struct OnboardingView: View {
    @ObservedObject var model: OnboardingModel
    let actions: OnboardingViewActions

    var body: some View {
        HStack(spacing: 0) {
            OnboardingArt()
                .frame(width: 260)
            VStack(alignment: .leading, spacing: 18) {
                brand
                page.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                navigation
            }
            .padding(.horizontal, 36)
            .padding(.top, 36)
            .padding(.bottom, 26)
        }
        .frame(width: 760, height: 500)
        .background(Color(nsColor: .windowBackgroundColor))
    }

    private var brand: some View {
        HStack(spacing: 8) {
            Image(nsImage: NSApp.applicationIconImage).resizable().frame(width: 26, height: 26)
            Text("Dopamine").font(.headline)
        }
    }

    @ViewBuilder private var page: some View {
        switch model.step {
        case .welcome: welcome
        case .permission: permission
        case .finish: finish
        }
    }

    private func heading(_ eyebrow: String, _ title: String, _ detail: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(eyebrow).font(.caption.weight(.semibold)).foregroundColor(.accentColor)
            Text(title).font(.system(size: 26, weight: .semibold)).fixedSize(horizontal: false, vertical: true)
            Text(detail).font(.callout).foregroundColor(.secondary).fixedSize(horizontal: false, vertical: true)
        }
    }

    private func point(_ symbol: String, _ title: String, _ detail: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: symbol).foregroundColor(.accentColor).frame(width: 20)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.callout.weight(.semibold))
                Text(detail).font(.callout).foregroundColor(.secondary).fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var welcome: some View {
        VStack(alignment: .leading, spacing: 22) {
            heading(
                L("01 / WELCOME", "01 / 欢迎", "01 / 歡迎"),
                L("Know where your time goes.", "知道你的时间去了哪里。", "知道你的時間去了哪裡。"),
                L("Dopamine notes which app and window are in front, and draws your day.",
                  "Dopamine 记下最前面的是哪个应用和窗口，再把你的一天画出来。",
                  "Dopamine 記下最前面的是哪個應用程式和視窗，再把你的一天畫出來。")
            )
            VStack(alignment: .leading, spacing: 14) {
                point("hand.raised", L("Zero effort", "不用动手", "不用動手"),
                      L("Nothing to start or label. It pauses when you lock the screen, sleep or walk away.",
                        "不用开始，也不用标记。锁屏、睡眠或离开时会自动暂停。",
                        "不用開始，也不用標記。鎖定螢幕、睡眠或離開時會自動暫停。"))
                point("lock", L("Stays on this Mac", "只留在这台 Mac 上", "只留在這台 Mac 上"),
                      L("Everything is kept in a local file. No account, nothing uploaded.",
                        "所有记录都存在本地文件里。不用注册，也不会上传。",
                        "所有紀錄都存在本機檔案裡。不用註冊，也不會上傳。"))
                point("pause.circle", L("Yours to control", "由你决定", "由你決定"),
                      L("Pause any time from the menu bar, hide apps, or forget a window.",
                        "随时可以在菜单栏暂停、隐藏应用，或删掉某个窗口的记录。",
                        "隨時可以在選單列暫停、隱藏應用程式，或刪掉某個視窗的紀錄。"))
            }
        }
    }

    private var permission: some View {
        VStack(alignment: .leading, spacing: 22) {
            heading(
                L("02 / PERMISSION", "02 / 权限", "02 / 權限"),
                L("Let Dopamine read window titles.", "让 Dopamine 读取窗口标题。", "讓 Dopamine 讀取視窗標題。"),
                L("macOS keeps window titles behind Accessibility. Dopamine checks automatically once it's on.",
                  "macOS 把窗口标题放在“辅助功能”权限后面。打开之后 Dopamine 会自动检测到。",
                  "macOS 把視窗標題放在「輔助使用」權限後面。打開之後 Dopamine 會自動偵測到。")
            )
            HStack(alignment: .center, spacing: 12) {
                Image(systemName: model.granted ? "checkmark.circle.fill" : "lock.shield")
                    .font(.title2)
                    .foregroundColor(model.granted ? .green : .orange)
                VStack(alignment: .leading, spacing: 3) {
                    Text(L("Accessibility", "辅助功能", "輔助使用")).font(.callout.weight(.semibold))
                    Text(model.granted
                         ? L("Allowed · Ready", "已允许 · 就绪", "已允許 · 就緒")
                         : L("For window and tab titles. Switch Dopamine on under Accessibility.",
                             "用来读取窗口和标签页标题。请在“辅助功能”里打开 Dopamine。",
                             "用來讀取視窗和分頁標題。請在「輔助使用」裡打開 Dopamine。"))
                        .font(.callout)
                        .foregroundColor(model.granted ? .green : .secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer()
                Button(model.granted ? L("Allowed", "已允许", "已允許") : L("Open Settings…", "打开设置…", "打開設定…"), action: actions.grant)
                    .disabled(model.granted)
                    .accessibilityLabel(L("Allow window titles", "允许读取窗口标题", "允許讀取視窗標題"))
            }
            .padding(14)
            .background(RoundedRectangle(cornerRadius: 10).fill(Color.primary.opacity(0.05)))
            if !model.granted {
                Text(L(
                    "Already switched on? That entry is from an older copy: Open Settings clears it, then switch Dopamine on again. If macOS asks you to quit and reopen, setup picks up here.",
                    "列表里已经打开了？那是旧版本留下的记录：点“打开设置”会清掉它，再重新打开 Dopamine 即可。如果 macOS 要求退出并重新打开，设置会从这一步继续。",
                    "列表裡已經打開了？那是舊版本留下的紀錄：點「打開設定」會清掉它，再重新打開 Dopamine 即可。如果 macOS 要求結束並重新打開，設定會從這一步繼續。"
                ))
                .font(.caption)
                .foregroundColor(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var finish: some View {
        VStack(alignment: .leading, spacing: 22) {
            heading(
                L("03 / MAKE IT YOURS", "03 / 按你的习惯来", "03 / 照你的習慣來"),
                L("You're all set.", "一切就绪。", "一切就緒。"),
                L("Dopamine is already recording. Your day fills in as you use your Mac.",
                  "Dopamine 已经在记录了。你用 Mac 的时候，今天的图表会慢慢填满。",
                  "Dopamine 已經在記錄了。你用 Mac 的時候，今天的圖表會慢慢填滿。")
            )
            if let launchAtLogin = model.launchAtLogin {
                Toggle(isOn: Binding(get: { launchAtLogin }, set: actions.setLaunchAtLogin)) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(L("Open at login", "登录时打开", "登入時打開")).font(.callout.weight(.semibold))
                        Text(L("So no part of the day goes unrecorded.", "这样一天里不会漏掉任何时段。", "這樣一天裡不會漏掉任何時段。"))
                            .font(.callout).foregroundColor(.secondary)
                    }
                }
                .toggleStyle(.switch)
                .padding(14)
                .background(RoundedRectangle(cornerRadius: 10).fill(Color.primary.opacity(0.05)))
            }
            point("menubar.rectangle", L("Today at a glance", "随时看今天", "隨時看今天"),
                  L("Click the dabs in the menu bar for today's total, top apps and Pause.",
                    "点菜单栏里的色块，可以看到今天的总时长、最常用的应用，还能暂停。",
                    "點選單列裡的色塊，可以看到今天的總時長、最常用的應用程式，還能暫停。"))
            point("questionmark.circle", L("Getting started", "入门指南", "入門指南"),
                  L("Open this guide again from the menu bar.", "以后可以从菜单栏再次打开这份指南。", "之後可以從選單列再次打開這份指南。"))
        }
    }

    /// The step counter stays centred however wide the buttons beside it are.
    private var navigation: some View {
        ZStack {
            Text("\(model.step.rawValue + 1) / \(OnboardingFlow.Step.count)")
                .font(.caption)
                .foregroundColor(.secondary)
                .monospacedDigit()
            buttons
        }
        .controlSize(.large)
    }

    private var buttons: some View {
        HStack {
            if model.step.previous != nil {
                Button(L("Back", "上一步", "上一步"), action: actions.back)
            }
            Spacer()
            Button(model.step.next == nil ? L("Open Dashboard", "打开仪表板", "打開儀表板") : L("Continue", "继续", "繼續"), action: actions.next)
                .keyboardShortcut(.defaultAction)
                .disabled(!model.step.canContinue(granted: model.granted))
                .help(model.step.canContinue(granted: model.granted) ? "" : L(
                    "Allow Accessibility to continue.",
                    "允许“辅助功能”后才能继续。",
                    "允許「輔助使用」後才能繼續。"
                ))
        }
    }
}

/// Paint dabs in the category colours, like the dashboard's calendar, with the slogan.
private struct OnboardingArt: View {
    private struct Dab: Identifiable {
        let id: Int
        let category: Category
        let x, y, size: CGFloat
    }

    private static let dabs: [Dab] = [
        Dab(id: 0, category: .work, x: 70, y: 120, size: 120),
        Dab(id: 1, category: .study, x: 180, y: 200, size: 90),
        Dab(id: 2, category: .social, x: 90, y: 270, size: 70),
        Dab(id: 3, category: .entertainment, x: 190, y: 330, size: 80),
        Dab(id: 4, category: .other, x: 60, y: 370, size: 56),
    ]

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.primary.opacity(0.04)
            ForEach(Self.dabs) { dab in
                Ellipse()
                    .fill(dab.category.color.opacity(0.55))
                    .frame(width: dab.size, height: dab.size * 0.82)
                    .rotationEffect(.degrees(Double(dab.id) * 23 - 30))
                    .position(x: dab.x, y: dab.y)
            }
            Text(L("Know where\nyour time goes.", "知道你的时间\n去了哪里。", "知道你的時間\n去了哪裡。"))
                .font(.system(size: 15, weight: .medium))
                .multilineTextAlignment(.center)
                .foregroundColor(.secondary)
                .padding(.bottom, 36)
        }
    }
}
