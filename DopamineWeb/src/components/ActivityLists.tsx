"use client";

import { useState } from "react";
import { AppStat, Session } from "@/lib/analytics";
import { CATEGORIES, CATEGORY_META } from "@/lib/categories";
import { MINUTE, View, clock, formatDuration, shortDate } from "@/lib/time";
import { AppAvatar, Card, CategoryDot, ChevronDown, EmptyState, Segmented } from "./ui";

type Tab = "apps" | "sessions";

export function ActivityLists({ apps, sessions, total, view }: { apps: AppStat[]; sessions: Session[]; total: number; view: View }) {
  const [tab, setTab] = useState<Tab>("apps");
  return (
    <Card
      title={tab === "apps" ? "Apps & windows" : "Sessions"}
      action={
        <Segmented<Tab>
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: "apps", label: "Apps" },
            { value: "sessions", label: "Sessions" },
          ]}
        />
      }
    >
      {tab === "apps" ? <AppList apps={apps} total={total} /> : <SessionList sessions={sessions} showDate={view !== "day"} />}
    </Card>
  );
}

function AppList({ apps, total }: { apps: AppStat[]; total: number }) {
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(8);
  if (apps.length === 0) return <EmptyState>Nothing tracked in this period</EmptyState>;
  const top = apps[0].total;

  return (
    <div>
      <ul className="-mx-2">
        {apps.slice(0, limit).map((a) => {
          const expanded = open === a.app;
          return (
            <li key={a.app}>
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : a.app)}
                aria-expanded={expanded}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-2"
              >
                <AppAvatar app={a.app} category={a.category} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-medium">{a.app}</span>
                    <span className="num shrink-0 text-sm text-muted">{formatDuration(a.total)}</span>
                  </div>
                  <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-track">
                    <div className="flex h-full" style={{ width: `${(a.total / top) * 100}%` }}>
                      {CATEGORIES.map((c) =>
                        a.byCategory[c] > 0 ? <div key={c} style={{ width: `${(a.byCategory[c] / a.total) * 100}%`, background: CATEGORY_META[c].color }} /> : null,
                      )}
                    </div>
                  </div>
                </div>
                <span className="num w-9 shrink-0 text-right text-xs text-faint">{Math.round((a.total / total) * 100)}%</span>
                <ChevronDown className={`size-4 shrink-0 text-faint transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>
              {expanded && (
                <ul className="fade-in mb-2 ml-[3.25rem] mr-2 space-y-1 border-l border-border pl-3">
                  {a.titles.slice(0, 8).map((t) => (
                    <li key={t.title} className="flex items-center gap-2 py-0.5 text-[13px]">
                      <CategoryDot category={t.category} className="size-1.5" />
                      <span className="min-w-0 flex-1 truncate text-muted" title={t.title}>
                        {t.title}
                      </span>
                      <span className="num shrink-0 text-xs text-faint">{formatDuration(t.total)}</span>
                    </li>
                  ))}
                  {a.titles.length > 8 && <li className="py-0.5 text-xs text-faint">+{a.titles.length - 8} more windows</li>}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      {apps.length > limit && (
        <button type="button" onClick={() => setLimit((l) => l + 12)} className="mt-2 text-xs font-medium text-accent hover:underline">
          Show {Math.min(12, apps.length - limit)} more
        </button>
      )}
    </div>
  );
}

function SessionList({ sessions, showDate }: { sessions: Session[]; showDate: boolean }) {
  const [showShort, setShowShort] = useState(false);
  const [limit, setLimit] = useState(40);
  const visible = showShort ? sessions : sessions.filter((s) => s.active >= MINUTE);
  const hidden = sessions.length - visible.length;
  if (sessions.length === 0) return <EmptyState>Nothing tracked in this period</EmptyState>;

  let lastDate = "";
  return (
    <div>
      <ol className="relative">
        {visible.slice(0, limit).map((s) => {
          const date = shortDate(new Date(s.start));
          const header = showDate && date !== lastDate;
          lastDate = date;
          return (
            <li key={`${s.start}-${s.app}`}>
              {header && <div className="mt-3 mb-1 text-xs font-semibold text-faint first:mt-0">{date}</div>}
              <div className="flex items-start gap-3 py-2">
                <div className="num w-[4.5rem] shrink-0 pt-0.5 text-right text-xs text-faint">{clock(s.start)}</div>
                <div className="relative mt-1.5 flex flex-col items-center self-stretch">
                  <span className="size-2 rounded-full ring-4 ring-surface" style={{ background: CATEGORY_META[s.category].color }} />
                  <span className="mt-1 w-px flex-1 bg-border" />
                </div>
                <div className="min-w-0 flex-1 pb-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-medium">{s.app}</span>
                    <span className="num shrink-0 text-xs text-muted">{formatDuration(s.active)}</span>
                  </div>
                  <div className="truncate text-[13px] text-muted" title={s.titles[0]?.title}>
                    {s.titles[0]?.title}
                    {s.titles.length > 1 && <span className="text-faint"> · +{s.titles.length - 1}</span>}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-2 flex items-center gap-4 text-xs">
        {visible.length > limit && (
          <button type="button" onClick={() => setLimit((l) => l + 60)} className="font-medium text-accent hover:underline">
            Show more
          </button>
        )}
        {hidden > 0 && !showShort && (
          <button type="button" onClick={() => setShowShort(true)} className="text-faint hover:text-muted">
            {hidden} sessions under a minute hidden
          </button>
        )}
      </div>
    </div>
  );
}
