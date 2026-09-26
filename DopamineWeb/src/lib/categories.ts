// Categorization. The rules live in category-rules.json, shared with the macOS agent.
import RULES from "./category-rules.json";

export type Category = "work" | "study" | "social" | "entertainment" | "other";

export const CATEGORIES: Category[] = ["work", "study", "social", "entertainment", "other"];

/** Names are in i18n.ts (`categories`). */
export const CATEGORY_META: Record<Category, { color: string; productive: boolean }> = {
  work: { color: "var(--cat-work)", productive: true },
  study: { color: "var(--cat-study)", productive: true },
  social: { color: "var(--cat-social)", productive: false },
  entertainment: { color: "var(--cat-entertainment)", productive: false },
  other: { color: "var(--cat-other)", productive: false },
};

/** Metadata an agent reads from the app itself, used for apps no rule knows by name. */
export interface AppHint {
  /** macOS Info.plist LSApplicationCategoryType, e.g. "public.app-category.games". */
  kind?: string;
  /** Windows file description or macOS bundle display name. */
  description?: string;
  /** Windows company name / macOS copyright holder. */
  publisher?: string;
  /** Path of the executable or app bundle. */
  path?: string;
}

type RuleList = [Category, RegExp][];

// Latin keywords must match whole words ("code" is not in "barcode") and also match their plural
// ("lecture" finds "Lectures"); others (e.g. Chinese) match anywhere.
function compile(keywords: string[]): RegExp {
  const esc = (k: string) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = keywords.map((k) => {
    if (!/^[\x00-\x7f]+$/.test(k)) return esc(k);
    const start = /^[a-z0-9]/i.test(k) ? "(?<![a-z0-9])" : "";
    const end = /[a-z]$/i.test(k) ? "(?:e?s)?(?![a-z0-9])" : /[0-9]$/.test(k) ? "(?![a-z0-9])" : "";
    return start + esc(k) + end;
  });
  return new RegExp(parts.join("|"), "i");
}

const BROWSERS = new Set(RULES.browsers);
const SITES: RuleList = RULES.sites.map(([c, k]) => [c as Category, compile(k as string[])]);
const APPS: RuleList = RULES.apps.map(([c, k]) => [c as Category, compile(k as string[])]);
const PLATFORM_KINDS = RULES.platformKinds as Record<string, Category>;
/** Regular expressions for titles keywords can't describe, like course codes ("15-445", "CS 61A"). */
const TITLE_PATTERNS: RuleList = RULES.titlePatterns.flatMap(([c, ps]) => (ps as string[]).map((p): [Category, RegExp] => [c as Category, new RegExp(p, "i")]));
const GAME_PATHS = compile(RULES.gamePaths);
const GAME_PUBLISHERS = compile(RULES.gamePublishers);

function match(rules: RuleList, text: string): Category | null {
  for (const [category, re] of rules) if (re.test(text)) return category;
  return null;
}

/**
 * Process names come as "idea64", "LeagueClientUx", "VALORANT-Win64-Shipping". Match against the raw
 * name plus versions with digits and camelCase split off, so rules can simply say "idea".
 */
export function appHaystack(process: string): string {
  const raw = process.replace(/\.(exe|app)$/i, "").replace(/[-_.]+/g, " ");
  const digits = raw.replace(/([a-z])(\d)/gi, "$1 $2");
  const camel = digits.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  return `${raw} | ${digits} | ${camel}`.toLowerCase();
}

function fromHint(hint: AppHint | undefined): Category | null {
  if (!hint) return null;
  if (hint.kind) {
    const k = hint.kind.toLowerCase();
    if (PLATFORM_KINDS[k]) return PLATFORM_KINDS[k];
    if (k.endsWith("-games")) return "entertainment"; // action-games, card-games, puzzle-games …
  }
  if (hint.path && GAME_PATHS.test(hint.path.replace(/[\\/]+/g, " "))) return "entertainment";
  if (hint.publisher && GAME_PUBLISHERS.test(hint.publisher)) return "entertainment";
  for (const text of [hint.description, hint.publisher]) {
    const c = text ? match(APPS, appHaystack(text)) : null;
    if (c && c !== "other") return c;
  }
  return null;
}

/**
 * Decides what a window is about:
 * 1. Browsers are judged by the site in the tab title.
 * 2. Other apps by their name (exact rules, including "other" for system utilities).
 * 3. Apps no rule knows: what other users agreed on, then the metadata the agent read from the
 *    app (category, publisher, path).
 * 4. Finally the window title, e.g. `javaw` showing "Minecraft".
 */
export function isBrowser(process: string): boolean {
  return BROWSERS.has(process.replace(/\.(exe|app)$/i, "").toLowerCase());
}

/**
 * `community` holds categories other users agreed on (see community.ts). It fills in for apps our
 * rules don't know, but never overrides a built-in rule, so a handful of bad votes can't relabel
 * well-known apps.
 */
