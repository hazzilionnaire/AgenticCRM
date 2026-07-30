import Link from "next/link";
import type { AttentionItem } from "@/server/companies/attention";
import { WORKFLOW_STAGE_LABELS } from "@/lib/labels";
import { TIER_SHORT_LABELS } from "@/server/tiering/calculate-tier";
import type { WorkflowStage } from "@/generated/prisma/enums";
import { Badge, Card, EmptyState, tierTone } from "@/components/ui/primitives";

export function NeedsAttention({ items }: { items: AttentionItem[] }) {
  return (
    <Card
      title="Needs attention"
      description="Ranked by staleness, risk, and account value. Closed deals are never included."
    >
      {items.length === 0 ? (
        <EmptyState
          title="Nothing needs attention right now"
          hint="Every open account has been touched recently and none are flagged at risk."
        />
      ) : (
        <ul className="divide-y divide-[var(--border-subtle)]">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-start gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/companies/${item.id}`}
                    className="text-sm font-medium hover:text-[var(--accent)] hover:underline"
                  >
                    {item.legalName}
                  </Link>
                  {item.dbaName && (
                    <span className="text-xs text-[var(--muted)]">({item.dbaName})</span>
                  )}
                  <Badge tone={tierTone(item.tier)}>
                    {item.tier ? TIER_SHORT_LABELS[item.tier as 1 | 2 | 3 | 4] : "Unclassified"}
                  </Badge>
                  <Badge tone="neutral">
                    {WORKFLOW_STAGE_LABELS[item.workflowStage as WorkflowStage]}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">{item.reasons.join(" · ")}</p>
              </div>
              <span className="shrink-0 text-xs text-[var(--muted)]">
                {item.ownerName ?? "Unassigned"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
