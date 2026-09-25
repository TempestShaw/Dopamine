"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Dashboard } from "@/components/Dashboard";
import { PairScreen } from "@/components/PairScreen";
import { Logo } from "@/components/ui";
import { DemoSource } from "@/lib/demo";
import { I18nContext, Locale, detectLocale, saveLocale } from "@/lib/i18n";
import { setTimeLocale } from "@/lib/time";
import { AgentInfo, AgentSource, EventStore, clearPairing, defaultAgentUrl, identify, loadPairing, savePairing, verifyCode } from "@/lib/source";

type State = { kind: "booting" } | { kind: "pairing" } | { kind: "ready"; store: EventStore };

/** Set by the standalone preview build (scripts/build-preview.ts): open straight into sample data. */
const isPreview = () => typeof window !== "undefined" && (window as { __DOPAMINE_PREVIEW__?: boolean }).__DOPAMINE_PREVIEW__ === true;

/**
 * Reads a pairing handed over by the agent's "Open Dashboard" menu item
 * (`#pair=CODE`, optionally `&agent=URL`) and removes it from the address bar.
 */
function takeHashPairing(): { code: string; url?: string } | null {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const code = hash.get("pair");
  if (!code) return null;
  history.replaceState(null, "", window.location.pathname + window.location.search);
  return { code, url: hash.get("agent") ?? undefined };
}

export default function Home() {
  const [state, setState] = useState<State>({ kind: "booting" });
  // Held here, above everything, so a change re-renders the whole page in the new language.
  const [locale, setLocaleState] = useState<Locale>(() => {
    const l = detectLocale();
    setTimeLocale(l);
    return l;
  });
  const i18n = useMemo(
    () => ({
      locale,
      setLocale: (l: Locale) => {
        setTimeLocale(l);
        saveLocale(l);
        setLocaleState(l);
      },
    }),
    [locale],
  );
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const connect = useCallback((url: string, code: string, info: AgentInfo) => {
    savePairing({ url, code });
    setState({ kind: "ready", store: new EventStore(new AgentSource(url, code, info)) });
  }, []);

  useEffect(() => {
    if (isPreview()) {
      setState({ kind: "ready", store: new EventStore(new DemoSource()) });
      return;
    }
    (async () => {
      const handed = takeHashPairing();
      const saved = loadPairing();
      const candidates = [handed && { url: handed.url ?? defaultAgentUrl(), code: handed.code }, saved].filter(Boolean) as { url: string; code: string }[];
      for (const c of candidates) {
        const info = await identify(c.url);
        if (info && (await verifyCode(c.url, c.code))) return connect(c.url, c.code, info);
      }
      setState({ kind: "pairing" });
    })();
  }, [connect]);

  const disconnect = useCallback(() => {
    clearPairing();
    setState({ kind: "pairing" });
  }, []);

  return (
    <I18nContext.Provider value={i18n}>
      {state.kind === "booting" ? (
        <div className="grid min-h-screen place-items-center">
          <Logo className="size-12 animate-pulse" />
        </div>
      ) : state.kind === "pairing" ? (
        <PairScreen onPaired={connect} onDemo={() => setState({ kind: "ready", store: new EventStore(new DemoSource()) })} />
      ) : (
        <Dashboard store={state.store} onDisconnect={disconnect} />
      )}
    </I18nContext.Provider>
  );
}
