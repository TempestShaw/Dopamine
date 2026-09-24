import { Summary, productiveTime } from "@/lib/analytics";
import { CATEGORY_META } from "@/lib/categories";
import { trend } from "@/lib/insights";
import { View, clock, formatDuration } from "@/lib/time";
import { AppAvatar } from "./ui";

const vs: Record<View, string> = { day: "vs yesterday", week: "vs last week", month: "vs last month" };

export function StatCards({ view, summary, previous, days }: { view: View; summary: Summary; previous: Summary | null; days: number }) {
  const focus = productiveTime(summary.byCategory);
  const share = summary.total ? focus / summary.total : 0;
  const t = trend(summary.byCategory, previous?.byCategory ?? null);
  const top = summary.apps[0];
  const avg = view !== "day" && days > 0 ? summary.total / days : null;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Screen time" value={formatDuration(summary.total)}>
        {t !== null ? (
          <span className="text-muted">
            {t > 0 ? "▲" : "▼"} {Math.abs(Math.round(t * 100))}% {vs[view]}
          </span>
        ) : avg !== null ? (
          <span>{formatDuration(avg)} per active day</span>
        ) : summary.first ? (
          <span>
            {clock(summary.first)} – {clock(summary.last!)}
          </span>
        ) : (
          <span>—</span>
        )}
      </Stat>

      <Stat label="Focus time" value={formatDuration(focus)}>
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-track">
            <div className="h-full rounded-full" style={{ width: `${share * 100}%`, background: `linear-gradient(90deg, ${CATEGORY_META.work.color}, ${CATEGORY_META.study.color})` }} />
          </div>
          <span className="num">{Math.round(share * 100)}%</span>
        </div>
      </Stat>

      <Stat label="Longest focus" value={summary.longestFocus ? formatDuration(summary.longestFocus.focused) : "—"}>
        {summary.longestFocus ? (
          <span>
            {clock(summary.longestFocus.start)} – {clock(summary.longestFocus.end)}
          </span>
        ) : (
          <span>No focus block yet</span>
        )}
      </Stat>

      <Stat label="Most used" value={top ? top.app : "—"} valueClass="truncate">
        {top ? (
          <span className="flex items-center gap-2">
            <span className="num">{formatDuration(top.total)}</span>·<span>{summary.switches.toLocaleString()} switches</span>
          </span>
        ) : (
          <span>—</span>
        )}
        {top && (
          <span className="absolute top-4 right-4 hidden sm:block">
            <AppAvatar app={top.app} category={top.category} />
          </span>
        )}
      </Stat>
    </div>
  );
}

function Stat({ label, value, valueClass = "", children }: { label: string; value: string; valueClass?: string; children: React.ReactNode }) {
  return (
    <div className="card relative min-w-0 p-4">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className={`num mt-1 text-2xl font-semibold tracking-tight ${valueClass}`}>{value}</div>
      <div className="mt-2 text-xs text-faint">{children}</div>
    </div>
  );
}
