<p align="center">
  <img src="assets/dopamine-mark.png" alt="Dopamine logo" width="200">
</p>

<h1 align="center">Dopamine</h1>

<p align="center">Know where your time goes.</p>

<p align="center">
  <strong>English</strong> | <a href="README.zh-CN.md" lang="zh-CN">简体中文</a>
</p>

<p align="center">
  <a href="https://tempestshaw.github.io/Dopamine/">Website</a> ·
  <a href="https://github.com/TempestShaw/Dopamine/releases/latest">Download</a> ·
  <a href="#start-tracking">Quick Start</a> ·
  <a href="#privacy">Privacy</a> ·
  <a href="#architecture">Architecture</a>
</p>

<p align="center">
  <a href="https://github.com/TempestShaw/Dopamine/actions/workflows/build.yml"><img alt="Build" src="https://github.com/TempestShaw/Dopamine/actions/workflows/build.yml/badge.svg"></a>
  <img alt="macOS 12 or later" src="https://img.shields.io/badge/macOS-12%2B-111827">
  <img alt="Windows 10 or later" src="https://img.shields.io/badge/Windows-10%2B-111827">
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-111827"></a>
</p>

Dopamine is a small screen-time tracker for macOS and Windows. It notes which app and window are in front, keeps that on your computer, and draws your day as a timeline, a breakdown by app and window, and a month of paint dabs. It pauses on its own when you lock the screen, sleep, or walk away.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/dashboard-dark.png">
    <img src="assets/dashboard-light.png" alt="Dopamine dashboard showing a day of screen time: totals, a 24-hour timeline and categories" width="900">
  </picture>
</p>

<p align="center"><a href="https://tempestshaw.github.io/Dopamine/#film">▶ Watch the 48-second tour</a> of a day with Dopamine, in English, 简体中文 or 繁體中文.</p>

## Start tracking

