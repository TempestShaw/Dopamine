import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { addDays, addMonths, formatDuration, longDay, monthName, periodLabel, sameDay, startOfMonth, startOfWeek, weekdayInitials } from "@/lib/time";
import { ChevronLeft, ChevronRight, Section } from "./ui";


// Paint load of a dab (share of --heat mixed into the paper). Even the busiest day stays
// translucent so the grid reads as a wash rather than a row of solid blobs.
const MIN_PAINT = 0.1;
const MAX_PAINT = 0.6;
const LEGEND = [0, 1 / 3, 2 / 3, 1].map((t) => MIN_PAINT + t * (MAX_PAINT - MIN_PAINT));

/**
 * Scales each day against the lightest and heaviest days of this month, so the calendar shows
 * which days were heavier *for you* instead of turning every full workday the same colour.
 */
function paintScale(values: number[]): (ms: number) => number {
  const active = values.filter((v) => v > 0);
  const lo = Math.min(...active);
  const hi = Math.max(...active);
  return (ms) => {
    if (ms <= 0) return 0;
    const t = hi > lo ? (ms - lo) / (hi - lo) : 1;
    return MIN_PAINT + t * (MAX_PAINT - MIN_PAINT);
  };
}

const dab = (paint: number) => `color-mix(in srgb, var(--heat) ${Math.round(paint * 100)}%, transparent)`;

// Each day gets its own dab shape so the grid reads as hand-painted, not stamped.
const SHAPES = [
  "48% 52% 45% 55% / 55% 44% 56% 45%",
  "55% 45% 52% 48% / 46% 56% 44% 54%",
  "44% 56% 58% 42% / 52% 48% 52% 48%",
  "52% 48% 42% 58% / 58% 46% 54% 42%",
  "58% 42% 50% 50% / 44% 58% 42% 56%",
];

/**
 * A month of days, each painted by how long the screen was on. Browse months with the arrows and
 * click a day to go to it.
 */
export function MonthCalendar({
  anchor,
  heatFor,
  onShowMonth,
  selected,
  now,
  onPick,
  bare,
}: {
  /** The month shown first, and again whenever the period on screen moves to another month. */
  anchor: Date;
  heatFor: (month: Date) => Map<number, number>;
  /** Called with each month shown, so its data can be loaded. */
  onShowMonth: (month: Date) => void;
  selected: (d: Date) => boolean;
  now: number;
  onPick: (d: Date) => void;
  /** With a smaller heading, for the date picker. */
  bare?: boolean;
}) {
  const anchorMonth = startOfMonth(anchor).getTime();
  const [shown, setShown] = useState(anchorMonth);
  useEffect(() => setShown(anchorMonth), [anchorMonth]);
  useEffect(() => onShowMonth(new Date(shown)), [shown]); // eslint-disable-line react-hooks/exhaustive-deps

  const first = new Date(shown);
  const gridStart = startOfWeek(first);
  const cells: Date[] = [];
  for (let d = gridStart; cells.length < 42; d = addDays(d, 1)) cells.push(d);
  const rows = cells[35].getMonth() === first.getMonth() ? 6 : 5;
  const today = new Date(now);
  const daily = heatFor(first);
  const values = [...daily.values()];
  const monthTotal = values.reduce((a, b) => a + b, 0);
  const activeDays = values.filter((v) => v > 0).length;
  const strength = paintScale(values);
  const t = useT();
  const thisMonth = startOfMonth(today).getTime();
  const title = first.getFullYear() === today.getFullYear() ? monthName(first) : periodLabel("month", first);

  const nav = (
    <div className="flex items-center gap-0.5">
      {shown !== thisMonth && (
        <button type="button" onClick={() => setShown(thisMonth)} className="hand mr-1 rounded-md px-1.5 text-lg text-graphite hover:text-ink">
          {t.calendar.today}
        </button>
      )}
      <button type="button" aria-label={t.calendar.prevMonth} title={t.calendar.prevMonth} onClick={() => setShown(addMonths(first, -1).getTime())} className={NAV}>
        <ChevronLeft className="size-4" />
      </button>
      <button
        type="button"
        aria-label={t.calendar.nextMonth}
        title={t.calendar.nextMonth}
        onClick={() => setShown(addMonths(first, 1).getTime())}
        disabled={shown >= thisMonth}
        className={NAV}
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );

  return (
    <Section
      compact={bare}
      title={title}
      note={activeDays ? t.calendar.perDay(formatDuration(monthTotal / activeDays)) : undefined}
      action={nav}
    >
      <div className="grid grid-cols-7 gap-1 text-center">
        {weekdayInitials().map((w, i) => (
          <div key={i} className="pb-1 text-[11px] font-medium text-faint">
            {w}
          </div>
        ))}
        {cells.slice(0, rows * 7).map((d, i) => {
          const inMonth = d.getMonth() === first.getMonth();
          const ms = daily.get(d.getTime()) ?? 0;
          const s = strength(ms);
          const future = d.getTime() > now;
          const isSel = selected(d);
          const isToday = sameDay(d, today);
          return (
            <button
              key={d.getTime()}
              type="button"
              disabled={!inMonth || future}
              onClick={() => onPick(d)}
              title={inMonth ? `${longDay(d)} · ${formatDuration(ms)}` : undefined}
              className={`num relative grid aspect-square place-items-center text-[12px] transition-transform enabled:hover:scale-110 ${!inMonth ? "invisible" : ""} ${
                future ? "text-faint/50" : s > 0 ? "text-ink" : "text-graphite"
              }`}
            >
              {s > 0 && (
                <span
                  className="paint absolute inset-[3px]"
                  style={{ borderRadius: SHAPES[i % SHAPES.length], background: dab(s) }}
                />
              )}
              {isSel && (
                <span className="absolute inset-0 border-[1.6px] border-ink" style={{ borderRadius: SHAPES[(i + 2) % SHAPES.length] }} />
              )}
              <span className="relative">{d.getDate()}</span>
              {isToday && <span className="dab absolute bottom-1 left-1/2 size-1 -translate-x-1/2 bg-current" />}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-faint">
        <span className="hand text-base">{t.calendar.less}</span>
        {LEGEND.map((s) => (
          <span key={s} className="dab paint size-3" style={{ background: dab(s) }} />
        ))}
        <span className="hand text-base">{t.calendar.more}</span>
      </div>
    </Section>
  );
}

const NAV = "dab grid size-7 place-items-center text-graphite transition-colors hover:bg-wash hover:text-ink disabled:pointer-events-none disabled:opacity-30";
