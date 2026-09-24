// Turns the raw "window changed" events recorded by the desktop agents into durations and summaries.
//
// The agents write one row every time the foreground window changes, plus marker rows
// (process "<Dopamine>") when tracking stops or the user goes idle. A row therefore lasts
// until the next row, which is how durations are derived here.

import { CATEGORIES, Category, CATEGORY_META, categorize, cleanTitle, displayApp } from "./categories";
import { HOUR, MINUTE, Range, addDays } from "./time";

export interface RawEvent {
  id: number;
  timestamp: number; // unix seconds
  windowTitle: string;
  processName: string;
}

export const AGENT_PROCESS = "<Dopamine>";

/** Longest a single row may count for, in case the agent died without writing a stop marker. */
export const MAX_SEGMENT = 2 * HOUR;

export interface Segment {
  start: number; // ms
  end: number; // ms
  app: string; // display name
  process: string; // raw process name as recorded (used to look up the icon)
  title: string; // cleaned window title
  category: Category;
}

export type CategoryTotals = Record<Category, number>;

export function emptyTotals(): CategoryTotals {
  return { work: 0, study: 0, social: 0, entertainment: 0, other: 0 };
}

export function sumTotals(t: CategoryTotals): number {
  let s = 0;
  for (const c of CATEGORIES) s += t[c];
  return s;
}

export function productiveTime(t: CategoryTotals): number {
  let s = 0;
  for (const c of CATEGORIES) if (CATEGORY_META[c].productive) s += t[c];
  return s;
}

const categoryCache = new Map<string, Category>();

function categoryOf(title: string, process: string): Category {
  const key = `${process}\u0000${title}`;
  let c = categoryCache.get(key);
  if (c === undefined) {
    c = categorize(title, process);
    if (categoryCache.size > 20_000) categoryCache.clear();
    categoryCache.set(key, c);
  }
  return c;
}

/**
 * Converts events (sorted by timestamp) into segments clipped to `range`.
 * Pass events that start a little before the range so the window that was active at
 * `range.start` is known; the caller's EventStore takes care of that.
 */
export function buildSegments(events: RawEvent[], range: Range, now: number, maxSegment = MAX_SEGMENT): Segment[] {
  const out: Segment[] = [];
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.processName === AGENT_PROCESS) continue;
    const start = e.timestamp * 1000;
    if (start >= range.end) break;
    const next = events[i + 1];
    let end = next ? next.timestamp * 1000 : now;
    end = Math.min(end, start + maxSegment, now);
    const s = Math.max(start, range.start);
    const en = Math.min(end, range.end);
    if (en <= s) continue;
    out.push({
      start: s,
      end: en,
      app: displayApp(e.processName),
      process: e.processName,
      title: cleanTitle(e.windowTitle, e.processName),
      category: categoryOf(e.windowTitle, e.processName),
    });
  }
  return out;
}

export interface TitleStat {
  title: string;
  total: number;
  category: Category;
}

export interface AppStat {
  app: string;
  process: string;
  total: number;
  category: Category; // the category the app spent most time in
  byCategory: CategoryTotals;
  titles: TitleStat[];
}

export interface Bucket {
  start: number;
  end: number;
  byCategory: CategoryTotals;
  total: number;
}

export interface Session {
  app: string;
  process: string;
  start: number;
  end: number;
  active: number; // tracked time inside the session
  category: Category;
  titles: TitleStat[];
}

export interface FocusBlock {
  start: number;
  end: number;
  focused: number;
}

export interface Summary {
  range: Range;
  total: number;
  byCategory: CategoryTotals;
  apps: AppStat[];
  switches: number;
  longestFocus: FocusBlock | null;
  first: number | null;
  last: number | null;
}

export function summarize(segments: Segment[], range: Range): Summary {
  const byCategory = emptyTotals();
  const apps = new Map<string, { process: string; byCategory: CategoryTotals; titles: Map<string, TitleStat> }>();
  let switches = 0;
  let prevApp: string | null = null;

  for (const seg of segments) {
    const d = seg.end - seg.start;
    byCategory[seg.category] += d;

    let a = apps.get(seg.app);
    if (!a) {
      a = { process: seg.process, byCategory: emptyTotals(), titles: new Map() };
      apps.set(seg.app, a);
    }
    a.byCategory[seg.category] += d;
    const t = a.titles.get(seg.title);
    if (t) t.total += d;
    else a.titles.set(seg.title, { title: seg.title, total: d, category: seg.category });

    if (prevApp !== null && prevApp !== seg.app) switches++;
    prevApp = seg.app;
  }

  const appStats: AppStat[] = [];
  for (const [app, a] of apps) {
    appStats.push({
      app,
      process: a.process,
      total: sumTotals(a.byCategory),
      category: dominant(a.byCategory),
      byCategory: a.byCategory,
      titles: [...a.titles.values()].sort((x, y) => y.total - x.total),
    });
  }
  appStats.sort((x, y) => y.total - x.total);

  return {
    range,
    total: sumTotals(byCategory),
    byCategory,
    apps: appStats,
    switches,
    longestFocus: longestFocus(segments),
    first: segments.length ? segments[0].start : null,
    last: segments.length ? segments[segments.length - 1].end : null,
  };
}

