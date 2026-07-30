"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDateTime } from "@/lib/labels";
import { Button } from "@/components/ui/buttons";
import { Badge, Card, EmptyState, cx } from "@/components/ui/primitives";

export interface NotificationItem {
  id: string;
  type: string;
  status: string;
  title: string;
  body: string;
  createdAt: string;
  company: { id: string; legalName: string; tier: number | null } | null;
  suggestedUser: { id: string; name: string | null; email: string } | null;
}

export function NotificationList({ items }: { items: NotificationItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, action: "accept" | "dismiss" | "read") {
    setBusy(id);
    setError(null);

    const response = await fetch(`/api/notifications/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Action failed");
    }

    setBusy(null);
    router.refresh();
  }

  async function markAllRead() {
    setBusy("all");
    await fetch("/api/notifications", { method: "POST" });
    setBusy(null);
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <Card>
        <EmptyState
          title="Nothing here yet"
          hint="You'll be notified when an account you own changes tier."
        />
      </Card>
    );
  }

  const unread = items.filter((i) => i.status === "UNREAD").length;

  return (
    <div className="space-y-3">
      {unread > 0 && (
        <div className="flex justify-end">
          <Button variant="ghost" onClick={markAllRead} disabled={busy !== null}>
            Mark all read
          </Button>
        </div>
      )}

      {error && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {items.map((item) => {
        const isOffer = item.type === "TIER_CHANGED_SUPPORT_OFFER";
        const pendingOffer = isOffer && item.status !== "ACCEPTED" && item.status !== "DISMISSED";

        return (
          <article
            key={item.id}
            className={cx(
              "rounded-xl border bg-[var(--surface)] p-4 shadow-sm transition",
              item.status === "UNREAD"
                ? "border-[var(--accent)]/40"
                : "border-[var(--border-subtle)]",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">{item.title}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">{item.body}</p>
              </div>
              {item.status === "ACCEPTED" && <Badge tone="green">Accepted</Badge>}
              {item.status === "DISMISSED" && <Badge tone="neutral">Dismissed</Badge>}
              {item.status === "UNREAD" && <Badge tone="blue">New</Badge>}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {item.company && (
                <Link
                  href={`/companies/${item.company.id}`}
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  View {item.company.legalName} →
                </Link>
              )}
              <span className="text-xs text-[var(--muted)]">
                {formatDateTime(item.createdAt)}
              </span>

              <div className="ml-auto flex gap-2">
                {pendingOffer && item.suggestedUser && (
                  <>
                    <Button
                      variant="primary"
                      disabled={busy !== null}
                      onClick={() => act(item.id, "accept")}
                    >
                      Add {item.suggestedUser.name ?? item.suggestedUser.email}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy !== null}
                      onClick={() => act(item.id, "dismiss")}
                    >
                      No thanks
                    </Button>
                  </>
                )}
                {!pendingOffer && item.status === "UNREAD" && (
                  <Button
                    variant="ghost"
                    disabled={busy !== null}
                    onClick={() => act(item.id, "read")}
                  >
                    Mark read
                  </Button>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
