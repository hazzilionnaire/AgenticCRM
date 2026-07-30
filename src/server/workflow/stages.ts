import { WorkflowStage } from "@/generated/prisma/enums";

/**
 * The prospect workflow, in order — the pipeline board renders one column per
 * entry, left to right. Every call site reads the order from here rather than
 * hard-coding it, so adding a stage means adding it to the enum and to this
 * array. The order must match the enum declaration in schema.prisma, because
 * Postgres sorts an enum column by declaration order.
 */
export const WORKFLOW_STAGE_ORDER: WorkflowStage[] = [
  WorkflowStage.PENDING,
  WorkflowStage.CONTACTED,
  WorkflowStage.QUALIFIED,
  WorkflowStage.PROPOSAL_SENT,
  WorkflowStage.NEGOTIATION,
  WorkflowStage.CLOSED_WON,
  WorkflowStage.CLOSED_LOST,
];

/**
 * Stages a deal comes to rest in. They're siblings rather than sequential, so
 * neither one has a "next" — a rep picks won or lost, they don't pass through.
 */
export const TERMINAL_STAGES: WorkflowStage[] = [
  WorkflowStage.CLOSED_WON,
  WorkflowStage.CLOSED_LOST,
];

export function isTerminalStage(stage: WorkflowStage): boolean {
  return TERMINAL_STAGES.includes(stage);
}

export function stageIndex(stage: WorkflowStage): number {
  return WORKFLOW_STAGE_ORDER.indexOf(stage);
}

/** The stage a rep would normally advance to, or null at the end of the pipeline. */
export function nextStage(stage: WorkflowStage): WorkflowStage | null {
  if (isTerminalStage(stage)) return null;
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
