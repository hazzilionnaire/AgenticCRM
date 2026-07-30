import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { serialize, toErrorResponse } from "@/lib/api";
import { updateCompanySchema } from "@/lib/validation/company";
import { getCompany, softDeleteCompany, updateCompany } from "@/server/companies/service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireUser();
    const { id } = await params;
    const company = await getCompany(id);
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
    return NextResponse.json(serialize(company));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const input = updateCompanySchema.parse(await request.json());
    return NextResponse.json(serialize(await updateCompany(id, input, user.id)));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    return NextResponse.json(serialize(await softDeleteCompany(id, user.id)));
  } catch (error) {
    return toErrorResponse(error);
  }
}
