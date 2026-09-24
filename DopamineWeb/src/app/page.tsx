"use client";

import { useCallback, useEffect, useState } from "react";
import { Dashboard } from "@/components/Dashboard";
import { PairScreen } from "@/components/PairScreen";
import { Logo } from "@/components/ui";
import { DemoSource } from "@/lib/demo";
import { AgentInfo, AgentSource, EventStore, clearPairing, defaultAgentUrl, identify, loadPairing, savePairing, verifyCode } from "@/lib/source";

type State = { kind: "booting" } | { kind: "pairing" } | { kind: "ready"; store: EventStore };

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

  const connect = useCallback((url: string, code: string, info: AgentInfo) => {
    savePairing({ url, code });
    setState({ kind: "ready", store: new EventStore(new AgentSource(url, code, info)) });
  }, []);

  useEffect(() => {
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

  if (state.kind === "booting") {
    return (
      <div className="grid min-h-screen place-items-center">
        <Logo className="size-10 animate-pulse" />
      </div>
    );
  }
  if (state.kind === "pairing") {
    return <PairScreen onPaired={connect} onDemo={() => setState({ kind: "ready", store: new EventStore(new DemoSource()) })} />;
  }
  return <Dashboard store={state.store} onDisconnect={disconnect} />;
}
