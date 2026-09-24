import { CategoryTotals } from "@/lib/analytics";
import { CATEGORIES, CATEGORY_META } from "@/lib/categories";
import { formatDuration } from "@/lib/time";
import { Card, CategoryDot, EmptyState } from "./ui";

export function CategoryBreakdown({ totals, total }: { totals: CategoryTotals; total: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const gap = 2.5;
  const cats = CATEGORIES.filter((k) => totals[k] > 0).sort((a, b) => totals[b] - totals[a]);
  let offset = 0;

  return (
    <Card title="Categories">
      {total === 0 ? (
        <EmptyState>No activity yet</EmptyState>
      ) : (
        <div>
          <div className="relative mx-auto size-36">
          <svg viewBox="0 0 100 100" className="size-36 -rotate-90">
            <circle cx="50" cy="50" r={r} fill="none" stroke="var(--track)" strokeWidth="11" />
            {cats.map((k) => {
              const len = (totals[k] / total) * c;
              const dash = Math.max(len - (cats.length > 1 ? gap : 0), 0.5);
              const el = (
                <circle
                  key={k}
                  cx="50"
                  cy="50"
                  r={r}
                  fill="none"
                  stroke={CATEGORY_META[k].color}
                  strokeWidth="11"
                  strokeDasharray={`${dash} ${c - dash}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              );
              offset += len;
              return el;
            })}
          </svg>
          <div className="absolute inset-0 grid place-content-center text-center">
            <div className="num text-lg font-semibold">{formatDuration(total)}</div>
            <div className="text-[11px] text-faint">total</div>
          </div>
          </div>
          <ul className="mt-5 space-y-2">
            {cats.map((k) => (
              <li key={k} className="flex items-center gap-2 text-sm">
                <CategoryDot category={k} />
                <span className="flex-1 truncate">{CATEGORY_META[k].label}</span>
                <span className="num text-muted">{formatDuration(totals[k])}</span>
                <span className="num w-9 text-right text-xs text-faint">{Math.round((totals[k] / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
