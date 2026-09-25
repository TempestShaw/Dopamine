// Which language to show. Kept apart from i18n.ts (which needs React) so the root layout, a
// server component, can use the pre-paint script.

export type Locale = "en" | "zh-CN" | "zh-TW";

const STORAGE_KEY = "dopamine.locale";

function isLocale(v: unknown): v is Locale {
  return v === "en" || v === "zh-CN" || v === "zh-TW";
}

/** Maps a BCP 47 tag to one of ours: zh-TW/HK/MO and "Hant" read Traditional, unless the tag says "Hans". */
export function localeFromTag(tag: string): Locale | null {
  const t = tag.toLowerCase();
  if (t.startsWith("zh")) return !t.includes("hans") && /hant|-tw|-hk|-mo/.test(t) ? "zh-TW" : "zh-CN";
  if (t.startsWith("en")) return "en";
  return null;
}

/** The saved choice, else the first browser language we speak, else English. */
export function detectLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {}
  for (const tag of navigator.languages ?? [navigator.language]) {
    const l = localeFromTag(tag);
    if (l) return l;
  }
  return "en";
}

export function saveLocale(l: Locale) {
  try {
    localStorage.setItem(STORAGE_KEY, l);
  } catch {}
}

/** Runs before first paint (see layout.tsx) so `lang` and the CJK fonts are right from the start. */
export const langScript = `try{var l=localStorage.getItem("${STORAGE_KEY}");if(l!=="en"&&l!=="zh-CN"&&l!=="zh-TW"){l="en";var n=navigator.languages||[navigator.language];for(var i=0;i<n.length;i++){var t=n[i].toLowerCase();if(t.indexOf("zh")===0){l=t.indexOf("hans")<0&&/hant|-tw|-hk|-mo/.test(t)?"zh-TW":"zh-CN";break}if(t.indexOf("en")===0)break}}document.documentElement.lang=l}catch(e){}`;

