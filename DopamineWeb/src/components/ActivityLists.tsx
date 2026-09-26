"use client";

import { useState } from "react";
import { AppStat, Session } from "@/lib/analytics";
import { BROWSER_SCOPE, CATEGORIES, CATEGORY_META, Category, MAX_RULE_TEXT, Overrides, TitleRule, displayApp, isBrowser, titleRuleFor } from "@/lib/categories";
import { Sharing, votePayload } from "@/lib/community";
import { useT } from "@/lib/i18n";
import { MINUTE, View, clock, formatDuration, shortDate } from "@/lib/time";
import { AppAvatar, CategoryDot, ChevronDown, EmptyState, EyeOff, Section, Segmented, Trash } from "./ui";

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
  onForgetTitle: (app: string, title: string) => Promise<boolean>;
  titleRules: TitleRule[];
  onTitleRule: (contains: string, scope: string, category: Category | null) => void;
};

type ForgetSession = (session: Session) => Promise<boolean>;

export function ActivityLists({
  apps,
  sessions,
  total,
  view,
  onForgetSession,
  ...props
}: { apps: AppStat[]; sessions: Session[]; total: number; view: View; onForgetSession: ForgetSession } & OverrideProps) {
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
      {tab === "apps" ? <AppList apps={apps} total={total} {...props} /> : <SessionList sessions={sessions} showDate={view !== "day"} onForget={onForgetSession} />}
    </Section>
  );
}

function AppList({ apps, total, overrides, onOverride, sharing, hidden, onHide, onForgetTitle, titleRules, onTitleRule }: { apps: AppStat[]; total: number } & OverrideProps) {
  const t = useT();
  const [open, setOpen] = useState<string | null>(null);
  /** The window whose rule editor is open, as `${app}\0${title}`. */
  const [editing, setEditing] = useState<string | null>(null);
  /** Apps whose full window list is shown rather than the top few. */
  const [allTitles, setAllTitles] = useState<ReadonlySet<string>>(() => new Set());
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
                        {(allTitles.has(a.app) ? a.titles : a.titles.slice(0, TOP_TITLES)).map((w) => {
                          const key = `${a.app}\0${w.title}`;
                          const editingThis = editing === key;
                          return (
                            <li key={w.title} className="group/row flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px]">
                              <CategoryDot category={w.category} className="size-2" />
                              <button
                                type="button"
                                tabIndex={expanded ? 0 : -1}
                                onClick={() => setEditing(editingThis ? null : key)}
                                aria-expanded={editingThis}
                                aria-label={t.rules.open(w.title)}
                                title={w.title}
                                className="min-w-0 flex-1 truncate text-left text-graphite hover:text-ink hover:underline hover:decoration-line hover:underline-offset-4"
                              >
                                {w.title}
                              </button>
                              <span className="num shrink-0 text-faint">{formatDuration(w.total)}</span>
                              <Forget label={t.forget.title(w.title)} onForget={() => onForgetTitle(a.app, w.title)} tabIndex={expanded ? 0 : -1} />
                              {editingThis && <RuleEditor app={a.app} process={a.process} title={w.title} rules={titleRules} onRule={onTitleRule} />}
                            </li>
                          );
                        })}
                        {a.titles.length > TOP_TITLES && !allTitles.has(a.app) && (
                          <li>
                            <button
                              type="button"
                              tabIndex={expanded ? 0 : -1}
                              onClick={() => setAllTitles((prev) => new Set(prev).add(a.app))}
                              className="hand text-base text-faint underline decoration-line underline-offset-4 hover:text-graphite"
                            >
                              {t.lists.moreWindows(a.titles.length - TOP_TITLES)}
                            </button>
                          </li>
                        )}
                      </ul>
                      {/* A browser shows every kind of site, so one category for all of it would be wrong. */}
                      {isBrowser(a.process) && !overrides[a.process] ? (
                        <p className="hand mt-3 text-base text-faint">{t.rules.browserHint}</p>
                      ) : (
                        <>
                          <CategoryPicker app={a.app} current={overrides[a.process]} onPick={(c) => onOverride(a.process, c)} tabIndex={expanded ? 0 : -1} />
                          <p className="hand mt-1 text-base text-faint">{t.rules.appHint}</p>
                        </>
                      )}
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
    </div>
  );
}

const TOP_TITLES = 8;

/**
 * "Windows whose title contains [___] count as [category]": a rule for one window (or every window
 * sharing some words), in every browser or just this app. Starts from the rule already deciding it.
 */
