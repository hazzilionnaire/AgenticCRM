import { AccountStatus, WorkflowStage } from "@/generated/prisma/enums";
import { isTerminalStage } from "@/server/workflow/stages";

/** Below this many days since the last touch, a company is left alone. */
export const STALE_DAYS = 14;

/** A brand-new, never-contacted lead gets this many days before it's flagged. */
export const NEVER_CONTACTED_GRACE_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface AttentionInput {
  workflowStage: WorkflowStage;
  lastActivityAt: Date | null;
  createdAt: Date;
  tier: number | null;
  accountStatus: AccountStatus;
  ownerId: string | null;
}

export interface AttentionResult {
  flagged: boolean;
  /** Human-readable reasons, most load-bearing first. Empty when not flagged. */
  reasons: string[];
  /** Higher sorts first. Only meaningful when `flagged` is true. */
  score: number;
  /** Null when the company has never had any recorded activity. */
  daysSinceActivity: number | null;
}

function daysBetween(earlier: Date, later: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / MS_PER_DAY);
}

/**
 * Deterministic, rule-based scoring -- no model call, so it's free and instant
 * to run over every account. `now` is a parameter (not read internally) so
 * this stays pure and testable the same way calculateTier() is.
 *
 * Closed deals are excluded outright: a won or lost account isn't "stale",
 * it's finished, no matter how long it's been sitting there.
 */
export function evaluateAttention(input: AttentionInput, now: Date = new Date()): AttentionResult {
  if (isTerminalStage(input.workflowStage)) {
    return { flagged: false, reasons: [], score: 0, daysSinceActivity: null };
  }

  const reasons: string[] = [];
  let score = 0;
  let daysSinceActivity: number | null = null;

  if (input.lastActivityAt) {
    daysSinceActivity = daysBetween(input.lastActivityAt, now);
    if (daysSinceActivity >= STALE_DAYS) {
      reasons.push(`No activity in ${daysSinceActivity} days`);
      score += daysSinceActivity;
    }
  } else {
    const daysSinceCreated = daysBetween(input.createdAt, now);
    if (daysSinceCreated >= NEVER_CONTACTED_GRACE_DAYS) {
      reasons.push(`Never contacted — created ${daysSinceCreated} days ago`);
      score += daysSinceCreated;
    }
  }

  if (input.accountStatus === AccountStatus.AT_RISK) {
    reasons.push("Account marked at risk");
    score += 30;
  }

  if (!input.ownerId) {
    reasons.push("No owner assigned");
    score += 15;
  }

  // Only weight tier once something else has already earned this account a
  // spot on the list -- a fresh, healthy Tier 4 account shouldn't rank simply
  // for being valuable.
  if (reasons.length > 0 && input.tier) {
    score += input.tier * 5;
  }

  return { flagged: reasons.length > 0, reasons, score, daysSinceActivity };
}
