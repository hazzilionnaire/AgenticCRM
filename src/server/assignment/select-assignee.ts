import { AssignmentStrategy } from "@/generated/prisma/enums";

/**
 * Pure selection logic for the assignment engine, kept separate from the DB work
 * in assign-owner.ts so it can be unit-tested exhaustively.
 */

export interface PoolMember {
  userId: string;
  sortOrder: number;
  isActive: boolean;
}

export interface RuleSnapshot {
  strategy: AssignmentStrategy;
  isActive: boolean;
  cursor: number;
  members: PoolMember[];
}

export interface Selection {
  userId: string;
  /** Cursor to persist back on the rule so the next pick continues the rotation. */
  nextCursor: number;
}

/** Active members in a stable order — pool edits must not reshuffle the rotation. */
export function eligibleMembers(rule: RuleSnapshot, excludeUserId?: string | null): PoolMember[] {
  return rule.members
    .filter((m) => m.isActive)
    .filter((m) => (excludeUserId ? m.userId !== excludeUserId : true))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.userId.localeCompare(b.userId));
}

/**
 * Picks the next assignee.
 *
 *  - ROUND_ROBIN walks the pool in sortOrder, advancing a persisted cursor.
 *  - FIXED always returns the first member, so a tier can be pinned to one rep.
 *
 * `excludeUserId` is used when proposing a *support* rep — the account owner
 * should never be suggested as their own backup. Returns null when the rule is
 * inactive or the pool has nobody eligible.
 */
export function selectAssignee(
  rule: RuleSnapshot,
  excludeUserId?: string | null,
): Selection | null {
  if (!rule.isActive) return null;

  const pool = eligibleMembers(rule, excludeUserId);
  if (pool.length === 0) return null;

  if (rule.strategy === AssignmentStrategy.FIXED) {
    return { userId: pool[0].userId, nextCursor: rule.cursor };
  }

  // Guard against a cursor left past the end by a shrinking pool.
  const index = ((rule.cursor % pool.length) + pool.length) % pool.length;
  return {
    userId: pool[index].userId,
    nextCursor: (index + 1) % pool.length,
  };
}
