import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { serialize, toErrorResponse } from "@/lib/api";
import { restoreCompany } from "@/server/companies/service";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    return NextResponse.json(serialize(await restoreCompany(id, user.id)));
  } catch (error) {
    return toErrorResponse(error);
  }
}
