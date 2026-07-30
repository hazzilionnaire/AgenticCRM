import Link from "next/link";
import { listIndustries, listParentCandidates, listReps } from "@/server/reference/service";
import { NewCompanyForm } from "@/components/companies/new-company-form";

export const dynamic = "force-dynamic";

export default async function NewCompanyPage() {
  const [industries, reps, parents] = await Promise.all([
    listIndustries(),
    listReps(),
    listParentCandidates(),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <Link href="/companies" className="text-sm text-[var(--muted)] hover:underline">
          ← Companies
        </Link>
        <h1 className="mt-1 text-lg font-semibold">New company</h1>
        <p className="text-sm text-[var(--muted)]">
          Tier and account owner are assigned automatically on save.
        </p>
      </div>

      <NewCompanyForm refData={{ industries, reps, parents }} />
    </div>
  );
}
