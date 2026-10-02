"use client";

import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EventStore } from "@/lib/source";
import { useT } from "@/lib/i18n";
import { IconContext } from "@/lib/icons";
import { useDashboard } from "@/lib/useDashboard";
import { View, periodLabel, rangeFor, sameDay, shiftAnchor, startOfDay } from "@/lib/time";
import { ActivityChart } from "./ActivityChart";
import { ActivityLists } from "./ActivityLists";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { Insights } from "./Insights";
import { MonthCalendar } from "./MonthCalendar";
import { Sidebar } from "./Sidebar";
import { StatCards } from "./StatCards";
import { AppFrame, BarButton, LanguagePicker, PillTabs, ThemeToggle } from "./TitleBar";
import { Apple, ChevronDown, ChevronLeft, ChevronRight, Logout, Refresh, Rule, SidebarIcon, Windows } from "./ui";

const NO_ICONS: Record<string, string> = {};
const SIDEBAR_KEY = "dopamine.sidebar";

export function Dashboard({ store, onDisconnect }: { store: EventStore; onDisconnect: () => void }) {
  const [view, setView] = useState<View>("day");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [sidebar, setSidebar] = useSidebar();
  const t = useT();
  const {
    data,
    loading,
    error,
    now,
    overrides,
    setOverride,
    hidden,
    setHidden,
    forgetTitle,
    forgetSession,
    titleRules,
    setTitleRule,
    update,
    installUpdate,
    installingUpdate,
    checkUpdates,
    setCheckUpdates,
    heatFor,
    showMonth,
  } = useDashboard(store, view, anchor, onDisconnect);

  const range = useMemo(() => rangeFor(view, anchor), [view, anchor]);
  const isCurrent = range.start <= now && now < range.end;
  const platform = store.source.platform;

  const openDay = useCallback((d: Date) => {
    setAnchor(startOfDay(d));
    setView("day");
  }, []);

  const selected = useCallback((d: Date) => (view === "day" ? sameDay(d, anchor) : view === "week" && d.getTime() >= range.start && d.getTime() < range.end), [view, anchor, range]);

  const canShift = (dir: number) => rangeFor(view, shiftAnchor(view, anchor, dir)).start <= Date.now();
  const shift = (dir: number) => {
    if (canShift(dir)) setAnchor(shiftAnchor(view, anchor, dir));
  };

  // Buckets are days in the week and month views.
  const activeDays = data && view !== "day" ? data.buckets.filter((b) => b.total > 0).length : 1;

  return (
    <IconContext.Provider value={data?.icons ?? NO_ICONS}>
      <AppFrame
        brand={
          <span className="hidden items-center gap-1 text-graphite sm:inline-flex" title={store.source.version}>
            {platform === "mac" && <Apple className="size-3.5" />}
            {platform === "windows" && <Windows className="size-3" />}
            {t.platform[platform]}
          </span>
        }
        left={
          <>
            <BarButton label={sidebar ? t.sidebar.hide : t.sidebar.show} pressed={sidebar} onClick={() => setSidebar(!sidebar)}>
              <SidebarIcon />
            </BarButton>
            <BarButton label={t.previous} onClick={() => shift(-1)}>
              <ChevronLeft />
            </BarButton>
            <BarButton label={t.next} onClick={() => shift(1)} disabled={!canShift(1)}>
              <ChevronRight />
            </BarButton>
            <PillTabs<View> value={view} onChange={setView} options={(["day", "week", "month"] as const).map((v) => ({ value: v, label: t.views[v] }))} />
          </>
        }
        right={
          <>
            <LanguagePicker />
            <ThemeToggle />
            <BarButton label={platform === "demo" ? t.leaveDemo : t.disconnect} onClick={onDisconnect}>
              <Logout />
            </BarButton>
          </>
        }
      >
        {sidebar && <Sidebar today={data?.today ?? null} now={now} />}

        <main className={`panel panel-card scroll-thin min-w-0 flex-1 overflow-y-auto ${sidebar ? "" : "md:ml-2"}`}>
          <div className="mx-auto max-w-[1180px] px-4 pt-7 pb-10 sm:px-8">
            <div className="mb-8 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <DatePicker label={periodLabel(view, anchor)}>
                {(close) => (
                  <MonthCalendar
                    bare
                    anchor={anchor}
                    heatFor={heatFor}
                    onShowMonth={showMonth}
                    selected={selected}
                    now={now}
                    onPick={(d) => {
                      setAnchor(startOfDay(d));
                      close();
                    }}
                  />
                )}
              </DatePicker>
              {!isCurrent && (
                <button type="button" onClick={() => setAnchor(startOfDay(new Date()))} className="hand text-xl text-graphite underline decoration-line underline-offset-4 hover:text-ink">
                  {t.backTo[view]}
                </button>
              )}
              {loading && data && <Refresh className="size-3.5 animate-spin self-center text-faint" />}
            </div>

            {update && (
              <p className="sketch fade-in mb-8 px-4 py-3 text-[14px]">
                {t.update.available(update.version)}{" "}
                {update.automatic ? (
                  <button type="button" onClick={installUpdate} disabled={!update.ready || installingUpdate} className="font-semibold underline decoration-line underline-offset-4 hover:text-ink disabled:opacity-50">
                    {installingUpdate ? t.update.installing : update.ready ? t.update.install : t.update.downloading}
                  </button>
                ) : (
                  <a href={update.url} target="_blank" rel="noreferrer" className="font-semibold underline decoration-line underline-offset-4 hover:text-ink">
                    {t.update.download}
                  </a>
                )}
              </p>
            )}
            {error && (
              <div className="sketch mb-8 flex items-center justify-between gap-3 px-4 py-3 text-[15px]">
                <span className="marker">{t.errors[error]}</span>
                <button type="button" onClick={() => setAnchor(new Date(anchor))} className="inline-flex items-center gap-1.5 font-medium hover:underline">
                  <Refresh className="size-3.5" /> {t.retry}
                </button>
              </div>
            )}

            {!data ? (
              <Skeleton />
            ) : (
              <div key={`${view}-${range.start}`} className="fade-in">
                <StatCards view={view} summary={data.summary} previous={data.previous} days={activeDays} />
                <Rule className="my-10" />
                <div className="grid gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,1fr)_300px]">
                  <div className="min-w-0 space-y-12">
                    <ActivityChart view={view} buckets={data.buckets} segments={data.segments} range={range} now={now} onPickDay={openDay} />
                    <Rule />
                    <ActivityLists
                      apps={data.summary.apps}
                      sessions={data.sessions}
                      total={data.summary.total}
                      view={view}
                      overrides={overrides}
                      onOverride={setOverride}
                      hidden={hidden}
                      onHide={setHidden}
                      onForgetTitle={forgetTitle}
                      onForgetSession={forgetSession}
                      titleRules={titleRules}
                      onTitleRule={setTitleRule}
                    />
                  </div>
                  <aside className="space-y-12 lg:border-l lg:border-dashed lg:border-line lg:pl-10">
                    <CategoryBreakdown totals={data.summary.byCategory} total={data.summary.total} />
                    <Insights items={data.insights} />
                    <MonthCalendar anchor={anchor} heatFor={heatFor} onShowMonth={showMonth} selected={selected} now={now} onPick={openDay} />
                  </aside>
                </div>
              </div>
            )}

            <footer className="hand mt-16 flex flex-col items-center gap-1 text-center text-lg text-faint">
              <span>{t.footer.local}</span>
              {platform !== "demo" && (
                <button type="button" onClick={() => setCheckUpdates(!checkUpdates)} className="text-base underline decoration-line underline-offset-4 hover:text-graphite">
                  {checkUpdates ? t.footer.updatesOn : t.footer.updatesOff}
                </button>
              )}
            </footer>
          </div>
        </main>
      </AppFrame>
    </IconContext.Provider>
  );
}

/** Open unless the user closed it; remembered between visits. */
function useSidebar(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem(SIDEBAR_KEY) === "closed") setOpen(false);
    } catch {}
  }, []);
  const set = (next: boolean) => {
    setOpen(next);
    try {
      localStorage.setItem(SIDEBAR_KEY, next ? "open" : "closed");
    } catch {}
  };
  return [open, set];
}

/** The period's title; clicking it opens a calendar to jump to any day. */
function DatePicker({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={t.calendar.pick}
        className="group -mx-2 flex items-center gap-1.5 rounded-lg px-2 py-0.5 transition-colors hover:bg-wash"
      >
        <h1 className="serif text-[34px] leading-tight whitespace-nowrap sm:text-[44px]">{label}</h1>
        <ChevronDown className={`size-5 text-faint transition-transform group-hover:text-ink ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={t.calendar.pick}
          className="fade-in absolute top-full left-0 z-40 mt-2 w-[300px] rounded-xl border border-line bg-paper p-4 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.28)]"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
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
