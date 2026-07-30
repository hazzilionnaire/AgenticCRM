import { notFound } from "next/navigation";
import { serialize } from "@/lib/api";
import { getActivity, getCompany } from "@/server/companies/service";
import { listIndustries, listParentCandidates, listReps } from "@/server/reference/service";
import {
  CompanyDetailView,
  type CompanyDetail,
} from "@/components/companies/company-detail";
import type { ActivityEntry } from "@/components/companies/activity-feed";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const company = await getCompany(id);
  if (!company) notFound();

  const [activity, industries, reps, parents] = await Promise.all([
    getActivity(id),
    listIndustries(),
    listReps(),
    listParentCandidates(id),
  ]);

  // The change log stores raw FK ids; this map lets the feed show names instead.
  const names: Record<string, string> = {};
  for (const rep of reps) names[rep.id] = rep.name ?? rep.email;
  for (const industry of industries) names[industry.id] = industry.name;
  for (const parent of parents) names[parent.id] = parent.legalName;

  return (
    <CompanyDetailView
      company={serialize(company) as unknown as CompanyDetail}
      activity={serialize(activity) as unknown as ActivityEntry[]}
      refData={{ industries, reps, parents }}
      names={names}
    />
  );
}
