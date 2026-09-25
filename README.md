<p align="center">
  <img src="assets/dopamine-mark.png" alt="Dopamine logo" width="200">
</p>

<h1 align="center">Dopamine</h1>

<p align="center">See where your hours went, without lifting a finger.</p>

<p align="center">
  <strong>English</strong> | <a href="README.zh-CN.md" lang="zh-CN">简体中文</a>
</p>

<p align="center">
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

## Start tracking

Download the latest build for your computer from [Releases](https://github.com/TempestShaw/Dopamine/releases/latest).

**macOS 12 or later**

1. Unzip `Dopamine-mac.zip` and move `Dopamine.app` to Applications.
2. Open it. This early build is not notarised, so macOS asks first: choose **Open Anyway** in System Settings → Privacy & Security.
3. Allow **Accessibility** access when asked, so Dopamine can read window titles. Without it, only app names are recorded.
4. Click the hourglass in the menu bar, then **Open Dashboard**.

**Windows 10 or later**

1. Unzip `Dopamine-win.zip` anywhere you like and run `DopamineWin.exe`. No .NET installation is needed.
2. Right-click the tray icon (or double-click it) and choose **Open Dashboard**.

The dashboard opens at [localhost:26535](http://localhost:26535) and pairs itself. The menu shows a six-character pairing code if you ever need to connect by hand.

## Why use Dopamine?

- **Zero effort.** Nothing to start, stop or label. Time stops counting when you lock the screen, sleep, or leave the keyboard alone for five minutes.
- **Honest numbers.** Windows you glance at for under five seconds don't count, a crashed session can't inflate a day, and the current day is compared with yesterday up to the same time.
- **See the detail.** The timeline shows exactly when each window was in front. Open any app to see its windows and tabs, with the app's real icon.
- **Categories that fit you.** Work, study, social, entertainment and other are detected automatically, and one click changes an app's category for good.
- **Only what you want counted.** Hide any app from the numbers; Dopamine's own windows are hidden from the start.
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

Built-in rules only cover apps and sites whose use is clear. Everything else is read by a small
title model, and your corrections train it on your computer, the way a mail app learns what you
mark as spam.

Dopamine looks at the evidence in this order and stops at the first answer:

| Evidence | Example |
| --- | --- |
| A window you sorted by hand | You marked "Stack Overflow" as Study |
| Your title rules | Windows with "CS 101" in the title count as Study |
| Your own choice for the app | Discord counts as Study because you said so |
| The site, for browsers | `Two Sum - LeetCode - Google Chrome` → Study |
| The app, by name | `idea64`, `LeagueClientUx`, `WXWork` |
| Apps others agreed on | Only if you opted in, and only for apps the rules don't know |
| What the app says about itself | macOS App Store category; Windows publisher and install path (`steamapps` means a game) |
| The title model | `Week 6 lecture: dynamic programming` → Study, `季度工作汇报` → Work |

Note apps and AI chats (Notion, Obsidian, ChatGPT…) are used for anything, so they go straight to
the title model. On video sites the model can move a lecture to Study when it is at least 80% sure.

The title model is naive Bayes over words and Chinese character pairs: no download, a few
milliseconds to train. It starts from neutral example titles and learns from every window you sort
and every rule you set. None of that leaves your computer.

The rules and example titles live in [`category-rules.json`](DopamineWeb/src/lib/category-rules.json), shared by the dashboard and the macOS agent. They are checked against real process names and tab titles, plus held-out sets that were never used for tuning.

## Privacy

Your activity never leaves your computer. Window titles, times and usage stay in a local SQLite database and are only served to `localhost`, behind the pairing code.

The one exception is optional. The first time you pick a category for an app, the dashboard asks whether to share that choice so others benefit. If you agree, this is the complete request it sends, for that and later choices:

```json
{ "p_install": "<random id for this install>", "p_app": "Discord", "p_platform": "mac", "p_category": "study" }
```

The request is built in [`community.ts`](DopamineWeb/src/lib/community.ts) and stored by the functions in [`supabase/migrations`](supabase/migrations). Browser choices are never sent. An app gets a community category once at least 5 installs agree with a 70% majority. You can stop sharing any time from the dashboard footer. Sharing is not switched on in this release: no server is configured yet, so nothing is sent.

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
```

Each agent writes a row whenever the front window changes, plus marker rows when tracking stops or you go idle. The dashboard turns those rows into durations. Every protected request sends `Authorization: Bearer <pairing code>`.

| Folder | What it is |
| --- | --- |
| [`DopamineMac`](DopamineMac) | Swift menu bar agent, no third-party dependencies |
| [`DopamineWin`](DopamineWin) | C# tray agent |
| [`DopamineWeb`](DopamineWeb) | Dashboard, exported as static files and bundled into both agents |
| [`supabase`](supabase) | Server side of optional community categories |

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
cd DopamineWeb && bun test src      # analytics, categories, community payload
cd DopamineMac && swift test        # database, API, categories
```

CI builds and tests all three on every push and attaches `Dopamine-mac.zip` and `Dopamine-win.zip` to tagged releases.

## Trust and license

This is an early release. The trackers are tested for building, storage, the API and categorisation. Their behaviour on real desktops (permission prompts, lock and sleep handling, the menu bar and tray) is checked by hand, so please [report anything odd](https://github.com/TempestShaw/Dopamine/issues/new) with your operating system and what you saw.

Categories are estimates; correct them in the dashboard when they are wrong.

[MIT](LICENSE).
