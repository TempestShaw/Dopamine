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
}

const LIVE_REFRESH_MS = 30_000;

export function useDashboard(store: EventStore, view: View, anchor: Date, onAuthError: () => void) {
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const authRef = useRef(onAuthError);
  authRef.current = onAuthError;

  const range = useMemo(() => rangeFor(view, anchor), [view, anchor]);
  const prevRange = useMemo(() => rangeFor(view, previousAnchor(view, anchor)), [view, anchor]);
  const monthRange = useMemo(() => {
    const m = startOfMonth(anchor);
    return { start: m.getTime(), end: addMonths(m, 1).getTime() };
  }, [anchor]);

  // Load everything the current view needs; the store caches by month, so this is usually instant.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const all = { start: Math.min(prevRange.start, monthRange.start), end: Math.max(range.end, monthRange.end) };
    store
      .ensure(all)
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

  const data = useMemo<DashboardData | null>(() => {
    if (version === 0) return null;
    const segments = buildSegments(store.slice(range), range, now);
    const summary = summarize(segments, range);
    // While a period is still running, compare against the same elapsed span of the previous one
    // (today until 4pm vs yesterday until 4pm), not the whole previous period.
    const elapsed = now - range.start;
    const prev = elapsed > 0 && elapsed < range.end - range.start ? { start: prevRange.start, end: Math.min(prevRange.end, prevRange.start + elapsed) } : prevRange;
    const prevSegs = buildSegments(store.slice(prev), prev, now);
    const previous = prevSegs.length ? summarize(prevSegs, prev) : null;
    const profile = hourOfDayProfile(segments);
    const monthSegs = buildSegments(store.slice(monthRange), monthRange, now);
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
    };
    // `version` bumps whenever the store's contents change.
  }, [store, version, view, range, prevRange, monthRange, now]);

  return { data, loading, error, now };
}
