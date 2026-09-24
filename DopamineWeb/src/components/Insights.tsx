import { Insight } from "@/lib/insights";
import { EmptyState, Section } from "./ui";

const toneColor: Record<Insight["tone"], string> = {
  good: "var(--cat-study)",
  warn: "var(--cat-social)",
  neutral: "var(--cat-work)",
};

/** Observations written as margin notes. */
export function Insights({ items }: { items: Insight[] }) {
  return (
    <Section title="Notes">
      {items.length === 0 ? (
        <EmptyState>notes show up after a few minutes of activity</EmptyState>
      ) : (
        <ul className="space-y-3.5">
          {items.map((i, idx) => (
            <li key={idx} className="flex gap-3 text-[15px] leading-snug">
              <span className="dab paint mt-1.5 size-2.5 shrink-0" style={{ background: toneColor[i.tone] }} />
              <span>{i.text}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
