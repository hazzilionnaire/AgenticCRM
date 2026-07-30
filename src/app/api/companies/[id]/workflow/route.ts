import { NextRequest, NextResponse } from "next/server";
import type { WorkflowStage } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { serialize, toErrorResponse } from "@/lib/api";
import { workflowTransitionSchema } from "@/lib/validation/company";
import { transitionWorkflow } from "@/server/companies/service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const { stage, note } = workflowTransitionSchema.parse(await request.json());
    const company = await transitionWorkflow(id, stage as WorkflowStage, user.id, note);
    return NextResponse.json(serialize(company));
  } catch (error) {
    return toErrorResponse(error);
  }
}
