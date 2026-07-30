import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { serialize, toErrorResponse } from "@/lib/api";
import { countUnread, listNotifications, markAllRead } from "@/server/notifications/service";

export async function GET() {
  try {
    const user = await requireUser();
    const [items, unread] = await Promise.all([
      listNotifications(user.id),
      countUnread(user.id),
    ]);
    return NextResponse.json(serialize({ items, unread }));
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** Marks the whole inbox read. */
export async function POST() {
  try {
    const user = await requireUser();
    return NextResponse.json({ marked: await markAllRead(user.id) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
