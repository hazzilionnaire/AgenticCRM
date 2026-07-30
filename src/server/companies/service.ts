import { ActivityType, AssignmentSource, WorkflowStage } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import type {
  CompanyListQuery,
  CreateCompanyInput,
  UpdateCompanyInput,
} from "@/lib/validation/company";
import { diffFields, logActivities, logActivity } from "@/server/activity/log";
import { applyAssignment } from "@/server/assignment/assign-owner";
import { buildCompanyOrderBy, buildCompanyWhere } from "@/server/companies/query-builder";
import type { Db } from "@/server/db-types";
import { calculateTier } from "@/server/tiering/calculate-tier";
import { canTransition } from "@/server/workflow/stages";

export class CompanyError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "CompanyError";
  }
}

/** Fields that feed the tier calculation — a write touching any of them retiers. */
const TIER_INPUT_FIELDS = ["employeeBand", "annualRevenueExact", "annualRevenueBand"] as const;

const listSelect = {
  id: true,
  legalName: true,
  dbaName: true,
  companyType: true,
  tier: true,
  employeeBand: true,
  annualRevenueExact: true,
  annualRevenueBand: true,
  currency: true,
  lifecycleStage: true,
  accountStatus: true,
  workflowStage: true,
  lastActivityAt: true,
  createdAt: true,
  deletedAt: true,
  industry: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true, email: true } },
} as const;

export async function listCompanies(query: CompanyListQuery) {
  const where = buildCompanyWhere(query);
  const [rows, total] = await Promise.all([
    prisma.company.findMany({
      where,
      orderBy: buildCompanyOrderBy(query),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: listSelect,
    }),
    prisma.company.count({ where }),
  ]);

  return {
    rows: rows.map((r) => ({
      ...r,
      annualRevenueExact: r.annualRevenueExact?.toString() ?? null,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getCompany(id: string) {
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      industry: true,
      owner: { select: { id: true, name: true, email: true } },
      parent: { select: { id: true, legalName: true } },
      subsidiaries: {
        where: { deletedAt: null },
        select: { id: true, legalName: true, tier: true },
        orderBy: { legalName: "asc" },
      },
      collaborators: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!company) return null;
  return company;
}

export async function getActivity(companyId: string, limit = 100) {
  return prisma.activityLog.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: { select: { id: true, name: true, email: true } } },
  });
}

async function assertParentIsValid(db: Db, parentId: string | null, selfId?: string) {
  if (!parentId) return;
  if (parentId === selfId) throw new CompanyError("A company cannot be its own parent");

  const parent = await db.company.findUnique({
    where: { id: parentId },
    select: { id: true, parentId: true, deletedAt: true },
  });
  if (!parent || parent.deletedAt) throw new CompanyError("Parent company not found", 404);

  // Walk up the chain so we can't create a cycle.
  if (selfId) {
    let cursor = parent.parentId;
    const seen = new Set<string>([parent.id]);
    while (cursor) {
      if (cursor === selfId) {
        throw new CompanyError("That parent would create a circular hierarchy");
      }
      if (seen.has(cursor)) break;
      seen.add(cursor);
      const next: { parentId: string | null } | null = await db.company.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = next?.parentId ?? null;
    }
  }
}

export async function createCompany(input: CreateCompanyInput, actorId: string) {
  return prisma.$transaction(async (tx) => {
    await assertParentIsValid(tx, input.parentId ?? null);

    const tier = calculateTier({
      employeeBand: input.employeeBand ?? null,
      annualRevenueExact: input.annualRevenueExact ?? null,
      annualRevenueBand: input.annualRevenueBand ?? null,
    });

    const ownerProvided = Boolean(input.ownerId);

    const company = await tx.company.create({
      data: {
        ...(input as Record<string, unknown>),
        tier,
        tierCalculatedAt: tier === null ? null : new Date(),
        // An owner picked in the create form is a deliberate human choice and is
        // therefore protected from later auto-assignment.
        ownerAssignedBy: ownerProvided ? AssignmentSource.MANUAL : null,
        ownerAssignedAt: ownerProvided ? new Date() : null,
      } as never,
    });

    await logActivity(tx, {
      companyId: company.id,
      actorId,
      type: ActivityType.COMPANY_CREATED,
      newValue: company.legalName,
      metadata: { tier },
    });

    if (tier !== null) {
      await logActivity(tx, {
        companyId: company.id,
        actorId: null,
        type: ActivityType.TIER_RECALCULATED,
        field: "tier",
        oldValue: null,
        newValue: String(tier),
      });
    }

    await applyAssignment(tx, {
      companyId: company.id,
      companyName: company.legalName,
      tier,
      currentOwnerId: company.ownerId,
      ownerAssignedBy: company.ownerAssignedBy,
      mode: "create",
      previousTier: null,
      actorId,
    });

    return tx.company.findUniqueOrThrow({ where: { id: company.id } });
  });
}

export async function updateCompany(id: string, input: UpdateCompanyInput, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.company.findUnique({ where: { id } });
    if (!before) throw new CompanyError("Company not found", 404);
    if (before.deletedAt) throw new CompanyError("Cannot edit a deleted company", 409);

    if (input.parentId !== undefined) {
      await assertParentIsValid(tx, input.parentId ?? null, id);
    }

    const touchesTierInputs = TIER_INPUT_FIELDS.some((f) => input[f] !== undefined);

    const nextTierInputs = {
      employeeBand:
        input.employeeBand !== undefined ? input.employeeBand : before.employeeBand,
      annualRevenueExact:
        input.annualRevenueExact !== undefined
          ? input.annualRevenueExact
          : before.annualRevenueExact?.toString() ?? null,
      annualRevenueBand:
        input.annualRevenueBand !== undefined
          ? input.annualRevenueBand
          : before.annualRevenueBand,
    };

    const nextTier = touchesTierInputs ? calculateTier(nextTierInputs) : before.tier;
    const tierChanged = nextTier !== before.tier;

    // A human explicitly setting the owner marks it MANUAL, which permanently
    // shields it from auto-assignment. Clearing the owner resets that.
    const ownerExplicitlySet = input.ownerId !== undefined && input.ownerId !== before.ownerId;
    const ownerFields = ownerExplicitlySet
      ? {
          ownerAssignedBy: input.ownerId ? AssignmentSource.MANUAL : null,
          ownerAssignedAt: input.ownerId ? new Date() : null,
        }
      : {};

    const changeEntries = diffFields(
      before as unknown as Record<string, unknown>,
      input as Record<string, unknown>,
      { companyId: id, actorId },
    );

    await tx.company.update({
      where: { id },
      data: {
        ...(input as Record<string, unknown>),
        ...ownerFields,
        ...(tierChanged ? { tier: nextTier, tierCalculatedAt: new Date() } : {}),
      } as never,
    });

    await logActivities(tx, changeEntries);

    if (tierChanged) {
      await logActivity(tx, {
        companyId: id,
        actorId: null,
        type: ActivityType.TIER_RECALCULATED,
        field: "tier",
        oldValue: before.tier === null ? null : String(before.tier),
        newValue: nextTier === null ? null : String(nextTier),
        metadata: { automatic: true },
      });

      const current = await tx.company.findUniqueOrThrow({
        where: { id },
        select: { ownerId: true, ownerAssignedBy: true, legalName: true },
      });

      await applyAssignment(tx, {
        companyId: id,
        companyName: current.legalName,
        tier: nextTier,
        currentOwnerId: current.ownerId,
        ownerAssignedBy: current.ownerAssignedBy,
        mode: "retier",
        previousTier: before.tier,
        actorId,
      });
    }

    return tx.company.findUniqueOrThrow({ where: { id } });
  });
}

