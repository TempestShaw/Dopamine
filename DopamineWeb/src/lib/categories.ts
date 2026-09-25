// Categorization. The rules live in category-rules.json, shared with the macOS agent.
import RULES from "./category-rules.json";
import { MIN_CONFIDENCE, TitleModel, buildTitleModel } from "./nlp";

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

// Latin keywords must match whole words ("code" is not in "barcode"); others (e.g. Chinese) match anywhere.
function compile(keywords: string[]): RegExp {
  const esc = (k: string) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = keywords.map((k) => {
    if (!/^[\x00-\x7f]+$/.test(k)) return esc(k);
    const start = /^[a-z0-9]/i.test(k) ? "(?<![a-z0-9])" : "";
    const end = /[a-z0-9]$/i.test(k) ? "(?![a-z0-9])" : "";
    return start + esc(k) + end;
  });
  return new RegExp(parts.join("|"), "i");
}

const BROWSERS = new Set(RULES.browsers);
const SITES: RuleList = RULES.sites.map(([c, k]) => [c as Category, compile(k as string[])]);
// Every site name at once, to take platform names out of a title before reading its topic.
const ANY_SITE = new RegExp(RULES.sites.map(([, k]) => compile(k as string[]).source).join("|"), "gi");
const APPS: RuleList = RULES.apps.map(([c, k]) => [c as Category, compile(k as string[])]);
const MIXED_APPS = compile(RULES.mixedApps);
const PLATFORM_KINDS = RULES.platformKinds as Record<string, Category>;
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
export function categorize(title: string, process: string, hint?: AppHint, community?: Overrides, model: TitleModel = seedModel()): Category {
  const read = (text: string) => model.guess(cleanTitle(text, process));

  // Note apps and AI chats are used for anything; the page or chat title says what.
  if (!isBrowser(process) && !match(APPS, appHaystack(process)) && MIXED_APPS.test(appHaystack(process))) {
    const g = read(title);
    return g && g.p >= MIN_CONFIDENCE ? g.category : (fromHint(hint) ?? "other");
  }

  const browser = isBrowser(process);
  const known = browser
    ? match(SITES, title)
    : (match(APPS, appHaystack(process)) ?? community?.[process] ?? fromHint(hint) ?? match(SITES, title));

  // Video sites carry lectures and talks as well as entertainment: read the title without the
  // platform's name, and move it only when the model is sure.
  if (known === "entertainment" && browser) {
    const g = read(title.replace(ANY_SITE, " "));
    if (g && (g.category === "study" || g.category === "work") && g.p >= SURE) return g.category;
  }
  if (known) return known;

  // Nothing recognised: let the title model read it.
  const g = read(title);
  return g && g.p >= MIN_CONFIDENCE ? g.category : "other";
}

/** How sure the model must be to overrule a site rule. */
const SURE = 0.8;

let seed: TitleModel | null = null;
/** The model trained on the seed examples only (built once, on first use). */
export function seedModel(): TitleModel {
  return (seed ??= buildTitleModel(RULES.titleExamples as Partial<Record<Category, string[]>>));
}

/** The seed model plus what the user taught it: labelled windows, title rules and the windows those matched. */
export function userModel(labels: TitleLabels, rules: TitleRules, ruledTitles: Iterable<[string, Category]>): TitleModel {
  if (Object.keys(labels).length === 0 && Object.keys(rules).length === 0) return seedModel();
  return buildTitleModel(RULES.titleExamples as Partial<Record<Category, string[]>>, labels, rules, ruledTitles);
}

/** A user's choice of category for an app, keyed by raw process name. Always wins. */
export type Overrides = Record<string, Category>;

export type Classifier = (title: string, process: string) => Category;

/**
 * Windows the user put in a category one by one, keyed by their cleaned title. Like marking mail
 * as spam: the window itself changes at once, and the title model learns from it for similar ones.
 */
export type TitleLabels = Record<string, Category>;

/**
 * The user's own rules for windows: a title containing the keyword (any case) counts as the
 * category. They cover what no built-in rule can know, like a chat named after its topic or a
 * course's name, and win over everything else. The longest matching keyword decides.
 */
export type TitleRules = Record<string, Category>;

/** The rule a title falls under, if any. */
export function matchTitleRule(title: string, rules: TitleRules): { keyword: string; category: Category } | null {
  const t = title.toLowerCase();
  let best: string | null = null;
  for (const k of Object.keys(rules)) if (k && t.includes(k.toLowerCase()) && (best === null || k.length > best.length)) best = k;
  return best === null ? null : { keyword: best, category: rules[best] };
}

/** Builds a memoised classifier; rebuild it when hints, overrides or title rules change. */
export function makeClassifier(
  hint: (process: string) => AppHint | undefined = () => undefined,
  overrides: Overrides = {},
  community: Overrides = {},
  titleRules: TitleRules = {},
  model: TitleModel = seedModel(),
  labels: TitleLabels = {},
): Classifier {
  const cache = new Map<string, Category>();
  const hasRules = Object.keys(titleRules).length > 0;
  const hasLabels = Object.keys(labels).length > 0;
  return (title, process) => {
    if (hasLabels) {
      const labelled = labels[cleanTitle(title, process)];
      if (labelled) return labelled;
    }
    if (hasRules) {
      const rule = matchTitleRule(title, titleRules);
      if (rule) return rule.category;
    }
    const chosen = overrides[process];
    if (chosen) return chosen;
    const key = `${process}\u0000${title}`;
    let c = cache.get(key);
    if (c === undefined) {
      c = categorize(title, process, hint(process), community, model);
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
