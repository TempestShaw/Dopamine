"use client";

import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { CATEGORY_META } from "@/lib/categories";
import { useT } from "@/lib/i18n";
import { formatDuration } from "@/lib/time";
import type { Today } from "@/lib/useDashboard";
import { AppAvatar } from "./ui";

const MINUTE = 60_000;

/** Today, whatever date is on screen: what's in front now, today's goals, and a focus timer. */
export function Sidebar({ today, now }: { today: Today | null; now: number }) {
  return (
    <aside className="scroll-thin hidden w-64 shrink-0 flex-col gap-2 overflow-y-auto px-2 pb-2 md:flex">
      <NowCard today={today} now={now} />
      <GoalsCard today={today} />
      <FocusTimer />
    </aside>
  );
}

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-paper/60 p-3.5">
      <header className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="label">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function NowCard({ today, now }: { today: Today | null; now: number }) {
  const t = useT();
  const current = today?.current;
  return (
    <Card title={t.now.title}>
      {current ? (
        <div className="flex items-center gap-3">
          <AppAvatar app={current.app} process={current.process} category={current.category} />
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold text-ink">{current.app}</div>
            <div className="text-[12px] text-graphite">{t.now.for(formatDuration(Math.max(now - current.since, MINUTE)))}</div>
          </div>
        </div>
      ) : (
        <div className="text-[13px] text-faint">{t.now.idle}</div>
      )}
      {today && <div className="mt-2.5 border-t border-line pt-2 text-[12px] text-graphite">{t.now.today(formatDuration(today.total))}</div>}
    </Card>
  );
}

type Goals = { limit: number; focus: number }; // minutes; 0 is off
const GOALS_KEY = "dopamine.goals";
const DEFAULT_GOALS: Goals = { limit: 6 * 60, focus: 3 * 60 };

function loadGoals(): Goals {
  try {
    const g = JSON.parse(localStorage.getItem(GOALS_KEY) ?? "null");
    if (g && Number.isFinite(g.limit) && Number.isFinite(g.focus)) return { limit: Math.max(0, g.limit), focus: Math.max(0, g.focus) };
  } catch {}
  return DEFAULT_GOALS;
}

function GoalsCard({ today }: { today: Today | null }) {
  const t = useT();
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);
  const [editing, setEditing] = useState(false);
  useEffect(() => setGoals(loadGoals()), []);

  const save = (g: Goals) => {
    setGoals(g);
    setEditing(false);
    try {
      localStorage.setItem(GOALS_KEY, JSON.stringify(g));
    } catch {}
  };

  return (
    <Card
      title={t.goals.title}
      action={
        !editing && (
          <button type="button" onClick={() => setEditing(true)} className="text-[12px] font-semibold text-accent hover:underline">
            {t.goals.edit}
          </button>
        )
      }
    >
      {editing ? (
        <GoalsForm goals={goals} onSave={save} onCancel={() => setEditing(false)} />
      ) : !goals.limit && !goals.focus ? (
        <div className="text-[12.5px] text-faint">{t.goals.none}</div>
      ) : (
        <div className="space-y-3">
          <Goal
            label={t.goals.limit}
            target={goals.limit}
            value={today?.total ?? 0}
            color="var(--accent)"
            status={(v, target) => (v > target ? t.goals.over(formatDuration(v - target)) : t.goals.left(formatDuration(target - v)))}
            warnWhenOver
          />
          <Goal
            label={t.goals.focus}
            target={goals.focus}
            value={today?.focus ?? 0}
            color={CATEGORY_META.study.color}
            status={(v, target) => (v >= target ? t.goals.reached : t.goals.toGo(formatDuration(target - v)))}
          />
        </div>
      )}
    </Card>
  );
}

function Goal({
  label,
  target,
  value,
  color,
  status,
  warnWhenOver,
}: {
  label: string;
  target: number;
  value: number;
  color: string;
  status: (value: number, target: number) => string;
  warnWhenOver?: boolean;
}) {
  const t = useT();
  const targetMs = target * MINUTE;
  const share = targetMs ? Math.min(1, value / targetMs) : 0;
  const over = warnWhenOver && targetMs > 0 && value > targetMs;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
        <span className="text-graphite">{label}</span>
        <span className="num font-semibold text-ink">{targetMs ? formatDuration(targetMs) : t.goals.off}</span>
      </div>
      {targetMs > 0 && (
        <>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/[0.08]">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${share * 100}%`, background: over ? "var(--warn)" : color }}
            />
          </div>
          <div className={`mt-1 text-[11.5px] ${over ? "font-semibold text-warn" : "text-faint"}`}>{status(value, targetMs)}</div>
        </>
      )}
    </div>
  );
}

