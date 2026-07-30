import { AssignmentStrategy, UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

export async function resetDatabase() {
  // Order matters less with CASCADE, but keeping it explicit documents the graph.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "ActivityLog", "Notification", "CompanyCollaborator",
      "AssignmentRuleMember", "AssignmentRule", "Company", "Industry", "User"
    RESTART IDENTITY CASCADE
  `);
}

export async function createUser(email: string, name: string) {
  return prisma.user.create({
    data: { email, name, passwordHash: "x", role: UserRole.REP },
  });
}

export async function createRule(
  tier: number,
  userIds: string[],
  strategy: AssignmentStrategy = AssignmentStrategy.ROUND_ROBIN,
) {
  return prisma.assignmentRule.create({
    data: {
      tier,
      strategy,
      members: {
        create: userIds.map((userId, sortOrder) => ({ userId, sortOrder })),
      },
    },
  });
}

/** A minimal but realistic world: four tiers, two reps each, no overlap. */
export async function seedFixtures() {
  const reps = {
    t1a: await createUser("t1a@test", "Tier1 A"),
    t1b: await createUser("t1b@test", "Tier1 B"),
    t2a: await createUser("t2a@test", "Tier2 A"),
    t2b: await createUser("t2b@test", "Tier2 B"),
    t3a: await createUser("t3a@test", "Tier3 A"),
    t3b: await createUser("t3b@test", "Tier3 B"),
    t4a: await createUser("t4a@test", "Tier4 A"),
    t4b: await createUser("t4b@test", "Tier4 B"),
    actor: await createUser("actor@test", "Acting Rep"),
  };

  await createRule(1, [reps.t1a.id, reps.t1b.id]);
  await createRule(2, [reps.t2a.id, reps.t2b.id]);
  await createRule(3, [reps.t3a.id, reps.t3b.id]);
  await createRule(4, [reps.t4a.id, reps.t4b.id]);

  return reps;
}
