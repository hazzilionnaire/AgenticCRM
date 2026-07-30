import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  ActivityType,
  AssignmentSource,
  EmployeeBand,
  NotificationStatus,
  NotificationType,
  RevenueBand,
  WorkflowStage,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import {
  CompanyError,
  createCompany,
  softDeleteCompany,
  restoreCompany,
  transitionWorkflow,
  updateCompany,
} from "@/server/companies/service";
import { acceptSupportOffer, dismissSupportOffer } from "@/server/notifications/service";
import { resetDatabase, seedFixtures } from "./helpers";

type Reps = Awaited<ReturnType<typeof seedFixtures>>;
let reps: Reps;

beforeEach(async () => {
  await resetDatabase();
  reps = await seedFixtures();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createCompany", () => {
  it("derives the tier and auto-assigns from that tier's pool", async () => {
    const company = await createCompany(
      { legalName: "Acme Co", employeeBand: EmployeeBand.SIZE_250_999 },
      reps.actor.id,
    );

    expect(company.tier).toBe(3);
    expect(company.tierCalculatedAt).not.toBeNull();
    expect(company.ownerId).toBe(reps.t3a.id);
    expect(company.ownerAssignedBy).toBe(AssignmentSource.AUTO);
  });

  it("round-robins successive companies at the same tier", async () => {
    const a = await createCompany(
      { legalName: "A", employeeBand: EmployeeBand.SIZE_1_49 },
      reps.actor.id,
    );
    const b = await createCompany(
      { legalName: "B", employeeBand: EmployeeBand.SIZE_1_49 },
      reps.actor.id,
    );
    const c = await createCompany(
      { legalName: "C", employeeBand: EmployeeBand.SIZE_1_49 },
      reps.actor.id,
    );

    expect([a.ownerId, b.ownerId, c.ownerId]).toEqual([
      reps.t1a.id,
      reps.t1b.id,
      reps.t1a.id,
    ]);
  });

  it("leaves a company with no size data unclassified and unassigned", async () => {
    const company = await createCompany({ legalName: "Mystery Inc" }, reps.actor.id);

    expect(company.tier).toBeNull();
    expect(company.ownerId).toBeNull();
    expect(company.ownerAssignedBy).toBeNull();
  });

  it("marks an owner chosen in the form as MANUAL and does not overwrite it", async () => {
    const company = await createCompany(
      {
        legalName: "Hand Picked Ltd",
        employeeBand: EmployeeBand.SIZE_1000_PLUS,
        ownerId: reps.t1a.id,
      },
      reps.actor.id,
    );

    expect(company.tier).toBe(4);
    expect(company.ownerId).toBe(reps.t1a.id);
    expect(company.ownerAssignedBy).toBe(AssignmentSource.MANUAL);
  });

  it("does not offer tier support on creation — nothing has changed yet", async () => {
    const company = await createCompany(
      {
        legalName: "Fresh Manual Co",
        employeeBand: EmployeeBand.SIZE_1000_PLUS,
        ownerId: reps.actor.id,
      },
      reps.actor.id,
    );

    const notifications = await prisma.notification.findMany({
      where: { companyId: company.id },
    });
    expect(notifications).toHaveLength(0);
  });

  it("takes the higher tier when headcount and revenue disagree", async () => {
    const company = await createCompany(
      {
        legalName: "Meridian Capital",
        employeeBand: EmployeeBand.SIZE_50_249,
        annualRevenueExact: 2_100_000_000,
      },
      reps.actor.id,
    );

    expect(company.tier).toBe(4);
    expect(company.ownerId).toBe(reps.t4a.id);
  });

  it("writes a creation entry and a tier entry to the change log", async () => {
    const company = await createCompany(
      { legalName: "Logged Co", employeeBand: EmployeeBand.SIZE_50_249 },
      reps.actor.id,
    );

    const log = await prisma.activityLog.findMany({ where: { companyId: company.id } });
    const types = log.map((l) => l.type);

    expect(types).toContain(ActivityType.COMPANY_CREATED);
    expect(types).toContain(ActivityType.TIER_RECALCULATED);
    expect(types).toContain(ActivityType.OWNER_ASSIGNED);
  });

  it("rejects a parent that does not exist", async () => {
    await expect(
      createCompany({ legalName: "Orphan", parentId: "nope" }, reps.actor.id),
    ).rejects.toThrow(CompanyError);
  });
});

