import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { serialize, toErrorResponse } from "@/lib/api";
import { getActivity } from "@/server/companies/service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireUser();
    const { id } = await params;
    return NextResponse.json(serialize(await getActivity(id)));
  } catch (error) {
    return toErrorResponse(error);
  }
}
