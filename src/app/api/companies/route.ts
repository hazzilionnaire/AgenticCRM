import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { serialize, toErrorResponse } from "@/lib/api";
import { companyListQuerySchema, createCompanySchema } from "@/lib/validation/company";
import { createCompany, listCompanies } from "@/server/companies/service";

export async function GET(request: NextRequest) {
  try {
    await requireUser();
    const query = companyListQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    return NextResponse.json(serialize(await listCompanies(query)));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const input = createCompanySchema.parse(await request.json());
    const company = await createCompany(input, user.id);
    return NextResponse.json(serialize(company), { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
