"use client";

import { useEffect, useState } from "react";
import { Platform } from "@/lib/source";
import { View, periodLabel } from "@/lib/time";
import { Apple, ChevronLeft, ChevronRight, IconButton, Logo, Logout, Moon, Segmented, Sun, Windows } from "./ui";

const PLATFORM_LABEL: Record<Platform, string> = { windows: "Windows", mac: "macOS", demo: "Demo data" };

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
    <header className="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight">Dopamine</span>
        </div>

        <div className="order-3 flex w-full items-center justify-between gap-3 md:order-none md:ml-6 md:w-auto md:justify-start">
          <Segmented<View>
            value={view}
            onChange={onView}
            options={[
              { value: "day", label: "Day" },
              { value: "week", label: "Week" },
              { value: "month", label: "Month" },
            ]}
          />
          <div className="flex items-center gap-1">
            <IconButton label="Previous" onClick={() => onShift(-1)}>
              <ChevronLeft />
            </IconButton>
            <span className="num min-w-24 text-center text-sm font-medium whitespace-nowrap sm:min-w-36">{periodLabel(view, anchor)}</span>
            <IconButton label="Next" onClick={() => onShift(1)}>
              <ChevronRight />
            </IconButton>
            {!isCurrent && (
              <button type="button" onClick={onToday} className="ml-1 rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft">
                {view === "day" ? "Today" : view === "week" ? "This week" : "This month"}
              </button>
            )}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <span className="mr-2 hidden items-center gap-2 rounded-full border border-border px-2.5 py-1 text-xs text-muted sm:inline-flex" title={version}>
            <span className="relative flex size-2">
              {loading && <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />}
              <span className={`relative inline-flex size-2 rounded-full ${platform === "demo" ? "bg-warn" : "bg-good"}`} />
            </span>
            {platform === "mac" && <Apple className="size-3.5" />}
            {platform === "windows" && <Windows className="size-3" />}
            {PLATFORM_LABEL[platform]}
          </span>
          <ThemeToggle />
          <IconButton label={platform === "demo" ? "Exit demo" : "Disconnect"} onClick={onDisconnect}>
            <Logout />
          </IconButton>
        </div>
      </div>
    </header>
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  useEffect(() => setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light"), []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("dopamine.theme", next);
    } catch {}
    setTheme(next);
  };
  return (
    <IconButton label="Toggle theme" onClick={toggle}>
      {theme === "dark" ? <Sun /> : <Moon />}
    </IconButton>
  );
}
