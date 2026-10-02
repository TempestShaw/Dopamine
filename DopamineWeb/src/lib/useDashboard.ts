"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bucket,
  CategoryTotals,
  Segment,
  Session,
  Summary,
  bucketize,
  buildSegments,
  buildSessions,
  dailyTotals,
  dayEdges,
  hourEdges,
  hourOfDayProfile,
  productiveTime,
  rowsIn,
  summarize,
} from "./analytics";
import { Category, MAX_TITLE_RULES, cleanTitle, displayApp, makeClassifier } from "./categories";
import { Insight, buildInsights } from "./insights";
import { useI18n } from "./i18n";
import { AuthError, EventStore, Preferences, RawEventFilter, UpdateInfo, defaultHidden, hiddenKey, themeToReport } from "./source";
import { Range, View, previousAnchor, rangeFor, startOfDay, startOfMonth, addMonths } from "./time";

export interface DashboardData {
  range: Range;
  segments: Segment[];
  summary: Summary;
  previous: Summary | null;
  buckets: Bucket[]; // hours for the day view, days otherwise
  profile: CategoryTotals[]; // hour-of-day
  sessions: Session[];
  insights: Insight[];
  /** Icon data: URLs for the apps on screen. */
  icons: Record<string, string>;
  /** Today, whatever period is on screen: for the sidebar. */
  today: Today;
}

export interface Today {
  total: number;
  focus: number;
  /** The app in front right now and how long this stretch in it has lasted; null when idle or paused. */
  current: { app: string; process: string; category: Category; since: number } | null;
}

const LIVE_REFRESH_MS = 30_000;

/** Keys into the `errors` strings of i18n.ts. */
export type DashboardError = "save" | "unreachable" | "lost" | "forget" | "update";

