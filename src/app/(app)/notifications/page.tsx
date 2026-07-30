import { redirect } from "next/navigation";
import { serialize } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { listNotifications } from "@/server/notifications/service";
import {
  NotificationList,
  type NotificationItem,
} from "@/components/notifications/notification-list";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const items = await listNotifications(user.id);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Notifications</h1>
        <p className="text-sm text-[var(--muted)]">
          Tier changes on accounts you own, and offers of tier support.
        </p>
      </div>
      <NotificationList items={serialize(items) as unknown as NotificationItem[]} />
    </div>
  );
}
