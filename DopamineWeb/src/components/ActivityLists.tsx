"use client";

import { useState } from "react";
import { AppStat, Session } from "@/lib/analytics";
import { CATEGORIES, CATEGORY_META, Category, Overrides } from "@/lib/categories";
import { MINUTE, View, clock, formatDuration, shortDate } from "@/lib/time";
import { AppAvatar, CategoryDot, ChevronDown, EmptyState, Section, Segmented } from "./ui";

type Tab = "apps" | "sessions";

type OverrideProps = { overrides: Overrides; onOverride: (process: string, category: Category | null) => void };

export function ActivityLists({ apps, sessions, total, view, overrides, onOverride }: { apps: AppStat[]; sessions: Session[]; total: number; view: View } & OverrideProps) {
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
      {tab === "apps" ? <AppList apps={apps} total={total} overrides={overrides} onOverride={onOverride} /> : <SessionList sessions={sessions} showDate={view !== "day"} />}
    </Section>
  );
}

function AppList({ apps, total, overrides, onOverride }: { apps: AppStat[]; total: number } & OverrideProps) {
  const [open, setOpen] = useState<string | null>(null);
  // Details are rendered the first time an app is opened and kept, so closing can animate too.
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  const [limit, setLimit] = useState(8);
  const prepare = (app: string) => setOpened((prev) => (prev.has(app) ? prev : new Set(prev).add(app)));
  const toggle = (app: string) => {
    prepare(app);
    setOpen((cur) => (cur === app ? null : app));
  };
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
                onClick={() => toggle(a.app)}
                // Render the details on hover so the click only has to animate.
                onPointerEnter={() => prepare(a.app)}
                onFocus={() => prepare(a.app)}
                aria-expanded={expanded}
                className="group flex w-full items-center gap-4 py-3 text-left"
              >
                <AppAvatar app={a.app} process={a.process} category={a.category} />
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
                <ChevronDown className={`size-4 shrink-0 text-faint transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${expanded ? "rotate-180" : ""}`} />
              </button>
              {/* Height animates 0fr → 1fr so the list slides open quickly instead of popping in. */}
              <div
                className="grid transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                style={{ gridTemplateRows: expanded ? "1fr" : "0fr", opacity: expanded ? 1 : 0 }}
                aria-hidden={!expanded}
              >
                <div className="min-h-0 overflow-hidden">
                  {opened.has(a.app) && (
                    <div
                      className={`mb-4 ml-[3.25rem] pr-8 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${expanded ? "translate-y-0" : "-translate-y-1.5"}`}
                    >
                      <ul className="space-y-1.5">
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
                      <CategoryPicker app={a.app} current={overrides[a.process]} onPick={(c) => onOverride(a.process, c)} tabIndex={expanded ? 0 : -1} />
                    </div>
                  )}
                </div>
              </div>
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

/**
 * Lets the user say what an app is. Automatic detection handles most apps; this covers the rest
 * (an unfamiliar game, a tool used for study). The choice applies to every window of the app.
 */
function CategoryPicker({ app, current, onPick, tabIndex }: { app: string; current?: Category; onPick: (c: Category | null) => void; tabIndex: number }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1.5 text-[13px]">
      <span className="hand mr-1.5 text-base text-faint">{app} counts as</span>
      {CATEGORIES.map((c) => {
        const active = current === c;
        return (
          <button
            key={c}
            type="button"
            tabIndex={tabIndex}
            onClick={() => onPick(active ? null : c)}
            aria-pressed={active}
            className={`dab inline-flex items-center gap-1.5 px-2.5 py-0.5 transition-colors ${active ? "bg-wash font-medium text-ink" : "text-graphite hover:bg-wash hover:text-ink"}`}
          >
            <CategoryDot category={c} className="size-2" />
            {CATEGORY_META[c].label}
          </button>
        );
      })}
      {current ? (
        <button type="button" tabIndex={tabIndex} onClick={() => onPick(null)} className="hand ml-1 text-base text-faint underline decoration-line underline-offset-4 hover:text-graphite">
          back to automatic
        </button>
      ) : (
        <span className="hand ml-1 text-base text-faint">(automatic)</span>
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
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <AppAvatar app={s.app} process={s.process} category={s.category} size="sm" />
                      <span className="truncate text-[15px] font-medium">{s.app}</span>
                    </span>
                    <span className="num shrink-0 text-[13px] text-graphite">{formatDuration(s.active)}</span>
                  </div>
                  <div className="truncate pl-8 text-[13px] text-graphite" title={s.titles[0]?.title}>
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
