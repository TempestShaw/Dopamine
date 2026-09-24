// Categorization rules. Keep in sync with DopamineMac/Sources/DopamineMac/Categories.swift,
// which uses the same ordered rules for the menu bar summary.

export type Category = "work" | "study" | "social" | "entertainment" | "other";

export const CATEGORIES: Category[] = ["work", "study", "social", "entertainment", "other"];

export const CATEGORY_META: Record<Category, { label: string; color: string; productive: boolean }> = {
  work: { label: "Work", color: "var(--cat-work)", productive: true },
  study: { label: "Study", color: "var(--cat-study)", productive: true },
  social: { label: "Social", color: "var(--cat-social)", productive: false },
  entertainment: { label: "Entertainment", color: "var(--cat-entertainment)", productive: false },
  other: { label: "Other", color: "var(--cat-other)", productive: false },
};

// Ordered: the first match wins. Site/title keywords come before app names so that
// "YouTube - Google Chrome" is entertainment rather than a generic browser.
const RULES: [Category, RegExp][] = [
  ["entertainment", /youtube|bilibili|netflix|twitch|prime video|disney\+|hulu|spotify|apple music|music\b|steam|epic games|battle\.net|minecraft|roblox|league of legends|genshin|tiktok|douyin|iqiyi|youku/i],
  ["social", /discord|whatsapp|telegram|signal|wechat|weixin|\bqq\b|line\b|messenger|facebook|instagram|twitter|\bx\.com|reddit|weibo|xiaohongshu|threads|mastodon|bluesky/i],
  ["study", /coursera|udemy|edx|khan academy|kindle|books\b|\.pdf|preview|acrobat|notion|obsidian|evernote|onenote|anki|quizlet|canvas|blackboard|moodle|gradescope|piazza|scholar|arxiv|researchgate|wikipedia|zotero|mendeley|overleaf|latex|wolfram|leetcode|duolingo/i],
  ["work", /code|visual studio|xcode|intellij|webstorm|pycharm|goland|rider|clion|android studio|sublime|vim|emacs|cursor|zed|terminal|iterm|warp|powershell|cmd\b|windowsterminal|github|gitlab|bitbucket|jira|linear|confluence|slack|teams|zoom|meet\b|webex|outlook|mail\b|calendar|excel|powerpoint|winword|\bword\b|keynote|pages|numbers|figma|sketch|photoshop|illustrator|docker|postman|insomnia|tableplus|datagrip|dbeaver|chatgpt|claude|stack overflow|localhost/i],
];

export function categorize(title: string, app: string): Category {
  const haystack = `${title} ${app}`;
  for (const [category, re] of RULES) if (re.test(haystack)) return category;
  return "other";
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
