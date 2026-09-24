"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { AgentInfo, defaultAgentUrl, identify, platformOf, verifyCode } from "@/lib/source";
import { Apple, Logo, Windows } from "./ui";
import { ThemeToggle } from "./Header";

const RELEASES = "https://github.com/TempestShaw/Dopamine/releases/latest";
const CODE_LEN = 6;

type Status = "probing" | "found" | "missing";

export function PairScreen({ onPaired, onDemo }: { onPaired: (url: string, code: string, info: AgentInfo) => void; onDemo: () => void }) {
  const [url, setUrl] = useState(defaultAgentUrl);
  const [status, setStatus] = useState<Status>("probing");
  const [info, setInfo] = useState<AgentInfo | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editUrl, setEditUrl] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const probe = async (target: string) => {
    setStatus("probing");
    const found = await identify(target);
    setInfo(found);
    setStatus(found ? "found" : "missing");
    if (found) setTimeout(() => input.current?.focus(), 50);
  };

  useEffect(() => {
    probe(url);
    // Keep looking in the background so the page reacts once the agent is started.
    const id = setInterval(() => {
      if (!document.hidden) identify(url).then((f) => f && (setInfo(f), setStatus("found")));
    }, 4000);
    return () => clearInterval(id);
  }, [url]);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!info || code.length !== CODE_LEN) return;
    setBusy(true);
    setError(null);
    const ok = await verifyCode(url, code);
    setBusy(false);
    if (ok) onPaired(url, code, info);
    else setError("That code didn't work. Check the Dopamine menu for the current code.");
  };

  const platform = info ? platformOf(info) : null;

  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--accent)_18%,transparent),transparent)]" />
      </div>

      <main className="relative z-10 m-auto w-full max-w-md px-5 py-16">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="size-12" />
          <h1 className="mt-5 text-3xl font-semibold tracking-tight">Rediscover your time</h1>
          <p className="mt-2 text-[15px] text-muted">Dopamine quietly notes which app is in front, keeps it on your computer, and shows you where the hours went.</p>
        </div>

        <div className="card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="relative flex size-2.5">
              {status === "probing" && <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />}
              <span className={`relative inline-flex size-2.5 rounded-full ${status === "found" ? "bg-good" : status === "missing" ? "bg-faint" : "bg-accent"}`} />
            </span>
            <div className="min-w-0 flex-1 text-sm">
              {status === "found" && info ? (
                <span>
                  Found <b className="font-semibold">Dopamine for {platform === "mac" ? "macOS" : "Windows"}</b> <span className="text-faint">v{info.version}</span>
                </span>
              ) : status === "missing" ? (
                <span className="text-muted">No Dopamine agent running on this computer</span>
              ) : (
                <span className="text-muted">Looking for Dopamine…</span>
              )}
            </div>
            <button type="button" onClick={() => setEditUrl((v) => !v)} className="text-xs text-faint hover:text-muted">
              {editUrl ? "Done" : "Change address"}
            </button>
          </div>

          {editUrl && (
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                probe(url);
              }}
            >
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-[13px] outline-none focus:border-accent"
                spellCheck={false}
              />
              <button className="rounded-lg border border-border px-3 text-sm hover:bg-surface-2">Check</button>
            </form>
          )}

          {status === "found" ? (
            <form onSubmit={submit} className="mt-6">
              <label htmlFor="code" className="text-sm font-medium">
                Pairing code
              </label>
              <p className="mt-0.5 text-xs text-muted">
                Click the Dopamine icon in your {platform === "mac" ? "menu bar" : "system tray"} to see it.
              </p>
              <div className="relative mt-3" onClick={() => input.current?.focus()}>
                <input
                  id="code"
                  ref={input}
                  value={code}
                  onChange={(e) => {
                    const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LEN);
                    setCode(v);
                    setError(null);
                  }}
                  autoComplete="one-time-code"
                  inputMode="text"
                  className="absolute inset-0 opacity-0"
                  aria-label="Pairing code"
                />
                <div className="grid grid-cols-6 gap-2" aria-hidden>
                  {Array.from({ length: CODE_LEN }, (_, i) => (
                    <div
                      key={i}
                      className={`grid h-12 place-items-center rounded-lg border font-mono text-xl font-semibold transition-colors ${
                        i === code.length ? "border-accent bg-accent-soft/40" : "border-border bg-surface-2"
                      }`}
                    >
                      {code[i] ?? ""}
                    </div>
                  ))}
                </div>
              </div>
              {error && <p className="mt-3 text-sm text-warn">{error}</p>}
              <button
                disabled={code.length !== CODE_LEN || busy}
                className="mt-5 w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {busy ? "Connecting…" : "Connect"}
              </button>
            </form>
          ) : (
            <div className="mt-6 space-y-3">
              <p className="text-sm text-muted">Install the Dopamine agent, then come back — this page connects automatically.</p>
              <div className="grid grid-cols-2 gap-2">
                <a href={RELEASES} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-sm font-medium hover:bg-surface-2">
                  <Apple /> macOS
                </a>
                <a href={RELEASES} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-sm font-medium hover:bg-surface-2">
                  <Windows className="size-3.5" /> Windows
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted">
          Just looking?
          <button type="button" onClick={onDemo} className="font-medium text-accent hover:underline">
            Explore with demo data
          </button>
        </div>
      </main>
    </div>
  );
}
