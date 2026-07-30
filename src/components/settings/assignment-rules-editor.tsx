"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { tierLabel } from "@/server/tiering/calculate-tier";
import { Button } from "@/components/ui/buttons";
import { Badge, Card, cx, inputClass, labelClass, tierTone } from "@/components/ui/primitives";

export interface RuleView {
  tier: number;
  strategy: string;
  isActive: boolean;
  cursor: number;
  memberIds: string[];
}

interface Rep {
  id: string;
  name: string | null;
  email: string;
}

function RuleCard({ rule, reps }: { rule: RuleView; reps: Rep[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState(rule);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    draft.strategy !== rule.strategy ||
    draft.isActive !== rule.isActive ||
    draft.memberIds.join(",") !== rule.memberIds.join(",");

  function toggleMember(id: string) {
    setSaved(false);
    setDraft((prev) => ({
      ...prev,
      memberIds: prev.memberIds.includes(id)
        ? prev.memberIds.filter((m) => m !== id)
        : [...prev.memberIds, id],
    }));
  }

  function move(index: number, delta: number) {
    const next = [...draft.memberIds];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setSaved(false);
    setDraft((prev) => ({ ...prev, memberIds: next }));
  }

  async function save() {
    setSaving(true);
    setError(null);

    const response = await fetch("/api/assignment-rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tier: draft.tier,
        strategy: draft.strategy,
        isActive: draft.isActive,
        memberIds: draft.memberIds,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Could not save the rule");
      setSaving(false);
      return;
    }

    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  const nameOf = (id: string) => {
    const rep = reps.find((r) => r.id === id);
    return rep ? (rep.name ?? rep.email) : id;
  };

  const unselected = reps.filter((r) => !draft.memberIds.includes(r.id));

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Badge tone={tierTone(draft.tier)}>Tier {draft.tier}</Badge>
          {tierLabel(draft.tier)}
        </span>
      }
      actions={
        <div className="flex items-center gap-2">
          {saved && !dirty && <span className="text-xs text-emerald-600">Saved</span>}
          <Button variant="primary" onClick={save} disabled={!dirty || saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Strategy</label>
            <select
              value={draft.strategy}
              onChange={(e) => {
                setSaved(false);
                setDraft((prev) => ({ ...prev, strategy: e.target.value }));
              }}
              className={inputClass}
            >
              <option value="ROUND_ROBIN">Round-robin across the pool</option>
              <option value="FIXED">Fixed — always the first rep</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(e) => {
                  setSaved(false);
                  setDraft((prev) => ({ ...prev, isActive: e.target.checked }));
                }}
                className="accent-[var(--accent)]"
              />
              Rule active
            </label>
          </div>
        </div>

        <div>
          <label className={labelClass}>
            Pool ({draft.memberIds.length}) — order sets the rotation
          </label>
          {draft.memberIds.length === 0 ? (
            <p className="rounded-md border border-dashed border-[var(--border-subtle)] px-3 py-3 text-xs text-[var(--muted)]">
              Empty pool — companies at this tier stay unassigned.
            </p>
          ) : (
            <ol className="space-y-1.5">
              {draft.memberIds.map((id, index) => (
                <li
                  key={id}
                  className={cx(
                    "flex items-center gap-2 rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm",
                    draft.strategy === "ROUND_ROBIN" &&
                      index === draft.cursor % Math.max(draft.memberIds.length, 1) &&
                      "border-[var(--accent)]/50 bg-[var(--accent)]/[0.06]",
                  )}
                >
                  <span className="w-5 text-xs text-[var(--muted)]">{index + 1}</span>
                  <span className="flex-1 truncate">{nameOf(id)}</span>
                  {draft.strategy === "ROUND_ROBIN" &&
                    index === draft.cursor % Math.max(draft.memberIds.length, 1) && (
                      <Badge tone="blue">Next up</Badge>
                    )}
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="rounded px-1.5 text-xs disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/10"
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === draft.memberIds.length - 1}
                    className="rounded px-1.5 text-xs disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/10"
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleMember(id)}
                    className="rounded px-1.5 text-xs text-red-600 hover:bg-red-500/10"
                    aria-label="Remove from pool"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>

        {unselected.length > 0 && (
          <div>
            <label className={labelClass}>Add a rep</label>
            <div className="flex flex-wrap gap-1.5">
              {unselected.map((rep) => (
                <button
                  key={rep.id}
                  type="button"
                  onClick={() => toggleMember(rep.id)}
                  className="rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-xs transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  + {rep.name ?? rep.email}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </Card>
  );
}

export function AssignmentRulesEditor({ rules, reps }: { rules: RuleView[]; reps: Rep[] }) {
  return (
    <div className="space-y-4">
      {rules.map((rule) => (
        <RuleCard key={rule.tier} rule={rule} reps={reps} />
      ))}
    </div>
  );
}