export function categorize(title: string, process: string, hint?: AppHint, community?: Overrides): Category {
  if (isBrowser(process)) return match(SITES, title) ?? match(TITLE_PATTERNS, title) ?? "other";
  return match(APPS, appHaystack(process)) ?? community?.[process] ?? fromHint(hint) ?? match(SITES, title) ?? match(TITLE_PATTERNS, title) ?? "other";
}

/** Scope of a title rule that applies in every browser (otherwise the scope is a process name). */
export const BROWSER_SCOPE = "browsers";

/**
 * The user's own rule for windows: "titles containing X count as Y", in every browser or in one app.
 * Never shared with the community: window titles are private.
 */
export interface TitleRule {
  contains: string;
  category: Category;
  scope: string;
}

/** "Code.app", "code.exe" and "Code" are the same app. */
function appKey(process: string): string {
  return process.replace(/\.(exe|app)$/i, "").toLowerCase();
}

/** The rule that decides this window, if any: the longest one whose text is in the title. */
export function titleRuleFor(rules: TitleRule[], title: string, process: string): TitleRule | undefined {
  if (rules.length === 0) return undefined;
  const lower = title.toLowerCase();
  const scope = isBrowser(process) ? BROWSER_SCOPE : appKey(process);
  let best: TitleRule | undefined;
  for (const r of rules) {
    const inScope = r.scope === BROWSER_SCOPE ? scope === BROWSER_SCOPE : appKey(r.scope) === scope;
    if (inScope && lower.includes(r.contains.toLowerCase()) && (!best || r.contains.length > best.contains.length)) best = r;
  }
  return best;
}

export const MAX_TITLE_RULES = 500;
export const MAX_RULE_TEXT = 200;

/** Keeps only well-formed rules (the agents check them too). */
export function sanitizeTitleRules(raw: unknown): TitleRule[] {
  if (!Array.isArray(raw)) return [];
  const out: TitleRule[] = [];
  for (const r of raw) {
    if (typeof r !== "object" || r === null) continue;
    const { contains, category, scope } = r as Record<string, unknown>;
    if (typeof contains !== "string" || typeof scope !== "string" || !CATEGORIES.includes(category as Category)) continue;
    const text = contains.trim();
    if (text.length === 0 || text.length > MAX_RULE_TEXT || scope.length === 0 || scope.length > 256) continue;
    out.push({ contains: text, category: category as Category, scope });
  }
  return out.slice(0, MAX_TITLE_RULES);
}

/** A user's choice of category for an app, keyed by raw process name. Always wins. */
export type Overrides = Record<string, Category>;

export type Classifier = (title: string, process: string) => Category;

/** Builds a memoised classifier; rebuild it when hints or overrides change. */
export function makeClassifier(
  hint: (process: string) => AppHint | undefined = () => undefined,
  overrides: Overrides = {},
  community: Overrides = {},
  titleRules: TitleRule[] = [],
): Classifier {
  const cache = new Map<string, Category>();
  return (title, process) => {
    const rule = titleRuleFor(titleRules, title, process);
    if (rule) return rule.category;
    const chosen = overrides[process];
    if (chosen) return chosen;
    const key = `${process}\u0000${title}`;
    let c = cache.get(key);
    if (c === undefined) {
      c = categorize(title, process, hint(process), community);
      if (cache.size > 20_000) cache.clear();
      cache.set(key, c);
    }
    return c;
  };
}

const APP_NAMES: Record<string, string> = {
  chrome: "Chrome",
  msedge: "Edge",
  firefox: "Firefox",
  explorer: "File Explorer",
  code: "VS Code",
  devenv: "Visual Studio",
  windowsterminal: "Terminal",
  winword: "Word",
  excel: "Excel",
  powerpnt: "PowerPoint",
  outlook: "Outlook",
  "ms-teams": "Teams",
  teams: "Teams",
  applicationframehost: "Windows App",
  searchhost: "Windows Search",
  shellexperiencehost: "Windows Shell",
  lockapp: "Lock Screen",
  finder: "Finder",
  dopaminewin: "Dopamine",
};

/** Human-friendly app name from a raw process name ("msedge" -> "Edge"). */
export function displayApp(process: string): string {
  const known = APP_NAMES[process.toLowerCase()];
  if (known) return known;
  return process.length > 0 ? process[0].toUpperCase() + process.slice(1) : "Unknown";
}

/** Strip noisy suffixes from window titles ("Doc - Google Chrome" -> "Doc", "C:\\a\\b.txt" -> "b.txt"). */
export function cleanTitle(title: string, app: string): string {
  let t = title.trim();
  if (!t) return displayApp(app);
  t = t.replace(/\s+[-–—|]\s+(Google Chrome|Microsoft\u200b? ?Edge|Mozilla Firefox|Safari|Visual Studio Code|Brave|Arc|Opera)$/i, "");
  t = t.replace(/\s+-\s+(Personal|Work|Profile \d+)$/i, "");
  if (/^[A-Za-z]:\\|^\//.test(t) && !t.includes(" - ")) {
    const parts = t.split(/[\\/]/).filter(Boolean);
    t = parts[parts.length - 1] ?? t;
  }
  return t;
}
