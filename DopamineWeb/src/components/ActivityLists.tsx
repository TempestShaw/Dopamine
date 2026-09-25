"use client";

import { useState } from "react";
import { AppStat, Session } from "@/lib/analytics";
import { CATEGORIES, CATEGORY_META, Category, Overrides, TitleLabels, TitleRules, displayApp, matchTitleRule } from "@/lib/categories";
import { Sharing, votePayload } from "@/lib/community";
import { useT } from "@/lib/i18n";
import { MINUTE, View, clock, formatDuration, shortDate } from "@/lib/time";
import { AppAvatar, CategoryDot, ChevronDown, EmptyState, EyeOff, Section, Segmented } from "./ui";

type Tab = "apps" | "sessions";

export interface SharingState {
  available: boolean;
  state: Sharing;
  pending: { process: string; category: Category } | null;
  set: (s: "on" | "off") => void;
  isDemo: boolean;
}

type OverrideProps = {
  overrides: Overrides;
  onOverride: (process: string, category: Category | null) => void;
  sharing: SharingState;
  hidden: string[];
  onHide: (process: string, hide: boolean) => void;
  titleRules: TitleRules;
  onTitleRule: (keyword: string, category: Category | null, replaces?: string) => void;
  titleLabels: TitleLabels;
  onTitleLabel: (title: string, category: Category | null) => void;
};

export function ActivityLists({ apps, sessions, total, view, ...props }: { apps: AppStat[]; sessions: Session[]; total: number; view: View } & OverrideProps) {
  const [tab, setTab] = useState<Tab>("apps");
  const t = useT();
  return (
    <Section
      title={tab === "apps" ? t.lists.apps : t.lists.sessions}
      action={
        <Segmented<Tab>
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: "apps", label: t.lists.tabApps },
            { value: "sessions", label: t.lists.tabSessions },
          ]}
        />
      }
    >
      {tab === "apps" ? <AppList apps={apps} total={total} {...props} /> : <SessionList sessions={sessions} showDate={view !== "day"} />}
    </Section>
  );
}

function AppList(props: { apps: AppStat[]; total: number } & OverrideProps) {
  const { apps, total, overrides, onOverride, sharing, hidden, onHide, titleRules, onTitleRule, titleLabels, onTitleLabel } = props;
  /** The window whose title rule is being edited, as `app \0 title`. */
  const [editing, setEditing] = useState<string | null>(null);
  const t = useT();
  const [open, setOpen] = useState<string | null>(null);
  // Details are rendered the first time an app is opened and kept, so closing can animate too.
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  const [limit, setLimit] = useState(8);
  const prepare = (app: string) => setOpened((prev) => (prev.has(app) ? prev : new Set(prev).add(app)));
  const toggle = (app: string) => {
    prepare(app);
    setOpen((cur) => (cur === app ? null : app));
  };
  if (apps.length === 0)
    return (
      <div>
        <EmptyState>{t.lists.empty}</EmptyState>
        <HiddenApps hidden={hidden} onHide={onHide} />
        <Corrections {...props} />
      </div>
    );
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
                        {a.titles.slice(0, 8).map((w) => {
                          const key = `${a.app}\0${w.title}`;
                          return (
                            <li key={w.title}>
                              {/* Any window can get its own rule: the title says what an app name can't. */}
                              <button
                                type="button"
                                tabIndex={expanded ? 0 : -1}
                                onClick={() => setEditing((cur) => (cur === key ? null : key))}
                                aria-expanded={editing === key}
                                title={t.rules.hint}
                                className="group/w flex w-full items-center gap-2.5 text-left text-[13px]"
                              >
                                <CategoryDot category={w.category} className="size-2 transition-transform group-hover/w:scale-150" />
                                <span className="min-w-0 flex-1 truncate text-graphite group-hover/w:text-ink" title={w.title}>
                                  {w.title}
                                </span>
                                <span className="num shrink-0 text-faint">{formatDuration(w.total)}</span>
                              </button>
                              {editing === key && (
                                <WindowEditor
                                  title={w.title}
                                  labels={titleLabels}
                                  rules={titleRules}
                                  onLabel={(c) => {
                                    onTitleLabel(w.title, c);
                                    setEditing(null);
                                  }}
                                  onRule={(k, c, replaces) => {
                                    onTitleRule(k, c, replaces);
                                    setEditing(null);
                                  }}
                                  onCancel={() => setEditing(null)}
                                />
                              )}
                            </li>
                          );
                        })}
                        {a.titles.length > 8 && <li className="hand text-base text-faint">{t.lists.moreWindows(a.titles.length - 8)}</li>}
                      </ul>
                      <CategoryPicker app={a.app} current={overrides[a.process]} onPick={(c) => onOverride(a.process, c)} tabIndex={expanded ? 0 : -1} />
                      <button
                        type="button"
                        tabIndex={expanded ? 0 : -1}
                        onClick={() => onHide(a.process, true)}
                        title={t.hide.hint}
                        className="hand mt-2 inline-flex items-center gap-1.5 text-base text-faint hover:text-graphite"
                      >
                        <EyeOff className="size-3.5" /> {t.hide.button}
                      </button>
                      {sharing.pending?.process === a.process && <SharePrompt app={a.app} process={a.process} category={sharing.pending.category} sharing={sharing} />}
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
          {t.lists.showN(Math.min(12, apps.length - limit))}
        </button>
      )}
      <HiddenApps hidden={hidden} onHide={onHide} />
      <Corrections {...props} />
    </div>
  );
}

