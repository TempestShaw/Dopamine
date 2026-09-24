// Deterministic sample data so the dashboard can be explored without an agent installed.

import { AGENT_PROCESS, RawEvent } from "./analytics";
import { AppInfo, DataSource, Preferences, preferencesFromSettings, settingsFromPreferences } from "./source";
import { addDays, startOfDay } from "./time";

const PREFS_KEY = "dopamine.demo.preferences";

type Activity = [process: string, titles: string[], weight: number, minMinutes: number, maxMinutes: number];

const FOCUS: Activity[] = [
  ["Code", ["analytics.ts — dopamine", "Dashboard.tsx — dopamine", "ApiServer.cs — DopamineWin", "README.md — dopamine"], 6, 8, 55],
  ["Terminal", ["zsh — bun test", "zsh — git status", "ssh build-box"], 2, 2, 10],
  ["Google Chrome", ["Pull request #12 · TempestShaw/Dopamine - Google Chrome", "MDN Web Docs - Google Chrome", "Stack Overflow - Google Chrome"], 3, 3, 18],
  ["Notion", ["Sprint planning", "Reading notes — Deep Work"], 2, 5, 25],
  ["Preview", ["Lecture 7 — Distributed Systems.pdf", "paper-draft.pdf"], 2, 10, 40],
  ["Slack", ["#dev — Acme", "#general — Acme"], 2, 2, 8],
  ["Zoom", ["Zoom Meeting — Standup"], 1, 15, 30],
  ["Figma", ["Dopamine — Dashboard v2"], 1, 10, 35],
  // Hidden by default, like the real agents' own windows: shows up under "1 app hidden".
  ["Dopamine", ["Dopamine"], 1, 1, 3],
];

const DISTRACT: Activity[] = [
  ["Google Chrome", ["YouTube - Google Chrome", "Reddit - r/programming - Google Chrome", "Bilibili - Google Chrome"], 3, 3, 25],
  ["Discord", ["#general | Study Group", "Friends"], 2, 2, 12],
  ["Spotify", ["Spotify Premium"], 1, 1, 4],
  ["WeChat", ["WeChat"], 2, 1, 6],
  ["Finder", ["Downloads", "Documents"], 1, 1, 3],
];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T extends Activity>(list: T[], rnd: () => number): T {
  const total = list.reduce((s, a) => s + a[2], 0);
  let r = rnd() * total;
  for (const a of list) {
    r -= a[2];
    if (r <= 0) return a;
  }
  return list[list.length - 1];
}

function generateDay(day: Date): RawEvent[] {
  const dayIndex = Math.floor(day.getTime() / 86_400_000);
  const rnd = mulberry32(dayIndex * 2654435761);
  const weekend = day.getDay() === 0 || day.getDay() === 6;
  if (weekend && rnd() < 0.35) return [];

  const events: RawEvent[] = [];
  let id = dayIndex * 10_000;
  const push = (t: number, processName: string, windowTitle: string) =>
    events.push({ id: id++, timestamp: Math.floor(t / 1000), processName, windowTitle });

  const minute = 60_000;
  let t = day.getTime() + (weekend ? 10.5 : 8.5 + rnd() * 1.5) * 3_600_000;
  const end = day.getTime() + (weekend ? 17 : 18.5 + rnd() * 4) * 3_600_000;
  const lunch = day.getTime() + 12.25 * 3_600_000;
  let lunched = false;
  const focusBias = weekend ? 0.35 : 0.55 + rnd() * 0.15;

  while (t < end) {
    if (!lunched && t > lunch) {
      push(t, AGENT_PROCESS, "<Stopped>");
      t += (40 + rnd() * 35) * minute;
      lunched = true;
      continue;
    }
    const a = pick(rnd() < focusBias ? FOCUS : DISTRACT, rnd);
    const title = a[1][Math.floor(rnd() * a[1].length)];
    push(t, a[0], title);
    t += (a[3] + rnd() * (a[4] - a[3])) * minute;
    if (rnd() < 0.05) {
      push(t, AGENT_PROCESS, "<Idle>");
      t += (5 + rnd() * 20) * minute;
    }
  }
  push(end, AGENT_PROCESS, "<Stopped>");
  return events;
}

