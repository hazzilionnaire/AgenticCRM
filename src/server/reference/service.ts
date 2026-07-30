import { prisma } from "@/lib/db";

/** Small shared reads used to populate pickers and filter bars. */

export function listIndustries() {
  return prisma.industry.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true },
  });
}

export function listReps() {
  return prisma.user.findMany({
    where: { isActive: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: { id: true, name: true, email: true, role: true },
  });
}

export function listAssignmentRules() {
  return prisma.assignmentRule.findMany({
    orderBy: { tier: "asc" },
    include: {
      members: {
        orderBy: { sortOrder: "asc" },
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });
}

/** Companies eligible to be a parent — excludes deleted rows and the company itself. */
export function listParentCandidates(excludeId?: string) {
  return prisma.company.findMany({
    where: { deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    orderBy: { legalName: "asc" },
    select: { id: true, legalName: true },
    take: 500,
  });
}
