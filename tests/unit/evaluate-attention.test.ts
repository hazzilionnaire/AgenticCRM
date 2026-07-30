import { describe, expect, it } from "vitest";
import { AccountStatus, WorkflowStage } from "@/generated/prisma/enums";
import {
  NEVER_CONTACTED_GRACE_DAYS,
  STALE_DAYS,
  evaluateAttention,
  type AttentionInput,
} from "@/server/attention/evaluate-attention";

const NOW = new Date("2026-07-30T00:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

function baseInput(overrides: Partial<AttentionInput> = {}): AttentionInput {
  return {
    workflowStage: WorkflowStage.CONTACTED,
    lastActivityAt: daysAgo(1),
    createdAt: daysAgo(30),
    tier: null,
    accountStatus: AccountStatus.ACTIVE,
    ownerId: "user-1",
    ...overrides,
  };
}

describe("evaluateAttention", () => {
  it("does not flag a recently touched account", () => {
    const result = evaluateAttention(baseInput({ lastActivityAt: daysAgo(1) }), NOW);
    expect(result.flagged).toBe(false);
    expect(result.reasons).toEqual([]);
  });

  it("flags an account once it crosses the staleness threshold", () => {
    const result = evaluateAttention(baseInput({ lastActivityAt: daysAgo(STALE_DAYS) }), NOW);
    expect(result.flagged).toBe(true);
    expect(result.reasons[0]).toMatch(/no activity/i);
    expect(result.daysSinceActivity).toBe(STALE_DAYS);
  });

  it("does not flag an account one day short of the staleness threshold", () => {
    const result = evaluateAttention(
      baseInput({ lastActivityAt: daysAgo(STALE_DAYS - 1) }),
      NOW,
    );
    expect(result.flagged).toBe(false);
  });

  it("excludes closed-won and closed-lost regardless of staleness", () => {
    const won = evaluateAttention(
      baseInput({ workflowStage: WorkflowStage.CLOSED_WON, lastActivityAt: daysAgo(400) }),
      NOW,
    );
    const lost = evaluateAttention(
      baseInput({ workflowStage: WorkflowStage.CLOSED_LOST, lastActivityAt: daysAgo(400) }),
      NOW,
    );
    expect(won.flagged).toBe(false);
    expect(lost.flagged).toBe(false);
  });

  it("flags a never-contacted account once it clears the grace period", () => {
    const result = evaluateAttention(
      baseInput({ lastActivityAt: null, createdAt: daysAgo(NEVER_CONTACTED_GRACE_DAYS) }),
      NOW,
    );
    expect(result.flagged).toBe(true);
    expect(result.reasons[0]).toMatch(/never contacted/i);
    expect(result.daysSinceActivity).toBeNull();
  });

  it("does not flag a never-contacted account still inside the grace period", () => {
    const result = evaluateAttention(
      baseInput({ lastActivityAt: null, createdAt: daysAgo(NEVER_CONTACTED_GRACE_DAYS - 1) }),
      NOW,
    );
    expect(result.flagged).toBe(false);
  });

  it("flags an at-risk account even when recently touched", () => {
    const result = evaluateAttention(
      baseInput({ accountStatus: AccountStatus.AT_RISK, lastActivityAt: daysAgo(1) }),
      NOW,
    );
    expect(result.flagged).toBe(true);
    expect(result.reasons).toContain("Account marked at risk");
  });

  it("flags an unowned account even when recently touched", () => {
    const result = evaluateAttention(baseInput({ ownerId: null, lastActivityAt: daysAgo(1) }), NOW);
    expect(result.flagged).toBe(true);
    expect(result.reasons).toContain("No owner assigned");
  });

  it("weights tier only when something else has already flagged the account", () => {
    const flaggedHighTier = evaluateAttention(
      baseInput({ lastActivityAt: daysAgo(STALE_DAYS), tier: 4 }),
      NOW,
    );
    const unflaggedHighTier = evaluateAttention(
      baseInput({ lastActivityAt: daysAgo(1), tier: 4 }),
      NOW,
    );
    expect(flaggedHighTier.score).toBeGreaterThan(STALE_DAYS);
    expect(unflaggedHighTier.flagged).toBe(false);
    expect(unflaggedHighTier.score).toBe(0);
  });

  it("ranks a stale, at-risk, high-tier account above a merely stale one", () => {
    const worse = evaluateAttention(
      baseInput({
        lastActivityAt: daysAgo(STALE_DAYS),
        accountStatus: AccountStatus.AT_RISK,
        tier: 4,
      }),
      NOW,
    );
    const merelyStale = evaluateAttention(
      baseInput({ lastActivityAt: daysAgo(STALE_DAYS) }),
      NOW,
    );
    expect(worse.score).toBeGreaterThan(merelyStale.score);
  });
});
