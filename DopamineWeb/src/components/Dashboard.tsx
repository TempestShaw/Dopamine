"use client";

import { useCallback, useMemo, useState } from "react";
import { EventStore } from "@/lib/source";
import { IconContext } from "@/lib/icons";
import { useDashboard } from "@/lib/useDashboard";
import { View, rangeFor, sameDay, shiftAnchor, startOfDay } from "@/lib/time";
import { ActivityChart } from "./ActivityChart";
import { ActivityLists } from "./ActivityLists";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { Header } from "./Header";
import { Insights } from "./Insights";
import { MonthCalendar } from "./MonthCalendar";
import { StatCards } from "./StatCards";
import { Refresh, Rule } from "./ui";

const NO_ICONS: Record<string, string> = {};

export function Dashboard({ store, onDisconnect }: { store: EventStore; onDisconnect: () => void }) {
  const [view, setView] = useState<View>("day");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const { data, loading, error, now, overrides, setOverride, sharing } = useDashboard(store, view, anchor, onDisconnect);

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
    <IconContext.Provider value={data?.icons ?? NO_ICONS}>
    <div className="min-h-screen pb-10">
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

      <main className="mx-auto max-w-[1180px] px-4 pt-8 sm:px-8">
        {error && (
          <div className="sketch mb-8 flex items-center justify-between gap-3 px-4 py-3 text-[15px]">
            <span className="marker">{error}</span>
            <button type="button" onClick={() => setAnchor(new Date(anchor))} className="inline-flex items-center gap-1.5 font-medium hover:underline">
              <Refresh className="size-3.5" /> Retry
            </button>
          </div>
        )}

        {!data ? (
          <Skeleton />
        ) : (
          <div key={`${view}-${range.start}`} className="fade-in">
            <StatCards view={view} summary={data.summary} previous={data.previous} days={activeDays} />
            <Rule className="my-10" />
            <div className="grid gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 space-y-12">
                <ActivityChart view={view} buckets={data.buckets} segments={data.segments} range={range} now={now} onPickDay={openDay} />
                <Rule />
                <ActivityLists apps={data.summary.apps} sessions={data.sessions} total={data.summary.total} view={view} overrides={overrides} onOverride={setOverride} sharing={sharing} />
              </div>
              <aside className="space-y-12 lg:border-l lg:border-dashed lg:border-line lg:pl-10">
                <CategoryBreakdown totals={data.summary.byCategory} total={data.summary.total} />
                <Insights items={data.insights} />
                <MonthCalendar anchor={anchor} daily={data.monthDaily} selected={selected} now={now} onPick={openDay} />
              </aside>
            </div>
          </div>
        )}

        <footer className="hand mt-16 flex flex-col items-center gap-1 text-center text-lg text-faint">
          <span>{sharing.state === "on" ? "your activity stays on this computer; only app categories you pick are shared" : "everything stays on this computer"}</span>
          {sharing.available && sharing.state !== "ask" && (
            <button type="button" onClick={() => sharing.set(sharing.state === "on" ? "off" : "on")} className="text-base underline decoration-line underline-offset-4 hover:text-graphite">
              {sharing.state === "on" ? "stop sharing category choices" : "share category choices to help others"}
            </button>
          )}
        </footer>
      </main>
    </div>
    </IconContext.Provider>
  );
}

function Skeleton() {
  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-24" />
        ))}
      </div>
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-10">
          <div className="skeleton h-72" />
          <div className="skeleton h-80" />
        </div>
        <div className="space-y-10">
          <div className="skeleton h-56" />
          <div className="skeleton h-56" />
        </div>
      </div>
    </div>
  );
}
