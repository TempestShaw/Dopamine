import { ReactNode } from "react";
import { Category, CATEGORY_META } from "@/lib/categories";

type IconProps = { className?: string };
const svg = (path: ReactNode) =>
  function Icon({ className = "size-4" }: IconProps) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden>
        {path}
      </svg>
    );
  };

export const ChevronLeft = svg(<path d="m15 18-6-6 6-6" />);
export const ChevronRight = svg(<path d="m9 18 6-6-6-6" />);
export const ChevronDown = svg(<path d="m6 9 6 6 6-6" />);
export const Sun = svg(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </>,
);
export const Moon = svg(<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />);
export const Logout = svg(<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />);
export const Refresh = svg(<path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6" />);
export const Windows = svg(<path d="M3 5.5 10 4.5V11H3zM11 4.3 21 3v8H11zM3 12h7v6.5L3 17.5zM11 12h10v9l-10-1.4z" fill="currentColor" stroke="none" />);
export const Apple = svg(
  <path
    d="M16.4 12.6c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.3.8c1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.8-1.1-2.8-4.1ZM14 5.2c.7-.8 1.2-2 1-3.2-1 .1-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.5 2.9-1.3Z"
    fill="currentColor"
    stroke="none"
  />,
);

/**
 * SVG filters shared by every painted mark: `paint` roughens edges and adds pigment streaks,
 * `pencil` makes straight lines wobble like graphite on paper. Rendered once per page.
 */
export function PaintFilters() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
      <defs>
        <filter id="dopamine-paint" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="7" result="edge" />
          <feDisplacementMap in="SourceGraphic" in2="edge" scale="3.2" xChannelSelector="R" yChannelSelector="G" result="rough" />
          <feTurbulence type="fractalNoise" baseFrequency="0.5 0.035" numOctaves="2" seed="3" result="streaks" />
          <feColorMatrix in="streaks" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.5 1.12" result="streakAlpha" />
          <feComposite in="rough" in2="streakAlpha" operator="in" />
        </filter>
        <filter id="dopamine-pencil" x="-2%" y="-20%" width="104%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" seed="11" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}

/** Overlapping paint dabs in the dopamine palette. */
export function Logo({ className = "size-8" }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" className={`paint ${className}`} aria-hidden>
      <circle cx="15" cy="15" r="10" fill="var(--cat-social)" />
      <circle cx="26" cy="16" r="9" fill="var(--highlight)" opacity="0.9" />
      <circle cx="18" cy="26" r="9.5" fill="var(--cat-work)" opacity="0.9" />
      <circle cx="28" cy="27" r="6" fill="var(--cat-study)" opacity="0.9" />
    </svg>
  );
}

export function CategoryDot({ category, className = "size-2.5" }: { category: Category; className?: string }) {
  return <span className={`dab inline-block shrink-0 ${className}`} style={{ background: CATEGORY_META[category].color }} />;
}

export function AppAvatar({ app, category }: { app: string; category: Category }) {
  const color = CATEGORY_META[category].color;
  return (
    <span className="relative grid size-9 shrink-0 place-items-center">
      <span className="dab paint absolute inset-0" style={{ background: `color-mix(in srgb, ${color} 30%, transparent)` }} />
      <span className="serif relative text-lg italic" style={{ color: `color-mix(in srgb, ${color} 70%, var(--ink))` }}>
        {app.slice(0, 1).toUpperCase()}
      </span>
    </span>
  );
}

/** A hand-drawn stroke, used under titles and the selected tab. */
export function Stroke({ color = "var(--highlight)", className = "" }: { color?: string; className?: string }) {
  return (
    <svg viewBox="0 0 120 8" preserveAspectRatio="none" className={`pointer-events-none ${className}`} aria-hidden>
      <path d="M2 5.2C22 2.6 48 6.4 70 4.1S104 3 118 4.6" stroke={color} strokeWidth="3.4" strokeLinecap="round" fill="none" className="pencil" />
    </svg>
  );
}

/** A titled section. No box; structure comes from whitespace and a pencil rule. */
export function Section({ title, note, action, children, className = "" }: { title?: ReactNode; note?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      {(title || action) && (
        <header className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="flex items-baseline gap-3">
            {title && <h2 className="serif text-[26px] leading-none">{title}</h2>}
            {note && <span className="hand text-lg leading-none text-graphite">{note}</span>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Rule({ className = "" }: { className?: string }) {
  return <div className={`rule ${className}`} role="presentation" />;
}

export function Segmented<T extends string>({ value, options, onChange, size = "md" }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; size?: "sm" | "md" }) {
  return (
    <div role="tablist" className={`inline-flex items-center ${size === "sm" ? "gap-3" : "gap-5"}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`relative pb-1 font-medium transition-colors ${size === "sm" ? "text-[13px]" : "text-[15px]"} ${active ? "text-ink" : "text-faint hover:text-graphite"}`}
          >
            <span className="relative z-10">{o.label}</span>
            {active && <Stroke className="absolute -bottom-0.5 left-[-6%] h-2.5 w-[112%]" />}
          </button>
        );
      })}
    </div>
  );
}

export function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="dab grid size-9 place-items-center text-graphite transition-colors hover:bg-wash hover:text-ink"
    >
      {children}
    </button>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="hand grid min-h-28 place-items-center px-4 text-center text-xl text-faint">{children}</div>;
}
