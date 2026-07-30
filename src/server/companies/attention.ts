import { prisma } from "@/lib/db";
import { evaluateAttention } from "@/server/attention/evaluate-attention";

/** Keeps the digest scannable -- a rep should see the worst cases, not a wall. */
export const NEEDS_ATTENTION_LIMIT = 20;

export interface AttentionItem {
  id: string;
  legalName: string;
  dbaName: string | null;
  tier: number | null;
  workflowStage: string;
  ownerName: string | null;
  reasons: string[];
  daysSinceActivity: number | null;
}

export async function listNeedsAttention(): Promise<AttentionItem[]> {
  const rows = await prisma.company.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      legalName: true,
      dbaName: true,
      tier: true,
      workflowStage: true,
      lastActivityAt: true,
      createdAt: true,
      accountStatus: true,
      ownerId: true,
      owner: { select: { name: true, email: true } },
    },
  });

  const now = new Date();

  return rows
    .map((row) => ({ row, result: evaluateAttention(row, now) }))
    .filter(({ result }) => result.flagged)
    .sort((a, b) => b.result.score - a.result.score)
    .slice(0, NEEDS_ATTENTION_LIMIT)
    .map(({ row, result }) => ({
      id: row.id,
      legalName: row.legalName,
      dbaName: row.dbaName,
      tier: row.tier,
      workflowStage: row.workflowStage,
      ownerName: row.owner?.name ?? row.owner?.email ?? null,
      reasons: result.reasons,
      daysSinceActivity: result.daysSinceActivity,
    }));
}
