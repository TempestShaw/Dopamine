import { Summary, productiveTime } from "@/lib/analytics";
import { CATEGORY_META } from "@/lib/categories";
import { trend } from "@/lib/insights";
import { View, clock, formatDuration } from "@/lib/time";
import { AppAvatar } from "./ui";

const vs: Record<View, string> = { day: "vs. yesterday", week: "vs. last week", month: "vs. last month" };

/** Four headline figures set like a painter's notes: big serif numbers, pencil dividers, no boxes. */
export function StatCards({ view, summary, previous, days }: { view: View; summary: Summary; previous: Summary | null; days: number }) {
  const focus = productiveTime(summary.byCategory);
  const share = summary.total ? focus / summary.total : 0;
  const t = trend(summary.byCategory, previous?.byCategory ?? null);
  const top = summary.apps[0];
  const avg = view !== "day" && days > 0 ? summary.total / days : null;

  return (
    <div className="grid grid-cols-2 gap-y-8 lg:grid-cols-4">
      <Stat label="Screen time" value={formatDuration(summary.total)} highlight>
        {t !== null ? (
          <>
            {t > 0 ? "↑" : "↓"} {Math.abs(Math.round(t * 100))}% {vs[view]}
          </>
        ) : avg !== null ? (
          <>{formatDuration(avg)} a day</>
        ) : summary.first ? (
          <>
            {clock(summary.first)} – {clock(summary.last!)}
          </>
        ) : (
          "—"
        )}
      </Stat>

      <Stat label="Focused" value={formatDuration(focus)}>
        <span className="flex items-center gap-2">
          <span className="relative h-2 w-20 overflow-hidden">
            <span className="rule absolute inset-x-0 top-1/2" />
            <span
              className="paint absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${share * 100}%`, background: `linear-gradient(90deg, ${CATEGORY_META.work.color}, ${CATEGORY_META.study.color})` }}
            />
          </span>
          {Math.round(share * 100)}% of it
        </span>
      </Stat>

      <Stat label="Longest focus" value={summary.longestFocus ? formatDuration(summary.longestFocus.focused) : "—"}>
        {summary.longestFocus ? `from ${clock(summary.longestFocus.start)}` : "no deep stretch yet"}
      </Stat>

      <Stat label="Most used" value={top ? top.app : "—"} icon={top && <AppAvatar app={top.app} process={top.process} category={top.category} size="lg" />}>
        {top ? `${formatDuration(top.total)} · ${summary.switches.toLocaleString()} switches` : "—"}
      </Stat>
    </div>
  );
}

function Stat({ label, value, highlight, icon, children }: { label: string; value: string; highlight?: boolean; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-w-0 border-line pr-4 lg:border-l lg:pl-6 lg:first:border-l-0 lg:first:pl-0">
      <div className="label">{label}</div>
      <div className="mt-2 flex min-w-0 items-center gap-3">
        {icon}
        <div className="serif num min-w-0 truncate text-[40px] leading-[1.05] sm:text-[46px]">
          <span className={highlight ? "marker" : ""}>{value}</span>
        </div>
      </div>
      <div className="mt-2 text-[13px] text-graphite">{children}</div>
    </div>
  );
}
