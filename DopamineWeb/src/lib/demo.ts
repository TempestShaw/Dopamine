// Deterministic sample data so the dashboard can be explored without an agent installed.

import { AGENT_PROCESS, RawEvent } from "./analytics";
import { DataSource } from "./source";
import { addDays, startOfDay } from "./time";

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

export class DemoSource implements DataSource {
  platform = "demo" as const;
  version = "demo";

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
