import { CategoryTotals } from "@/lib/analytics";
import { CATEGORIES, CATEGORY_META } from "@/lib/categories";
import { useT } from "@/lib/i18n";
import { formatDuration } from "@/lib/time";
import { CategoryDot, Duration, EmptyState, Section } from "./ui";

/** A painted ring: each category is one brushstroke around the circle. */
export function CategoryBreakdown({ totals, total }: { totals: CategoryTotals; total: number }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const gap = 16; // round caps eat into the gap
  const cats = CATEGORIES.filter((k) => totals[k] > 0).sort((a, b) => totals[b] - totals[a]);
  let offset = 0;
  const t = useT();

  return (
    <Section title={t.categoriesTitle}>
      {total === 0 ? (
        <EmptyState>{t.nothingYet}</EmptyState>
      ) : (
        <div className="flex flex-col items-center gap-6 sm:flex-row lg:flex-col">
          <div className="relative size-44 shrink-0">
            <svg viewBox="0 0 100 100" className="paint size-44 -rotate-[100deg]">
              <circle cx="50" cy="50" r={r} fill="none" stroke="var(--wash)" strokeWidth="13" />
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
                    strokeWidth="13"
                    strokeDasharray={`${dash} ${c - dash}`}
                    strokeDashoffset={-offset}
                    strokeLinecap="round"
                  />
                );
                offset += len;
                return el;
              })}
            </svg>
            <div className="absolute inset-0 grid place-content-center text-center">
              <div className="serif num text-[30px] leading-none">
                <Duration ms={total} />
              </div>
              <div className="hand text-lg text-faint">{t.inTotal}</div>
            </div>
          </div>
          <ul className="w-full space-y-2.5">
            {cats.map((k) => (
              <li key={k} className="flex items-center gap-3 text-[15px]">
                <CategoryDot category={k} className="size-3" />
                <span className="flex-1">{t.categories[k]}</span>
                <span className="num text-graphite">{formatDuration(totals[k])}</span>
                <span className="hand num w-10 text-right text-lg leading-none text-faint">{Math.round((totals[k] / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}
