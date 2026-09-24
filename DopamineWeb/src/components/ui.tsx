import { ReactNode } from "react";
import { Category, CATEGORY_META } from "@/lib/categories";

type IconProps = { className?: string };
const base = "shrink-0";
const svg = (path: ReactNode, vb = "0 0 24 24") =>
  function Icon({ className = "size-4" }: IconProps) {
    return (
      <svg viewBox={vb} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={`${base} ${className}`} aria-hidden>
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
export const Sparkle = svg(<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />);
export const Windows = svg(<path d="M3 5.5 10 4.5V11H3zM11 4.3 21 3v8H11zM3 12h7v6.5L3 17.5zM11 12h10v9l-10-1.4z" fill="currentColor" stroke="none" />);
export const Apple = svg(
  <path
    d="M16.4 12.6c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.3.8c1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.8-1.1-2.8-4.1ZM14 5.2c.7-.8 1.2-2 1-3.2-1 .1-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.5 2.9-1.3Z"
    fill="currentColor"
    stroke="none"
  />,
);
export const Download = svg(<path d="M12 3v12M7 10l5 5 5-5M5 21h14" />);

export function Logo({ className = "size-7" }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id="dopamine-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c7cf8" />
          <stop offset="1" stopColor="#12a18c" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#dopamine-g)" />
      <path d="M9 16a7 7 0 1 0 7-7" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M16 11v5l3.5 2" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function CategoryDot({ category, className = "size-2" }: { category: Category; className?: string }) {
  return <span className={`inline-block rounded-full ${className}`} style={{ background: CATEGORY_META[category].color }} />;
}

export function AppAvatar({ app, category }: { app: string; category: Category }) {
  const color = CATEGORY_META[category].color;
  return (
    <span
      className="grid size-8 shrink-0 place-items-center rounded-lg text-[13px] font-semibold"
      style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
    >
      {app.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function Card({ title, action, children, className = "" }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-5 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Segmented<T extends string>({ value, options, onChange, size = "md" }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; size?: "sm" | "md" }) {
  return (
    <div role="tablist" className="inline-flex rounded-lg bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={`rounded-md font-medium transition-colors ${size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-[13px]"} ${
            o.value === value ? "bg-surface text-text shadow-sm ring-1 ring-border" : "text-muted hover:text-text"
          }`}
        >
          {o.label}
        </button>
      ))}
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
      className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-text"
    >
      {children}
    </button>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="grid min-h-28 place-items-center rounded-xl border border-dashed border-border px-4 text-center text-sm text-faint">{children}</div>;
}
