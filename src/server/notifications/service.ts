import {
  ActivityType,
  CollaboratorRole,
  NotificationStatus,
  NotificationType,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { logActivity } from "@/server/activity/log";

export async function listNotifications(userId: string, limit = 30) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      company: { select: { id: true, legalName: true, tier: true } },
      suggestedUser: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function countUnread(userId: string) {
  return prisma.notification.count({
    where: { userId, status: NotificationStatus.UNREAD },
  });
}

export async function markRead(userId: string, notificationId: string) {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId, status: NotificationStatus.UNREAD },
    data: { status: NotificationStatus.READ, readAt: new Date() },
  });
  return result.count > 0;
}

export async function markAllRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, status: NotificationStatus.UNREAD },
    data: { status: NotificationStatus.READ, readAt: new Date() },
  });
  return result.count;
}

export class NotificationError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "NotificationError";
  }
}

/**
 * The owner accepts the proposed tier-support rep. Adds them as a collaborator
 * (the owner keeps the account) and lets them know.
 */
export async function acceptSupportOffer(userId: string, notificationId: string) {
  return prisma.$transaction(async (tx) => {
    const notification = await tx.notification.findFirst({
      where: { id: notificationId, userId },
      include: { company: { select: { id: true, legalName: true } } },
    });

    if (!notification) throw new NotificationError("Notification not found", 404);
    if (notification.type !== NotificationType.TIER_CHANGED_SUPPORT_OFFER) {
      throw new NotificationError("This notification has no support offer to accept");
    }
    if (notification.status === NotificationStatus.ACCEPTED) {
      throw new NotificationError("Offer already accepted");
    }
    if (!notification.suggestedUserId || !notification.companyId || !notification.company) {
      throw new NotificationError("Offer is missing its suggested rep");
    }

    await tx.companyCollaborator.upsert({
      where: {
        companyId_userId: {
          companyId: notification.companyId,
          userId: notification.suggestedUserId,
        },
      },
      create: {
        companyId: notification.companyId,
        userId: notification.suggestedUserId,
        role: CollaboratorRole.TIER_SUPPORT,
        addedById: userId,
      },
      update: {},
    });

    await tx.notification.update({
      where: { id: notificationId },
      data: { status: NotificationStatus.ACCEPTED, readAt: new Date() },
    });

    await logActivity(tx, {
      companyId: notification.companyId,
      actorId: userId,
      type: ActivityType.COLLABORATOR_ADDED,
      field: "collaborators",
      newValue: notification.suggestedUserId,
      metadata: { role: CollaboratorRole.TIER_SUPPORT, viaNotificationId: notificationId },
    });

    await tx.notification.create({
      data: {
        userId: notification.suggestedUserId,
        companyId: notification.companyId,
        type: NotificationType.SUPPORT_OFFER_ACCEPTED,
        title: `You're now supporting ${notification.company.legalName}`,
        body: "The account owner accepted your help on this account.",
      },
    });

    return { companyId: notification.companyId, collaboratorId: notification.suggestedUserId };
  });
}

export async function dismissSupportOffer(userId: string, notificationId: string) {
  return prisma.$transaction(async (tx) => {
    const notification = await tx.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!notification) throw new NotificationError("Notification not found", 404);

    await tx.notification.update({
      where: { id: notificationId },
      data: { status: NotificationStatus.DISMISSED, readAt: new Date() },
    });

    if (
      notification.companyId &&
      notification.type === NotificationType.TIER_CHANGED_SUPPORT_OFFER
    ) {
      await logActivity(tx, {
        companyId: notification.companyId,
        actorId: userId,
        type: ActivityType.SUPPORT_OFFER_DISMISSED,
        newValue: notification.suggestedUserId,
        metadata: { viaNotificationId: notificationId },
      });
    }

    return true;
  });
}