function GoalsForm({ goals, onSave, onCancel }: { goals: Goals; onSave: (g: Goals) => void; onCancel: () => void }) {
  const t = useT();
  const [limit, setLimit] = useState(goals.limit ? String(goals.limit / 60) : "");
  const [focus, setFocus] = useState(goals.focus ? String(goals.focus / 60) : "");
  // An empty field, or 0, means no target.
  const minutes = (v: string) => Math.round(Math.min(24, Math.max(0, Number(v) || 0)) * 60);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave({ limit: minutes(limit), focus: minutes(focus) });
  };
  const field = (label: string, value: string, set: (v: string) => void, fallback: number) => {
    const none = minutes(value) === 0;
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2 text-[12.5px] text-graphite">
          <span>{label}</span>
          <span className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={24}
              step={0.5}
              value={value}
              placeholder="–"
              aria-label={label}
              onChange={(e) => set(e.target.value)}
              className="num w-14 rounded-md border border-line bg-chrome px-1.5 py-1 text-right text-ink outline-none placeholder:text-faint focus:border-accent"
            />
            {t.goals.hours}
          </span>
        </div>
        <label className="flex items-center justify-end gap-1.5 text-[11.5px] text-faint">
          <input type="checkbox" checked={none} onChange={(e) => set(e.target.checked ? "" : String(fallback / 60))} className="accent-[var(--accent)]" />
          {t.goals.off}
        </label>
      </div>
    );
  };
  return (
    <form onSubmit={submit} className="space-y-2.5">
      {field(t.goals.limit, limit, setLimit, goals.limit || DEFAULT_GOALS.limit)}
      {field(t.goals.focus, focus, setFocus, goals.focus || DEFAULT_GOALS.focus)}
      <div className="flex justify-end gap-1.5 pt-1 text-[12.5px]">
        <button type="button" onClick={onCancel} className="rounded-md px-2 py-1 text-graphite hover:bg-ink/[0.06] hover:text-ink">
          {t.goals.cancel}
        </button>
        <button type="submit" className="rounded-md bg-ink px-2.5 py-1 font-semibold text-paper hover:opacity-90">
          {t.goals.save}
        </button>
      </div>
    </form>
  );
}

/** A running timer keeps its end time, so it carries on while the window is closed. */
type Timer = { length: number; endAt: number | null; left: number | null; done?: boolean };
const TIMER_KEY = "dopamine.timer";
const LENGTHS = [25, 50];

function loadTimer(): Timer {
  try {
    const t = JSON.parse(localStorage.getItem(TIMER_KEY) ?? "null");
    if (t && LENGTHS.includes(t.length)) return { length: t.length, endAt: t.endAt ?? null, left: t.left ?? null };
  } catch {}
  return { length: LENGTHS[0], endAt: null, left: null };
}

function FocusTimer() {
  const t = useT();
  const [timer, setTimerState] = useState<Timer>({ length: LENGTHS[0], endAt: null, left: null });
  const [clock, setClock] = useState(() => Date.now());
  const chimed = useRef(false);
  useEffect(() => setTimerState(loadTimer()), []);

  const setTimer = (next: Timer) => {
    setTimerState(next);
    try {
      localStorage.setItem(TIMER_KEY, JSON.stringify(next));
    } catch {}
  };

  const running = timer.endAt !== null;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setClock(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);

  const total = timer.length * MINUTE;
  const left = timer.endAt !== null ? Math.max(0, timer.endAt - clock) : (timer.left ?? total);
  const finished = timer.endAt !== null && left === 0;

  useEffect(() => {
    if (!finished) {
      chimed.current = false;
      return;
    }
    if (chimed.current) return;
    chimed.current = true;
    chime();
    setTimer({ length: timer.length, endAt: null, left: null, done: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  const start = () => setTimer({ length: timer.length, endAt: Date.now() + left, left: null });
  const pause = () => setTimer({ length: timer.length, endAt: null, left });
  const reset = () => setTimer({ length: timer.length, endAt: null, left: null });
  const idle = !running && timer.left === null;

  const mm = Math.floor(left / MINUTE);
  const ss = Math.floor((left % MINUTE) / 1000);
  const r = 34;
  const c = 2 * Math.PI * r;

  return (
    <Card title={t.timer.title}>
      <div className="flex items-center gap-3.5">
        <div className="relative grid size-20 shrink-0 place-items-center">
          <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-ink/[0.08]" />
            <circle
              cx="40"
              cy="40"
              r={r}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (left / total)}
              className="transition-[stroke-dashoffset] duration-300"
            />
          </svg>
          <span className="num text-[17px] font-extrabold text-ink">
            {mm}:{String(ss).padStart(2, "0")}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {idle && (
            <div className="flex gap-1">
              {LENGTHS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setTimer({ length: n, endAt: null, left: null })}
                  className={`flex-1 rounded-md px-1.5 py-1 text-[12px] font-semibold transition-colors ${
                    timer.length === n ? "bg-ink/[0.08] text-ink" : "text-graphite hover:bg-ink/[0.05]"
                  }`}
                >
                  {t.timer.minutes(n)}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-1">
            <button
              type="button"
              onClick={running ? pause : start}
              className="flex-1 rounded-md bg-accent px-2 py-1 text-[12.5px] font-semibold text-white hover:opacity-90"
            >
              {running ? t.timer.pause : idle ? t.timer.start : t.timer.resume}
            </button>
            {!idle && (
              <button type="button" onClick={reset} className="rounded-md px-2 py-1 text-[12.5px] text-graphite hover:bg-ink/[0.06] hover:text-ink">
                {t.timer.reset}
              </button>
            )}
          </div>
        </div>
      </div>
      {timer.done && idle && <div className="mt-2.5 text-[12.5px] font-semibold text-accent">{t.timer.done}</div>}
    </Card>
  );
}

/** Two soft notes, so the end of a focus block is heard even with the window in the background. */
function chime() {
  try {
    const ctx = new AudioContext();
    [880, 1318.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      const at = ctx.currentTime + i * 0.28;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.18, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.9);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 1);
    });
    setTimeout(() => ctx.close(), 2000);
  } catch {}
}
