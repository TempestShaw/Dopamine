import { CategoryTotals, Summary, productiveTime, sumTotals } from "./analytics";
import { CATEGORY_META } from "./categories";
import type { InsightMsg } from "./i18n";
import { HOUR, View, clock, formatDuration, hourLabel } from "./time";

/** A margin note. The wording lives in i18n.ts; figures are formatted here. */
export interface Insight {
  tone: "good" | "warn" | "neutral";
  msg: InsightMsg;
}

export function buildInsights(view: View, cur: Summary, prev: Summary | null, profile: CategoryTotals[]): Insight[] {
  const out: Insight[] = [];
  if (cur.total < 5 * 60_000) return out;

  const focus = productiveTime(cur.byCategory);
  const share = focus / cur.total;

  if (prev && prev.total > 10 * 60_000) {
    const prevFocus = productiveTime(prev.byCategory);
    const delta = focus - prevFocus;
    if (Math.abs(delta) >= 10 * 60_000) {
      out.push({
        tone: delta > 0 ? "good" : "warn",
        msg: { kind: "focusDelta", amount: formatDuration(Math.abs(delta)), more: delta > 0, view },
      });
    }
  }

  if (cur.longestFocus && cur.longestFocus.focused >= 15 * 60_000) {
    out.push({
      tone: "good",
      msg: { kind: "longest", amount: formatDuration(cur.longestFocus.focused), start: clock(cur.longestFocus.start) },
    });
  }

  let peak = -1;
  let peakVal = 0;
  profile.forEach((t, h) => {
    const v = productiveTime(t);
    if (v > peakVal) {
      peakVal = v;
      peak = h;
    }
  });
  if (peak >= 0) {
    out.push({ tone: "neutral", msg: { kind: "peak", from: hourLabel(peak), to: hourLabel((peak + 1) % 24) } });
  }

  const distraction = cur.apps.find((a) => !CATEGORY_META[a.category].productive && a.category !== "other");
  if (distraction && distraction.total >= 10 * 60_000) {
    out.push({
      tone: "warn",
      msg: { kind: "distraction", app: distraction.app, amount: formatDuration(distraction.total), percent: Math.round((distraction.total / cur.total) * 100) },
    });
  }

  const hours = cur.total / HOUR;
  if (hours >= 0.5) {
    const perHour = cur.switches / hours;
    out.push({
      tone: perHour > 40 ? "warn" : "neutral",
      msg: { kind: "switches", perHour: Math.round(perHour), busy: perHour > 40 },
    });
  }

  if (share >= 0.7) out.push({ tone: "good", msg: { kind: "focusShare", percent: Math.round(share * 100) } });

  return out.slice(0, 5);
}

export function trend(cur: CategoryTotals, prev: CategoryTotals | null): number | null {
  if (!prev) return null;
  const p = sumTotals(prev);
  if (sumTotals(cur) === 0) return null;
  if (p < 10 * 60_000) return null;
  return (sumTotals(cur) - p) / p;
}
