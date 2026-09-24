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
  summarize,
} from "./analytics";
import { Category, Overrides, makeClassifier } from "./categories";
import { Sharing, communityAvailable, fetchCommunityCategories, isShareable, newInstallId, shareChoice } from "./community";
import { Insight, buildInsights } from "./insights";
import { useI18n } from "./i18n";
import { AuthError, EventStore, Preferences, defaultHidden, hiddenKey } from "./source";
import { Range, View, previousAnchor, rangeFor, startOfMonth, addMonths } from "./time";

export interface DashboardData {
  range: Range;
  segments: Segment[];
  summary: Summary;
  previous: Summary | null;
  buckets: Bucket[]; // hours for the day view, days otherwise
  profile: CategoryTotals[]; // hour-of-day
  sessions: Session[];
  monthDaily: Map<number, number>;
  insights: Insight[];
  /** Icon data: URLs for the apps on screen. */
  icons: Record<string, string>;
}

const LIVE_REFRESH_MS = 30_000;

/** Keys into the `errors` strings of i18n.ts. */
export type DashboardError = "save" | "unreachable" | "lost";

export function useDashboard(store: EventStore, view: View, anchor: Date, onAuthError: () => void) {
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DashboardError | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [prefs, setPrefs] = useState<Preferences>(() => ({ overrides: {}, sharing: "ask", hidden: defaultHidden(store.source.platform) }));
  const [community, setCommunity] = useState<Overrides>({});
  /** A choice waiting for the user to decide whether to share it (asked once, on the first choice). */
  const [pendingShare, setPendingShare] = useState<{ process: string; category: Category } | null>(null);
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
  // Sample data can walk through the sharing prompt, but never sends anything.
  const canShare = platform === "demo" || communityAvailable();

  useEffect(() => {
    store.source.loadPreferences().then(setPrefs, () => {});
    if (platform !== "demo") fetchCommunityCategories(platform).then(setCommunity);
  }, [store, platform]);

  const savePrefs = (change: Partial<Preferences>) => {
    setPrefs((prev) => ({ ...prev, ...change }));
    store.source.savePreferences(change).catch(() => setError("save"));
  };

  const share = (installId: string | undefined, process: string, category: Category | null) => {
    if (platform !== "demo" && installId) shareChoice(installId, process, platform, category);
  };

  /** Pins an app to a category (or back to automatic with null). */
  const setOverride = (process: string, category: Category | null) => {
    const next = { ...prefs.overrides };
    if (category) next[process] = category;
    else delete next[process];
    savePrefs({ overrides: next });

    if (!canShare || !isShareable(process)) return;
    if (prefs.sharing === "on") share(prefs.installId, process, category);
    else if (prefs.sharing === "ask" && category) setPendingShare({ process, category });
  };

  /** Leaves an app out of every figure, or brings it back. */
  const setHidden = (process: string, hide: boolean) => {
    const key = hiddenKey(process);
    const rest = prefs.hidden.filter((p) => hiddenKey(p) !== key);
    savePrefs({ hidden: hide ? [...rest, process] : rest });
  };

  /** The user's answer to the sharing prompt (also used by the footer switch). */
  const setSharing = (sharing: Exclude<Sharing, "ask">) => {
    const installId = sharing === "on" ? (prefs.installId ?? newInstallId()) : prefs.installId;
    savePrefs({ sharing, installId });
    if (sharing === "on" && pendingShare) share(installId, pendingShare.process, pendingShare.category);
    setPendingShare(null);
  };

  // Load everything the current view needs; the store caches by month, so this is usually instant.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const all = { start: Math.min(prevRange.start, monthRange.start), end: Math.max(range.end, monthRange.end) };
    store
      .ensure(all)
      // Metadata for unfamiliar apps feeds categorisation, so fetch it before computing.
      .then(() => store.ensureApps(store.processNames(all)))
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

  // Keep the ongoing period live.
  const isLive = range.start <= now && now < range.end;
  useEffect(() => {
    if (!isLive) return;
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
  }, [store, isLive]);

  const classify = useMemo(
    () => makeClassifier((p) => store.app(p), overrides, community),
    // `version` bumps when new app metadata may have arrived.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, overrides, community, version],
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
    const monthSegs = build(monthRange);
    const icons: Record<string, string> = {};
    for (const p of [...summary.apps.map((a) => a.process), ...prefs.hidden]) {
      const icon = store.app(p)?.icon;
      if (icon) icons[p] = icon;
    }
    return {
      range,
      segments,
      summary,
      previous,
      buckets: bucketize(segments, view === "day" ? hourEdges(range.start) : dayEdges(range)),
      profile,
      sessions: buildSessions(segments),
      monthDaily: dailyTotals(monthSegs, monthRange),
      insights: buildInsights(view, summary, previous, profile),
      icons,
    };
    // `version` bumps whenever the store's contents change; `locale` changes how insights format figures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, version, view, range, prevRange, monthRange, now, classify, hiddenSet, prefs.hidden, locale]);

  return {
    data,
    loading,
    error,
    now,
    overrides,
    setOverride,
    hidden: prefs.hidden,
    setHidden,
    sharing: { available: canShare, state: prefs.sharing, pending: pendingShare, set: setSharing, isDemo: platform === "demo" },
  };
}
