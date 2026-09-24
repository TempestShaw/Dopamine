"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { DataSource } from "./source";

// Icons rarely change, so each process name is fetched once per data source and kept for the session.
const cache = new WeakMap<DataSource, Map<string, string | null>>();

function cacheFor(source: DataSource) {
  let map = cache.get(source);
  if (!map) {
    map = new Map();
    cache.set(source, map);
  }
  return map;
}

/** Returns data: URLs for the given process names, fetching any that aren't cached yet in one request. */
export function useAppIcons(source: DataSource, processNames: string[]): Record<string, string> {
  const key = [...new Set(processNames)].sort().join("\n");
  const [, force] = useState(0);

  useEffect(() => {
    const map = cacheFor(source);
    const missing = (key ? key.split("\n") : []).filter((n) => !map.has(n));
    if (missing.length === 0 || !source.fetchIcons) return;
    for (const n of missing) map.set(n, null); // in flight; stays null if the agent has no icon
    source
      .fetchIcons(missing)
      .then((icons) => {
        for (const [n, url] of Object.entries(icons)) map.set(n, url);
        force((v) => v + 1);
      })
      .catch(() => {
        for (const n of missing) map.delete(n); // retry on a later render
      });
  }, [source, key]);

  const map = cacheFor(source);
  const out: Record<string, string> = {};
  for (const n of processNames) {
    const url = map.get(n);
    if (url) out[n] = url;
  }
  return out;
}

export const IconContext = createContext<Record<string, string>>({});

export function useIcon(process: string): string | undefined {
  return useContext(IconContext)[process];
}