function RuleEditor({ app, process, title, rules, onRule }: { app: string; process: string; title: string; rules: TitleRule[]; onRule: (contains: string, scope: string, category: Category | null) => void }) {
  const t = useT();
  const scope = isBrowser(process) ? BROWSER_SCOPE : process;
  const existing = titleRuleFor(rules, title, process);
  const [text, setText] = useState(existing?.contains ?? title);
  const trimmed = text.trim();
  const valid = trimmed.length > 0 && trimmed.length <= MAX_RULE_TEXT;
  const active = existing && existing.contains.toLowerCase() === trimmed.toLowerCase() ? existing.category : null;
  return (
    <div className="fade-in basis-full space-y-2 py-1.5 pl-4.5 text-[13px]">
      <label className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="hand text-base text-faint">{t.rules.contains}</span>
        <input
          value={text}
          autoFocus
          maxLength={MAX_RULE_TEXT}
          onChange={(e) => setText(e.target.value)}
          className="min-w-0 flex-1 rounded-md bg-wash px-2 py-1 text-ink outline-none focus-visible:ring-1 focus-visible:ring-line"
        />
      </label>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5">
        <span className="hand mr-1.5 text-base text-faint">{t.rules.countsAs}</span>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            disabled={!valid}
            onClick={() => onRule(trimmed, scope, c)}
            aria-pressed={active === c}
            className={`dab inline-flex items-center gap-1.5 px-2.5 py-0.5 transition-colors disabled:opacity-40 ${active === c ? "bg-wash font-medium text-ink" : "text-graphite hover:bg-wash hover:text-ink"}`}
          >
            <CategoryDot category={c} className="size-2" />
            {t.categories[c]}
          </button>
        ))}
      </div>
      <div className="hand flex flex-wrap items-center gap-x-3 text-base text-faint">
        <span>{scope === BROWSER_SCOPE ? t.rules.everyBrowser : t.rules.inApp(app)}</span>
        {existing && (
          <button type="button" onClick={() => onRule(existing.contains, existing.scope, null)} className="underline decoration-line underline-offset-4 hover:text-graphite">
            {t.rules.remove}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * A trash icon that asks once before erasing; the question takes its place on the row.
 * Visible on hover or focus with a mouse, always on touch screens.
 */
function Forget({ label, onForget, tabIndex = 0 }: { label: string; onForget: () => Promise<boolean>; tabIndex?: number }) {
  const t = useT();
  const [state, setState] = useState<"idle" | "ask" | "busy">("idle");
  if (state === "idle")
    return (
      <button
        type="button"
        tabIndex={tabIndex}
        aria-label={label}
        title={label}
        onClick={() => setState("ask")}
        className="shrink-0 text-faint opacity-0 transition-opacity group-hover/row:opacity-100 hover:text-ink focus-visible:opacity-100 pointer-coarse:opacity-100"
      >
        <Trash className="size-3.5" />
      </button>
    );
  const confirm = async () => {
    setState("busy");
    await onForget();
    setState("idle");
  };
  return (
    <div role="alert" className="fade-in flex basis-full flex-wrap items-center gap-x-3 gap-y-1 pl-4.5 text-[13px]">
      <span className="text-graphite">{t.forget.ask}</span>
      <button
        type="button"
        autoFocus
        disabled={state === "busy"}
        onClick={confirm}
        className="dab bg-ink px-2.5 py-0.5 font-semibold text-paper hover:opacity-90 disabled:opacity-50"
      >
        {t.forget.yes}
      </button>
      <button type="button" disabled={state === "busy"} onClick={() => setState("idle")} className="font-medium text-graphite underline decoration-line underline-offset-4 hover:text-ink">
        {t.forget.no}
      </button>
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

function SessionList({ sessions, showDate, onForget }: { sessions: Session[]; showDate: boolean; onForget: ForgetSession }) {
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
              <div className="group/row flex items-stretch gap-4">
                <div className="num w-[4.6rem] shrink-0 pt-3 text-right text-[13px] text-faint">{clock(s.start)}</div>
                <div className="relative flex w-3 justify-center">
                  <span className="absolute inset-y-0 w-[1.4px] bg-line" />
                  <CategoryDot category={s.category} className="relative mt-4 size-3" />
                </div>
                <div className="min-w-0 flex-1 py-2.5">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <AppAvatar app={s.app} process={s.process} category={s.category} size="sm" />
                      <span className="truncate text-[15px] font-medium">{s.app}</span>
                    </span>
                    <span className="num shrink-0 text-[13px] text-graphite">{formatDuration(s.active)}</span>
                    <Forget label={t.forget.session} onForget={() => onForget(s)} />
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
