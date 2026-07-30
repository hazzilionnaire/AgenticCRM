"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui/primitives";

export interface Option {
  value: string;
  label: string;
}

/**
 * Checkbox dropdown. Native <select multiple> is unusable for filtering — it
 * needs ctrl-click to combine values and shows one row at a time.
 */
export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  className,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggle = (value: string) => {
    onChange(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
    );
  };

  const summary =
    selected.length === 0
      ? "Any"
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? "1 selected")
        : `${selected.length} selected`;

  return (
    <div ref={ref} className={cx("relative", className)}>
      <span className="block text-xs font-medium text-[var(--muted)] mb-1.5">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cx(
          "flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition",
          "border-[var(--border-subtle)] bg-[var(--surface)] hover:border-[var(--accent)]/50",
          selected.length > 0 && "border-[var(--accent)]/60",
        )}
      >
        <span className={cx("truncate", selected.length === 0 && "text-[var(--muted)]")}>
          {summary}
        </span>
        <span className="text-[var(--muted)] text-xs">▾</span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full min-w-52 overflow-auto rounded-md border border-[var(--border-subtle)] bg-[var(--surface)] p-1 shadow-lg"
        >
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mb-1 w-full rounded px-2 py-1 text-left text-xs text-[var(--muted)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            >
              Clear selection
            </button>
          )}
          {options.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            >
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() => toggle(option.value)}
                className="accent-[var(--accent)]"
              />
              <span className="truncate">{option.label}</span>
            </label>
          ))}
          {options.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-[var(--muted)]">No options</p>
          )}
        </div>
      )}
    </div>
  );
}