export async function transitionWorkflow(
  id: string,
  stage: WorkflowStage,
  actorId: string,
  note?: string,
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.company.findUnique({
      where: { id },
      select: { workflowStage: true, deletedAt: true },
    });
    if (!before) throw new CompanyError("Company not found", 404);
    if (before.deletedAt) throw new CompanyError("Cannot edit a deleted company", 409);
    if (!canTransition(before.workflowStage, stage)) {
      throw new CompanyError(`Company is already ${stage}`, 409);
    }

    const now = new Date();
    const company = await tx.company.update({
      where: { id },
      data: {
        workflowStage: stage,
        workflowStageChangedAt: now,
        workflowStageChangedById: actorId,
        lastActivityAt: now,
      },
    });

    await logActivity(tx, {
      companyId: id,
      actorId,
      type: ActivityType.WORKFLOW_STAGE_CHANGED,
      field: "workflowStage",
      oldValue: before.workflowStage,
      newValue: stage,
      metadata: note ? { note } : undefined,
    });

    return company;
  });
}

export async function softDeleteCompany(id: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.company.findUnique({
      where: { id },
      select: { deletedAt: true, legalName: true },
    });
    if (!before) throw new CompanyError("Company not found", 404);
    if (before.deletedAt) throw new CompanyError("Company is already deleted", 409);

    const company = await tx.company.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await logActivity(tx, {
      companyId: id,
      actorId,
      type: ActivityType.COMPANY_DELETED,
      oldValue: before.legalName,
    });

    return company;
  });
}

export async function restoreCompany(id: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.company.findUnique({
      where: { id },
      select: { deletedAt: true, legalName: true },
    });
    if (!before) throw new CompanyError("Company not found", 404);
    if (!before.deletedAt) throw new CompanyError("Company is not deleted", 409);

    const company = await tx.company.update({ where: { id }, data: { deletedAt: null } });

    await logActivity(tx, {
      companyId: id,
      actorId,
      type: ActivityType.COMPANY_RESTORED,
      newValue: before.legalName,
    });

    return company;
  });
}
