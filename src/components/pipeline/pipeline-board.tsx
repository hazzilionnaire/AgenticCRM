"use client";

import { useMemo, useState, type DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WorkflowStage } from "@/generated/prisma/enums";
import { WORKFLOW_STAGE_LABELS, formatCurrency } from "@/lib/labels";
import { TIER_SHORT_LABELS } from "@/server/tiering/calculate-tier";
import { WORKFLOW_STAGE_ORDER, isTerminalStage } from "@/server/workflow/stages";
import type { PipelineCard } from "@/server/companies/pipeline";
import { Button } from "@/components/ui/buttons";
import { MultiSelect } from "@/components/ui/multi-select";
import { Badge, cx, inputClass, tierTone } from "@/components/ui/primitives";

/** Column accents. Opacity-based fills so one value reads in both themes. */
const STAGE_TONE: Record<WorkflowStage, { bar: string; wash: string; text: string }> = {
  [WorkflowStage.PENDING]: {
    bar: "bg-slate-400",
    wash: "bg-slate-500/[0.08]",
    text: "text-slate-600 dark:text-slate-300",
  },
  [WorkflowStage.CONTACTED]: {
    bar: "bg-sky-400",
    wash: "bg-sky-500/[0.08]",
    text: "text-sky-700 dark:text-sky-300",
  },
  [WorkflowStage.QUALIFIED]: {
    bar: "bg-violet-400",
    wash: "bg-violet-500/[0.08]",
    text: "text-violet-700 dark:text-violet-300",
  },
  [WorkflowStage.PROPOSAL_SENT]: {
    bar: "bg-amber-400",
    wash: "bg-amber-500/[0.10]",
    text: "text-amber-700 dark:text-amber-300",
  },
  [WorkflowStage.NEGOTIATION]: {
    bar: "bg-orange-400",
    wash: "bg-orange-500/[0.10]",
    text: "text-orange-700 dark:text-orange-300",
  },
  [WorkflowStage.CLOSED_WON]: {
    bar: "bg-emerald-400",
    wash: "bg-emerald-500/[0.08]",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  [WorkflowStage.CLOSED_LOST]: {
    bar: "bg-rose-400",
    wash: "bg-rose-500/[0.08]",
    text: "text-rose-700 dark:text-rose-300",
  },
};

const TIER_BORDER: Record<number, string> = {
  1: "border-l-slate-400",
  2: "border-l-blue-500",
  3: "border-l-violet-500",
  4: "border-l-emerald-500",
};

const TIER_OPTIONS = [1, 2, 3, 4].map((t) => ({
  value: String(t),
  label: TIER_SHORT_LABELS[t as 1 | 2 | 3 | 4],
}));

function GripIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0 fill-current text-[var(--muted)] opacity-40 group-hover:opacity-70"
    >
      <circle cx="6" cy="3" r="1.3" />
      <circle cx="10" cy="3" r="1.3" />
      <circle cx="6" cy="8" r="1.3" />
      <circle cx="10" cy="8" r="1.3" />
      <circle cx="6" cy="13" r="1.3" />
      <circle cx="10" cy="13" r="1.3" />
    </svg>
  );
}

export interface Rep {
  id: string;
  name: string | null;
  email: string;
}

