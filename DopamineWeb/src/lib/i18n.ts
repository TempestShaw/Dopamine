// Interface text in English, Simplified Chinese and Traditional Chinese. No library: the
// dashboard has a few hundred words, and a typed object catches a missing translation at build time.
import { ReactNode, createContext, useContext } from "react";
import type { Category } from "./categories";
import type { View } from "./time";

import type { Locale } from "./locale";

export type { Locale } from "./locale";
export { detectLocale, saveLocale } from "./locale";

export const LOCALES: { value: Locale; label: string; short: string }[] = [
  { value: "en", label: "English", short: "EN" },
  { value: "zh-CN", label: "简体中文", short: "简" },
  { value: "zh-TW", label: "繁體中文", short: "繁" },
];

/** Things a sentence can say about a period, reused by the insight notes. */
export type InsightMsg =
  | { kind: "focusDelta"; amount: string; more: boolean; view: View }
  | { kind: "longest"; amount: string; start: string }
  | { kind: "peak"; from: string; to: string }
  | { kind: "distraction"; app: string; amount: string; percent: number }
  | { kind: "switches"; perHour: number; busy: boolean }
  | { kind: "focusShare"; percent: number };

const en = {
  language: "Language",
  platform: { windows: "Windows", mac: "macOS", demo: "sample data" },
  leaveDemo: "Leave sample data",
  disconnect: "Disconnect",
  previous: "Previous",
  next: "Next",
  backTo: { day: "back to today", week: "back to this week", month: "back to this month" } as Record<View, string>,
  views: { day: "Day", week: "Week", month: "Month" } as Record<View, string>,
  themeLight: "Paper (light)",
  themeDark: "Canvas (dark)",
  retry: "Retry",
  errors: {
    save: "Couldn't save that setting.",
    unreachable: "Couldn't reach the Dopamine agent. Is it running?",
    lost: "Lost connection to the Dopamine agent.",
  },
  footer: {
    local: "everything stays on this computer",
    sharing: "your activity stays on this computer; only app categories you pick are shared",
    stop: "stop sharing category choices",
    start: "share category choices to help others",
  },
  categories: { work: "Work", study: "Study", social: "Social", entertainment: "Entertainment", other: "Other" } as Record<Category, string>,
  stats: {
    screenTime: "Screen time",
    focused: "Focused",
    longestFocus: "Longest focus",
    mostUsed: "Most used",
    vs: { day: "vs. yesterday", week: "vs. last week", month: "vs. last month" } as Record<View, string>,
    perDay: (d: string) => `${d} a day`,
    ofIt: (p: number) => `${p}% of it`,
    from: (t: string) => `from ${t}`,
    noStretch: "no deep stretch yet",
    switches: (n: string) => `${n} switches`,
  },
  chart: {
    timeline: "Timeline",
    dayByDay: "Day by day",
    hoverHour: "hover a bar to see the hour",
    hoverDay: "hover for details · click a day to open it",
  },
  categoriesTitle: "Categories",
  nothingYet: "nothing tracked yet",
  inTotal: "in total",
  calendar: { perDay: (d: string) => `~${d} a day`, less: "less", more: "more" },
  notes: { title: "Notes", empty: "notes show up after a few minutes of activity" },
  insight(m: InsightMsg): string {
    switch (m.kind) {
      case "focusDelta": {
        const than = { day: "yesterday by this time", week: "last week so far", month: "last month so far" }[m.view];
        return `${m.amount} ${m.more ? "more" : "less"} focus time than ${than}.`;
      }
      case "longest":
        return `Longest focus stretch: ${m.amount}, starting at ${m.start}.`;
      case "peak":
        return `You focus best around ${m.from}–${m.to}.`;
      case "distraction":
        return `${m.app} took ${m.amount} (${m.percent}% of screen time).`;
      case "switches":
        return `${m.perHour} app switches per hour${m.busy ? " — lots of context switching" : ""}.`;
      case "focusShare":
        return `${m.percent}% of your screen time was focused work or study.`;
    }
  },
  lists: {
    apps: "Apps & windows",
    sessions: "Sessions",
    tabApps: "Apps",
    tabSessions: "Sessions",
    empty: "nothing tracked in this period",
    moreWindows: (n: number) => `+${n} more windows`,
    showN: (n: number) => `show ${n} more`,
    showMore: "show more",
    shortHidden: (n: number) => `${n} sessions under a minute hidden`,
    countsAs: (app: string) => `${app} counts as`,
    automatic: "(automatic)",
    backToAuto: "back to automatic",
  },
  hide: {
    button: "hide this app",
    hint: "Its time won't count anywhere. You can bring it back under the list.",
    count: (n: number) => (n === 1 ? "1 app hidden" : `${n} apps hidden`),
    manage: "manage",
    done: "done",
    unhide: "show again",
  },
  share: {
    ask: (app: ReactNode) => ["Share this choice so Dopamine recognises ", app, " for other people too?"],
    everything: "This is everything that would be sent, now and for later choices. No window titles, no times, no usage:",
    yes: "Share anonymously",
    no: "Keep it on this computer",
    code: "read the code →",
    demo: "sample data: nothing is sent either way",
    installId: "<random id for this install>",
  },
  pair: {
    title: ["Rediscover", "your time."],
    intro: "Dopamine notes which window is in front, keeps it on your computer, and shows you where the hours went.",
    found: (os: ReactNode, version: string) => ["Found ", os, ` v${version}`],
    agentName: (mac: boolean) => `Dopamine for ${mac ? "macOS" : "Windows"}`,
    missing: "No Dopamine agent running on this computer",
    looking: "Looking for Dopamine…",
    address: "address",
    done: "done",
    check: "Check",
    code: "Pairing code",
    where: (mac: boolean) => `It's in the Dopamine ${mac ? "menu bar" : "tray"} menu.`,
    wrong: "That code didn't match. Open the Dopamine menu to see the current one.",
    connecting: "Connecting…",
    connect: "Connect",
    install: "Install the agent, then come back. This page connects on its own.",
    demo: (sample: ReactNode) => ["or look around with ", sample, " →"],
    sample: "sample data",
  },
  duration: { h: "h", m: "m", mOnly: "m", s: "s", sep: " " },
};

