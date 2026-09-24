"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { AgentInfo, defaultAgentUrl, identify, platformOf, verifyCode } from "@/lib/source";
import { LanguagePicker, ThemeToggle } from "./Header";
import { Apple, Logo, Rule, Stroke, Windows } from "./ui";

const RELEASES = "https://github.com/TempestShaw/Dopamine/releases/latest";
const CODE_LEN = 6;

type Status = "probing" | "found" | "missing";

/** Loose paint dabs behind the title, one per category colour. */
function Palette() {
  const dabs = [
    { c: "var(--cat-social)", x: 8, y: 18, r: 58 },
    { c: "var(--highlight)", x: 34, y: 6, r: 44 },
    { c: "var(--cat-work)", x: 62, y: 22, r: 54 },
    { c: "var(--cat-study)", x: 86, y: 8, r: 38 },
    { c: "var(--cat-entertainment)", x: 22, y: 64, r: 40 },
    { c: "var(--cat-other)", x: 76, y: 66, r: 34 },
  ];
  return (
    <svg viewBox="0 0 100 90" className="paint pointer-events-none absolute -inset-x-10 -top-14 h-52 w-[calc(100%+5rem)] opacity-35" preserveAspectRatio="none" aria-hidden>
      {dabs.map((d, i) => (
        <ellipse key={i} cx={d.x} cy={d.y} rx={d.r / 4} ry={d.r / 5.5} fill={d.c} transform={`rotate(${i * 23 - 30} ${d.x} ${d.y})`} />
      ))}
    </svg>
  );
}

export function PairScreen({ onPaired, onDemo }: { onPaired: (url: string, code: string, info: AgentInfo) => void; onDemo: () => void }) {
  const [url, setUrl] = useState(defaultAgentUrl);
  const [status, setStatus] = useState<Status>("probing");
  const [info, setInfo] = useState<AgentInfo | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editUrl, setEditUrl] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const t = useT();

  const probe = async (target: string) => {
    setStatus("probing");
    const found = await identify(target);
    setInfo(found);
    setStatus(found ? "found" : "missing");
    if (found) setTimeout(() => input.current?.focus(), 50);
  };

  useEffect(() => {
    probe(url);
    // Keep looking so the page reacts once the agent is started.
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
    else setError(t.pair.wrong);
  };

  const platform = info ? platformOf(info) : null;

  return (
    <div className="relative flex min-h-screen flex-col px-4">
      <div className="absolute top-5 right-5 flex items-center gap-1">
        <LanguagePicker />
        <ThemeToggle />
      </div>

      <main className="relative m-auto w-full max-w-[440px] py-16">
        <div className="relative mb-10">
          <Palette />
          <Logo className="relative size-12" />
          <h1 className="serif relative mt-6 text-[56px] leading-[0.95]">
            {t.pair.title[0]}
            <br />
            <span className="italic">{t.pair.title[1]}</span>
          </h1>
          <p className="relative mt-5 max-w-[36ch] text-[15px] leading-relaxed text-graphite">
            {t.pair.intro}
          </p>
        </div>

        <div className="sketch px-6 py-6">
          <div className="flex items-center gap-3 text-[14px]">
            <span className="dab size-2.5 shrink-0" style={{ background: status === "found" ? "var(--good)" : status === "missing" ? "var(--faint)" : "var(--highlight)" }} />
            <div className="min-w-0 flex-1">
              {status === "found" && info ? (
                <>
                  {t.pair.found(
                    <b key="os" className="font-semibold">
                      {t.pair.agentName(platform === "mac")}
                    </b>,
                    info.version,
                  )}
                </>
              ) : status === "missing" ? (
                <span className="text-graphite">{t.pair.missing}</span>
              ) : (
                <span className="text-graphite">{t.pair.looking}</span>
              )}
            </div>
            <button type="button" onClick={() => setEditUrl((v) => !v)} className="hand text-lg text-faint hover:text-graphite">
              {editUrl ? t.pair.done : t.pair.address}
            </button>
          </div>

          {editUrl && (
            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                probe(url);
              }}
            >
              <input
                id="agent-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="min-w-0 flex-1 border-b-[1.5px] border-line bg-transparent px-1 py-1.5 font-mono text-[13px] outline-none focus:border-ink"
                spellCheck={false}
              />
              <button className="px-2 text-[14px] font-medium hover:underline">{t.pair.check}</button>
            </form>
          )}

          <Rule className="my-5" />

          {status === "found" ? (
            <form onSubmit={submit}>
              <label htmlFor="code" className="label">
                {t.pair.code}
              </label>
              <p className="mt-1 text-[13px] text-graphite">{t.pair.where(platform === "mac")}</p>
              <div className="relative mt-4" onClick={() => input.current?.focus()}>
                <input
                  id="code"
                  ref={input}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LEN));
                    setError(null);
                  }}
                  autoComplete="one-time-code"
                  className="absolute inset-0 opacity-0"
                  aria-label={t.pair.code}
                />
                <div className="grid grid-cols-6 gap-3" aria-hidden>
                  {Array.from({ length: CODE_LEN }, (_, i) => (
                    <div key={i} className="relative grid h-12 place-items-end justify-center pb-1">
                      <span className="serif text-[32px] leading-none">{code[i] ?? ""}</span>
                      <Stroke color={i === code.length ? "var(--highlight)" : "var(--line)"} className="absolute bottom-0 left-0 h-2 w-full" />
                    </div>
                  ))}
                </div>
              </div>
              {error && (
                <p className="mt-4 text-[14px]">
                  <span className="marker">{error}</span>
                </p>
              )}
              <button
                disabled={code.length !== CODE_LEN || busy}
                className="dab mt-6 w-full bg-ink py-3 text-[15px] font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-30"
              >
                {busy ? t.pair.connecting : t.pair.connect}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-[14px] text-graphite">{t.pair.install}</p>
              <div className="flex gap-6">
                <a href={RELEASES} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[15px] font-medium underline decoration-line underline-offset-4 hover:decoration-ink">
                  <Apple /> macOS
                </a>
                <a href={RELEASES} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[15px] font-medium underline decoration-line underline-offset-4 hover:decoration-ink">
                  <Windows className="size-3.5" /> Windows
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 text-center">
          <button type="button" onClick={onDemo} className="hand text-2xl text-graphite hover:text-ink">
            {t.pair.demo(
              <span key="sample" className="marker">
                {t.pair.sample}
              </span>,
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
