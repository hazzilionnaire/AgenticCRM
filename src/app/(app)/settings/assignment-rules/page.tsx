import { listAssignmentRules, listReps } from "@/server/reference/service";
import {
  AssignmentRulesEditor,
  type RuleView,
} from "@/components/settings/assignment-rules-editor";

export const dynamic = "force-dynamic";

export default async function AssignmentRulesPage() {
  const [rules, reps] = await Promise.all([listAssignmentRules(), listReps()]);

  // Every tier gets a row even if no rule exists yet, so pools can be created here.
  const byTier = new Map(rules.map((r) => [r.tier, r]));
  const view: RuleView[] = [1, 2, 3, 4].map((tier) => {
    const rule = byTier.get(tier);
    return {
      tier,
      strategy: rule?.strategy ?? "ROUND_ROBIN",
      isActive: rule?.isActive ?? true,
      cursor: rule?.cursor ?? 0,
      memberIds: rule?.members.filter((m) => m.isActive).map((m) => m.userId) ?? [],
    };
  });

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Assignment rules</h1>
        <p className="text-sm text-[var(--muted)]">
          Which reps own each tier. New companies are auto-assigned from these pools, and the
          same pools decide who gets proposed as tier support when a manually-owned account
          changes tier. Editable here — no code change needed.
        </p>
      </div>

      <AssignmentRulesEditor rules={view} reps={reps} />
    </div>
  );
}
