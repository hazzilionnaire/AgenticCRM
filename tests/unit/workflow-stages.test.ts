import { describe, expect, it } from "vitest";
import { WorkflowStage } from "@/generated/prisma/enums";
import { WORKFLOW_STAGE_ORDER, canTransition, nextStage, stageIndex } from "@/server/workflow/stages";

describe("workflow stages", () => {
  it("starts at PENDING and advances to CONTACTED", () => {
    expect(WORKFLOW_STAGE_ORDER[0]).toBe(WorkflowStage.PENDING);
    expect(nextStage(WorkflowStage.PENDING)).toBe(WorkflowStage.CONTACTED);
  });

  it("has no stage after the last one", () => {
    expect(nextStage(WORKFLOW_STAGE_ORDER.at(-1)!)).toBeNull();
  });

  it("orders every stage in the enum", () => {
    expect([...WORKFLOW_STAGE_ORDER].sort()).toEqual(Object.values(WorkflowStage).sort());
    for (const stage of Object.values(WorkflowStage)) {
      expect(stageIndex(stage)).toBeGreaterThanOrEqual(0);
    }
  });

  it("allows moving backwards so a mis-click can be undone", () => {
    expect(canTransition(WorkflowStage.CONTACTED, WorkflowStage.PENDING)).toBe(true);
  });

  it("rejects a no-op transition", () => {
    expect(canTransition(WorkflowStage.PENDING, WorkflowStage.PENDING)).toBe(false);
  });
});
