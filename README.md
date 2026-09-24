# Dopamine — see where your screen time goes 🎯

Dopamine is a tiny, private screen-time tracker for **macOS** and **Windows**. A lightweight
menu bar / tray agent notes which app and window is in front, stores it in a local SQLite
database, and serves a fast dashboard at <http://localhost:26535/>. Nothing leaves your computer.

- **Zero effort** — install it and forget it. Pauses automatically when you lock the screen, sleep, or walk away (idle detection).
- **Glanceable** — today's total sits in the menu bar; click for a breakdown by category and top apps.
- **Honest numbers** — a timeline of exactly when each window was in front, focus stretches, context switches and trends vs. the previous day/week/month.

## Layout

| Folder | What it is |
| --- | --- |
| `DopamineMac` | Swift menu bar agent (AppKit + SwiftUI, no third-party dependencies) |
| `DopamineWin` | C# / .NET 8 tray agent |
| `DopamineWeb` | Next.js dashboard, exported as static files and served by the agents |

Both agents write the same SQLite schema and expose the same local API, so the dashboard works with either:

| Endpoint | Auth | Description |
| --- | --- | --- |
| `GET /identify` | – | `{ name: "dopamine-mac" \| "dopamine-win", version, settings }` |
| `GET /pair` | ✓ | 200 if the pairing code is valid |
| `GET /titles?from=&to=` | ✓ | Window-change rows between two unix timestamps (seconds) |
| `GET/PUT /settings` | ✓ | `trackingInterval` (ms), `idleTimeout` (s) |
| `GET /*` | – | The bundled dashboard |

Authenticated requests send `Authorization: Bearer <pairing code>`; the code is shown in the agent's menu.
Rows with process `<Dopamine>` are markers (`<Stopped>`, `<Idle>`) that end the previous activity.

## Running it

### macOS (12+)

```bash
cd DopamineWeb && bun install && bun run build   # optional: bundles the dashboard
cd ../DopamineMac && swift run                   # dev
./scripts/bundle.sh                              # -> dist/Dopamine.app
```

Grant **Accessibility** access when asked (System Settings → Privacy & Security) so Dopamine can read
window titles; without it only app names are recorded.

### Windows

```powershell
cd DopamineWeb; bun install; bun run build   # optional: bundles the dashboard into wwwroot
cd ..\DopamineWin; dotnet run
```

### Dashboard development

```bash
cd DopamineWeb
bun install
bun dev        # http://localhost:3000 — talks to the agent on :26535, or use demo data
bun test src   # analytics unit tests
```

Pushing a `v*` tag builds both agents in CI and attaches `Dopamine-mac.zip` / `Dopamine-win.zip` to a GitHub release.

## License

MIT