describe("updateCompany — retiering", () => {
  it("recalculates the tier when employee band changes", async () => {
    const company = await createCompany(
      { legalName: "Growth Co", employeeBand: EmployeeBand.SIZE_1_49 },
      reps.actor.id,
    );
    expect(company.tier).toBe(1);

    const updated = await updateCompany(
      company.id,
      { employeeBand: EmployeeBand.SIZE_1000_PLUS },
      reps.actor.id,
    );

    expect(updated.tier).toBe(4);
    expect(updated.ownerId).toBe(reps.t4a.id);
    expect(updated.ownerAssignedBy).toBe(AssignmentSource.AUTO);
  });

  it("recalculates when exact revenue changes, and lets exact beat the band", async () => {
    const company = await createCompany(
      { legalName: "Revenue Co", annualRevenueBand: RevenueBand.UNDER_10M },
      reps.actor.id,
    );
    expect(company.tier).toBe(1);

    const updated = await updateCompany(
      company.id,
      { annualRevenueExact: 750_000_000 },
      reps.actor.id,
    );
    expect(updated.tier).toBe(3);
  });

  it("does not touch the tier when an unrelated field is edited", async () => {
    const company = await createCompany(
      { legalName: "Stable Co", employeeBand: EmployeeBand.SIZE_50_249 },
      reps.actor.id,
    );
    const before = company.tierCalculatedAt;

    const updated = await updateCompany(company.id, { phone: "+1 555 0100" }, reps.actor.id);

    expect(updated.tier).toBe(2);
    expect(updated.tierCalculatedAt).toEqual(before);
  });

  it("clears the tier when the last size signal is removed", async () => {
    const company = await createCompany(
      { legalName: "Shrinking Co", employeeBand: EmployeeBand.SIZE_250_999 },
      reps.actor.id,
    );

    const updated = await updateCompany(company.id, { employeeBand: null }, reps.actor.id);
    expect(updated.tier).toBeNull();
  });

  it("logs one FIELD_CHANGED entry per field that actually moved", async () => {
    const company = await createCompany({ legalName: "Diff Co" }, reps.actor.id);

    await updateCompany(
      company.id,
      { legalName: "Diff Co", phone: "+1 555 0111", dbaName: "Diffy" },
      reps.actor.id,
    );

    const changes = await prisma.activityLog.findMany({
      where: { companyId: company.id, type: ActivityType.FIELD_CHANGED },
    });

    // legalName was submitted unchanged, so it must not be logged.
    expect(changes.map((c) => c.field).sort()).toEqual(["dbaName", "phone"]);
  });

  it("refuses a parent that would create a cycle", async () => {
    const parent = await createCompany({ legalName: "Parent" }, reps.actor.id);
    const child = await createCompany(
      { legalName: "Child", parentId: parent.id },
      reps.actor.id,
    );

    await expect(
      updateCompany(parent.id, { parentId: child.id }, reps.actor.id),
    ).rejects.toThrow(/circular/i);
  });

  it("refuses to make a company its own parent", async () => {
    const company = await createCompany({ legalName: "Solo" }, reps.actor.id);
    await expect(
      updateCompany(company.id, { parentId: company.id }, reps.actor.id),
    ).rejects.toThrow(/own parent/i);
  });
});