export function PipelineBoard({
  cards,
  reps,
  capped,
}: {
  cards: PipelineCard[];
  reps: Rep[];
  capped: boolean;
}) {
  const router = useRouter();

  const [repFilter, setRepFilter] = useState<string[]>([]);
  const [tierFilter, setTierFilter] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<WorkflowStage | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Stage changes are layered over the server data rather than replacing it, so
   * a card moves the instant it's dropped and a failed save just drops its
   * override instead of having to rebuild the list.
   */
  const [moved, setMoved] = useState<Record<string, WorkflowStage>>({});

  const resolved = useMemo(
    () => cards.map((c) => ({ ...c, workflowStage: moved[c.id] ?? c.workflowStage })),
    [cards, moved],
  );

  const filtered = useMemo(
    () =>
      resolved.filter((c) => {
        if (repFilter.length && (!c.ownerId || !repFilter.includes(c.ownerId))) return false;
        if (tierFilter.length && (c.tier === null || !tierFilter.includes(String(c.tier))))
          return false;
        if (dateFrom && c.createdDate < dateFrom) return false;
        if (dateTo && c.createdDate > dateTo) return false;
        return true;
      }),
    [resolved, repFilter, tierFilter, dateFrom, dateTo],
  );

  // Mixed-currency pipelines can't be summed honestly; the header follows the
  // first card in view and the per-card figures stay in their own currency.
  const displayCurrency = filtered[0]?.currency ?? "USD";
  const totalAcv = filtered.reduce((sum, c) => sum + Number(c.acv ?? 0), 0);

  const byStage = useMemo(() => {
    const map = new Map<WorkflowStage, PipelineCard[]>();
    WORKFLOW_STAGE_ORDER.forEach((s) => map.set(s, []));
    filtered.forEach((c) => map.get(c.workflowStage)?.push(c));
    return map;
  }, [filtered]);

  /**
   * Leads per agent, derived from the same filtered set the board is showing so
   * the two never disagree. "Live" means still in play — closed won and lost are
   * excluded, because a rep's workload is what hasn't landed yet.
   */
  const agentRows = useMemo(() => {
    const live = filtered.filter((c) => !isTerminalStage(c.workflowStage));
    const rows = new Map<string, { name: string; count: number; acv: number }>();

    live.forEach((c) => {
      const key = c.ownerId ?? "__unassigned";
      const row = rows.get(key) ?? {
        name: c.ownerName ?? "Unassigned",
        count: 0,
        acv: 0,
      };
      row.count += 1;
      row.acv += Number(c.acv ?? 0);
      rows.set(key, row);
    });

    return [...rows.entries()]
      .map(([id, row]) => ({ id, ...row }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [filtered]);

  const busiestAgent = agentRows[0]?.count ?? 0;

  const hasFilters =
    repFilter.length > 0 || tierFilter.length > 0 || dateFrom !== "" || dateTo !== "";

  function clearFilters() {
    setRepFilter([]);
    setTierFilter([]);
    setDateFrom("");
    setDateTo("");
  }

  async function moveCard(id: string, stage: WorkflowStage) {
    const current = resolved.find((c) => c.id === id);
    if (!current || current.workflowStage === stage) return;

    setMoved((prev) => ({ ...prev, [id]: stage }));
    setSaving(id);
    setError(null);

    const response = await fetch(`/api/companies/${id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });

    setSaving(null);

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Could not move that company. It has been put back.");
      setMoved((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }

    // Pull the server's version back so the activity log and timestamps are current.
    router.refresh();
  }

  function onDrop(event: DragEvent, stage: WorkflowStage) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain") || dragId;
    setDragId(null);
    setOverStage(null);
    if (id) void moveCard(id, stage);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Pipeline</h1>
          <p className="text-sm text-[var(--muted)]">
            Live opportunities by stage. Drag a card to move an account.
          </p>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2.5 shadow-sm">
          <div className="text-right">
            <p className="text-[11px] font-medium tracking-wide text-[var(--muted)] uppercase">
              Accounts in view
            </p>
            <p className="text-lg font-semibold">{filtered.length}</p>
          </div>
          <div className="h-8 w-px bg-[var(--border-subtle)]" />
          <div className="text-right">
            <p className="text-[11px] font-medium tracking-wide text-[var(--muted)] uppercase">
              ACV in view
            </p>
            <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totalAcv, displayCurrency)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <MultiSelect
          label="Account owner"
          className="w-52"
          options={reps.map((r) => ({ value: r.id, label: r.name ?? r.email }))}
          selected={repFilter}
          onChange={setRepFilter}
        />
        <MultiSelect
          label="Tier"
          className="w-44"
          options={TIER_OPTIONS}
          selected={tierFilter}
          onChange={setTierFilter}
        />
        <div>
          <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Created from</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={cx(inputClass, "w-40")}
          />
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Created to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={cx(inputClass, "w-40")}
          />
        </div>
        {hasFilters && (
          <Button variant="ghost" onClick={clearFilters} className="mb-0.5">
            Clear filters
          </Button>
        )}
      </div>

      {error && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {capped && (
        <p className="text-xs text-[var(--muted)]">
          Showing the 500 most recently updated accounts. Older ones are on the{" "}
          <Link href="/companies" className="underline">
            companies list
          </Link>
          .
        </p>
      )}

      <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-sm">
        <header className="border-b border-[var(--border-subtle)] px-4 py-3">
          <h2 className="text-sm font-semibold">Leads per agent</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Open opportunities by account owner. Closed won and lost are excluded, and the
            filters above apply.
          </p>
        </header>

        {agentRows.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-[var(--muted)]">
            No open opportunities match the current filters.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {agentRows.map((row) => (
              <li key={row.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-44 shrink-0 truncate text-sm">{row.name}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
                  <span
                    className="block h-full rounded-full bg-[var(--accent)]"
                    style={{
                      width: `${busiestAgent === 0 ? 0 : (row.count / busiestAgent) * 100}%`,
                    }}
                  />
                </span>
                <span className="w-16 shrink-0 text-right text-sm font-semibold tabular-nums">
                  {row.count}
                </span>
                <span className="w-28 shrink-0 text-right text-xs text-[var(--muted)] tabular-nums">
                  {formatCurrency(row.acv, displayCurrency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {WORKFLOW_STAGE_ORDER.map((stage) => {
          const stageCards = byStage.get(stage) ?? [];
          const stageAcv = stageCards.reduce((sum, c) => sum + Number(c.acv ?? 0), 0);
          const tone = STAGE_TONE[stage];
          const isOver = overStage === stage;

          return (
            <div
              key={stage}
              onDragOver={(e) => {
                e.preventDefault();
                setOverStage(stage);
              }}
              onDragLeave={() => setOverStage((s) => (s === stage ? null : s))}
              onDrop={(e) => onDrop(e, stage)}
              className={cx(
                "flex w-[264px] shrink-0 flex-col rounded-xl border transition",
                isOver
                  ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/30"
                  : "border-[var(--border-subtle)]",
              )}
            >
              <div className={cx("rounded-t-xl px-3 py-3", tone.wash)}>
                <div className={cx("mb-1.5 h-1 w-8 rounded-full", tone.bar)} />
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold">{WORKFLOW_STAGE_LABELS[stage]}</h2>
                  <span className={cx("text-xs font-semibold", tone.text)}>
                    {stageCards.length}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {formatCurrency(stageAcv, displayCurrency)} ACV
                </p>
              </div>

              <div className="min-h-[140px] flex-1 rounded-b-xl bg-black/[0.015] p-2.5 dark:bg-white/[0.02]">
                {stageCards.map((card) => (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={(e) => {
                      setDragId(card.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", card.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverStage(null);
                    }}
                    className={cx(
                      "group mb-2.5 cursor-grab rounded-lg border border-l-4 border-[var(--border-subtle)]",
                      "bg-[var(--surface)] p-3 shadow-sm transition active:cursor-grabbing",
                      TIER_BORDER[card.tier ?? 0] ?? "border-l-[var(--border-subtle)]",
                      dragId === card.id ? "opacity-40" : "hover:shadow-md",
                      saving === card.id && "animate-pulse",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/companies/${card.id}`}
                        draggable={false}
                        className="text-sm leading-snug font-semibold hover:underline"
                      >
                        {card.legalName}
                      </Link>
                      <GripIcon />
                    </div>
                    {card.dbaName && (
                      <p className="mt-0.5 text-xs text-[var(--muted)]">{card.dbaName}</p>
                    )}

                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <Badge tone={tierTone(card.tier)}>
                        {card.tier ? TIER_SHORT_LABELS[card.tier as 1 | 2 | 3 | 4] : "Unclassified"}
                      </Badge>
                      <span className="text-sm font-semibold">
                        {formatCurrency(card.acv, card.currency)}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-2 text-[11px] text-[var(--muted)]">
                      <span className="truncate">{card.ownerName ?? "Unassigned"}</span>
                      <span>{card.createdDate}</span>
                    </div>
                  </div>
                ))}

                {stageCards.length === 0 && (
                  <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-[var(--border-subtle)] text-xs text-[var(--muted)]">
                    No accounts
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
