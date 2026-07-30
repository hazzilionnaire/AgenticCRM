import type { WorkflowStage } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

/**
 * The board holds every open account in memory so dragging, filtering and the
 * running totals stay instant — no refetch per interaction. That only works
 * while the set is bounded, hence the cap; the page tells the user when it bites
 * rather than silently showing a partial pipeline.
 */
export const PIPELINE_CARD_LIMIT = 500;

export interface PipelineCard {
  id: string;
  legalName: string;
  dbaName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  tier: number | null;
  /** Annual contract value as a string — Decimal loses precision through a float. */
  acv: string | null;
  currency: string;
  workflowStage: WorkflowStage;
  /** ISO date only (YYYY-MM-DD), so the date-range filter is a string compare. */
  createdDate: string;
}

export async function listPipeline(): Promise<{ cards: PipelineCard[]; capped: boolean }> {
  const rows = await prisma.company.findMany({
    where: { deletedAt: null },
    orderBy: [{ workflowStageChangedAt: "desc" }, { createdAt: "desc" }],
    take: PIPELINE_CARD_LIMIT + 1,
    select: {
      id: true,
      legalName: true,
      dbaName: true,
      tier: true,
      acv: true,
      currency: true,
      workflowStage: true,
      createdAt: true,
      owner: { select: { id: true, name: true, email: true } },
    },
  });

  const capped = rows.length > PIPELINE_CARD_LIMIT;

  return {
    capped,
    cards: rows.slice(0, PIPELINE_CARD_LIMIT).map((row) => ({
      id: row.id,
      legalName: row.legalName,
      dbaName: row.dbaName,
      ownerId: row.owner?.id ?? null,
      ownerName: row.owner?.name ?? row.owner?.email ?? null,
      tier: row.tier,
      acv: row.acv?.toString() ?? null,
      currency: row.currency,
      workflowStage: row.workflowStage,
      createdDate: row.createdAt.toISOString().slice(0, 10),
    })),
  };
}
