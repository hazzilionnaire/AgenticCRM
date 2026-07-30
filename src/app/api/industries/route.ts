import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { toErrorResponse } from "@/lib/api";
import { listIndustries } from "@/server/reference/service";

export async function GET() {
  try {
    await requireUser();
    return NextResponse.json(await listIndustries());
  } catch (error) {
    return toErrorResponse(error);
  }
}
