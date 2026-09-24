"use client";

import { useMemo, useState } from "react";
import { Bucket, Segment } from "@/lib/analytics";
import { CATEGORIES, CATEGORY_META } from "@/lib/categories";
import { useT } from "@/lib/i18n";
import { HOUR, Range, View, clock, formatDuration, formatHoursShort, hourLabel, longDay, sameDay, weekdayShort } from "@/lib/time";
import { AppAvatar, CategoryDot, Section } from "./ui";

/** Picks a round axis maximum (15m, 30m, 1h … or 2h, 4h, 8h …). */
function niceMax(v: number, view: View): number {
  const steps = view === "day" ? [15, 30, 45, 60].map((m) => m * 60_000) : [1, 2, 4, 6, 8, 10, 12, 16, 24].map((h) => h * HOUR);
  return steps.find((s) => s >= v) ?? v;
}

export function ActivityChart({ view, buckets, segments, range, now, onPickDay }: { view: View; buckets: Bucket[]; segments: Segment[]; range: Range; now: number; onPickDay: (d: Date) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = useMemo(() => niceMax(Math.max(1, ...buckets.map((b) => b.total)), view), [buckets, view]);
  const hovered = hover === null ? null : buckets[hover];
  const t = useT();

  const label = (b: Bucket, i: number) => {
    if (view === "day") return i % 6 === 0 ? hourLabel(new Date(b.start).getHours()) : "";
    if (view === "week") return weekdayShort(b.start);
    const d = new Date(b.start).getDate();
    return d === 1 || d % 5 === 0 ? String(d) : "";
  };

  return (
    <Section title={view === "day" ? t.chart.timeline : t.chart.dayByDay} action={<Legend />}>
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
                aria-label={`${view === "day" ? clock(b.start) : longDay(b.start)}: ${formatDuration(b.total)}`}
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
              <span className="serif text-lg text-ink italic">{view === "day" ? `${clock(hovered.start)} – ${clock(hovered.end)}` : longDay(hovered.start)}</span>
              <span className="num font-medium text-ink">{formatDuration(hovered.total)}</span>
              {CATEGORIES.filter((c) => hovered.byCategory[c] > 0).map((c) => (
                <span key={c} className="num inline-flex items-center gap-1.5">
                  <CategoryDot category={c} className="size-2" /> {formatDuration(hovered.byCategory[c])}
                </span>
              ))}
            </>
          ) : (
            <span className="hand text-lg text-faint">{view === "day" ? t.chart.hoverHour : t.chart.hoverDay}</span>
          )}
        </div>
      </div>
    </Section>
  );
}

function Legend() {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {CATEGORIES.map((c) => (
        <span key={c} className="inline-flex items-center gap-1.5 text-[13px] text-graphite">
          <CategoryDot category={c} />
          {t.categories[c]}
        </span>
      ))}
    </div>
  );
}

/** One long brushstroke across 24 hours showing exactly when each window was in front. */
function DayRibbon({ segments, range }: { segments: Segment[]; range: Range }) {
  const [tip, setTip] = useState<{ seg: Segment; x: number } | null>(null);
  const span = range.end - range.start;

  // A real day can hold a thousand window switches. Paint touching segments of the same category
  // as one run (far fewer DOM nodes) and find the hovered segment by position instead of giving
  // every sliver its own mouse handler.
  const runs = useMemo(() => {
    const out: { start: number; end: number; category: Segment["category"] }[] = [];
    for (const s of segments) {
      const last = out[out.length - 1];
      if (last && last.category === s.category && s.start - last.end < 30_000) last.end = s.end;
      else out.push({ start: s.start, end: s.end, category: s.category });
    }
    return out;
  }, [segments]);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const t = range.start + ((e.clientX - box.left) / box.width) * span;
    let lo = 0;
    let hi = segments.length - 1;
    let found: Segment | null = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (segments[mid].end <= t) lo = mid + 1;
      else if (segments[mid].start > t) hi = mid - 1;
      else {
        found = segments[mid];
        break;
      }
    }
    if (found?.start === tip?.seg.start) return;
    setTip(found && { seg: found, x: ((found.start + found.end) / 2 - range.start) / span * 100 });
  };

  return (
    <div className="relative mb-8">
      <div className="relative h-9 cursor-crosshair" onMouseMove={onMove} onMouseLeave={() => setTip(null)}>
        <div className="rule absolute inset-x-0 top-1/2 -translate-y-1/2" />
        <div className="paint absolute inset-0">
          {runs.map((r) => (
            <div
              key={r.start}
              className="absolute inset-y-0"
              style={{ left: `${((r.start - range.start) / span) * 100}%`, width: `max(${((r.end - r.start) / span) * 100}%, 1.5px)`, background: CATEGORY_META[r.category].color }}
            />
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-faint">
        {[0, 6, 12, 18, 24].map((h) => (
          <span key={h} className="num">
            {h === 24 ? "" : hourLabel(h)}
          </span>
        ))}
      </div>
      {tip && (
        // Floats over the chart below; it never takes up space in the layout.
        <div className="pointer-events-none absolute top-12 z-30 w-max max-w-72 -translate-x-1/2" style={{ left: `clamp(8rem, ${tip.x}%, calc(100% - 8rem))` }}>
          <div className="sketch bg-paper px-3.5 py-2.5 text-[13px] shadow-[0_8px_28px_-12px_rgba(0,0,0,0.45)]">
            <div className="flex items-center gap-1.5 font-semibold">
              <AppAvatar app={tip.seg.app} process={tip.seg.process} category={tip.seg.category} size="sm" /> {tip.seg.app}
            </div>
            <div className="truncate text-graphite">{tip.seg.title}</div>
            <div className="num mt-0.5 text-faint">
              {clock(tip.seg.start)} – {clock(tip.seg.end)} · {formatDuration(tip.seg.end - tip.seg.start)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
