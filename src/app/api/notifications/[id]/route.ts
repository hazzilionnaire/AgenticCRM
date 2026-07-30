import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { serialize, toErrorResponse } from "@/lib/api";
import {
  acceptSupportOffer,
  dismissSupportOffer,
  markRead,
} from "@/server/notifications/service";

type Params = { params: Promise<{ id: string }> };

const actionSchema = z.object({ action: z.enum(["accept", "dismiss", "read"]) });

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const { action } = actionSchema.parse(await request.json());

    switch (action) {
      case "accept":
        return NextResponse.json(serialize(await acceptSupportOffer(user.id, id)));
      case "dismiss":
        await dismissSupportOffer(user.id, id);
        return NextResponse.json({ ok: true });
      case "read":
        return NextResponse.json({ ok: await markRead(user.id, id) });
    }
  } catch (error) {
    return toErrorResponse(error);
  }
}
