import {
  ActivityType,
  AssignmentSource,
  NotificationType,
} from "@/generated/prisma/enums";
import { logActivity } from "@/server/activity/log";
import { selectAssignee, type RuleSnapshot } from "@/server/assignment/select-assignee";
import type { Db } from "@/server/db-types";
import { tierLabel } from "@/server/tiering/calculate-tier";

/**
 * Ownership policy (confirmed with the product owner):
 *
 *  - A company with no owner, or one whose owner was itself auto-assigned, is
 *    (re)assigned from the tier's pool.
 *  - A MANUALLY set owner is NEVER replaced. Instead, on a tier change the owner
 *    is notified and a rep from the new tier's pool is proposed as tier support.
 *    Accepting the offer adds that rep as a collaborator; the owner is unchanged.
 *
 * "Experienced in that tier" is defined as membership in that tier's assignment
 * pool — the same config that drives auto-assignment, so there is one list to
 * maintain rather than two.
 */

export type AssignmentOutcome =
  | { kind: "assigned"; userId: string }
  | { kind: "support_offered"; ownerId: string; suggestedUserId: string }
  | {
      kind: "skipped";
      reason: "no_tier" | "no_pool" | "manual_owner" | "manual_owner_no_candidate";
    };

async function loadRule(db: Db, tier: number): Promise<RuleSnapshot | null> {
  const rule = await db.assignmentRule.findUnique({
    where: { tier },
    include: { members: true },
  });
  if (!rule) return null;
  return {
    strategy: rule.strategy,
    isActive: rule.isActive,
    cursor: rule.cursor,
    members: rule.members.map((m) => ({
      userId: m.userId,
      sortOrder: m.sortOrder,
      isActive: m.isActive,
    })),
  };
}

/**
 * Applies the ownership policy for a company at a given tier.
 * Must be called inside the same transaction as the write that changed the tier.
 */
export async function applyAssignment(
  db: Db,
  params: {
    companyId: string;
    companyName: string;
    tier: number | null;
    currentOwnerId: string | null;
    ownerAssignedBy: AssignmentSource | null;
    /**
     * "create" is a company being written for the first time; "retier" is an
     * existing company whose tier just moved. Only a retier can produce a
     * support offer — on create there is no change to tell the owner about.
     */
    mode: "create" | "retier";
    previousTier?: number | null;
    actorId?: string | null;
  },
): Promise<AssignmentOutcome> {
  const { companyId, companyName, tier, currentOwnerId, ownerAssignedBy, actorId } = params;

  if (tier === null) return { kind: "skipped", reason: "no_tier" };

  const rule = await loadRule(db, tier);
  if (!rule) return { kind: "skipped", reason: "no_pool" };

  const ownerIsManual = currentOwnerId !== null && ownerAssignedBy === AssignmentSource.MANUAL;

  if (ownerIsManual) {
    if (params.mode === "create") return { kind: "skipped", reason: "manual_owner" };

    return offerTierSupport(db, {
      companyId,
      companyName,
      tier,
      ownerId: currentOwnerId,
      previousTier: params.previousTier ?? null,
      rule,
    });
  }

  const selection = selectAssignee(rule);
  if (!selection) return { kind: "skipped", reason: "no_pool" };

  // Already owned by the right rep — don't churn the cursor or log a no-op.
  if (selection.userId === currentOwnerId) {
    return { kind: "assigned", userId: selection.userId };
  }

  await db.assignmentRule.update({
    where: { tier },
    data: { cursor: selection.nextCursor },
  });

  await db.company.update({
    where: { id: companyId },
    data: {
      ownerId: selection.userId,
      ownerAssignedBy: AssignmentSource.AUTO,
      ownerAssignedAt: new Date(),
    },
  });

  await logActivity(db, {
    companyId,
    actorId,
    type: ActivityType.OWNER_ASSIGNED,
    field: "ownerId",
    oldValue: currentOwnerId,
    newValue: selection.userId,
    metadata: { tier, automatic: true },
  });

  await db.notification.create({
    data: {
      userId: selection.userId,
      companyId,
      type: NotificationType.COMPANY_ASSIGNED,
      title: `You've been assigned ${companyName}`,
      body: `Auto-assigned from the Tier ${tier} (${tierLabel(tier)}) pool.`,
      metadata: { tier },
    },
  });

  return { kind: "assigned", userId: selection.userId };
}

/**
 * A manually-owned account changed tier. Keep the owner, tell them about it, and
 * propose a rep from the new tier's pool who can tag along if they want help.
 */
async function offerTierSupport(
  db: Db,
  params: {
    companyId: string;
    companyName: string;
    tier: number;
    ownerId: string;
    previousTier: number | null;
    rule: RuleSnapshot;
  },
): Promise<AssignmentOutcome> {
  const { companyId, companyName, tier, ownerId, previousTier, rule } = params;

  // Don't propose the owner to themselves, nor anyone already collaborating.
  const existing = await db.companyCollaborator.findMany({
    where: { companyId },
    select: { userId: true },
  });
  const excluded = new Set([ownerId, ...existing.map((c) => c.userId)]);

  const candidate = selectAssignee(
    { ...rule, members: rule.members.filter((m) => !excluded.has(m.userId)) },
    null,
  );

  if (!candidate) {
    return { kind: "skipped", reason: "manual_owner_no_candidate" };
  }

  await db.assignmentRule.update({
    where: { tier },
    data: { cursor: candidate.nextCursor },
  });

  const suggested = await db.user.findUnique({
    where: { id: candidate.userId },
    select: { name: true, email: true },
  });
  const suggestedName = suggested?.name ?? suggested?.email ?? "a teammate";

  const movement =
    previousTier === null
      ? `is now Tier ${tier} (${tierLabel(tier)})`
      : `moved from Tier ${previousTier} (${tierLabel(previousTier)}) to Tier ${tier} (${tierLabel(tier)})`;

  await db.notification.create({
    data: {
      userId: ownerId,
      companyId,
      type: NotificationType.TIER_CHANGED_SUPPORT_OFFER,
      title: `${companyName} ${movement}`,
      body:
        `You're still the account owner — nothing has changed there. ` +
        `${suggestedName} works Tier ${tier} accounts and can tag along if you'd like a hand.`,
      suggestedUserId: candidate.userId,
      metadata: { tier, previousTier },
    },
  });

  return { kind: "support_offered", ownerId, suggestedUserId: candidate.userId };
}
