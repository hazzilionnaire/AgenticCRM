"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AccountStatus, LifecycleStage } from "@/generated/prisma/enums";
import {
  ACCOUNT_STATUS_LABELS,
  EMPLOYEE_BAND_LABELS,
  LIFECYCLE_STAGE_LABELS,
  REVENUE_BAND_LABELS,
  WORKFLOW_STAGE_LABELS,
  formatCurrency,
  formatDate,
} from "@/lib/labels";
import { tierShortLabel } from "@/server/tiering/calculate-tier";
import { Badge, EmptyState, cx, tierTone } from "@/components/ui/primitives";

export interface CompanyRow {
  id: string;
  legalName: string;
  dbaName: string | null;
  tier: number | null;
  employeeBand: keyof typeof EMPLOYEE_BAND_LABELS | null;
  annualRevenueExact: string | null;
  annualRevenueBand: keyof typeof REVENUE_BAND_LABELS | null;
  currency: string;
  lifecycleStage: LifecycleStage;
  accountStatus: AccountStatus;
  workflowStage: keyof typeof WORKFLOW_STAGE_LABELS;
  lastActivityAt: string | null;
  deletedAt: string | null;
  industry: { id: string; name: string } | null;
  owner: { id: string; name: string | null; email: string } | null;
}

const COLUMNS: { key: string; label: string; sortable: boolean; className?: string }[] = [
  { key: "legalName", label: "Company", sortable: true },
  { key: "industry", label: "Industry", sortable: true },
  { key: "tier", label: "Tier", sortable: true },
  { key: "employeeBand", label: "Employees", sortable: true },
  { key: "annualRevenueExact", label: "Revenue", sortable: true, className: "text-right" },
  { key: "lifecycleStage", label: "Lifecycle", sortable: true },
  { key: "workflowStage", label: "Workflow", sortable: true },
  { key: "owner", label: "Owner", sortable: true },
  { key: "lastActivityAt", label: "Last activity", sortable: true },
];

const LIFECYCLE_TONE: Record<string, "neutral" | "blue" | "green" | "red"> = {
  LEAD: "neutral",
  PROSPECT: "blue",
  CUSTOMER: "green",
  CHURNED: "red",
};

export function CompanyTable({
  rows,
  total,
  page,
  pageCount,
}: {
  rows: CompanyRow[];
  total: number;
  page: number;
  pageCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const sort = params.get("sort") ?? "createdAt";
  const dir = params.get("dir") ?? "desc";

  function toggleSort(key: string) {
    const next = new URLSearchParams(params.toString());
    // First click on a new column sorts ascending; clicking the active one flips it.
    next.set("dir", sort === key && dir === "asc" ? "desc" : "asc");
    next.set("sort", key);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  function goToPage(next: number) {
    const params2 = new URLSearchParams(params.toString());
    params2.set("page", String(next));
    router.push(`${pathname}?${params2.toString()}`);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] text-left">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={cx("px-4 py-2.5 text-xs font-medium text-[var(--muted)]", col.className)}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex items-center gap-1 transition hover:text-[var(--foreground)]"
                    >
                      {col.label}
                      <span className={cx("text-[10px]", sort !== col.key && "opacity-25")}>
                        {sort === col.key ? (dir === "asc" ? "▲" : "▼") : "▾"}
                      </span>
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={cx(
                  "border-b border-[var(--border-subtle)] last:border-0 transition",
                  "hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
                  row.deletedAt && "opacity-55",
                )}
              >
                <td className="px-4 py-2.5">
                  <Link
                    href={`/companies/${row.id}`}
                    className="font-medium hover:text-[var(--accent)] hover:underline"
                  >
                    {row.legalName}
                  </Link>
                  {row.dbaName && (
                    <span className="ml-1.5 text-xs text-[var(--muted)]">({row.dbaName})</span>
                  )}
                  {row.deletedAt && (
                    <Badge tone="red" className="ml-2">
                      Deleted
                    </Badge>
                  )}
                  {row.accountStatus === "AT_RISK" && (
                    <Badge tone="amber" className="ml-2">
                      {ACCOUNT_STATUS_LABELS.AT_RISK}
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-2.5 text-[var(--muted)]">{row.industry?.name ?? "—"}</td>
                <td className="px-4 py-2.5">
                  {row.tier === null ? (
                    <span className="text-xs text-[var(--muted)]">Unclassified</span>
                  ) : (
                    <Badge tone={tierTone(row.tier)}>
                      T{row.tier} · {tierShortLabel(row.tier)}
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-2.5 text-[var(--muted)]">
                  {row.employeeBand ? EMPLOYEE_BAND_LABELS[row.employeeBand] : "—"}
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  {row.annualRevenueExact ? (
                    formatCurrency(row.annualRevenueExact, row.currency)
                  ) : row.annualRevenueBand ? (
                    <span className="text-[var(--muted)]">
                      {REVENUE_BAND_LABELS[row.annualRevenueBand]}
                    </span>
                  ) : (
                    <span className="text-[var(--muted)]">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <Badge tone={LIFECYCLE_TONE[row.lifecycleStage] ?? "neutral"}>
                    {LIFECYCLE_STAGE_LABELS[row.lifecycleStage]}
                  </Badge>
                </td>
                <td className="px-4 py-2.5">
                  <Badge tone={row.workflowStage === "CONTACTED" ? "green" : "neutral"}>
                    {WORKFLOW_STAGE_LABELS[row.workflowStage]}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-[var(--muted)]">
                  {row.owner ? (row.owner.name ?? row.owner.email) : "Unassigned"}
                </td>
                <td className="px-4 py-2.5 text-[var(--muted)] whitespace-nowrap">
                  {formatDate(row.lastActivityAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <EmptyState
          title="No companies match these filters"
          hint="Try clearing a filter or widening the search."
        />
      )}

      {rows.length > 0 && (
        <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-4 py-2.5 text-xs text-[var(--muted)]">
          <span>
            {total} compan{total === 1 ? "y" : "ies"} · page {page} of {pageCount}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
              className="rounded px-2 py-1 transition hover:bg-black/[0.05] disabled:opacity-40 dark:hover:bg-white/[0.07]"
            >
              ← Previous
            </button>
            <button
              type="button"
              disabled={page >= pageCount}
              onClick={() => goToPage(page + 1)}
              className="rounded px-2 py-1 transition hover:bg-black/[0.05] disabled:opacity-40 dark:hover:bg-white/[0.07]"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
