"use client";

import type { ButtonHTMLAttributes } from "react";
import { cx } from "@/components/ui/primitives";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 border border-transparent",
  secondary:
    "bg-[var(--surface)] border border-[var(--border-subtle)] hover:bg-black/[0.03] dark:hover:bg-white/[0.05] disabled:opacity-50",
  ghost:
    "border border-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-50",
  danger:
    "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 border border-transparent",
};

export function Button({
  variant = "secondary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium",
        "transition disabled:cursor-not-allowed",
        VARIANTS[variant],
        className,
      )}
    />
  );
}