describe("updateCompany — manual owners are never overwritten", () => {
  it("keeps the manual owner and offers tier support instead", async () => {
    const company = await createCompany(
      {
        legalName: "Protected Co",
        employeeBand: EmployeeBand.SIZE_1_49,
        ownerId: reps.actor.id,
      },
      reps.actor.id,
    );
    expect(company.ownerAssignedBy).toBe(AssignmentSource.MANUAL);

    const updated = await updateCompany(
      company.id,
      { employeeBand: EmployeeBand.SIZE_1000_PLUS },
      reps.actor.id,
    );

    // Tier moved, ownership did not.
    expect(updated.tier).toBe(4);
    expect(updated.ownerId).toBe(reps.actor.id);
    expect(updated.ownerAssignedBy).toBe(AssignmentSource.MANUAL);

    const notification = await prisma.notification.findFirst({
      where: { companyId: company.id, type: NotificationType.TIER_CHANGED_SUPPORT_OFFER },
    });

    expect(notification).not.toBeNull();
    expect(notification!.userId).toBe(reps.actor.id);
    // The proposed rep comes from the NEW tier's pool.
    expect([reps.t4a.id, reps.t4b.id]).toContain(notification!.suggestedUserId);
    expect(notification!.title).toContain("Tier 4");
  });

  it("never proposes the owner as their own support rep", async () => {
    const company = await createCompany(
      {
        legalName: "Self Support Co",
        employeeBand: EmployeeBand.SIZE_1_49,
        ownerId: reps.t4a.id,
      },
      reps.actor.id,
    );

    await updateCompany(
      company.id,
      { employeeBand: EmployeeBand.SIZE_1000_PLUS },
      reps.actor.id,
    );

    const notification = await prisma.notification.findFirst({
      where: { companyId: company.id, type: NotificationType.TIER_CHANGED_SUPPORT_OFFER },
    });

    expect(notification!.suggestedUserId).toBe(reps.t4b.id);
  });

  it("makes no offer when the new tier's pool has nobody else", async () => {
    await prisma.assignmentRuleMember.deleteMany({
      where: { rule: { tier: 4 }, userId: reps.t4b.id },
    });

    const company = await createCompany(
      {
        legalName: "Lonely Tier Co",
        employeeBand: EmployeeBand.SIZE_1_49,
        ownerId: reps.t4a.id,
      },
      reps.actor.id,
    );

    await updateCompany(
      company.id,
      { employeeBand: EmployeeBand.SIZE_1000_PLUS },
      reps.actor.id,
    );

    const notifications = await prisma.notification.findMany({
      where: { companyId: company.id, type: NotificationType.TIER_CHANGED_SUPPORT_OFFER },
    });
    expect(notifications).toHaveLength(0);
  });

  it("reassigns freely when the owner was auto-assigned", async () => {
    const company = await createCompany(
      { legalName: "Auto Owned Co", employeeBand: EmployeeBand.SIZE_1_49 },
      reps.actor.id,
    );
    expect(company.ownerAssignedBy).toBe(AssignmentSource.AUTO);

    const updated = await updateCompany(
      company.id,
      { employeeBand: EmployeeBand.SIZE_250_999 },
      reps.actor.id,
    );

    expect(updated.ownerId).toBe(reps.t3a.id);

    const offers = await prisma.notification.findMany({
      where: { companyId: company.id, type: NotificationType.TIER_CHANGED_SUPPORT_OFFER },
    });
    expect(offers).toHaveLength(0);
  });

  it("marks an owner set through an edit as MANUAL from then on", async () => {
    const company = await createCompany(
      { legalName: "Claimed Co", employeeBand: EmployeeBand.SIZE_1_49 },
      reps.actor.id,
    );

    const claimed = await updateCompany(
      company.id,
      { ownerId: reps.actor.id },
      reps.actor.id,
    );
    expect(claimed.ownerAssignedBy).toBe(AssignmentSource.MANUAL);

    const retiered = await updateCompany(
      company.id,
      { employeeBand: EmployeeBand.SIZE_1000_PLUS },
      reps.actor.id,
    );
    expect(retiered.ownerId).toBe(reps.actor.id);
  });
});

