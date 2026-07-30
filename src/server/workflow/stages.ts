import { WorkflowStage } from "@/generated/prisma/enums";

/**
 * The prospect workflow, in order. Phase 1 ships PENDING → CONTACTED; adding
 * QUALIFIED / MEETING_SET means adding them to the enum and to this array —
 * every call site reads the order from here rather than hard-coding it.
 */
export const WORKFLOW_STAGE_ORDER: WorkflowStage[] = [
  WorkflowStage.PENDING,
  WorkflowStage.CONTACTED,
];

export function stageIndex(stage: WorkflowStage): number {
  return WORKFLOW_STAGE_ORDER.indexOf(stage);
}

/** The stage a rep would normally advance to, or null at the end of the pipeline. */
export function nextStage(stage: WorkflowStage): WorkflowStage | null {
  const i = stageIndex(stage);
  if (i < 0 || i >= WORKFLOW_STAGE_ORDER.length - 1) return null;
  return WORKFLOW_STAGE_ORDER[i + 1];
}

/**
 * Any known stage is reachable — reps need to walk an account back when they
 * mis-click. The only rejected transition is a no-op.
 */
export function canTransition(from: WorkflowStage, to: WorkflowStage): boolean {
  return stageIndex(to) >= 0 && from !== to;
}
