import type { ReactNode } from "react";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export const inputClass =
  "w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-sm " +
  "outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/25 " +
  "disabled:opacity-60";

export const labelClass = "block text-xs font-medium text-[var(--muted)] mb-1.5";

export function Card({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-sm",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-3.5">
          <div>
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {description && (
              <p className="mt-0.5 text-xs text-[var(--muted)]">{description}</p>
            )}
          </div>
          {actions}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

type BadgeTone = "neutral" | "blue" | "green" | "amber" | "red" | "violet";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-slate-500/12 text-slate-700 dark:text-slate-300",
  blue: "bg-blue-500/12 text-blue-700 dark:text-blue-300",
  green: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  amber: "bg-amber-500/16 text-amber-700 dark:text-amber-300",
  red: "bg-red-500/12 text-red-700 dark:text-red-300",
  violet: "bg-violet-500/12 text-violet-700 dark:text-violet-300",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Tier colour ramps with segment size so the list scans at a glance. */
export function tierTone(tier: number | null | undefined): BadgeTone {
  switch (tier) {
    case 1:
      return "neutral";
    case 2:
      return "blue";
    case 3:
      return "violet";
    case 4:
      return "green";
    default:
      return "neutral";
  }
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className={labelClass}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

export function ReadOnlyField({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-[var(--muted)]">{label}</dt>
      <dd className="mt-0.5 text-sm break-words">{value ?? "—"}</dd>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>}
    </div>
  );
}