export type Dict = typeof en;

const zhCN: Dict = {
  language: "语言",
  platform: { windows: "Windows", mac: "macOS", demo: "示例数据" },
  leaveDemo: "退出示例数据",
  disconnect: "断开连接",
  previous: "上一个",
  next: "下一个",
  backTo: { day: "回到今天", week: "回到本周", month: "回到本月" },
  views: { day: "日", week: "周", month: "月" },
  themeLight: "纸面（浅色）",
  themeDark: "画布（深色）",
  retry: "重试",
  errors: {
    save: "这项设置没能保存。",
    unreachable: "连不上 Dopamine 代理程序，它在运行吗？",
    lost: "和 Dopamine 代理程序的连接断开了。",
  },
  footer: {
    local: "所有数据都只留在这台电脑上",
    sharing: "你的活动只留在这台电脑上，只会分享你选定的应用分类",
    stop: "停止分享分类选择",
    start: "分享分类选择，帮助其他人",
  },
  categories: { work: "工作", study: "学习", social: "社交", entertainment: "娱乐", other: "其他" },
  stats: {
    screenTime: "屏幕时间",
    focused: "专注",
    longestFocus: "最长专注",
    mostUsed: "最常用",
    vs: { day: "较昨天", week: "较上周", month: "较上月" },
    perDay: (d) => `每天 ${d}`,
    ofIt: (p) => `占 ${p}%`,
    from: (t) => `从 ${t} 开始`,
    noStretch: "还没有长时间专注",
    switches: (n) => `切换 ${n} 次`,
  },
  chart: {
    timeline: "时间线",
    dayByDay: "每日",
    hoverHour: "把鼠标移到柱子上查看该小时",
    hoverDay: "悬停查看详情 · 点击某天打开",
  },
  categoriesTitle: "分类",
  nothingYet: "还没有记录",
  inTotal: "合计",
  calendar: { perDay: (d) => `平均每天 ${d}`, less: "少", more: "多" },
  notes: { title: "笔记", empty: "活动几分钟后，这里会出现笔记" },
  insight(m) {
    switch (m.kind) {
      case "focusDelta": {
        const than = { day: "昨天同一时间", week: "上周同期", month: "上月同期" }[m.view];
        return `专注时间比${than}${m.more ? "多" : "少"} ${m.amount}。`;
      }
      case "longest":
        return `最长专注 ${m.amount}，从 ${m.start} 开始。`;
      case "peak":
        return `你在 ${m.from}–${m.to} 最专注。`;
      case "distraction":
        return `${m.app} 用了 ${m.amount}（占屏幕时间 ${m.percent}%）。`;
      case "switches":
        return `每小时切换应用 ${m.perHour} 次${m.busy ? "，切换有点频繁" : ""}。`;
      case "focusShare":
        return `${m.percent}% 的屏幕时间用在工作或学习上。`;
    }
  },
  lists: {
    apps: "应用与窗口",
    sessions: "时段",
    tabApps: "应用",
    tabSessions: "时段",
    empty: "这段时间没有记录",
    moreWindows: (n) => `还有 ${n} 个窗口`,
    showN: (n) => `再显示 ${n} 个`,
    showMore: "显示更多",
    shortHidden: (n) => `已隐藏 ${n} 个不到一分钟的时段`,
    countsAs: (app) => `${app} 算作`,
    automatic: "（自动）",
    backToAuto: "恢复自动",
  },
  hide: {
    button: "隐藏这个应用",
    hint: "它的时间不会再计入任何统计。可以在列表下方恢复。",
    count: (n) => `已隐藏 ${n} 个应用`,
    manage: "管理",
    done: "完成",
    unhide: "取消隐藏",
  },
  share: {
    ask: (app) => ["要分享这个选择，让 Dopamine 也能帮其他人认出 ", app, " 吗？"],
    everything: "以下就是会发送的全部内容，现在和以后的选择都一样。不含窗口标题、时间或使用情况：",
    yes: "匿名分享",
    no: "只留在这台电脑上",
    code: "查看代码 →",
    demo: "示例数据：无论怎么选都不会发送",
    installId: "<这台电脑的随机 ID>",
  },
  pair: {
    title: ["重新发现", "你的时间。"],
    intro: "Dopamine 记录哪个窗口在最前面，数据只存在你的电脑上，然后告诉你时间都去哪了。",
    found: (os, version) => ["找到了 ", os, ` v${version}`],
    agentName: (mac) => `Dopamine（${mac ? "macOS" : "Windows"} 版）`,
    missing: "这台电脑上没有运行 Dopamine 代理程序",
    looking: "正在寻找 Dopamine…",
    address: "地址",
    done: "完成",
    check: "检查",
    code: "配对码",
    where: (mac) => `在 Dopamine 的${mac ? "菜单栏" : "托盘"}菜单里。`,
    wrong: "配对码不对。打开 Dopamine 菜单查看当前的配对码。",
    connecting: "正在连接…",
    connect: "连接",
    install: "先安装代理程序再回来，这个页面会自动连接。",
    demo: (sample) => ["或者先用", sample, "看看 →"],
    sample: "示例数据",
  },
  duration: { h: "小时", m: "分", mOnly: "分钟", s: "秒", sep: "" },
};

