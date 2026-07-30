import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { countUnread } from "@/server/notifications/service";
import { NavBar } from "@/components/shell/nav-bar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/login");

  const unread = await countUnread(user.id);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[var(--border-subtle)] bg-[var(--surface)]/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-6 px-5 py-3">
          <Link href="/companies" className="text-sm font-semibold tracking-tight">
            AgenticCRM
          </Link>
          <NavBar user={user} unread={unread} />
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-5 py-6">{children}</main>
    </div>
  );
}