function dominant(t: CategoryTotals): Category {
  let best: Category = "other";
  let max = -1;
  for (const c of CATEGORIES) {
    if (t[c] > max) {
      max = t[c];
      best = c;
    }
  }
  return best;
}

/** Splits segment time into consecutive buckets delimited by `edges` (ascending ms timestamps). */
export function bucketize(segments: Segment[], edges: number[]): Bucket[] {
  const buckets: Bucket[] = [];
  for (let i = 0; i + 1 < edges.length; i++) {
    buckets.push({ start: edges[i], end: edges[i + 1], byCategory: emptyTotals(), total: 0 });
  }
  let b = 0;
  for (const seg of segments) {
    while (b < buckets.length && buckets[b].end <= seg.start) b++;
    for (let j = b; j < buckets.length && buckets[j].start < seg.end; j++) {
      const overlap = Math.min(seg.end, buckets[j].end) - Math.max(seg.start, buckets[j].start);
      if (overlap > 0) {
        buckets[j].byCategory[seg.category] += overlap;
        buckets[j].total += overlap;
      }
    }
  }
  return buckets;
}

export function hourEdges(dayStart: number): number[] {
  // Built from calendar dates rather than +1h steps so DST days stay aligned to clock hours.
  const d = new Date(dayStart);
  const edges: number[] = [];
  for (let h = 0; h <= 24; h++) edges.push(new Date(d.getFullYear(), d.getMonth(), d.getDate(), h).getTime());
  return edges;
}

export function dayEdges(range: Range): number[] {
  const edges: number[] = [];
  let d = new Date(range.start);
  while (d.getTime() < range.end) {
    edges.push(d.getTime());
    d = addDays(d, 1);
  }
  edges.push(range.end);
  return edges;
}

/** Aggregates time per clock hour (0-23) across every day in the segments. */
export function hourOfDayProfile(segments: Segment[]): CategoryTotals[] {
  const profile = Array.from({ length: 24 }, emptyTotals);
  for (const seg of segments) {
    let t = seg.start;
    while (t < seg.end) {
      const d = new Date(t);
      const nextHour = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime();
      const until = Math.min(seg.end, nextHour);
      profile[d.getHours()][seg.category] += until - t;
      t = until;
    }
  }
  return profile;
}

/** Merges consecutive segments of the same app (tolerating short gaps) into sessions, newest first. */
export function buildSessions(segments: Segment[], maxGap = 2 * MINUTE): Session[] {
  const sessions: Session[] = [];
  let cur: { app: string; process: string; start: number; end: number; byCategory: CategoryTotals; titles: Map<string, TitleStat> } | null = null;

  const flush = () => {
    if (!cur) return;
    sessions.push({
      app: cur.app,
      process: cur.process,
      start: cur.start,
      end: cur.end,
      active: sumTotals(cur.byCategory),
      category: dominant(cur.byCategory),
      titles: [...cur.titles.values()].sort((a, b) => b.total - a.total),
    });
  };

  for (const seg of segments) {
    if (!cur || cur.app !== seg.app || seg.start - cur.end > maxGap) {
      flush();
      cur = { app: seg.app, process: seg.process, start: seg.start, end: seg.end, byCategory: emptyTotals(), titles: new Map() };
    }
    const d = seg.end - seg.start;
    cur.end = seg.end;
    cur.byCategory[seg.category] += d;
    const t = cur.titles.get(seg.title);
    if (t) t.total += d;
    else cur.titles.set(seg.title, { title: seg.title, total: d, category: seg.category });
  }
  flush();
  return sessions.reverse();
}

/**
 * Longest stretch of work/study. Short detours (< 2 min) into other categories don't break
 * the block, but a detour that long, or a gap in tracking over 5 min, does.
 */
export function longestFocus(segments: Segment[], maxDetour = 2 * MINUTE, maxGap = 5 * MINUTE): FocusBlock | null {
  let best: FocusBlock | null = null;
  let cur: FocusBlock | null = null;
  let detour = 0;
  let lastEnd = -Infinity;

  const close = () => {
    if (cur && (!best || cur.focused > best.focused)) best = cur;
    cur = null;
    detour = 0;
  };

  for (const seg of segments) {
    if (seg.start - lastEnd > maxGap) close();
    lastEnd = seg.end;
    const d = seg.end - seg.start;
    if (CATEGORY_META[seg.category].productive) {
      if (!cur) cur = { start: seg.start, end: seg.end, focused: 0 };
      cur.focused += d;
      cur.end = seg.end;
      detour = 0;
    } else if (cur) {
      detour += d;
      if (detour >= maxDetour) close();
    }
  }
  close();
  return best;
}

/** Per-day totals, keyed by local midnight in ms. */
export function dailyTotals(segments: Segment[], range: Range): Map<number, number> {
  const out = new Map<number, number>();
  for (const b of bucketize(segments, dayEdges(range))) out.set(b.start, b.total);
  return out;
}
