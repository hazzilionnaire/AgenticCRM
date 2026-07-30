import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { toErrorResponse } from "@/lib/api";
import { getCompany } from "@/server/companies/service";
import { draftIntroEmail } from "@/server/ai/draft-intro-email";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  try {
    await requireUser();
    const { id } = await params;
    const company = await getCompany(id);
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    const draft = await draftIntroEmail({
      legalName: company.legalName,
      dbaName: company.dbaName,
      industryName: company.industry?.name ?? null,
      tier: company.tier,
      companyType: company.companyType,
      lifecycleStage: company.lifecycleStage,
      websiteDomain: company.websiteDomain,
    });

    return NextResponse.json(draft);
  } catch (error) {
    return toErrorResponse(error);
  }
}
