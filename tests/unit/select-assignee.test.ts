import { describe, expect, it } from "vitest";
import { AssignmentStrategy } from "@/generated/prisma/enums";
import {
  eligibleMembers,
  selectAssignee,
  type RuleSnapshot,
} from "@/server/assignment/select-assignee";

const rule = (overrides: Partial<RuleSnapshot> = {}): RuleSnapshot => ({
  strategy: AssignmentStrategy.ROUND_ROBIN,
  isActive: true,
  cursor: 0,
  members: [
    { userId: "alice", sortOrder: 0, isActive: true },
    { userId: "bob", sortOrder: 1, isActive: true },
    { userId: "carol", sortOrder: 2, isActive: true },
  ],
  ...overrides,
});

describe("eligibleMembers", () => {
  it("drops inactive members and sorts by sortOrder", () => {
    const members = eligibleMembers(
      rule({
        members: [
          { userId: "carol", sortOrder: 2, isActive: true },
          { userId: "bob", sortOrder: 1, isActive: false },
          { userId: "alice", sortOrder: 0, isActive: true },
        ],
      }),
    );
    expect(members.map((m) => m.userId)).toEqual(["alice", "carol"]);
  });

  it("breaks sortOrder ties deterministically", () => {
    const members = eligibleMembers(
      rule({
        members: [
          { userId: "zoe", sortOrder: 0, isActive: true },
          { userId: "adam", sortOrder: 0, isActive: true },
        ],
      }),
    );
    expect(members.map((m) => m.userId)).toEqual(["adam", "zoe"]);
  });

  it("honours the exclusion", () => {
    expect(eligibleMembers(rule(), "bob").map((m) => m.userId)).toEqual(["alice", "carol"]);
  });
});

describe("selectAssignee — round robin", () => {
  it("walks the pool in order and wraps around", () => {
    let current = rule();
    const picked: string[] = [];

    for (let i = 0; i < 7; i += 1) {
      const selection = selectAssignee(current)!;
      picked.push(selection.userId);
      current = { ...current, cursor: selection.nextCursor };
    }

    expect(picked).toEqual(["alice", "bob", "carol", "alice", "bob", "carol", "alice"]);
  });

  it("distributes evenly over many picks", () => {
    let current = rule();
    const counts: Record<string, number> = { alice: 0, bob: 0, carol: 0 };

    for (let i = 0; i < 300; i += 1) {
      const selection = selectAssignee(current)!;
      counts[selection.userId] += 1;
      current = { ...current, cursor: selection.nextCursor };
    }

    expect(counts).toEqual({ alice: 100, bob: 100, carol: 100 });
  });

  it("recovers when the pool shrank below a stale cursor", () => {
    const selection = selectAssignee(
      rule({
        cursor: 9,
        members: [{ userId: "alice", sortOrder: 0, isActive: true }],
      }),
    );
    expect(selection).toEqual({ userId: "alice", nextCursor: 0 });
  });

  it("skips deactivated members without leaving a gap in the rotation", () => {
    let current = rule({
      members: [
        { userId: "alice", sortOrder: 0, isActive: true },
        { userId: "bob", sortOrder: 1, isActive: false },
        { userId: "carol", sortOrder: 2, isActive: true },
      ],
    });
    const picked: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const selection = selectAssignee(current)!;
      picked.push(selection.userId);
      current = { ...current, cursor: selection.nextCursor };
    }
    expect(picked).toEqual(["alice", "carol", "alice", "carol"]);
  });
});

describe("selectAssignee — fixed", () => {
  it("always returns the first member and leaves the cursor alone", () => {
    const fixed = rule({ strategy: AssignmentStrategy.FIXED, cursor: 2 });
    expect(selectAssignee(fixed)).toEqual({ userId: "alice", nextCursor: 2 });
    expect(selectAssignee(fixed)).toEqual({ userId: "alice", nextCursor: 2 });
  });
});

describe("selectAssignee — no candidate", () => {
  it("returns null for an inactive rule", () => {
    expect(selectAssignee(rule({ isActive: false }))).toBeNull();
  });

  it("returns null for an empty pool", () => {
    expect(selectAssignee(rule({ members: [] }))).toBeNull();
  });

  it("returns null when every member is inactive", () => {
    expect(
      selectAssignee(rule({ members: [{ userId: "alice", sortOrder: 0, isActive: false }] })),
    ).toBeNull();
  });

  it("returns null when the only member is the excluded user", () => {
    expect(
      selectAssignee(
        rule({ members: [{ userId: "alice", sortOrder: 0, isActive: true }] }),
        "alice",
      ),
    ).toBeNull();
  });

  it("never proposes the excluded user as tier support", () => {
    for (let cursor = 0; cursor < 6; cursor += 1) {
      const selection = selectAssignee(rule({ cursor }), "bob");
      expect(selection?.userId).not.toBe("bob");
    }
  });
});
