import { MAX_SEGMENT, RawEvent } from "./analytics";
import { Range, addMonths, startOfMonth } from "./time";

export const DEFAULT_PORT = 26535;

export interface AgentInfo {
  name: string; // "dopamine-win" | "dopamine-mac"
  version: string;
}

export type Platform = "windows" | "mac" | "demo";

export function platformOf(info: AgentInfo): Platform {
  return info.name === "dopamine-mac" ? "mac" : "windows";
}

export interface DataSource {
  platform: Platform;
  version: string;
  fetchEvents(fromSec: number, toSec: number): Promise<RawEvent[]>;
  /** App icons as data: URLs, keyed by raw process name. Missing names have no icon. */
  fetchIcons?(processNames: string[]): Promise<Record<string, string>>;
}

export class AuthError extends Error {}

function trimUrl(url: string): string {
  const withScheme = /^https?:\/\//i.test(url) ? url : `http://${url}`;
  return withScheme.replace(/\/+$/, "");
}

/** Where to look for the agent first: same origin when the agent itself serves this page. */
export function defaultAgentUrl(): string {
  if (typeof window !== "undefined" && window.location.port === String(DEFAULT_PORT)) return window.location.origin;
  return `http://localhost:${DEFAULT_PORT}`;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 4000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

export async function identify(url: string): Promise<AgentInfo | null> {
  try {
    const res = await fetchWithTimeout(`${trimUrl(url)}/identify`, {}, 2500);
    if (!res.ok) return null;
    const info = (await res.json()) as AgentInfo;
    return info.name?.startsWith("dopamine-") ? info : null;
  } catch {
    return null;
  }
}

export async function verifyCode(url: string, code: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${trimUrl(url)}/pair`, { headers: { Authorization: `Bearer ${code}` } });
    return res.ok;
  } catch {
    return false;
  }
}

export class AgentSource implements DataSource {
  readonly baseUrl: string;

  constructor(url: string, readonly code: string, readonly info: AgentInfo) {
    this.baseUrl = trimUrl(url);
  }

  get platform() {
    return platformOf(this.info);
  }

  get version() {
    return this.info.version;
  }

  async fetchEvents(fromSec: number, toSec: number): Promise<RawEvent[]> {
    const res = await fetchWithTimeout(
      `${this.baseUrl}/titles?from=${Math.floor(fromSec)}&to=${Math.ceil(toSec)}`,
      { headers: { Authorization: `Bearer ${this.code}` } },
      15000,
    );
    if (res.status === 401 || res.status === 403) throw new AuthError("Pairing code rejected");
    if (!res.ok) throw new Error(`Agent returned ${res.status}`);
    return (await res.json()) as RawEvent[];
  }

  async fetchIcons(processNames: string[]): Promise<Record<string, string>> {
    // Names are newline-separated: process names never contain one, but may contain commas.
    const res = await fetchWithTimeout(`${this.baseUrl}/icons?names=${encodeURIComponent(processNames.join("\n"))}`, {
      headers: { Authorization: `Bearer ${this.code}` },
    });
    if (!res.ok) return {}; // older agents have no icon endpoint
    return (await res.json()) as Record<string, string>;
  }
}

// ---------------------------------------------------------------------------------------------
// Persistence of the pairing (per browser).

const KEY_URL = "dopamine.agentUrl";
const KEY_CODE = "dopamine.code";

export interface SavedPairing {
  url: string;
  code: string;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadPairing(): SavedPairing | null {
  const s = storage();
  if (!s) return null;
  // Fall back to the keys used by earlier versions of the dashboard.
  const code = s.getItem(KEY_CODE) ?? s.getItem("dopaminePinCode");
  if (!code) return null;
  const url = s.getItem(KEY_URL) ?? s.getItem("dopamineUrl") ?? defaultAgentUrl();
  return { url, code };
}

export function savePairing(p: SavedPairing) {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(KEY_URL, trimUrl(p.url));
    s.setItem(KEY_CODE, p.code);
  } catch {
    // Storage full or blocked: the pairing just won't survive a reload.
  }
}

export function clearPairing() {
  const s = storage();
  if (!s) return;
  for (const k of [KEY_URL, KEY_CODE, "dopaminePinCode", "dopamineUrl"]) s.removeItem(k);
}

// ---------------------------------------------------------------------------------------------
// Client-side cache. Data is fetched a calendar month at a time so moving between days of the
// same month is instant, and the ongoing period is topped up incrementally.

export class EventStore {
  private events: RawEvent[] = [];
  private ids = new Set<number>();
  private months = new Map<number, Promise<void>>();

  constructor(readonly source: DataSource) {}

  /** Makes sure every event needed to compute segments inside `range` is loaded. */
  async ensure(range: Range): Promise<void> {
    const jobs: Promise<void>[] = [];
    for (let m = startOfMonth(new Date(range.start - MAX_SEGMENT)); m.getTime() < range.end; m = addMonths(m, 1)) {
      const key = m.getTime();
      let job = this.months.get(key);
      if (!job) {
        const from = key - MAX_SEGMENT;
        const to = addMonths(m, 1).getTime() + MAX_SEGMENT;
        job = this.source.fetchEvents(from / 1000, to / 1000).then((evts) => this.merge(evts));
        job.catch(() => this.months.delete(key));
        this.months.set(key, job);
      }
      jobs.push(job);
    }
    await Promise.all(jobs);
  }

  /** Fetches anything recorded since the newest event we have. Returns true if something changed. */
  async refreshLatest(now: number): Promise<boolean> {
    const last = this.events.length ? this.events[this.events.length - 1].timestamp : Math.floor(now / 1000) - 3600;
    const before = this.events.length;
    this.merge(await this.source.fetchEvents(last, now / 1000 + 60));
    return this.events.length !== before;
  }

  /** Events that can contribute to segments inside `range`, sorted by time. */
  slice(range: Range): RawEvent[] {
    const lo = lowerBound(this.events, (range.start - MAX_SEGMENT) / 1000);
    const hi = lowerBound(this.events, (range.end + MAX_SEGMENT) / 1000);
    return this.events.slice(lo, hi);
  }

  private merge(incoming: RawEvent[]) {
    let outOfOrder = false;
    for (const e of incoming) {
      if (this.ids.has(e.id)) continue;
      this.ids.add(e.id);
      const last = this.events[this.events.length - 1];
      if (last && (e.timestamp < last.timestamp || (e.timestamp === last.timestamp && e.id < last.id))) outOfOrder = true;
      this.events.push(e);
    }
    // Live refreshes only ever append newer rows, so the full sort is only needed for backfills.
    if (outOfOrder) this.events.sort((a, b) => a.timestamp - b.timestamp || a.id - b.id);
  }
}

function lowerBound(events: RawEvent[], ts: number): number {
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid].timestamp < ts) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