describe("support offers", () => {
  async function offerFor(companyOwner: string) {
    const company = await createCompany(
      {
        legalName: "Offer Co",
        employeeBand: EmployeeBand.SIZE_1_49,
        ownerId: companyOwner,
      },
      reps.actor.id,
    );
    await updateCompany(
      company.id,
      { employeeBand: EmployeeBand.SIZE_1000_PLUS },
      reps.actor.id,
    );
    const notification = await prisma.notification.findFirstOrThrow({
      where: { companyId: company.id, type: NotificationType.TIER_CHANGED_SUPPORT_OFFER },
    });
    return { company, notification };
  }

  it("accepting adds the rep as a collaborator and notifies them", async () => {
    const { company, notification } = await offerFor(reps.actor.id);

    await acceptSupportOffer(reps.actor.id, notification.id);

    const collaborators = await prisma.companyCollaborator.findMany({
      where: { companyId: company.id },
    });
    expect(collaborators).toHaveLength(1);
    expect(collaborators[0].userId).toBe(notification.suggestedUserId);

    const updated = await prisma.notification.findUniqueOrThrow({
      where: { id: notification.id },
    });
    expect(updated.status).toBe(NotificationStatus.ACCEPTED);

    const theirs = await prisma.notification.findFirst({
      where: {
        userId: notification.suggestedUserId!,
        type: NotificationType.SUPPORT_OFFER_ACCEPTED,
      },
    });
    expect(theirs).not.toBeNull();

    // Owner is still the owner — accepting help doesn't hand over the account.
    const after = await prisma.company.findUniqueOrThrow({ where: { id: company.id } });
    expect(after.ownerId).toBe(reps.actor.id);
  });

  it("dismissing records the decision and adds nobody", async () => {
    const { company, notification } = await offerFor(reps.actor.id);

    await dismissSupportOffer(reps.actor.id, notification.id);

    const collaborators = await prisma.companyCollaborator.findMany({
      where: { companyId: company.id },
    });
    expect(collaborators).toHaveLength(0);

    const log = await prisma.activityLog.findFirst({
      where: { companyId: company.id, type: ActivityType.SUPPORT_OFFER_DISMISSED },
    });
    expect(log).not.toBeNull();
  });

  it("won't let another user act on someone else's notification", async () => {
    const { notification } = await offerFor(reps.actor.id);
    await expect(acceptSupportOffer(reps.t1a.id, notification.id)).rejects.toThrow(
      /not found/i,
    );
  });

  it("does not propose someone who already collaborates on the account", async () => {
    const { company, notification } = await offerFor(reps.actor.id);
    await acceptSupportOffer(reps.actor.id, notification.id);
    const first = notification.suggestedUserId;

    // Drop back to Tier 1 and climb again — the second offer must be someone new.
    await updateCompany(
      company.id,
      { employeeBand: EmployeeBand.SIZE_1_49 },
      reps.actor.id,
    );
    await updateCompany(
      company.id,
      { employeeBand: EmployeeBand.SIZE_1000_PLUS },
      reps.actor.id,
    );

    const second = await prisma.notification.findFirst({
      where: {
        companyId: company.id,
        type: NotificationType.TIER_CHANGED_SUPPORT_OFFER,
        id: { not: notification.id },
      },
      orderBy: { createdAt: "desc" },
    });

    expect(second?.suggestedUserId).not.toBe(first);
  });
});

describe("workflow transitions", () => {
  it("moves pending → contacted, stamping who and when", async () => {
    const company = await createCompany({ legalName: "Workflow Co" }, reps.actor.id);
    expect(company.workflowStage).toBe(WorkflowStage.PENDING);

    const moved = await transitionWorkflow(
      company.id,
      WorkflowStage.CONTACTED,
      reps.t1a.id,
      "Left a voicemail",
    );

    expect(moved.workflowStage).toBe(WorkflowStage.CONTACTED);
    expect(moved.workflowStageChangedById).toBe(reps.t1a.id);
    expect(moved.workflowStageChangedAt).not.toBeNull();
    expect(moved.lastActivityAt).not.toBeNull();

    const log = await prisma.activityLog.findFirstOrThrow({
      where: { companyId: company.id, type: ActivityType.WORKFLOW_STAGE_CHANGED },
    });
    expect(log.oldValue).toBe(WorkflowStage.PENDING);
    expect(log.newValue).toBe(WorkflowStage.CONTACTED);
    expect(log.actorId).toBe(reps.t1a.id);
    expect(log.metadata).toEqual({ note: "Left a voicemail" });
  });

  it("rejects a transition to the stage it is already in", async () => {
    const company = await createCompany({ legalName: "Idle Co" }, reps.actor.id);
    await expect(
      transitionWorkflow(company.id, WorkflowStage.PENDING, reps.actor.id),
    ).rejects.toThrow(CompanyError);
  });
});

describe("soft delete", () => {
  it("hides the company without destroying it, and restores it", async () => {
    const company = await createCompany({ legalName: "Temp Co" }, reps.actor.id);

    const deleted = await softDeleteCompany(company.id, reps.actor.id);
    expect(deleted.deletedAt).not.toBeNull();

    // Still in the database, just filtered out of normal reads.
    const row = await prisma.company.findUnique({ where: { id: company.id } });
    expect(row).not.toBeNull();

    const restored = await restoreCompany(company.id, reps.actor.id);
    expect(restored.deletedAt).toBeNull();
  });

  it("refuses to edit a deleted company", async () => {
    const company = await createCompany({ legalName: "Gone Co" }, reps.actor.id);
    await softDeleteCompany(company.id, reps.actor.id);

    await expect(
      updateCompany(company.id, { phone: "+1 555 0123" }, reps.actor.id),
    ).rejects.toThrow(/deleted/i);
  });

  it("refuses to delete twice", async () => {
    const company = await createCompany({ legalName: "Double Co" }, reps.actor.id);
    await softDeleteCompany(company.id, reps.actor.id);
    await expect(softDeleteCompany(company.id, reps.actor.id)).rejects.toThrow(/already/i);
  });
});