Download the latest build for your computer from [Releases](https://github.com/TempestShaw/Dopamine/releases/latest).

**macOS 12 or later**

1. Open `Dopamine-mac.dmg` and drag `Dopamine` onto Applications.
2. Open it. This early build is not notarised, so macOS asks first: choose **Open Anyway** in System Settings → Privacy & Security.
3. Allow **Accessibility** access when asked, so Dopamine can read window titles. Without it, only app names are recorded.
4. Click the hourglass in the menu bar, then **Open Dashboard**. Tick **Open at login** there to have it start with your Mac.

**Windows 10 or later**

1. Unzip `Dopamine-win.zip` anywhere you like and run the included `DopamineWin.exe`, or use `Dopamine-win-Setup.exe` from the release to install it. No .NET installation is needed.
2. Click the tray icon to open the dashboard, or right-click it for the menu. Running `DopamineWin.exe` again also opens the dashboard. Choose **Start with Windows** in the same menu to have it start when you sign in.

On Windows the dashboard opens in its own Dopamine window, with its own title bar: the view switch, language, theme and the minimise, maximise and close buttons sit in one row, the way Discord or VS Code do it. Closing the window leaves tracking running in the tray; choose **Exit** from the tray menu to stop. The window uses the Microsoft Edge WebView2 runtime that comes with Windows 10 and 11; on the rare PC without it, the dashboard opens in your browser instead.

On macOS the dashboard opens in its own Dopamine window too, with the same title bar under the usual red, yellow and green buttons. While it's open, Dopamine shows in the Dock and the app switcher; closing it leaves tracking running in the menu bar.

The dashboard is also served at [localhost:26535](http://localhost:26535) for any browser, and pairs itself when opened from the app. The menu shows a six-character pairing code if you ever need to connect by hand.

## Why use Dopamine?

- **Zero effort.** Nothing to start, stop or label. Time stops counting when you lock the screen, sleep, or leave the keyboard alone for five minutes.
- **Honest numbers.** Windows you glance at for under five seconds don't count, a crashed session can't inflate a day, and the current day is compared with yesterday up to the same time.
- **See the detail.** The timeline shows exactly when each window was in front. Open any app to see its windows and tabs, with the app's real icon.
- **Categories that fit you.** Work, study, social, entertainment and other are detected automatically. Click a window to set its category, for that one title or for every title containing some words (a course code, a channel name), in every browser or just one app. One click changes a whole app's category too.
- **Only what you want counted.** Hide any app from the numbers; Dopamine's own windows are hidden from the start.
- **Forget what you'd rather not keep.** Erase a window or a session from the dashboard: its title is overwritten on disk and its time stops counting. To keep something from being recorded at all, pause from the menu bar or tray for 15 minutes, an hour, until tomorrow, or until you resume.
- **Updates install themselves.** The app checks daily, downloads updates in the background and installs them when it quits. Choose **Update and restart** to apply a ready update immediately.
- **A sidebar for today.** What's in front right now and for how long, today's goals (a screen-time limit and a focus target, with progress), and a 25 or 50 minute focus timer that chimes when it's done. It shows today even while you look at another date.
- **Jump to any day.** Click the date at the top, or any day in the calendar, to go there. Browse back through earlier months; each day is painted by how long the screen was on.
- **Speaks your language.** English, 简体中文 and 繁體中文, in the dashboard and the menu bar or tray.
- **Light on your machine.** A native menu bar or tray agent, a local SQLite file, and a dashboard with no charting libraries that holds 60 fps.

## What you get

| | |
| --- | --- |
| Timeline | A 24-hour strip of every window, plus hourly or daily stacked bars |
| Apps & windows | Time per app with its icon, expandable to the windows and tabs inside it |
| Sessions | A log of uninterrupted stretches in each app |
| Categories | A ring of where the time went, and a picker to recategorise any app |
| Notes | Longest focus stretch, best hour, biggest distraction, context switching |
| Calendar | The month as paint dabs, from your lightest day to your heaviest |
| Menu bar / tray | Today's total and top apps at a glance |

## How categories are decided

Dopamine looks at the evidence in this order and stops at the first answer:

| Evidence | Example |
| --- | --- |
| Your own choice for the app | Discord counts as Study because you said so |
| The site, for browsers | `Two Sum - LeetCode - Google Chrome` → Study |
| The app, by name | `idea64`, `LeagueClientUx`, `WXWork` |
| What the app says about itself | macOS App Store category; Windows publisher and install path (`steamapps` means a game) |
| The window title | `javaw` showing "Minecraft" |

The rules live in [`category-rules.json`](DopamineWeb/src/lib/category-rules.json), shared by the dashboard and the macOS agent. They are checked against 115 real process names and tab titles, and a separate held-out set that the rules were never tuned on.

## Privacy

Your activity never leaves your computer. Window titles, times and usage stay in a local SQLite database and are only served to `localhost`, behind the pairing code.

Automatic updates use Sparkle on macOS and Velopack on Windows, with update files hosted on GitHub Releases. These requests do not upload your activity, window titles or local category choices. Turn off future automatic checks and downloads from the dashboard footer; an update already prepared by Sparkle may still install when the app quits. See [updater setup and testing](docs/updates.md).

## Architecture

```text
 macOS menu bar agent (Swift)        Windows tray agent (C# / .NET 8)
   NSWorkspace + Accessibility          GetForegroundWindow + GetLastInputInfo
                  \                          /
                   SQLite: WindowActivities, AppInfo
                                 ↓
                 local API on localhost:26535
       /identify · /pair · /titles · /apps · /settings
                                 ↓
          Dashboard (Next.js static export, served by the agent)
            in the agent's own window: WebView2 on Windows, WKWebView on macOS
```

Each agent writes a row whenever the front window changes, plus marker rows when tracking stops or you go idle. The dashboard turns those rows into durations. Every protected request sends `Authorization: Bearer <pairing code>`.

| Folder | What it is |
| --- | --- |
| [`DopamineMac`](DopamineMac) | Swift menu bar agent, no third-party dependencies |
| [`DopamineWin`](DopamineWin) | C# tray agent |
| [`DopamineWeb`](DopamineWeb) | Dashboard, exported as static files and bundled into both agents |

## Build from source

Build the dashboard first; both agents bundle it.

```bash
cd DopamineWeb
bun install
bun run build
```

**macOS** (Xcode 15 or later):

```bash
cd DopamineMac
swift run                 # run from source
DOPAMINE_DASHBOARD_URL=http://localhost:3000/ DOPAMINE_OPEN_DASHBOARD=1 swift run   # dashboard window on `bun dev`
./scripts/bundle.sh       # universal Dopamine.app in dist/
```

**Windows** (.NET 8 SDK):

```powershell
cd DopamineWin
dotnet run
```

**Dashboard only**, with sample data or a running agent:

```bash
cd DopamineWeb
bun dev                   # http://localhost:3000
bun run preview           # one self-contained HTML file on sample data
```

After editing `category-rules.json`, run `bun run sync-rules` so the macOS agent picks up the same rules.

## Test

```bash
cd DopamineWeb && bun test src      # analytics, categories
cd DopamineMac && swift test        # database, API, categories
```

CI builds and tests all three on every push and attaches `Dopamine-mac.dmg`, `Dopamine-mac.zip` and `Dopamine-win.zip` to tagged releases.

## Trust and license

This is an early release. The trackers are tested for building, storage, the API and categorisation. Their behaviour on real desktops (permission prompts, lock and sleep handling, the menu bar and tray) is checked by hand, so please [report anything odd](https://github.com/TempestShaw/Dopamine/issues/new) with your operating system and what you saw.

Categories are estimates; correct them in the dashboard when they are wrong.

[MIT](LICENSE).