// Generic app-icon-style drawings for the sample apps (not the real logos): a squircle with a
// gradient and a simple white glyph. Real agents send each app's actual icon instead.
const GLYPHS: Record<string, [from: string, to: string, glyph: string]> = {
  Code: ["#3b82f6", "#1d4ed8", '<path d="M24 22l-9 10 9 10M40 22l9 10-9 10M35 18l-6 28" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'],
  Terminal: ["#3f3f46", "#18181b", '<path d="M17 24l9 8-9 8M30 42h16" stroke="#e4e4e7" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'],
  "Google Chrome": ["#f8fafc", "#e2e8f0", '<circle cx="32" cy="32" r="16" fill="none" stroke="#2563eb" stroke-width="4"/><path d="M16 32h32M32 16c-6 5-6 27 0 32M32 16c6 5 6 27 0 32" stroke="#2563eb" stroke-width="3" fill="none"/>'],
  Notion: ["#ffffff", "#e7e5e4", '<path d="M21 17h16l7 7v23H21z" fill="none" stroke="#1c1917" stroke-width="3.5" stroke-linejoin="round"/><path d="M27 31h11M27 38h11" stroke="#1c1917" stroke-width="3" stroke-linecap="round"/>'],
  Preview: ["#7dd3fc", "#0284c7", '<rect x="17" y="20" width="30" height="24" rx="3" fill="none" stroke="#fff" stroke-width="3.5"/><path d="M19 41l9-9 6 6 4-4 7 7" stroke="#fff" stroke-width="3" fill="none" stroke-linejoin="round"/><circle cx="39" cy="27" r="3" fill="#fff"/>'],
  Slack: ["#fb7185", "#be123c", '<path d="M18 22h28a3 3 0 013 3v14a3 3 0 01-3 3H30l-8 6v-6h-4a3 3 0 01-3-3V25a3 3 0 013-3z" fill="#fff"/><path d="M28 28l-2 9M36 28l-2 9M25 31h13M24 35h13" stroke="#be123c" stroke-width="2" stroke-linecap="round"/>'],
  Zoom: ["#60a5fa", "#2563eb", '<rect x="14" y="23" width="25" height="19" rx="4" fill="#fff"/><path d="M41 29l9-5v17l-9-5z" fill="#fff"/>'],
  Figma: ["#a78bfa", "#6d28d9", '<path d="M20 44l6-18 16-6-6 16z" fill="none" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/><circle cx="32" cy="32" r="3.5" fill="#fff"/>'],
  Discord: ["#818cf8", "#4338ca", '<path d="M17 21h22a3 3 0 013 3v12a3 3 0 01-3 3H27l-7 5v-5h-3a3 3 0 01-3-3V24a3 3 0 013-3z" fill="#fff"/><path d="M45 28h2a3 3 0 013 3v10a3 3 0 01-3 3h-2v4l-6-4h-7" stroke="#fff" stroke-width="3" fill="none" stroke-linejoin="round"/>'],
  Spotify: ["#4ade80", "#15803d", '<path d="M27 42V21l17-4v21" stroke="#fff" stroke-width="3.5" fill="none" stroke-linejoin="round"/><circle cx="23" cy="42" r="5" fill="#fff"/><circle cx="40" cy="38" r="5" fill="#fff"/>'],
  WeChat: ["#86efac", "#16a34a", '<ellipse cx="28" cy="29" rx="12" ry="10" fill="#fff"/><ellipse cx="39" cy="38" rx="10" ry="8" fill="#fff" stroke="#16a34a" stroke-width="2"/><circle cx="24" cy="27" r="1.8" fill="#16a34a"/><circle cx="32" cy="27" r="1.8" fill="#16a34a"/>'],
  Dopamine: ["#fbf8f1", "#efe8da", '<circle cx="27" cy="27" r="10" fill="#e8799f"/><circle cx="38" cy="28" r="9" fill="#ffd23f" opacity=".9"/><circle cx="30" cy="38" r="9.5" fill="#2f6bff" opacity=".9"/><circle cx="40" cy="39" r="6" fill="#4fb58a" opacity=".9"/>'],
  Finder: ["#93c5fd", "#3b82f6", '<path d="M15 23a3 3 0 013-3h9l3 4h16a3 3 0 013 3v15a3 3 0 01-3 3H18a3 3 0 01-3-3z" fill="#fff"/>'],
};

function demoIcon(process: string): string | null {
  const g = GLYPHS[process];
  if (!g) return null;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${g[0]}"/><stop offset="1" stop-color="${g[1]}"/></linearGradient></defs><rect x="4" y="4" width="56" height="56" rx="14" fill="url(#g)"/>${g[2]}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export class DemoSource implements DataSource {
  platform = "demo" as const;
  version = "demo";

  async fetchApps(processNames: string[]): Promise<Record<string, AppInfo>> {
    const out: Record<string, AppInfo> = {};
    for (const p of processNames) {
      const icon = demoIcon(p);
      if (icon) out[p] = { icon };
    }
    return out;
  }

  // Sample data has no agent, so preferences are kept in this browser. Nothing is ever shared.
  async loadPreferences(): Promise<Preferences> {
    try {
      return preferencesFromSettings(JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}"), "demo");
    } catch {
      return preferencesFromSettings({}, "demo");
    }
  }

  async savePreferences(change: Partial<Preferences>): Promise<void> {
    try {
      const current = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
      localStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...settingsFromPreferences(change) }));
    } catch {
      // Storage blocked: the choice lasts until reload.
    }
  }

  async fetchEvents(fromSec: number, toSec: number): Promise<RawEvent[]> {
    const now = Date.now();
    const out: RawEvent[] = [];
    for (let d = startOfDay(new Date(fromSec * 1000)); d.getTime() <= toSec * 1000; d = addDays(d, 1)) {
      if (d.getTime() > now) break;
      for (const e of generateDay(d)) {
        const ms = e.timestamp * 1000;
        if (e.timestamp >= fromSec && e.timestamp <= toSec && ms <= now) out.push(e);
      }
    }
    return out;
  }
}
