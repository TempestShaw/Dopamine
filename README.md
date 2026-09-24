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

## Privacy

Your activity never leaves your computer: window titles, times and usage stay in the local SQLite
database and are only served to `localhost`.

The one exception is optional. The first time you pick a category for an app ("Discord counts as
Study"), the dashboard asks whether to share that choice. If you agree, this is the complete request
it sends, for that and later choices:

```json
{ "p_install": "<random id for this install>", "p_app": "Discord", "p_platform": "mac", "p_category": "study" }
```

The request is built in [`DopamineWeb/src/lib/community.ts`](DopamineWeb/src/lib/community.ts) and
stored by the functions in [`supabase/migrations`](supabase/migrations). Choices for browsers are never
sent. Once at least 5 installs agree on an app (70%+ majority), it is categorised that way for everyone,
but only for apps the built-in rules don't know, so a few bad votes can't relabel well-known apps.
You can stop sharing any time from the dashboard footer.

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
