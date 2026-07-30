import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AssignmentStrategy } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { toErrorResponse } from "@/lib/api";
import { prisma } from "@/lib/db";
import { listAssignmentRules } from "@/server/reference/service";

export async function GET() {
  try {
    await requireUser();
    return NextResponse.json(await listAssignmentRules());
  } catch (error) {
    return toErrorResponse(error);
  }
}

const updateRuleSchema = z.object({
  tier: z.number().int().min(1).max(4),
  strategy: z.enum(Object.values(AssignmentStrategy) as [string, ...string[]]),
  isActive: z.boolean(),
  memberIds: z.array(z.string()).max(50),
});

/**
 * Replaces a tier's pool. Kept as a whole-rule PUT because the settings screen
 * edits the pool as a unit, and member order is meaningful to the rotation.
 */
export async function PUT(request: NextRequest) {
  try {
    await requireUser();
    const input = updateRuleSchema.parse(await request.json());

    const rule = await prisma.$transaction(async (tx) => {
      const existing = await tx.assignmentRule.upsert({
        where: { tier: input.tier },
        create: {
          tier: input.tier,
          strategy: input.strategy as AssignmentStrategy,
          isActive: input.isActive,
        },
        update: {
          strategy: input.strategy as AssignmentStrategy,
          isActive: input.isActive,
        },
      });

      await tx.assignmentRuleMember.deleteMany({
        where: { ruleId: existing.id, userId: { notIn: input.memberIds } },
      });

      for (const [i, userId] of input.memberIds.entries()) {
        await tx.assignmentRuleMember.upsert({
          where: { ruleId_userId: { ruleId: existing.id, userId } },
          create: { ruleId: existing.id, userId, sortOrder: i },
          update: { sortOrder: i, isActive: true },
        });
      }

      // A shrunken pool can leave the cursor past the end; selectAssignee guards
      // against that, but normalising here keeps the stored state sensible.
      if (input.memberIds.length > 0 && existing.cursor >= input.memberIds.length) {
        await tx.assignmentRule.update({
          where: { id: existing.id },
          data: { cursor: existing.cursor % input.memberIds.length },
        });
      }

      return existing;
    });

    return NextResponse.json(rule);
  } catch (error) {
    return toErrorResponse(error);
  }
}
