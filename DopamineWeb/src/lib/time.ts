// Small, dependency-free date helpers. All functions work in the viewer's local time zone.
import { DICTS, type Locale } from "./i18n";

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

// Dates follow the interface language (see i18n.ts); English keeps the browser's own English
// variant so en-GB still gets a 24-hour clock.
let intlLocale: string | undefined;
let units = DICTS.en.duration;
let fmtDay: Intl.DateTimeFormat;
let fmtMonth: Intl.DateTimeFormat;
let fmtShort: Intl.DateTimeFormat;
let fmtClock: Intl.DateTimeFormat;
let fmtHour: Intl.DateTimeFormat;
let fmtWeekday: Intl.DateTimeFormat;
let fmtNarrowWeekday: Intl.DateTimeFormat;
let fmtLongDay: Intl.DateTimeFormat;
let fmtMonthName: Intl.DateTimeFormat;

export function setTimeLocale(locale: Locale) {
  const browser = typeof navigator === "undefined" ? undefined : navigator.language;
  intlLocale = locale === "en" ? (browser?.toLowerCase().startsWith("en") ? browser : "en") : locale;
  units = DICTS[locale].duration;
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(intlLocale, o);
  fmtDay = f({ weekday: "short", month: "short", day: "numeric" });
  fmtMonth = f({ month: "long", year: "numeric" });
  fmtShort = f({ month: "short", day: "numeric" });
  fmtClock = f({ hour: "numeric", minute: "2-digit" });
  fmtHour = f({ hour: "numeric" });
  fmtWeekday = f({ weekday: "short" });
  fmtNarrowWeekday = f({ weekday: "narrow" });
  fmtLongDay = f({ weekday: "long", month: "short", day: "numeric" });
  fmtMonthName = f({ month: "long" });
}
setTimeLocale("en");

export function periodLabel(view: View, anchor: Date): string {
  if (view === "day") return fmtDay.format(anchor);
  if (view === "month") return fmtMonth.format(anchor);
  const s = startOfWeek(anchor);
  return `${fmtShort.format(s)} – ${fmtShort.format(addDays(s, 6))}`;
}

export function clock(ms: number): string {
  return fmtClock.format(ms);
}

/** "4 PM", "16", "下午4时": an hour of the day for axis labels. */
export function hourLabel(h: number): string {
  return fmtHour.format(new Date(2000, 0, 1, h));
}

export function shortDate(d: Date | number): string {
  return fmtShort.format(d);
}

export function weekdayShort(d: Date | number): string {
  return fmtWeekday.format(d);
}

export function longDay(d: Date | number): string {
  return fmtLongDay.format(d);
}

export function monthName(d: Date | number): string {
  return fmtMonthName.format(d);
}

/** Single-letter weekday names starting on Monday ("M T W …", "一 二 三 …"). */
export function weekdayInitials(): string[] {
  // 2024-01-01 was a Monday.
  return Array.from({ length: 7 }, (_, i) => fmtNarrowWeekday.format(new Date(2024, 0, 1 + i)));
}

/** Number and unit pairs, so large figures can set the unit smaller: [[3, "h"], [12, "m"]]. */
export function durationParts(ms: number): [number, string][] {
  const totalMin = Math.floor(ms / MINUTE);
  if (totalMin < 1) {
    const s = Math.round(ms / 1000);
    return s > 0 ? [[s, units.s]] : [[0, units.mOnly]];
  }
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return [[m, units.mOnly]];
  return m === 0 ? [[h, units.h]] : [[h, units.h], [m, units.m]];
}

/** "3h 12m", "45m", "30s" (or "3小时12分", "45分钟" …). */
export function formatDuration(ms: number): string {
  return durationParts(ms)
    .map(([n, u]) => `${n}${u}`)
    .join(units.sep);
}

/** Compact variant for axis labels: "3h", "45m". */
export function formatHoursShort(ms: number): string {
  if (ms >= HOUR) {
    const h = ms / HOUR;
    return `${Number.isInteger(h) ? h : h.toFixed(1)}h`;
  }
  return `${Math.round(ms / MINUTE)}m`;
}
