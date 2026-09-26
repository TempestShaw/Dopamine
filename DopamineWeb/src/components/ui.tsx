import { Fragment, ReactNode } from "react";
import { Category, CATEGORY_META } from "@/lib/categories";
import { useI18n } from "@/lib/i18n";
import { useIcon } from "@/lib/icons";
import { durationParts, formatDuration } from "@/lib/time";

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
export const EyeOff = svg(<path d="M10.7 5.1A10 10 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-2.2 3.1M6.6 6.6C3.9 8.4 2.5 12 2.5 12s3.5 7 9.5 7a9.5 9.5 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />);
export const Trash = svg(<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />);
export const Refresh = svg(<path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6" />);
export const Windows = svg(<path d="M3 5.5 10 4.5V11H3zM11 4.3 21 3v8H11zM3 12h7v6.5L3 17.5zM11 12h10v9l-10-1.4z" fill="currentColor" stroke="none" />);
export const Apple = svg(
  <path
    d="M16.4 12.6c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.3.8c1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.8-1.1-2.8-4.1ZM14 5.2c.7-.8 1.2-2 1-3.2-1 .1-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.5 2.9-1.3Z"
    fill="currentColor"
    stroke="none"
  />,
);

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

const AVATAR = {
  sm: { box: "size-6", img: "size-[20px]", text: "text-sm", offset: 1.5 },
  md: { box: "size-9", img: "size-[30px]", text: "text-lg", offset: 3 },
  lg: { box: "size-12", img: "size-[40px]", text: "text-2xl", offset: 4 },
};

/** Stable small tilt per app, so the same app always sits at the same angle. */
function tilt(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return (Math.abs(h) % 9) - 4;
}

/**
 * The app's real icon, pasted like a sticker onto a dab of its category colour.
 * Falls back to a painted initial when the agent couldn't provide an icon.
 */
export function AppAvatar({ app, process, category, size = "md" }: { app: string; process: string; category: Category; size?: keyof typeof AVATAR }) {
  const icon = useIcon(process);
  const color = CATEGORY_META[category].color;
  const s = AVATAR[size];

  if (!icon) {
    return (
      <span className={`relative grid shrink-0 place-items-center ${s.box}`}>
        <span className="dab paint absolute inset-0" style={{ background: `color-mix(in srgb, ${color} 30%, transparent)` }} />
        <span className={`serif relative italic ${s.text}`} style={{ color: `color-mix(in srgb, ${color} 70%, var(--ink))` }}>
          {app.slice(0, 1).toUpperCase()}
        </span>
      </span>
    );
  }

  return (
    <span className={`relative grid shrink-0 place-items-center ${s.box}`}>
      <span
        className="dab paint absolute inset-0"
        style={{ background: `color-mix(in srgb, ${color} 42%, transparent)`, transform: `translate(${s.offset}px, ${s.offset * 0.7}px)` }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- local data: URL, nothing to optimise */}
      <img
        src={icon}
        alt=""
        draggable={false}
        className={`relative ${s.img} object-contain drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.28)]`}
        style={{ transform: `rotate(${tilt(process)}deg)` }}
      />
    </span>
  );
}

/** A hand-drawn stroke, used under titles and the selected tab. */
export function Stroke({ color = "var(--highlight)", className = "" }: { color?: string; className?: string }) {
  return (
    <svg viewBox="0 0 120 8" preserveAspectRatio="none" className={`pointer-events-none ${className}`} aria-hidden>
      <path d="M2 5.2C22 2.6 48 6.4 70 4.1S104 3 118 4.6" stroke={color} strokeWidth="3.4" strokeLinecap="round" fill="none" />
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

/**
 * A duration for large figures. Chinese units (小时, 分钟) are whole words, so they are set
 * smaller than the numbers, the way a hand-written note would.
 */
export function Duration({ ms }: { ms: number }) {
  const { locale } = useI18n();
  if (locale === "en") return <>{formatDuration(ms)}</>;
  return (
    <>
      {durationParts(ms).map(([n, unit], i) => (
        <Fragment key={i}>
          {n}
          <span className="mx-[0.08em] text-[0.48em] tracking-wide">{unit}</span>
        </Fragment>
      ))}
    </>
  );
}
