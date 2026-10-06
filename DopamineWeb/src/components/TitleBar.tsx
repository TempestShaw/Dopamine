"use client";

import { ReactNode, useEffect, useState } from "react";
import { useAppBehaviour, useWindowFrame } from "@/lib/desktop";
import { LOCALES, Locale, useI18n, useT } from "@/lib/i18n";
import { Logo, Moon, Sun } from "./ui";

/**
 * The window: a title bar across the top, like Discord's or VS Code's, and the app below it. In the
 * dashboard window the bar moves the window and holds the minimise, maximise and close buttons;
 * in a browser it is just the app's top bar.
 */
export function AppFrame({ brand, left, right, children }: { brand?: ReactNode; left?: ReactNode; right?: ReactNode; children: ReactNode }) {
  useAppBehaviour();
  return (
    <div className="flex h-full flex-col">
      <TitleBar brand={brand} left={left} right={right} />
      <div className="flex min-h-0 flex-1">{children}</div>
    </div>
  );
}

function TitleBar({ brand, left, right }: { brand?: ReactNode; left?: ReactNode; right?: ReactNode }) {
  const frame = useWindowFrame();
  return (
    <header className="drag flex h-10 shrink-0 items-center text-[13px]">
      {/* Room for the Mac window's traffic lights (DopamineMac/DashboardWindow.swift places them). */}
      <div className={`flex items-center gap-2 pr-3 ${frame.trafficLights ? "pl-20" : "pl-3.5"}`}>
        <Logo className="size-[18px]" />
        <span className="hidden font-semibold text-ink sm:inline">Dopamine</span>
        {brand}
      </div>
      {left && <div className="flex items-center gap-1">{left}</div>}
      <div className="min-w-4 flex-1 self-stretch" />
      {right && <div className="flex items-center gap-1 pr-2">{right}</div>}
      {frame.custom && <WindowControls {...frame} />}
    </header>
  );
}

function WindowControls({ maximized, minimize, toggleMaximize, close }: ReturnType<typeof useWindowFrame>) {
  const t = useT();
  return (
    <div className="no-drag flex self-stretch">
      <button type="button" tabIndex={-1} className="caption-button" aria-label={t.window.minimize} title={t.window.minimize} onClick={minimize}>
        <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden>
          <path d="M0 5.5h10" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
      <button
        type="button"
        tabIndex={-1}
        className="caption-button"
        aria-label={maximized ? t.window.restore : t.window.maximize}
        title={maximized ? t.window.restore : t.window.maximize}
        onClick={toggleMaximize}
      >
        <svg viewBox="0 0 10 10" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden>
          {maximized ? (
            <>
              <rect x="0.5" y="2.5" width="7" height="7" rx="1" />
              <path d="M2.5 2.5V1.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1" />
            </>
          ) : (
            <rect x="0.5" y="0.5" width="9" height="9" rx="1.2" />
          )}
        </svg>
      </button>
      <button type="button" tabIndex={-1} className="caption-button close" aria-label={t.window.close} title={t.window.close} onClick={close}>
        <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden>
          <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
    </div>
  );
}

const BAR_BUTTON =
  "no-drag grid size-8 place-items-center rounded-md text-graphite transition-colors hover:bg-ink/[0.06] hover:text-ink active:bg-ink/10 disabled:pointer-events-none disabled:opacity-35";

/** A small square button for the title bar. */
export function BarButton({ label, onClick, disabled, pressed, children }: { label: string; onClick: () => void; disabled?: boolean; pressed?: boolean; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={pressed} onClick={onClick} disabled={disabled} className={BAR_BUTTON}>
      {children}
    </button>
  );
}

/** Two or three choices in a pill, the selected one raised, like a segmented switch. */
export function PillTabs<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="no-drag ml-1 flex h-8 items-center gap-0.5 rounded-lg bg-ink/[0.06] p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`h-full min-w-10 rounded-md px-2.5 text-[12.5px] font-semibold transition-colors ${
              active ? "bg-paper text-ink shadow-[0_1px_2px_rgba(0,0,0,0.12)]" : "text-graphite hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** English, 简体 or 繁體. A native select: tiny, keyboard-friendly, and right on every platform. */
export function LanguagePicker() {
  const { locale, setLocale } = useI18n();
  const t = useT();
  const current = LOCALES.find((l) => l.value === locale)!;
  return (
    <label className={`${BAR_BUTTON} relative w-auto min-w-8 px-1.5 text-[12.5px] font-semibold focus-within:bg-ink/[0.06]`} title={t.language}>
      <span aria-hidden>{current.short}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label={t.language}
        className="absolute inset-0 cursor-default appearance-none opacity-0"
      >
        {LOCALES.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ThemeToggle() {
  const t = useT();
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  useEffect(() => {
    // No attribute means "follow the system".
    const set = document.documentElement.dataset.theme;
    setTheme(set === "dark" || set === "light" ? set : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("dopamine.theme", next);
    } catch {}
    setTheme(next);
  };
  return (
    <BarButton label={theme === "dark" ? t.themeLight : t.themeDark} onClick={toggle}>
      {theme === "dark" ? <Sun /> : <Moon />}
    </BarButton>
  );
}

/** A title bar for screens without a dashboard yet (connecting, or pairing). */
export function PlainFrame({ children }: { children: ReactNode }) {
  return (
    <AppFrame
      right={
        <>
          <LanguagePicker />
          <ThemeToggle />
        </>
      }
    >
      {children}
    </AppFrame>
  );
}
