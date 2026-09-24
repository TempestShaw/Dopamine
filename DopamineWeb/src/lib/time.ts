// Small, dependency-free date helpers. All functions work in the viewer's local time zone.

export type View = "day" | "week" | "month";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Weeks start on Monday. */
export function startOfWeek(d: Date): Date {
  const day = (d.getDay() + 6) % 7;
  return addDays(startOfDay(d), -day);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** yyyy-mm-dd in local time. */
export function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export interface Range {
  start: number; // ms, inclusive
  end: number; // ms, exclusive
}

export function rangeFor(view: View, anchor: Date): Range {
  switch (view) {
    case "day": {
      const s = startOfDay(anchor);
      return { start: s.getTime(), end: addDays(s, 1).getTime() };
    }
    case "week": {
      const s = startOfWeek(anchor);
      return { start: s.getTime(), end: addDays(s, 7).getTime() };
    }
    case "month": {
      const s = startOfMonth(anchor);
      return { start: s.getTime(), end: addMonths(s, 1).getTime() };
    }
  }
}

/** The equally sized period immediately before the given one. */
export function previousAnchor(view: View, anchor: Date): Date {
  return shiftAnchor(view, anchor, -1);
}

export function shiftAnchor(view: View, anchor: Date, dir: number): Date {
  switch (view) {
    case "day":
      return addDays(anchor, dir);
    case "week":
      return addDays(anchor, 7 * dir);
    case "month":
      return addMonths(anchor, dir);
  }
}

/** Local midnights for every day in the range. */
export function daysIn(range: Range): Date[] {
  const days: Date[] = [];
  for (let d = new Date(range.start); d.getTime() < range.end; d = addDays(d, 1)) days.push(d);
  return days;
}

const fmtDay = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
const fmtMonth = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const fmtShort = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const fmtClock = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

export function periodLabel(view: View, anchor: Date): string {
  if (view === "day") return fmtDay.format(anchor);
  if (view === "month") return fmtMonth.format(anchor);
  const s = startOfWeek(anchor);
  return `${fmtShort.format(s)} – ${fmtShort.format(addDays(s, 6))}`;
}

export function clock(ms: number): string {
  return fmtClock.format(ms);
}

export function shortDate(d: Date): string {
  return fmtShort.format(d);
}

/** "3h 12m", "45m", "30s". */
export function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / MINUTE);
  if (totalMin < 1) {
    const s = Math.round(ms / 1000);
    return s > 0 ? `${s}s` : "0m";
  }
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Compact variant for axis labels: "3h", "45m". */
export function formatHoursShort(ms: number): string {
  if (ms >= HOUR) {
    const h = ms / HOUR;
    return `${Number.isInteger(h) ? h : h.toFixed(1)}h`;
  }
  return `${Math.round(ms / MINUTE)}m`;
}
