-- AlterEnum
-- Adds the deal stages the pipeline board needs. Purely additive: PENDING and
-- CONTACTED keep their meaning, so no existing row has to be rewritten.
--
-- `ADD VALUE` appends to the end of the enum, which is why the order here has to
-- match the order in schema.prisma -- Postgres sorts an enum column by the order
-- the values were declared, not alphabetically.
ALTER TYPE "WorkflowStage" ADD VALUE IF NOT EXISTS 'QUALIFIED';
ALTER TYPE "WorkflowStage" ADD VALUE IF NOT EXISTS 'PROPOSAL_SENT';
ALTER TYPE "WorkflowStage" ADD VALUE IF NOT EXISTS 'NEGOTIATION';
ALTER TYPE "WorkflowStage" ADD VALUE IF NOT EXISTS 'CLOSED_WON';
ALTER TYPE "WorkflowStage" ADD VALUE IF NOT EXISTS 'CLOSED_LOST';
