"use client";

import { useMemo, useState } from "react";
import { Bucket, Segment } from "@/lib/analytics";
import { CATEGORIES, CATEGORY_META } from "@/lib/categories";
import { HOUR, Range, View, clock, formatDuration, formatHoursShort, sameDay } from "@/lib/time";
import { Card, CategoryDot } from "./ui";

const dayLetter = new Intl.DateTimeFormat(undefined, { weekday: "short" });

/** Picks a "nice" axis maximum (e.g. 15m, 30m, 1h, 2h, 4h…). */
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
    if (view === "week") return dayLetter.format(b.start);
    const d = new Date(b.start).getDate();
    return d === 1 || d % 5 === 0 ? String(d) : "";
  };

  return (
    <Card
      title={view === "day" ? "Timeline" : "Daily activity"}
      action={<Legend />}
    >
      {view === "day" && <DayRibbon segments={segments} range={range} />}

      <div className="relative mt-2">
        <div className="pointer-events-none absolute inset-x-0 top-0 flex h-44 flex-col justify-between">
          {[1, 0.5, 0].map((f) => (
            <div key={f} className="flex items-center gap-2">
              <div className="h-px flex-1 border-t border-dashed border-border" />
              <span className="num w-8 text-right text-[10px] text-faint">{f === 0 ? "" : formatHoursShort(max * f)}</span>
            </div>
          ))}
        </div>

        <div className="flex h-44 items-end gap-[3px] pr-10" onMouseLeave={() => setHover(null)}>
          {buckets.map((b, i) => {
            const future = b.start > now;
            const today = view !== "day" && sameDay(new Date(b.start), new Date(now));
            return (
              <button
                key={b.start}
                type="button"
                disabled={view === "day"}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onClick={() => onPickDay(new Date(b.start))}
                aria-label={`${view === "day" ? clock(b.start) : new Date(b.start).toDateString()}: ${formatDuration(b.total)}`}
                className={`group relative flex h-full flex-1 flex-col justify-end rounded-[4px] ${view === "day" ? "cursor-default" : "cursor-pointer"} ${hover === i ? "bg-surface-2" : ""}`}
              >
                <div className="flex w-full flex-col-reverse overflow-hidden rounded-[4px]" style={{ height: `${(b.total / max) * 100}%` }}>
                  {CATEGORIES.map((c) =>
                    b.byCategory[c] > 0 ? <div key={c} style={{ height: `${(b.byCategory[c] / b.total) * 100}%`, background: CATEGORY_META[c].color }} /> : null,
                  )}
                </div>
                {b.total === 0 && !future && <div className="h-[3px] w-full rounded-full bg-track" />}
                {today && <span className="absolute -bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-accent" />}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex gap-[3px] pr-10">
          {buckets.map((b, i) => (
            <div key={b.start} className={`num flex-1 text-center text-[10px] whitespace-nowrap ${hover === i ? "text-text" : "text-faint"}`}>
              {label(b, i)}
            </div>
          ))}
        </div>

        <div className="mt-3 flex min-h-5 items-center gap-3 text-xs text-muted">
          {hovered ? (
            <>
              <span className="font-medium text-text">
                {view === "day" ? `${clock(hovered.start)} – ${clock(hovered.end)}` : new Date(hovered.start).toDateString()}
              </span>
              <span className="num">{formatDuration(hovered.total)}</span>
              {CATEGORIES.filter((c) => hovered.byCategory[c] > 0).map((c) => (
                <span key={c} className="num inline-flex items-center gap-1">
                  <CategoryDot category={c} /> {formatDuration(hovered.byCategory[c])}
                </span>
              ))}
            </>
          ) : (
            <span className="text-faint">{view === "day" ? "Hover a bar for details" : "Hover for details · click a day to open it"}</span>
          )}
        </div>
      </div>
    </Card>
  );
}

function Legend() {
  return (
    <div className="hidden flex-wrap items-center gap-3 sm:flex">
      {CATEGORIES.map((c) => (
        <span key={c} className="inline-flex items-center gap-1.5 text-xs text-muted">
          <CategoryDot category={c} />
          {CATEGORY_META[c].label}
        </span>
      ))}
    </div>
  );
}

/** A continuous 24h strip showing exactly when each window was in front. */
function DayRibbon({ segments, range }: { segments: Segment[]; range: Range }) {
  const [tip, setTip] = useState<{ seg: Segment; x: number } | null>(null);
  const span = range.end - range.start;
  return (
    <div className="relative mb-5">
      <div className="relative h-8 overflow-hidden rounded-lg bg-track" onMouseLeave={() => setTip(null)}>
        {segments.map((s, i) => {
          const left = ((s.start - range.start) / span) * 100;
          const width = ((s.end - s.start) / span) * 100;
          return (
            <div
              key={i}
              className="absolute inset-y-0 hover:brightness-110"
              style={{ left: `${left}%`, width: `max(${width}%, 1px)`, background: CATEGORY_META[s.category].color }}
              onMouseEnter={() => setTip({ seg: s, x: left + width / 2 })}
            />
          );
        })}
      </div>
      {tip && (
        <div
          className="pointer-events-none absolute top-10 z-10 max-w-72 -translate-x-1/2 rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg"
          style={{ left: `clamp(8rem, ${tip.x}%, calc(100% - 8rem))` }}
        >
          <div className="flex items-center gap-1.5 font-medium">
            <CategoryDot category={tip.seg.category} /> {tip.seg.app}
          </div>
          <div className="truncate text-muted">{tip.seg.title}</div>
          <div className="num mt-0.5 text-faint">
            {clock(tip.seg.start)} – {clock(tip.seg.end)} · {formatDuration(tip.seg.end - tip.seg.start)}
          </div>
        </div>
      )}
    </div>
  );
}