export function useDashboard(store: EventStore, view: View, anchor: Date, onAuthError: () => void) {
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DashboardError | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [prefs, setPrefs] = useState<Preferences>(() => ({
    overrides: {},
    hidden: defaultHidden(store.source.platform),
    titleRules: [],
    checkUpdates: true,
    theme: null,
  }));
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const overrides = prefs.overrides;
  const { locale } = useI18n();
  const authRef = useRef(onAuthError);
  authRef.current = onAuthError;

  const range = useMemo(() => rangeFor(view, anchor), [view, anchor]);
  const prevRange = useMemo(() => rangeFor(view, previousAnchor(view, anchor)), [view, anchor]);
  const monthRange = useMemo(() => {
    const m = startOfMonth(anchor);
    return { start: m.getTime(), end: addMonths(m, 1).getTime() };
  }, [anchor]);

  const platform = store.source.platform;

  useEffect(() => {
    store.source.loadPreferences().then(
      (p) => {
        setPrefs(p);
        setPrefsLoaded(true);
      },
      () => {},
    );
  }, [store, platform]);

  useEffect(() => {
    if (!prefs.checkUpdates) {
      setUpdate(null);
      return;
    }
    let cancelled = false;
    const refresh = () => store.source.fetchUpdate().then((u) => !cancelled && setUpdate(u), () => {});
    refresh();
    const timer = setInterval(refresh, 15_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [store, prefs.checkUpdates]);

  const savePrefs = (change: Partial<Preferences>) => {
    setPrefs((prev) => ({ ...prev, ...change }));
    store.source.savePreferences(change).catch(() => setError("save"));
  };

  // Tell the Windows agent which theme is on screen, so the dashboard window's frame matches it.
  const storedTheme = prefs.theme;
  useEffect(() => {
    if (!prefsLoaded || platform !== "windows") return;
    const root = document.documentElement;
    const report = () => {
      const theme = themeToReport(root.dataset.theme, storedTheme);
      if (theme) savePrefs({ theme });
    };
    report();
    const observer = new MutationObserver(report);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
    // savePrefs is recreated every render; only the theme on screen and the stored one matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsLoaded, platform, storedTheme]);

  /** Pins an app to a category (or back to automatic with null). */
  const setOverride = (process: string, category: Category | null) => {
    const next = { ...prefs.overrides };
    if (category) next[process] = category;
    else delete next[process];
    savePrefs({ overrides: next });
  };

  /** "Windows whose title contains `contains` count as `category`" (null removes the rule). */
  const setTitleRule = (contains: string, scope: string, category: Category | null) => {
    const text = contains.trim();
    if (!text) return;
    const same = (r: { contains: string; scope: string }) => r.scope === scope && r.contains.toLowerCase() === text.toLowerCase();
    const rest = prefs.titleRules.filter((r) => !same(r));
    const next = category ? [...rest, { contains: text, category, scope }] : rest;
    savePrefs({ titleRules: next.slice(-MAX_TITLE_RULES) });
  };

  /** Leaves an app out of every figure, or brings it back. */
  const setHidden = (process: string, hide: boolean) => {
    const key = hiddenKey(process);
    const rest = prefs.hidden.filter((p) => hiddenKey(p) !== key);
    savePrefs({ hidden: hide ? [...rest, process] : rest });
  };

  /** Erases the matching rows behind `span` on the agent. Resolves to whether it worked. */
  const forget = async (match: RawEventFilter, span: Range): Promise<boolean> => {
    try {
      await store.forget(rowsIn(store.slice(span), span, Date.now(), match));
      setVersion((v) => v + 1);
      return true;
    } catch (e) {
      if (e instanceof AuthError) authRef.current();
      else setError("forget");
      return false;
    }
  };

  /** One window title of one app, everywhere in the period on screen. */
  const forgetTitle = (app: string, title: string) =>
    forget((e) => displayApp(e.processName) === app && cleanTitle(e.windowTitle, e.processName) === title, range);

  /** Everything one session of an app recorded. */
  const forgetSession = (session: Session) => forget((e) => displayApp(e.processName) === session.app, { start: session.start, end: session.end });

  // Load everything the current view needs; the store caches by month, so this is usually instant.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const all = { start: Math.min(prevRange.start, monthRange.start), end: Math.max(range.end, monthRange.end) };
    const today = rangeFor("day", startOfDay(new Date()));
    Promise.all([store.ensure(all), store.ensure(today)])
      // Metadata for unfamiliar apps feeds categorisation, so fetch it before computing.
      .then(() => store.ensureApps([...store.processNames(all), ...store.processNames(today)]))
      .then(() => {
        if (cancelled) return;
        setError(null);
        setNow(Date.now());
        setVersion((v) => v + 1);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof AuthError) authRef.current();
        else setError("unreachable");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [store, range, prevRange, monthRange]);

  // Keep today live: the sidebar always shows it, and so does the period on screen when it is current.
  useEffect(() => {
    const tick = async () => {
      if (document.hidden) return;
      try {
        const t = Date.now();
        await store.refreshLatest(t);
        await store.ensureApps(store.processNames({ start: t - 3_600_000, end: t + 60_000 }));
        setNow(t);
        setVersion((v) => v + 1);
        setError(null);
      } catch (e) {
        if (e instanceof AuthError) authRef.current();
        else setError("lost");
      }
    };
    const id = setInterval(tick, LIVE_REFRESH_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [store]);

  const classify = useMemo(
    () => makeClassifier((p) => store.app(p), overrides, prefs.titleRules),
    // `version` bumps when new app metadata may have arrived.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, overrides, prefs.titleRules, version],
  );

  const hiddenSet = useMemo(() => new Set(prefs.hidden.map(hiddenKey)), [prefs.hidden]);

  const data = useMemo<DashboardData | null>(() => {
    if (version === 0) return null;
    // Hidden apps drop out after segmenting, so their time is not handed to the window before them.
    const build = (r: Range) => {
      const segs = buildSegments(store.slice(r), r, now, classify);
      return hiddenSet.size ? segs.filter((s) => !hiddenSet.has(hiddenKey(s.process))) : segs;
    };
    const segments = build(range);
    const summary = summarize(segments, range);
    // While a period is still running, compare against the same elapsed span of the previous one
    // (today until 4pm vs yesterday until 4pm), not the whole previous period.
    const elapsed = now - range.start;
    const prev = elapsed > 0 && elapsed < range.end - range.start ? { start: prevRange.start, end: Math.min(prevRange.end, prevRange.start + elapsed) } : prevRange;
    const prevSegs = build(prev);
    const previous = prevSegs.length ? summarize(prevSegs, prev) : null;
    const profile = hourOfDayProfile(segments);
    const icons: Record<string, string> = {};
    for (const p of [...summary.apps.map((a) => a.process), ...prefs.hidden]) {
      const icon = store.app(p)?.icon;
      if (icon) icons[p] = icon;
    }
    const todayRange = rangeFor("day", startOfDay(new Date(now)));
    const todaySegs = build(todayRange);
    const todaySummary = summarize(todaySegs, todayRange);
    const todaySessions = buildSessions(todaySegs);
    const lastSession = todaySessions[todaySessions.length - 1];
    // Still in front: the agent records every few seconds, so a stretch ending in the last minute is ongoing.
    const current = lastSession && now - lastSession.end < 60_000 ? lastSession : null;
    if (current) {
      const icon = store.app(current.process)?.icon;
      if (icon) icons[current.process] = icon;
    }
    return {
      today: {
        total: todaySummary.total,
        focus: productiveTime(todaySummary.byCategory),
        current: current && { app: current.app, process: current.process, category: current.category, since: current.start },
      },
      range,
      segments,
      summary,
      previous,
      buckets: bucketize(segments, view === "day" ? hourEdges(range.start) : dayEdges(range)),
      profile,
      sessions: buildSessions(segments),
      insights: buildInsights(view, summary, previous, profile),
      icons,
    };
    // `version` bumps whenever the store's contents change; `locale` changes how insights format figures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, version, view, range, prevRange, monthRange, now, classify, hiddenSet, prefs.hidden, locale]);

  /** Screen time per day of any month (empty until loaded); the calendar asks with `showMonth`. */
  const heatFor = (month: Date): Map<number, number> => {
    const m = startOfMonth(month);
    const r = { start: m.getTime(), end: addMonths(m, 1).getTime() };
    const segs = buildSegments(store.slice(r), r, now, classify);
    return dailyTotals(hiddenSet.size ? segs.filter((x) => !hiddenSet.has(hiddenKey(x.process))) : segs, r);
  };

  /** Loads a month the calendar is showing, so its days get their heat. */
  const showMonth = (month: Date) => {
    const m = startOfMonth(month);
    const r = { start: m.getTime(), end: addMonths(m, 1).getTime() };
    store
      .ensure(r)
      .then(() => store.ensureApps(store.processNames(r)))
      .then(() => setVersion((v) => v + 1))
      .catch(() => {});
  };

  return {
    data,
    heatFor,
    showMonth,
    loading,
    error,
    now,
    overrides,
    setOverride,
    hidden: prefs.hidden,
    setHidden,
    forgetTitle,
    forgetSession,
    titleRules: prefs.titleRules,
    setTitleRule,
    update,
    installingUpdate,
    installUpdate: async () => {
      setInstallingUpdate(true);
      try { await store.source.installUpdate(); }
      catch (e) {
        setInstallingUpdate(false);
        if (e instanceof AuthError) authRef.current();
        else setError("update");
      }
    },
    checkUpdates: prefs.checkUpdates,
    setCheckUpdates: (on: boolean) => savePrefs({ checkUpdates: on }),
  };
}
