import Link from "next/link";
import { companyListQuerySchema } from "@/lib/validation/company";
import { listCompanies } from "@/server/companies/service";
import { listIndustries, listReps } from "@/server/reference/service";
import { CompanyTable, type CompanyRow } from "@/components/companies/company-table";
import { FilterBar } from "@/components/companies/filter-bar";

export const dynamic = "force-dynamic";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );

  // Bad query strings shouldn't 500 the page — fall back to defaults.
  const parsed = companyListQuerySchema.safeParse(flat);
  const query = parsed.success ? parsed.data : companyListQuerySchema.parse({});

  const [result, industries, reps] = await Promise.all([
    listCompanies(query),
    listIndustries(),
    listReps(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Companies</h1>
          <p className="text-sm text-[var(--muted)]">
            {result.total} account{result.total === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/companies/new"
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          New company
        </Link>
      </div>

      <FilterBar industries={industries} reps={reps} />

      <CompanyTable
        rows={result.rows as unknown as CompanyRow[]}
        total={result.total}
        page={result.page}
        pageCount={result.pageCount}
      />
    </div>
  );
}
