import { Insight } from "@/lib/insights";
import { Card, EmptyState, Sparkle } from "./ui";

const toneClass: Record<Insight["tone"], string> = {
  good: "bg-good",
  warn: "bg-warn",
  neutral: "bg-accent",
};

export function Insights({ items }: { items: Insight[] }) {
  return (
    <Card title={<span className="inline-flex items-center gap-1.5"><Sparkle className="size-3.5" /> Insights</span>}>
      {items.length === 0 ? (
        <EmptyState>Insights show up after a few minutes of activity</EmptyState>
      ) : (
        <ul className="space-y-3">
          {items.map((i, idx) => (
            <li key={idx} className="flex gap-2.5 text-sm leading-snug">
              <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${toneClass[i.tone]}`} />
              <span>{i.text}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
