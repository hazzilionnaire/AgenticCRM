"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  ACCOUNT_STATUS_LABELS,
  COMPANY_TYPE_LABELS,
  EMPLOYEE_BAND_LABELS,
  LIFECYCLE_STAGE_LABELS,
  REVENUE_BAND_LABELS,
  WORKFLOW_STAGE_LABELS,
  toOptions,
} from "@/lib/labels";
import { TIER_SHORT_LABELS } from "@/server/tiering/calculate-tier";
import { Button } from "@/components/ui/buttons";
import { MultiSelect, type Option } from "@/components/ui/multi-select";
import { inputClass, labelClass } from "@/components/ui/primitives";

const TIER_OPTIONS: Option[] = [1, 2, 3, 4].map((t) => ({
  value: String(t),
  label: `Tier ${t} · ${TIER_SHORT_LABELS[t as 1 | 2 | 3 | 4]}`,
}));

export function FilterBar({
  industries,
  reps,
}: {
  industries: { id: string; name: string }[];
  reps: { id: string; name: string | null; email: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [search, setSearch] = useState(params.get("q") ?? "");

  const csv = (key: string) => {
    const raw = params.get(key);
    return raw ? raw.split(",").filter(Boolean) : [];
  };

  function push(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(params.toString());
    mutate(next);
    next.delete("page"); // any filter change invalidates the current page
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  const setParam = (key: string, value: string) =>
    push((next) => (value ? next.set(key, value) : next.delete(key)));

  const setMulti = (key: string, values: string[]) =>
    push((next) => (values.length ? next.set(key, values.join(",")) : next.delete(key)));

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (search === current) return;
    const timer = setTimeout(() => setParam("q", search), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const activeCount = [
    "q",
    "industryIds",
    "employeeBands",
    "revenueBands",
    "revenueMin",
    "revenueMax",
    "tiers",
    "lifecycleStages",
    "workflowStages",
    "companyTypes",
    "accountStatuses",
    "ownerIds",
    "includeDeleted",
  ].filter((key) => params.get(key)).length;

  const ownerOptions: Option[] = [
    { value: "unassigned", label: "— Unassigned —" },
    ...reps.map((r) => ({ value: r.id, label: r.name ?? r.email })),
  ];

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <label className={labelClass} htmlFor="company-search">
            Search
          </label>
          <input
            id="company-search"
            type="search"
            placeholder="Company name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={inputClass}
          />
        </div>

        <MultiSelect
          label="Industry"
          options={industries.map((i) => ({ value: i.id, label: i.name }))}
          selected={csv("industryIds")}
          onChange={(v) => setMulti("industryIds", v)}
        />

        <MultiSelect
          label="Employee band"
          options={toOptions(EMPLOYEE_BAND_LABELS)}
          selected={csv("employeeBands")}
          onChange={(v) => setMulti("employeeBands", v)}
        />

        <MultiSelect
          label="Tier"
          options={TIER_OPTIONS}
          selected={csv("tiers")}
          onChange={(v) => setMulti("tiers", v)}
        />
      </div>

      {showAdvanced && (
        <div className="mt-3 grid gap-3 border-t border-[var(--border-subtle)] pt-3 sm:grid-cols-2 lg:grid-cols-4">
          <MultiSelect
            label="Revenue band"
            options={toOptions(REVENUE_BAND_LABELS)}
            selected={csv("revenueBands")}
            onChange={(v) => setMulti("revenueBands", v)}
          />

          <div>
            <span className={labelClass}>Exact revenue range (USD)</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                placeholder="Min"
                defaultValue={params.get("revenueMin") ?? ""}
                onBlur={(e) => setParam("revenueMin", e.target.value)}
                className={inputClass}
              />
              <span className="text-xs text-[var(--muted)]">to</span>
              <input
                type="number"
                min={0}
                placeholder="Max"
                defaultValue={params.get("revenueMax") ?? ""}
                onBlur={(e) => setParam("revenueMax", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <MultiSelect
            label="Lifecycle stage"
            options={toOptions(LIFECYCLE_STAGE_LABELS)}
            selected={csv("lifecycleStages")}
            onChange={(v) => setMulti("lifecycleStages", v)}
          />

          <MultiSelect
            label="Account owner"
            options={ownerOptions}
            selected={csv("ownerIds")}
            onChange={(v) => setMulti("ownerIds", v)}
          />

          <MultiSelect
            label="Workflow stage"
            options={toOptions(WORKFLOW_STAGE_LABELS)}
            selected={csv("workflowStages")}
            onChange={(v) => setMulti("workflowStages", v)}
          />

          <MultiSelect
            label="Company type"
            options={toOptions(COMPANY_TYPE_LABELS)}
            selected={csv("companyTypes")}
            onChange={(v) => setMulti("companyTypes", v)}
          />

          <MultiSelect
            label="Account status"
            options={toOptions(ACCOUNT_STATUS_LABELS)}
            selected={csv("accountStatuses")}
            onChange={(v) => setMulti("accountStatuses", v)}
          />

          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={params.get("includeDeleted") === "true"}
                onChange={(e) => setParam("includeDeleted", e.target.checked ? "true" : "")}
                className="accent-[var(--accent)]"
              />
              Include deleted
            </label>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-[var(--border-subtle)] pt-3">
        <Button variant="ghost" onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? "Fewer filters" : "More filters"}
        </Button>
        {activeCount > 0 && (
          <>
            <span className="text-xs text-[var(--muted)]">
              {activeCount} filter{activeCount === 1 ? "" : "s"} active
            </span>
            <Button
              variant="ghost"
              className="ml-auto"
              onClick={() => {
                setSearch("");
                startTransition(() => router.push(pathname));
              }}
            >
              Clear all
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
