"use client";

import { useEffect, useState } from "react";
import { LOCALES, Locale, useI18n, useT } from "@/lib/i18n";
import { Platform } from "@/lib/source";
import { View, periodLabel } from "@/lib/time";
import { Apple, ChevronLeft, ChevronRight, IconButton, Logo, Logout, Moon, Segmented, Sun, Windows } from "./ui";

export function Header({
  view,
  anchor,
  isCurrent,
  platform,
  version,
  loading,
  onView,
  onShift,
  onToday,
  onDisconnect,
}: {
  view: View;
  anchor: Date;
  isCurrent: boolean;
  platform: Platform;
  version: string;
  loading: boolean;
  onView: (v: View) => void;
  onShift: (dir: number) => void;
  onToday: () => void;
  onDisconnect: () => void;
}) {
  const t = useT();
  return (
    <header className="mx-auto max-w-[1180px] px-4 pt-6 sm:px-8 sm:pt-8">
      <div className="flex items-center gap-3">
        <Logo className="size-9" />
        <span className="serif text-[28px] leading-none italic">Dopamine</span>
        <span className="hand ml-1 hidden translate-y-0.5 text-lg text-graphite sm:inline" title={version}>
          {platform === "mac" && <Apple className="mr-1 inline size-3.5 -translate-y-0.5" />}
          {platform === "windows" && <Windows className="mr-1 inline size-3 -translate-y-0.5" />}
          {t.platform[platform]}
          {loading && " · …"}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <LanguagePicker />
          <ThemeToggle />
          <IconButton label={platform === "demo" ? t.leaveDemo : t.disconnect} onClick={onDisconnect}>
            <Logout />
          </IconButton>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="flex items-center gap-2">
          <IconButton label={t.previous} onClick={() => onShift(-1)}>
            <ChevronLeft />
          </IconButton>
          <h1 className="serif min-w-0 text-[34px] leading-none whitespace-nowrap sm:text-[44px]">{periodLabel(view, anchor)}</h1>
          <IconButton label={t.next} onClick={() => onShift(1)}>
            <ChevronRight />
          </IconButton>
          {!isCurrent && (
            <button type="button" onClick={onToday} className="hand ml-1 text-xl text-graphite underline decoration-line underline-offset-4 hover:text-ink">
              {t.backTo[view]}
            </button>
          )}
        </div>
        <Segmented<View>
          value={view}
          onChange={onView}
          options={(["day", "week", "month"] as const).map((v) => ({ value: v, label: t.views[v] }))}
        />
      </div>
    </header>
  );
}

/** English, 简体 or 繁體. A native select: tiny, keyboard-friendly, and right on every platform. */
export function LanguagePicker() {
  const { locale, setLocale } = useI18n();
  const t = useT();
  const current = LOCALES.find((l) => l.value === locale)!;
  return (
    <label className="dab relative grid h-9 min-w-9 place-items-center px-2 text-[13px] font-semibold text-graphite transition-colors focus-within:bg-wash hover:bg-wash hover:text-ink" title={t.language}>
      <span aria-hidden>{current.short}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label={t.language}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
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
    <IconButton label={theme === "dark" ? t.themeLight : t.themeDark} onClick={toggle}>
      {theme === "dark" ? <Sun /> : <Moon />}
    </IconButton>
  );
}