function CategoryButtons({ active, disabled, onPick }: { active?: Category; disabled?: boolean; onPick: (c: Category) => void }) {
  const t = useT();
  return (
    <>
      {CATEGORIES.map((c) => (
        <button
          key={c}
          type="button"
          disabled={disabled}
          onClick={() => onPick(c)}
          aria-pressed={active === c}
          className={`dab inline-flex items-center gap-1.5 px-2.5 py-0.5 transition-colors disabled:opacity-40 ${active === c ? "bg-wash font-medium text-ink" : "text-graphite hover:bg-wash hover:text-ink"}`}
        >
          <CategoryDot category={c} className="size-2" />
          {t.categories[c]}
        </button>
      ))}
    </>
  );
}

/**
 * Sorting one window by hand, like marking a message as spam: it changes at once, and the title
 * model learns from it for similar windows. The second row turns a keyword into a rule; it starts
 * as the window's title (or the rule it falls under) so a shorter keyword is one edit away.
 */
function WindowEditor({
  title,
  labels,
  rules,
  onLabel,
  onRule,
  onCancel,
}: {
  title: string;
  labels: TitleLabels;
  rules: TitleRules;
  onLabel: (category: Category | null) => void;
  onRule: (keyword: string, category: Category | null, replaces?: string) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const labelled = labels[title];
  const existing = matchTitleRule(title, rules);
  const [keyword, setKeyword] = useState(existing?.keyword ?? title);
  const ok = keyword.trim().length > 0;
  return (
    <div className="fade-in my-2 ml-[1.1rem] space-y-1.5 text-[13px]" onKeyDown={(e) => e.key === "Escape" && onCancel()}>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5">
        <span className="hand mr-1 text-base text-faint">{t.labels.thisWindow}</span>
        <CategoryButtons active={labelled} onPick={(c) => onLabel(c === labelled ? null : c)} />
        {labelled && (
          <button type="button" onClick={() => onLabel(null)} className="hand ml-1 text-base text-faint underline decoration-line underline-offset-4 hover:text-graphite">
            {t.lists.backToAuto}
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5">
        <span className="hand mr-1 text-base text-faint">
          {t.labels.or} {t.rules.before}
        </span>
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          spellCheck={false}
          aria-label={t.rules.before}
          className="min-w-0 flex-[1_1_10rem] border-b-[1.5px] border-line bg-transparent px-1 py-0.5 outline-none focus:border-ink"
        />
        <span className="hand mr-1 ml-1 text-base text-faint">{t.rules.after}</span>
        <CategoryButtons active={existing?.keyword === keyword ? existing.category : undefined} disabled={!ok} onPick={(c) => onRule(keyword, c, existing?.keyword)} />
        {existing && (
          <button type="button" onClick={() => onRule(existing.keyword, null, existing.keyword)} className="hand ml-1 text-base text-faint underline decoration-line underline-offset-4 hover:text-graphite">
            {t.rules.remove}
          </button>
        )}
      </div>
    </div>
  );
}

/** "12 windows sorted by hand · manage", "3 title rules · manage": every correction, each undoable. */
function Corrections({ titleLabels, onTitleLabel, titleRules, onTitleRule }: OverrideProps) {
  const t = useT();
  return (
    <>
      <ManageList
        count={t.labels.count}
        entries={Object.entries(titleLabels).reverse()}
        removeText={t.lists.backToAuto}
        onRemove={(k) => onTitleLabel(k, null)}
      />
      <ManageList count={t.rules.count} entries={Object.entries(titleRules)} quote removeText={t.rules.remove} onRemove={(k) => onTitleRule(k, null, k)} />
    </>
  );
}

function ManageList({
  count,
  entries,
  quote,
  removeText,
  onRemove,
}: {
  count: (n: number) => string;
  entries: [string, Category][];
  quote?: boolean;
  removeText: string;
  onRemove: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(30);
  const t = useT();
  if (entries.length === 0) return null;
  return (
    <div className="mt-2 text-[13px]">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="hand inline-flex items-center gap-1.5 text-lg text-faint hover:text-graphite">
        <span className="dab inline-block size-2 bg-faint" />
        {count(entries.length)} · <span className="underline decoration-line underline-offset-4">{open ? t.hide.done : t.hide.manage}</span>
      </button>
      {open && (
        <ul className="fade-in mt-2 flex flex-wrap gap-2">
          {entries.slice(0, limit).map(([k, c]) => (
            <li key={k} className="dab inline-flex max-w-full items-center gap-2 bg-wash py-1 pr-3 pl-2.5">
              <span className="min-w-0 truncate font-medium" title={k}>
                {quote ? `“${k}”` : k}
              </span>
              <span className="text-faint">→</span>
              <CategoryDot category={c} className="size-2" />
              <span className="shrink-0">{t.categories[c]}</span>
              <button type="button" onClick={() => onRemove(k)} className="hand ml-1 shrink-0 text-base text-graphite underline decoration-line underline-offset-4 hover:text-ink">
                {removeText}
              </button>
            </li>
          ))}
          {entries.length > limit && (
            <li>
              <button type="button" onClick={() => setLimit((l) => l + 60)} className="hand text-base text-graphite underline decoration-line underline-offset-4 hover:text-ink">
                {t.lists.showMore}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/** "2 apps hidden · manage": the way back for anything hidden, Dopamine itself included. */
function HiddenApps({ hidden, onHide }: { hidden: string[]; onHide: (process: string, hide: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const t = useT();
  if (hidden.length === 0) return null;
  return (
    <div className="mt-4 text-[13px]">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="hand inline-flex items-center gap-1.5 text-lg text-faint hover:text-graphite">
        <EyeOff className="size-3.5" />
        {t.hide.count(hidden.length)} · <span className="underline decoration-line underline-offset-4">{open ? t.hide.done : t.hide.manage}</span>
      </button>
      {open && (
        <ul className="fade-in mt-2 flex flex-wrap gap-2">
          {hidden.map((p) => (
            <li key={p} className="dab inline-flex items-center gap-2 bg-wash py-1 pr-3 pl-1.5">
              <AppAvatar app={displayApp(p)} process={p} category="other" size="sm" />
              <span className="font-medium">{displayApp(p)}</span>
              <button type="button" onClick={() => onHide(p, false)} className="hand ml-1 text-base text-graphite underline decoration-line underline-offset-4 hover:text-ink">
                {t.hide.unhide}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Lets the user say what an app is. Automatic detection handles most apps; this covers the rest
 * (an unfamiliar game, a tool used for study). The choice applies to every window of the app.
 */
function CategoryPicker({ app, current, onPick, tabIndex }: { app: string; current?: Category; onPick: (c: Category | null) => void; tabIndex: number }) {
  const t = useT();
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1.5 text-[13px]">
      <span className="hand mr-1.5 text-base text-faint">{t.lists.countsAs(app)}</span>
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
            {t.categories[c]}
          </button>
        );
      })}
      {current ? (
        <button type="button" tabIndex={tabIndex} onClick={() => onPick(null)} className="hand ml-1 text-base text-faint underline decoration-line underline-offset-4 hover:text-graphite">
          {t.lists.backToAuto}
        </button>
      ) : (
        <span className="hand ml-1 text-base text-faint">{t.lists.automatic}</span>
      )}
    </div>
  );
}

const SOURCE_URL = "https://github.com/TempestShaw/Dopamine/blob/main/DopamineWeb/src/lib/community.ts";

/**
 * Asked once, on the user's first category choice. Shows the exact request that would be sent so
 * the promise "only the category is shared" can be checked, and links to the code that sends it.
 */
function SharePrompt({ app, process, category, sharing }: { app: string; process: string; category: Category; sharing: SharingState }) {
  const t = useT();
  const payload = votePayload(t.share.installId, process, "mac", category);
  return (
    <div className="sketch fade-in mt-4 px-4 py-3.5 text-[13px]">
      <p className="text-[14px] leading-snug">
        {t.share.ask(
          <b key="app" className="font-semibold">
            {app}
          </b>,
        )}
      </p>
      <p className="mt-1.5 text-graphite">{t.share.everything}</p>
      <pre className="mt-2 rounded-md bg-wash whitespace-pre-wrap break-all px-3 py-2 font-mono text-[12px] leading-relaxed text-ink">
        {JSON.stringify({ ...payload, p_platform: "mac | windows" }, null, 1).replace(/\n\s*/g, " ")}
      </pre>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="button" onClick={() => sharing.set("on")} className="dab bg-ink px-3.5 py-1.5 font-semibold text-paper hover:opacity-90">
          {t.share.yes}
        </button>
        <button type="button" onClick={() => sharing.set("off")} className="font-medium text-graphite underline decoration-line underline-offset-4 hover:text-ink">
          {t.share.no}
        </button>
        <a href={SOURCE_URL} target="_blank" rel="noreferrer" className="hand ml-auto text-base text-faint hover:text-graphite">
          {t.share.code}
        </a>
      </div>
      {sharing.isDemo && <p className="hand mt-2 text-base text-faint">{t.share.demo}</p>}
    </div>
  );
}

function SessionList({ sessions, showDate }: { sessions: Session[]; showDate: boolean }) {
  const [showShort, setShowShort] = useState(false);
  const [limit, setLimit] = useState(40);
  const visible = showShort ? sessions : sessions.filter((s) => s.active >= MINUTE);
  const hidden = sessions.length - visible.length;
  const t = useT();
  if (sessions.length === 0) return <EmptyState>{t.lists.empty}</EmptyState>;

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
            {t.lists.showMore}
          </button>
        )}
        {hidden > 0 && !showShort && (
          <button type="button" onClick={() => setShowShort(true)} className="text-faint hover:text-graphite">
            {t.lists.shortHidden(hidden)}
          </button>
        )}
      </div>
    </div>
  );
}
