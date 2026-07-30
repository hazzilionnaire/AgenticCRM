import type { Prisma } from "@/generated/prisma/client";
import type { CompanyListQuery } from "@/lib/validation/company";

/**
 * Turns validated list params into a Prisma where/orderBy pair.
 *
 * Size filters (employee band, revenue band, explicit revenue range) are applied
 * independently of tier — a rep can ask for "50–249 employees" without the tier
 * derivation interfering, and can filter by tier without touching size.
 */
export function buildCompanyWhere(query: CompanyListQuery): Prisma.CompanyWhereInput {
  const where: Prisma.CompanyWhereInput = {};
  const and: Prisma.CompanyWhereInput[] = [];

  if (!query.includeDeleted) where.deletedAt = null;

  if (query.q) {
    and.push({
      OR: [
        { legalName: { contains: query.q, mode: "insensitive" } },
        { dbaName: { contains: query.q, mode: "insensitive" } },
      ],
    });
  }

  if (query.industryIds.length) and.push({ industryId: { in: query.industryIds } });
  if (query.employeeBands.length) {
    and.push({ employeeBand: { in: query.employeeBands as never[] } });
  }
  if (query.revenueBands.length) {
    and.push({ annualRevenueBand: { in: query.revenueBands as never[] } });
  }
  if (query.tiers.length) and.push({ tier: { in: query.tiers } });
  if (query.lifecycleStages.length) {
    and.push({ lifecycleStage: { in: query.lifecycleStages as never[] } });
  }
  if (query.workflowStages.length) {
    and.push({ workflowStage: { in: query.workflowStages as never[] } });
  }
  if (query.companyTypes.length) {
    and.push({ companyType: { in: query.companyTypes as never[] } });
  }
  if (query.accountStatuses.length) {
    and.push({ accountStatus: { in: query.accountStatuses as never[] } });
  }
  if (query.ownerIds.length) {
    const explicit = query.ownerIds.filter((id) => id !== "unassigned");
    const clauses: Prisma.CompanyWhereInput[] = [];
    if (explicit.length) clauses.push({ ownerId: { in: explicit } });
    if (query.ownerIds.includes("unassigned")) clauses.push({ ownerId: null });
    if (clauses.length) and.push({ OR: clauses });
  }

  if (query.revenueMin !== undefined || query.revenueMax !== undefined) {
    const range: Prisma.DecimalNullableFilter = {};
    if (query.revenueMin !== undefined) range.gte = query.revenueMin;
    if (query.revenueMax !== undefined) range.lte = query.revenueMax;
    and.push({ annualRevenueExact: range });
  }

  if (and.length) where.AND = and;
  return where;
}

export function buildCompanyOrderBy(
  query: CompanyListQuery,
): Prisma.CompanyOrderByWithRelationInput[] {
  const dir = query.dir;

  // Nulls last on every sort — unclassified rows at the bottom reads better than
  // a block of blanks at the top.
  const primary: Prisma.CompanyOrderByWithRelationInput = (() => {
    switch (query.sort) {
      // Relation sorts can't take an explicit `nulls` in Prisma, so unassigned
      // rows fall wherever Postgres puts them (last ascending, first descending).
      case "owner":
        return { owner: { name: dir } };
      case "industry":
        return { industry: { name: dir } };
      case "tier":
        return { tier: { sort: dir, nulls: "last" } };
      case "annualRevenueExact":
        return { annualRevenueExact: { sort: dir, nulls: "last" } };
      case "employeeBand":
        return { employeeBand: { sort: dir, nulls: "last" } };
      case "lastActivityAt":
        return { lastActivityAt: { sort: dir, nulls: "last" } };
      default:
        return { [query.sort]: dir } as Prisma.CompanyOrderByWithRelationInput;
    }
  })();

  // Stable tiebreak so pagination can't drop or repeat rows.
  return [primary, { id: "asc" }];
}
