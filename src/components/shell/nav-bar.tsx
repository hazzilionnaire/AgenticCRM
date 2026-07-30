"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/auth";
import { Button } from "@/components/ui/buttons";
import { cx } from "@/components/ui/primitives";

const LINKS = [
  { href: "/home", label: "Home" },
  { href: "/companies", label: "Companies" },
  { href: "/notifications", label: "Notifications" },
  { href: "/settings/assignment-rules", label: "Assignment rules" },
];

export function NavBar({ user, unread }: { user: SessionUser; unread: number }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <nav className="flex flex-1 items-center gap-1">
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cx(
              "relative rounded-md px-2.5 py-1.5 text-sm transition",
              active
                ? "bg-black/[0.06] font-medium dark:bg-white/[0.08]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]",
            )}
          >
            {link.label}
            {link.href === "/notifications" && unread > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-semibold text-white">
                {unread}
              </span>
            )}
          </Link>
        );
      })}

      <div className="ml-auto flex items-center gap-3">
        <span className="hidden text-xs text-[var(--muted)] sm:inline">
          {user.name ?? user.email}
        </span>
        <Button variant="ghost" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </nav>
  );
}
