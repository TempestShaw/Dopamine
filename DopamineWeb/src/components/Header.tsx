"use client";

import { useEffect, useState } from "react";
import { Platform } from "@/lib/source";
import { View, periodLabel } from "@/lib/time";
import { Apple, ChevronLeft, ChevronRight, IconButton, Logo, Logout, Moon, Segmented, Sun, Windows } from "./ui";

const PLATFORM_LABEL: Record<Platform, string> = { windows: "Windows", mac: "macOS", demo: "sample data" };

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
  return (
    <header className="mx-auto max-w-[1180px] px-4 pt-6 sm:px-8 sm:pt-8">
      <div className="flex items-center gap-3">
        <Logo className="size-9" />
        <span className="serif text-[28px] leading-none italic">Dopamine</span>
        <span className="hand ml-1 hidden translate-y-0.5 text-lg text-graphite sm:inline" title={version}>
          {platform === "mac" && <Apple className="mr-1 inline size-3.5 -translate-y-0.5" />}
          {platform === "windows" && <Windows className="mr-1 inline size-3 -translate-y-0.5" />}
          {PLATFORM_LABEL[platform]}
          {loading && " · …"}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <IconButton label={platform === "demo" ? "Leave sample data" : "Disconnect"} onClick={onDisconnect}>
            <Logout />
          </IconButton>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="flex items-center gap-2">
          <IconButton label="Previous" onClick={() => onShift(-1)}>
            <ChevronLeft />
          </IconButton>
          <h1 className="serif min-w-0 text-[34px] leading-none whitespace-nowrap sm:text-[44px]">{periodLabel(view, anchor)}</h1>
          <IconButton label="Next" onClick={() => onShift(1)}>
            <ChevronRight />
          </IconButton>
          {!isCurrent && (
            <button type="button" onClick={onToday} className="hand ml-1 text-xl text-graphite underline decoration-line underline-offset-4 hover:text-ink">
              back to {view === "day" ? "today" : view === "week" ? "this week" : "this month"}
            </button>
          )}
        </div>
        <Segmented<View>
          value={view}
          onChange={onView}
          options={[
            { value: "day", label: "Day" },
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
          ]}
        />
      </div>
    </header>
  );
}

export function ThemeToggle() {
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
    <IconButton label={theme === "dark" ? "Paper (light)" : "Canvas (dark)"} onClick={toggle}>
      {theme === "dark" ? <Sun /> : <Moon />}
    </IconButton>
  );
}
