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
import { Insight, buildInsights } from "./insights";
import { AuthError, EventStore } from "./source";
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

export function useDashboard(store: EventStore, view: View, anchor: Date, onAuthError: () => void) {
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [overrides, setOverrides] = useState<Overrides>({});
  const authRef = useRef(onAuthError);
  authRef.current = onAuthError;

  const range = useMemo(() => rangeFor(view, anchor), [view, anchor]);
  const prevRange = useMemo(() => rangeFor(view, previousAnchor(view, anchor)), [view, anchor]);
  const monthRange = useMemo(() => {
    const m = startOfMonth(anchor);
    return { start: m.getTime(), end: addMonths(m, 1).getTime() };
  }, [anchor]);

  useEffect(() => {
    store.source.loadOverrides().then(setOverrides, () => {});
  }, [store]);

  /** Pins an app to a category (or back to automatic with null), saved by the agent. */
  const setOverride = (process: string, category: Category | null) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (category) next[process] = category;
      else delete next[process];
      store.source.saveOverrides(next).catch(() => setError("Couldn't save that category choice."));
      return next;
    });
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
        else setError("Couldn't reach the Dopamine agent. Is it running?");
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
        else setError("Lost connection to the Dopamine agent.");
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
    () => makeClassifier((p) => store.app(p), overrides),
    // `version` bumps when new app metadata may have arrived.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, overrides, version],
  );

  const data = useMemo<DashboardData | null>(() => {
    if (version === 0) return null;
    const segments = buildSegments(store.slice(range), range, now, classify);
    const summary = summarize(segments, range);
    // While a period is still running, compare against the same elapsed span of the previous one
    // (today until 4pm vs yesterday until 4pm), not the whole previous period.
    const elapsed = now - range.start;
    const prev = elapsed > 0 && elapsed < range.end - range.start ? { start: prevRange.start, end: Math.min(prevRange.end, prevRange.start + elapsed) } : prevRange;
    const prevSegs = buildSegments(store.slice(prev), prev, now, classify);
    const previous = prevSegs.length ? summarize(prevSegs, prev) : null;
    const profile = hourOfDayProfile(segments);
    const monthSegs = buildSegments(store.slice(monthRange), monthRange, now, classify);
    const icons: Record<string, string> = {};
    for (const a of summary.apps) {
      const icon = store.app(a.process)?.icon;
      if (icon) icons[a.process] = icon;
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
    // `version` bumps whenever the store's contents change.
  }, [store, version, view, range, prevRange, monthRange, now, classify]);

  return { data, loading, error, now, overrides, setOverride };
}
