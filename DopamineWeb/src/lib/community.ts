// Community categories: users can choose to share the category they picked for an app, and apps
// that enough people agree on are categorised for everyone. See supabase/migrations for the server.
//
// Exactly what is sent is built by votePayload() below: the app's process name, the category and
// the platform, plus a random install id so one install counts once. Nothing else leaves the device.

import { Category, Overrides, isBrowser } from "./categories";

// Filled in once the backend exists. While empty, nothing is sent or fetched.
export const COMMUNITY_URL = "";
export const COMMUNITY_KEY = "";

export type Sharing = "ask" | "on" | "off";
export type SharedPlatform = "mac" | "windows";

export function communityAvailable(): boolean {
  return COMMUNITY_URL !== "" && COMMUNITY_KEY !== "";
}

/** Browsers are judged per site, so a choice for "chrome" says nothing useful to others. */
export function isShareable(process: string): boolean {
  return !isBrowser(process);
}

/** The complete request body for sharing one choice. Shown verbatim to the user before they agree. */
export function votePayload(installId: string, app: string, platform: SharedPlatform, category: Category | null) {
  return category
    ? { p_install: installId, p_app: app, p_platform: platform, p_category: category }
    : { p_install: installId, p_app: app, p_platform: platform };
}

async function rpc(name: string, body: unknown): Promise<Response> {
  return fetch(`${COMMUNITY_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: COMMUNITY_KEY, Authorization: `Bearer ${COMMUNITY_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Shares (or with `null`, withdraws) one choice. Best effort: failures are silent. */
export async function shareChoice(installId: string, app: string, platform: SharedPlatform, category: Category | null): Promise<void> {
  if (!communityAvailable() || !isShareable(app)) return;
  try {
    await rpc(category ? "dopamine_vote" : "dopamine_unvote", votePayload(installId, app, platform, category));
  } catch {
    // Offline or backend paused; the local choice still applies.
  }
}

const CACHE_KEY = "dopamine.community";
const CACHE_TTL = 24 * 3600_000;

/** Apps the community agrees on, refreshed at most daily and cached in this browser. */
export async function fetchCommunityCategories(platform: SharedPlatform): Promise<Overrides> {
  if (!communityAvailable()) return {};
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null") as { at: number; platform: string; data: Overrides } | null;
    if (cached && cached.platform === platform && Date.now() - cached.at < CACHE_TTL) return cached.data;
  } catch {}
  try {
    const res = await rpc("dopamine_community_categories", { p_platform: platform });
    if (!res.ok) return {};
    const rows = (await res.json()) as { app: string; category: Category }[];
    const data: Overrides = {};
    for (const r of rows) data[r.app] = r.category;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), platform, data }));
    } catch {}
    return data;
  } catch {
    return {};
  }
}

export function newInstallId(): string {
  return crypto.randomUUID();
}
