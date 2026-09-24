"use client";

import { useState } from "react";
import { AppStat, Session } from "@/lib/analytics";
import { CATEGORIES, CATEGORY_META } from "@/lib/categories";
import { MINUTE, View, clock, formatDuration, shortDate } from "@/lib/time";
import { AppAvatar, CategoryDot, ChevronDown, EmptyState, Section, Segmented } from "./ui";

type Tab = "apps" | "sessions";

export function ActivityLists({ apps, sessions, total, view }: { apps: AppStat[]; sessions: Session[]; total: number; view: View }) {
  const [tab, setTab] = useState<Tab>("apps");
  return (
    <Section
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
    </Section>
  );
}

function AppList({ apps, total }: { apps: AppStat[]; total: number }) {
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(8);
  if (apps.length === 0) return <EmptyState>nothing tracked in this period</EmptyState>;
  const top = apps[0].total;

  return (
    <div>
      <ul>
        {apps.slice(0, limit).map((a) => {
          const expanded = open === a.app;
          return (
            <li key={a.app} className="border-b border-dashed border-line last:border-b-0">
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : a.app)}
                aria-expanded={expanded}
                className="group flex w-full items-center gap-4 py-3 text-left"
              >
                <AppAvatar app={a.app} category={a.category} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[15px] font-medium group-hover:underline group-hover:decoration-line group-hover:underline-offset-4">{a.app}</span>
                    <span className="num shrink-0 text-[15px] text-graphite">{formatDuration(a.total)}</span>
                  </div>
                  <div className="paint mt-2 flex h-2" style={{ width: `${Math.max((a.total / top) * 100, 1.5)}%` }}>
                    {CATEGORIES.map((c) =>
                      a.byCategory[c] > 0 ? (
                        <div key={c} className="first:rounded-l-full last:rounded-r-full" style={{ width: `${(a.byCategory[c] / a.total) * 100}%`, background: CATEGORY_META[c].color }} />
                      ) : null,
                    )}
                  </div>
                </div>
                <span className="hand num w-10 shrink-0 text-right text-lg leading-none text-faint">{Math.round((a.total / total) * 100)}%</span>
                <ChevronDown className={`size-4 shrink-0 text-faint transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>
              {expanded && (
                <ul className="fade-in mb-3 ml-[3.25rem] space-y-1.5 pr-8">
                  {a.titles.slice(0, 8).map((t) => (
                    <li key={t.title} className="flex items-center gap-2.5 text-[13px]">
                      <CategoryDot category={t.category} className="size-2" />
                      <span className="min-w-0 flex-1 truncate text-graphite" title={t.title}>
                        {t.title}
                      </span>
                      <span className="num shrink-0 text-faint">{formatDuration(t.total)}</span>
                    </li>
                  ))}
                  {a.titles.length > 8 && <li className="hand text-base text-faint">+{a.titles.length - 8} more windows</li>}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      {apps.length > limit && (
        <button type="button" onClick={() => setLimit((l) => l + 12)} className="hand mt-3 text-xl text-graphite underline decoration-line underline-offset-4 hover:text-ink">
          show {Math.min(12, apps.length - limit)} more
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
  if (sessions.length === 0) return <EmptyState>nothing tracked in this period</EmptyState>;

  let lastDate = "";
  return (
    <div>
      <ol>
        {visible.slice(0, limit).map((s) => {
          const date = shortDate(new Date(s.start));
          const header = showDate && date !== lastDate;
          lastDate = date;
          return (
            <li key={`${s.start}-${s.app}`}>
              {header && <div className="serif mt-4 mb-1 text-xl italic first:mt-0">{date}</div>}
              <div className="flex items-stretch gap-4">
                <div className="num w-[4.6rem] shrink-0 pt-3 text-right text-[13px] text-faint">{clock(s.start)}</div>
                <div className="relative flex w-3 justify-center">
                  <span className="absolute inset-y-0 w-[1.4px] bg-line" />
                  <CategoryDot category={s.category} className="relative mt-4 size-3" />
                </div>
                <div className="min-w-0 flex-1 py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[15px] font-medium">{s.app}</span>
                    <span className="num shrink-0 text-[13px] text-graphite">{formatDuration(s.active)}</span>
                  </div>
                  <div className="truncate text-[13px] text-graphite" title={s.titles[0]?.title}>
                    {s.titles[0]?.title}
                    {s.titles.length > 1 && <span className="text-faint"> · +{s.titles.length - 1}</span>}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="hand mt-3 flex flex-wrap items-center gap-5 text-lg">
        {visible.length > limit && (
          <button type="button" onClick={() => setLimit((l) => l + 60)} className="text-graphite underline decoration-line underline-offset-4 hover:text-ink">
            show more
          </button>
        )}
        {hidden > 0 && !showShort && (
          <button type="button" onClick={() => setShowShort(true)} className="text-faint hover:text-graphite">
            {hidden} sessions under a minute hidden
          </button>
        )}
      </div>
    </div>
  );
}
