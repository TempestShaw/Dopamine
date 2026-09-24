import { CategoryTotals, Summary, productiveTime, sumTotals } from "./analytics";
import { CATEGORY_META } from "./categories";
import { HOUR, View, clock, formatDuration } from "./time";

export interface Insight {
  tone: "good" | "warn" | "neutral";
  text: string;
}

const periodName: Record<View, string> = { day: "yesterday by this time", week: "last week so far", month: "last month so far" };

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
        text: `${formatDuration(Math.abs(delta))} ${delta > 0 ? "more" : "less"} focus time than ${periodName[view]}.`,
      });
    }
  }

  if (cur.longestFocus && cur.longestFocus.focused >= 15 * 60_000) {
    out.push({
      tone: "good",
      text: `Longest focus stretch: ${formatDuration(cur.longestFocus.focused)}, starting at ${clock(cur.longestFocus.start)}.`,
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
    out.push({ tone: "neutral", text: `You focus best around ${hourLabel(peak)}–${hourLabel((peak + 1) % 24)}.` });
  }

  const distraction = cur.apps.find((a) => !CATEGORY_META[a.category].productive && a.category !== "other");
  if (distraction && distraction.total >= 10 * 60_000) {
    out.push({
      tone: "warn",
      text: `${distraction.app} took ${formatDuration(distraction.total)} (${Math.round((distraction.total / cur.total) * 100)}% of screen time).`,
    });
  }

  const hours = cur.total / HOUR;
  if (hours >= 0.5) {
    const perHour = cur.switches / hours;
    out.push({
      tone: perHour > 40 ? "warn" : "neutral",
      text: `${Math.round(perHour)} app switches per hour${perHour > 40 ? " — lots of context switching" : ""}.`,
    });
  }

  if (share >= 0.7) out.push({ tone: "good", text: `${Math.round(share * 100)}% of your screen time was focused work or study.` });

  return out.slice(0, 5);
}

function hourLabel(h: number): string {
  return clock(new Date(2000, 0, 1, h).getTime()).replace(":00", "");
}

export function trend(cur: CategoryTotals, prev: CategoryTotals | null): number | null {
  if (!prev) return null;
  const p = sumTotals(prev);
  if (sumTotals(cur) === 0) return null;
  if (p < 10 * 60_000) return null;
  return (sumTotals(cur) - p) / p;
}
