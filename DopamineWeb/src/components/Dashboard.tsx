"use client";

import { useCallback, useMemo, useState } from "react";
import { EventStore } from "@/lib/source";
import { useDashboard } from "@/lib/useDashboard";
import { View, rangeFor, sameDay, shiftAnchor, startOfDay } from "@/lib/time";
import { ActivityChart } from "./ActivityChart";
import { ActivityLists } from "./ActivityLists";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { Header } from "./Header";
import { Insights } from "./Insights";
import { MonthCalendar } from "./MonthCalendar";
import { StatCards } from "./StatCards";
import { Refresh } from "./ui";

export function Dashboard({ store, onDisconnect }: { store: EventStore; onDisconnect: () => void }) {
  const [view, setView] = useState<View>("day");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const { data, loading, error, now } = useDashboard(store, view, anchor, onDisconnect);

  const range = useMemo(() => rangeFor(view, anchor), [view, anchor]);
  const isCurrent = range.start <= now && now < range.end;

  const openDay = useCallback((d: Date) => {
    setAnchor(startOfDay(d));
    setView("day");
  }, []);

  const selected = useCallback((d: Date) => (view === "day" ? sameDay(d, anchor) : view === "week" && d.getTime() >= range.start && d.getTime() < range.end), [view, anchor, range]);

  const shift = (dir: number) => {
    const next = shiftAnchor(view, anchor, dir);
    if (rangeFor(view, next).start <= Date.now()) setAnchor(next);
  };

  // Buckets are days in the week and month views.
  const activeDays = data && view !== "day" ? data.buckets.filter((b) => b.total > 0).length : 1;

  return (
    <div className="min-h-screen">
      <Header
        view={view}
        anchor={anchor}
        isCurrent={isCurrent}
        platform={store.source.platform}
        version={store.source.version}
        loading={loading}
        onView={setView}
        onShift={shift}
        onToday={() => setAnchor(startOfDay(new Date()))}
        onDisconnect={onDisconnect}
      />

      <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
        {error && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
            {error}
            <button type="button" onClick={() => setAnchor(new Date(anchor))} className="inline-flex items-center gap-1.5 font-medium hover:underline">
              <Refresh className="size-3.5" /> Retry
            </button>
          </div>
        )}

        {!data ? (
          <Skeleton />
        ) : (
          <div key={`${view}-${range.start}`} className="fade-in space-y-4">
            <StatCards view={view} summary={data.summary} previous={data.previous} days={activeDays} />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-w-0 space-y-4">
                <ActivityChart view={view} buckets={data.buckets} segments={data.segments} range={range} now={now} onPickDay={openDay} />
                <ActivityLists apps={data.summary.apps} sessions={data.sessions} total={data.summary.total} view={view} />
              </div>
              <aside className="space-y-4">
                <CategoryBreakdown totals={data.summary.byCategory} total={data.summary.total} />
                <Insights items={data.insights} />
                <MonthCalendar anchor={anchor} daily={data.monthDaily} selected={selected} now={now} onPick={openDay} />
              </aside>
            </div>
          </div>
        )}

        <footer className="mt-10 pb-6 text-center text-xs text-faint">All data stays on this computer · Dopamine {store.source.version !== "demo" ? `v${store.source.version}` : "demo"}</footer>
      </main>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-[104px]" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div className="skeleton h-80" />
          <div className="skeleton h-96" />
        </div>
        <div className="space-y-4">
          <div className="skeleton h-48" />
          <div className="skeleton h-64" />
        </div>
      </div>
    </div>
  );
}
