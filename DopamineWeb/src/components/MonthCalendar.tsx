import { HOUR, addDays, formatDuration, sameDay, startOfMonth, startOfWeek } from "@/lib/time";
import { Card } from "./ui";

const monthName = new Intl.DateTimeFormat(undefined, { month: "long" });
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function level(ms: number): number {
  if (ms <= 0) return 0;
  if (ms < 2 * HOUR) return 1;
  if (ms < 4 * HOUR) return 2;
  if (ms < 7 * HOUR) return 3;
  return 4;
}

const FILL = ["var(--track)", "25%", "45%", "70%", "100%"];

export function MonthCalendar({ anchor, daily, selected, now, onPick }: { anchor: Date; daily: Map<number, number>; selected: (d: Date) => boolean; now: number; onPick: (d: Date) => void }) {
  const first = startOfMonth(anchor);
  const gridStart = startOfWeek(first);
  const cells: Date[] = [];
  for (let d = gridStart; cells.length < 42; d = addDays(d, 1)) cells.push(d);
  const rows = cells[35].getMonth() === first.getMonth() ? 6 : 5;
  const today = new Date(now);
  const monthTotal = [...daily.values()].reduce((a, b) => a + b, 0);
  const activeDays = [...daily.values()].filter((v) => v > 0).length;

  return (
    <Card title={monthName.format(first)} action={<span className="num text-xs text-faint">{activeDays ? `${formatDuration(monthTotal / activeDays)} / day avg` : ""}</span>}>
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="pb-1 text-[10px] font-medium text-faint">
            {w}
          </div>
        ))}
        {cells.slice(0, rows * 7).map((d) => {
          const inMonth = d.getMonth() === first.getMonth();
          const ms = daily.get(d.getTime()) ?? 0;
          const lv = level(ms);
          const future = d.getTime() > now;
          const isSel = selected(d);
          const isToday = sameDay(d, today);
          return (
            <button
              key={d.getTime()}
              type="button"
              disabled={!inMonth || future}
              onClick={() => onPick(d)}
              title={inMonth ? `${d.toDateString()} · ${formatDuration(ms)}` : undefined}
              className={`num relative aspect-square rounded-md text-[11px] transition-transform enabled:hover:scale-110 ${
                !inMonth ? "invisible" : ""
              } ${isSel ? "ring-2 ring-accent ring-offset-1 ring-offset-surface" : ""} ${future ? "text-faint/60" : lv >= 3 ? "text-white dark:text-bg" : "text-muted"}`}
              style={{ background: lv === 0 ? "var(--track)" : `color-mix(in srgb, var(--accent) ${FILL[lv]}, var(--track))` }}
            >
              {d.getDate()}
              {isToday && <span className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-current" />}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-faint">
        Less
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className="size-2.5 rounded-sm" style={{ background: l === 0 ? "var(--track)" : `color-mix(in srgb, var(--accent) ${FILL[l]}, var(--track))` }} />
        ))}
        More
      </div>
    </Card>
  );
}
