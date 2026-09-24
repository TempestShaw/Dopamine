import { useT } from "@/lib/i18n";
import { Insight } from "@/lib/insights";
import { EmptyState, Section } from "./ui";

const toneColor: Record<Insight["tone"], string> = {
  good: "var(--cat-study)",
  warn: "var(--cat-social)",
  neutral: "var(--cat-work)",
};

/** Observations written as margin notes. */
export function Insights({ items }: { items: Insight[] }) {
  const t = useT();
  return (
    <Section title={t.notes.title}>
      {items.length === 0 ? (
        <EmptyState>{t.notes.empty}</EmptyState>
      ) : (
        <ul className="space-y-3.5">
          {items.map((i, idx) => (
            <li key={idx} className="flex gap-3 text-[15px] leading-snug">
              <span className="dab paint mt-1.5 size-2.5 shrink-0" style={{ background: toneColor[i.tone] }} />
              <span>{t.insight(i.msg)}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
