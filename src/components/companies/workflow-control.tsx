"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { WorkflowStage } from "@/generated/prisma/enums";
import { WORKFLOW_STAGE_LABELS, formatDateTime } from "@/lib/labels";
import { WORKFLOW_STAGE_ORDER } from "@/server/workflow/stages";
import { Button } from "@/components/ui/buttons";
import { cx } from "@/components/ui/primitives";

export function WorkflowControl({
  companyId,
  stage,
  changedAt,
  changedBy,
  disabled,
}: {
  companyId: string;
  stage: WorkflowStage;
  changedAt: string | Date | null;
  changedBy: string | null;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function moveTo(next: WorkflowStage) {
    setPending(next);
    setError(null);

    const response = await fetch(`/api/companies/${companyId}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: next }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Could not update the workflow stage");
      setPending(null);
      return;
    }

    setPending(null);
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {WORKFLOW_STAGE_ORDER.map((candidate) => {
          const active = candidate === stage;
          return (
            <Button
              key={candidate}
              variant={active ? "primary" : "secondary"}
              disabled={disabled || active || pending !== null}
              onClick={() => moveTo(candidate)}
              className={cx(active && "cursor-default")}
            >
              {pending === candidate ? "Saving…" : WORKFLOW_STAGE_LABELS[candidate]}
            </Button>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-[var(--muted)]">
        {changedAt
          ? `Moved to ${WORKFLOW_STAGE_LABELS[stage]} on ${formatDateTime(changedAt)}${
              changedBy ? ` by ${changedBy}` : ""
            }`
          : "Not yet moved out of the initial stage."}
      </p>

      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