const zhTW: Dict = {
  language: "語言",
  platform: { windows: "Windows", mac: "macOS", demo: "範例資料" },
  leaveDemo: "離開範例資料",
  disconnect: "中斷連線",
  previous: "上一個",
  next: "下一個",
  backTo: { day: "回到今天", week: "回到本週", month: "回到本月" },
  views: { day: "日", week: "週", month: "月" },
  themeLight: "紙面（淺色）",
  themeDark: "畫布（深色）",
  retry: "重試",
  errors: {
    save: "這項設定沒能儲存。",
    unreachable: "連不上 Dopamine 代理程式，它在執行嗎？",
    lost: "與 Dopamine 代理程式的連線中斷了。",
  },
  footer: {
    local: "所有資料都只留在這台電腦上",
    sharing: "你的活動只留在這台電腦上，只會分享你選定的應用程式分類",
    stop: "停止分享分類選擇",
    start: "分享分類選擇，幫助其他人",
  },
  categories: { work: "工作", study: "學習", social: "社交", entertainment: "娛樂", other: "其他" },
  stats: {
    screenTime: "螢幕使用時間",
    focused: "專注",
    longestFocus: "最長專注",
    mostUsed: "最常用",
    vs: { day: "較昨天", week: "較上週", month: "較上月" },
    perDay: (d) => `每天 ${d}`,
    ofIt: (p) => `佔 ${p}%`,
    from: (t) => `從 ${t} 開始`,
    noStretch: "還沒有長時間專注",
    switches: (n) => `切換 ${n} 次`,
  },
  chart: {
    timeline: "時間軸",
    dayByDay: "每日",
    hoverHour: "把滑鼠移到長條上查看該小時",
    hoverDay: "懸停查看詳情 · 點擊某天開啟",
  },
  categoriesTitle: "分類",
  nothingYet: "還沒有紀錄",
  inTotal: "合計",
  calendar: { perDay: (d) => `平均每天 ${d}`, less: "少", more: "多" },
  notes: { title: "筆記", empty: "活動幾分鐘後，這裡會出現筆記" },
  insight(m) {
    switch (m.kind) {
      case "focusDelta": {
        const than = { day: "昨天同一時間", week: "上週同期", month: "上月同期" }[m.view];
        return `專注時間比${than}${m.more ? "多" : "少"} ${m.amount}。`;
      }
      case "longest":
        return `最長專注 ${m.amount}，從 ${m.start} 開始。`;
      case "peak":
        return `你在 ${m.from}–${m.to} 最專注。`;
      case "distraction":
        return `${m.app} 用了 ${m.amount}（佔螢幕使用時間 ${m.percent}%）。`;
      case "switches":
        return `每小時切換應用程式 ${m.perHour} 次${m.busy ? "，切換有點頻繁" : ""}。`;
      case "focusShare":
        return `${m.percent}% 的螢幕使用時間用在工作或學習上。`;
    }
  },
  lists: {
    apps: "應用程式與視窗",
    sessions: "時段",
    tabApps: "應用程式",
    tabSessions: "時段",
    empty: "這段時間沒有紀錄",
    moreWindows: (n) => `還有 ${n} 個視窗`,
    showN: (n) => `再顯示 ${n} 個`,
    showMore: "顯示更多",
    shortHidden: (n) => `已隱藏 ${n} 個不到一分鐘的時段`,
    countsAs: (app) => `${app} 算作`,
    automatic: "（自動）",
    backToAuto: "恢復自動",
  },
  hide: {
    button: "隱藏這個應用程式",
    hint: "它的時間不會再計入任何統計。可以在列表下方恢復。",
    count: (n) => `已隱藏 ${n} 個應用程式`,
    manage: "管理",
    done: "完成",
    unhide: "取消隱藏",
  },
  share: {
    ask: (app) => ["要分享這個選擇，讓 Dopamine 也能幫其他人認出 ", app, " 嗎？"],
    everything: "以下就是會傳送的全部內容，現在和以後的選擇都一樣。不含視窗標題、時間或使用情況：",
    yes: "匿名分享",
    no: "只留在這台電腦上",
    code: "查看程式碼 →",
    demo: "範例資料：無論怎麼選都不會傳送",
    installId: "<這台電腦的隨機 ID>",
  },
  pair: {
    title: ["重新發現", "你的時間。"],
    intro: "Dopamine 記錄哪個視窗在最前面，資料只存在你的電腦上，然後告訴你時間都去哪了。",
    found: (os, version) => ["找到了 ", os, ` v${version}`],
    agentName: (mac) => `Dopamine（${mac ? "macOS" : "Windows"} 版）`,
    missing: "這台電腦上沒有執行 Dopamine 代理程式",
    looking: "正在尋找 Dopamine…",
    address: "位址",
    done: "完成",
    check: "檢查",
    code: "配對碼",
    where: (mac) => `在 Dopamine 的${mac ? "選單列" : "系統匣"}選單裡。`,
    wrong: "配對碼不對。打開 Dopamine 選單查看目前的配對碼。",
    connecting: "正在連線…",
    connect: "連線",
    install: "先安裝代理程式再回來，這個頁面會自動連線。",
    demo: (sample) => ["或者先用", sample, "看看 →"],
    sample: "範例資料",
  },
  duration: { h: "小時", m: "分", mOnly: "分鐘", s: "秒", sep: "" },
};

export const DICTS: Record<Locale, Dict> = { en, "zh-CN": zhCN, "zh-TW": zhTW };

export const I18nContext = createContext<{ locale: Locale; setLocale: (l: Locale) => void }>({ locale: "en", setLocale: () => {} });

export function useI18n() {
  return useContext(I18nContext);
}

/** The strings for the current language. */
export function useT(): Dict {
  return DICTS[useContext(I18nContext).locale];
}
