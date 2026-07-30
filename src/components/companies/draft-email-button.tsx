"use client";

import { useState } from "react";
import { Button } from "@/components/ui/buttons";
import { Card } from "@/components/ui/primitives";

interface EmailDraft {
  subject: string;
  body: string;
}

export function DraftEmailButton({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<EmailDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"subject" | "body" | null>(null);

  async function generate() {
    setOpen(true);
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/companies/${companyId}/draft-email`, { method: "POST" });

    setLoading(false);

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Could not generate a draft.");
      return;
    }

    setDraft(await response.json());
  }

  async function copy(text: string, which: "subject" | "body") {
    await navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied((c) => (c === which ? null : c)), 1500);
  }

  return (
    <>
      <Button variant="secondary" onClick={generate} disabled={loading}>
        {loading ? "Drafting…" : "Draft intro email"}
      </Button>

      {open && (
        <Card
          className="mt-3"
          title="Draft intro email"
          description="Based on this account's industry and profile -- review before sending. It has no access to real news, so treat anything specific it claims as unverified."
          actions={
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
          }
        >
          <div className="space-y-3">
            {loading && <p className="text-sm text-[var(--muted)]">Drafting…</p>}

            {error && (
              <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            {draft && (
              <>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--muted)]">Subject</span>
                    <Button variant="ghost" onClick={() => copy(draft.subject, "subject")}>
                      {copied === "subject" ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <p className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm">
                    {draft.subject}
                  </p>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--muted)]">Body</span>
                    <Button variant="ghost" onClick={() => copy(draft.body, "body")}>
                      {copied === "body" ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <p className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm whitespace-pre-line">
                    {draft.body}
                  </p>
                </div>

                <Button variant="secondary" onClick={generate} disabled={loading}>
                  Regenerate
                </Button>
              </>
            )}
          </div>
        </Card>
      )}
    </>
  );
}
