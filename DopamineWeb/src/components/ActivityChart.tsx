"use client";

import { useMemo, useState } from "react";
import { Bucket, Segment } from "@/lib/analytics";
import { CATEGORIES, CATEGORY_META } from "@/lib/categories";
import { HOUR, Range, View, clock, formatDuration, formatHoursShort, sameDay } from "@/lib/time";
import { CategoryDot, Section } from "./ui";

const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const longDay = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" });

/** Picks a round axis maximum (15m, 30m, 1h … or 2h, 4h, 8h …). */
function niceMax(v: number, view: View): number {
  const steps = view === "day" ? [15, 30, 45, 60].map((m) => m * 60_000) : [1, 2, 4, 6, 8, 10, 12, 16, 24].map((h) => h * HOUR);
  return steps.find((s) => s >= v) ?? v;
}

export function ActivityChart({ view, buckets, segments, range, now, onPickDay }: { view: View; buckets: Bucket[]; segments: Segment[]; range: Range; now: number; onPickDay: (d: Date) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = useMemo(() => niceMax(Math.max(1, ...buckets.map((b) => b.total)), view), [buckets, view]);
  const hovered = hover === null ? null : buckets[hover];

  const label = (b: Bucket, i: number) => {
    if (view === "day") return i % 6 === 0 ? clock(b.start).replace(":00", "") : "";
    if (view === "week") return weekday.format(b.start);
    const d = new Date(b.start).getDate();
    return d === 1 || d % 5 === 0 ? String(d) : "";
  };

  return (
    <Section title={view === "day" ? "Timeline" : "Day by day"} action={<Legend />}>
      {view === "day" && <DayRibbon segments={segments} range={range} />}

      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 flex h-48 flex-col justify-between">
          {[1, 0.5, 0].map((f) => (
            <div key={f} className="flex items-center gap-2">
              <div className="rule flex-1 opacity-70" />
              <span className="hand num w-9 text-right text-base leading-none text-faint">{f === 0 ? "" : formatHoursShort(max * f)}</span>
            </div>
          ))}
        </div>

        <div className="paint flex h-48 items-end gap-[3px] pr-11" onMouseLeave={() => setHover(null)}>
          {buckets.map((b, i) => {
            const today = view !== "day" && sameDay(new Date(b.start), new Date(now));
            return (
              <button
                key={b.start}
                type="button"
                disabled={view === "day"}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onClick={() => onPickDay(new Date(b.start))}
                aria-label={`${view === "day" ? clock(b.start) : longDay.format(b.start)}: ${formatDuration(b.total)}`}
                className={`relative flex h-full flex-1 flex-col justify-end ${view === "day" ? "cursor-default" : "cursor-pointer"}`}
              >
                <div
                  className="brush-up mx-auto flex w-full max-w-12 flex-col-reverse overflow-hidden rounded-t-[6px] rounded-b-[2px] transition-opacity"
                  style={{ height: `${(b.total / max) * 100}%`, animationDelay: `${i * 12}ms`, opacity: hover === null || hover === i ? 1 : 0.55 }}
                >
                  {CATEGORIES.map((c) =>
                    b.byCategory[c] > 0 ? <div key={c} style={{ height: `${(b.byCategory[c] / b.total) * 100}%`, background: CATEGORY_META[c].color }} /> : null,
                  )}
                </div>
                {today && <span className="dab absolute -bottom-2.5 left-1/2 size-1.5 -translate-x-1/2 bg-ink" />}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex gap-[3px] pr-11">
          {buckets.map((b, i) => (
            <div key={b.start} className={`num flex-1 text-center text-[11px] whitespace-nowrap ${hover === i ? "text-ink" : "text-faint"}`}>
              {label(b, i)}
            </div>
          ))}
        </div>

        <div className="mt-4 flex min-h-7 flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-graphite">
          {hovered ? (
            <>
              <span className="serif text-lg text-ink italic">{view === "day" ? `${clock(hovered.start)} – ${clock(hovered.end)}` : longDay.format(hovered.start)}</span>
              <span className="num font-medium text-ink">{formatDuration(hovered.total)}</span>
              {CATEGORIES.filter((c) => hovered.byCategory[c] > 0).map((c) => (
                <span key={c} className="num inline-flex items-center gap-1.5">
                  <CategoryDot category={c} className="size-2" /> {formatDuration(hovered.byCategory[c])}
                </span>
              ))}
            </>
          ) : (
            <span className="hand text-lg text-faint">{view === "day" ? "hover a bar to see the hour" : "hover for details · click a day to open it"}</span>
          )}
        </div>
      </div>
    </Section>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {CATEGORIES.map((c) => (
        <span key={c} className="inline-flex items-center gap-1.5 text-[13px] text-graphite">
          <CategoryDot category={c} />
          {CATEGORY_META[c].label}
        </span>
      ))}
    </div>
  );
}

/** One long brushstroke across 24 hours showing exactly when each window was in front. */
function DayRibbon({ segments, range }: { segments: Segment[]; range: Range }) {
  const [tip, setTip] = useState<{ seg: Segment; x: number } | null>(null);
  const span = range.end - range.start;
  return (
    <div className="relative mb-8">
      <div className="relative h-9" onMouseLeave={() => setTip(null)}>
        <div className="rule absolute inset-x-0 top-1/2" />
        <div className="paint absolute inset-0">
          {segments.map((s, i) => {
            const left = ((s.start - range.start) / span) * 100;
            const width = ((s.end - s.start) / span) * 100;
            return (
              <div
                key={i}
                className="absolute inset-y-0"
                style={{ left: `${left}%`, width: `max(${width}%, 1.5px)`, background: CATEGORY_META[s.category].color }}
                onMouseEnter={() => setTip({ seg: s, x: left + width / 2 })}
              />
            );
          })}
        </div>
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-faint">
        {[0, 6, 12, 18, 24].map((h) => (
          <span key={h} className="num">
            {h === 24 ? "" : clock(new Date(2000, 0, 1, h).getTime()).replace(":00", "")}
          </span>
        ))}
      </div>
      {tip && (
        <div
          className="sketch pointer-events-none absolute top-12 z-20 max-w-72 -translate-x-1/2 bg-paper px-3.5 py-2.5 text-[13px] shadow-[0_6px_24px_-12px_rgba(0,0,0,0.35)]"
          style={{ left: `clamp(8rem, ${tip.x}%, calc(100% - 8rem))` }}
        >
          <div className="flex items-center gap-1.5 font-semibold">
            <CategoryDot category={tip.seg.category} className="size-2" /> {tip.seg.app}
          </div>
          <div className="truncate text-graphite">{tip.seg.title}</div>
          <div className="num mt-0.5 text-faint">
            {clock(tip.seg.start)} – {clock(tip.seg.end)} · {formatDuration(tip.seg.end - tip.seg.start)}
          </div>
        </div>
      )}
    </div>
  );
}
