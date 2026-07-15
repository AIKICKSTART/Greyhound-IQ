import type { z } from "zod";
import { createAuditLog } from "@/lib/account-service";
import {
  assertReportUserBanAllowed,
  lockAdminAccessChanges,
} from "@/lib/admin-access-contract";
import type { CurrentUserProfile } from "@/lib/auth-types";
import { withDbRequestContext } from "@/lib/db-context";
import { createInAppNotification } from "@/lib/notification-service";
import {
  broadcastConversationRealtimeEvent,
  broadcastProfileRealtimeEvent,
} from "@/lib/realtime-service";
import type {
  reportCreateSchema,
  reportResolveSchema,
} from "@/lib/report-validation";

type ReportCreateInput = z.infer<typeof reportCreateSchema>;
type ReportResolveInput = z.infer<typeof reportResolveSchema>;

const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function createReportForUser(
  current: CurrentUserProfile,
  input: ReportCreateInput
) {
  const reportedId = await getReportedUserId(current, input.targetType, input.targetId);
  if (reportedId === current.dbUserId) {
    throw new Error("report.cannot_report_self");
  }

  const duplicateSince = new Date(Date.now() - DUPLICATE_WINDOW_MS);
  const duplicate = await withDbRequestContext(current, (tx) =>
    tx.report.findFirst({
      where: {
        reporterId: current.dbUserId,
        targetType: input.targetType,
        targetId: input.targetId,
        createdAt: { gte: duplicateSince },
      },
    })
  );
  if (duplicate) throw new Error("report.duplicate");

  const report = await withDbRequestContext(current, async (tx) => {
    const created = await tx.report.create({
      data: {
        reporterId: current.dbUserId,
        reportedId,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        description: input.description,
        status: "open",
      },
      include: {
        reporter: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        reported: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (input.targetType === "listing") {
      await tx.listingReport.create({
        data: {
          listingId: input.targetId,
          reporterProfileId: current.profileId,
          reason: input.reason,
          description: input.description,
          status: "open",
        },
      });
      await tx.listing.update({
        where: { id: input.targetId },
        data: { reportCount: { increment: 1 } },
      });
    }

    return created;
  });

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action: "report.create",
    targetType: input.targetType,
    targetId: input.targetId,
    metadata: {
      reportId: report.id,
      reason: input.reason,
      reportedId,
    },
  });

  return report;
}

export async function resolveReportForModerator(
  current: CurrentUserProfile,
  reportId: string,
  input: ReportResolveInput
) {
  const report = await withDbRequestContext(current, (tx) =>
    tx.report.findUnique({ where: { id: reportId } })
  );
  if (!report) throw new Error("report.not_found");

  const status = input.action === "dismiss" ? "dismissed" : "resolved";
  const now = new Date();

  const { updated: resolved, messageConversation } = await withDbRequestContext(
    current,
    async (tx) => {
      let messageConversation:
        | { id: string; participantAId: string; participantBId: string }
        | null = null;
      const isUserSafetyAction =
        input.action === "warn_user" || input.action === "ban_user";

      if (input.action === "ban_user" && report.reportedId) {
        await lockAdminAccessChanges(tx);
      }
      const freshActor =
        input.action === "ban_user" && report.reportedId
          ? await tx.user.findUnique({
              where: { id: current.dbUserId },
              select: {
                isBanned: true,
                deletionRequestedAt: true,
                profile: { select: { role: true } },
              },
            })
          : null;
      const reported =
        isUserSafetyAction && report.reportedId
          ? await tx.user.findUnique({
              where: { id: report.reportedId },
              select: {
                id: true,
                isBanned: true,
                deletionRequestedAt: true,
                profile: { select: { id: true, role: true } },
              },
            })
          : null;
      if (input.action === "ban_user" && reported) {
        const activeAdminCount = await tx.profile.count({
          where: {
            role: "admin",
            user: { isBanned: false, deletionRequestedAt: null },
          },
        });
        assertReportUserBanAllowed({
          actingUserId: current.dbUserId,
          actingRole: freshActor?.profile?.role,
          actingCurrentlyActive: Boolean(
            freshActor &&
              !freshActor.isBanned &&
              freshActor.deletionRequestedAt === null
          ),
          targetUserId: reported.id,
          targetCurrentRole: reported.profile?.role,
          targetCurrentlyActive:
            !reported.isBanned && reported.deletionRequestedAt === null,
          activeAdminCount,
        });
      }

      const updated = await tx.report.update({
        where: { id: report.id },
        data: {
          status,
          resolvedBy: current.dbUserId,
          resolvedAt: now,
          resolutionNotes: input.notes,
        },
      });

      if (report.targetType === "listing") {
        await tx.listingReport.updateMany({
          where: {
            listingId: report.targetId,
            status: "open",
          },
          data: {
            status,
            resolvedByProfileId: current.profileId,
            resolvedAt: now,
          },
        });
      }

      if (report.targetType === "message") {
        const message = await tx.message.findUnique({
          where: { id: report.targetId },
          include: { conversation: true },
        });
        if (message) {
          await tx.messageModerationAction.create({
            data: {
              messageId: message.id,
              actorProfileId: current.profileId,
              action: input.action,
              reason: input.notes ?? report.reason,
              metadataJson: JSON.stringify({
                reportId: report.id,
                resolutionStatus: status,
              }),
            },
          });
          if (
            status === "resolved" &&
            (input.action === "hide_content" ||
              input.action === "delete_content")
          ) {
            await tx.message.update({
              where: { id: message.id },
              data: {
                deletedBySenderAt: now,
                deletedByRecipientAt: now,
              },
            });
          }
          messageConversation = message.conversation;
        }
      }

      if (reported) {
        await tx.trustSafetyFlag.create({
          data: {
            profileId: reported.profile?.id ?? null,
            userId: reported.id,
            targetType: report.targetType,
            targetId: report.targetId,
            flagType:
              input.action === "ban_user"
                ? "moderation_ban"
                : "moderation_warning",
            severity: input.action === "ban_user" ? "high" : "medium",
            status: "open",
            reason: input.notes ?? report.reason,
          },
        });

        if (input.action === "ban_user") {
          await tx.user.update({
            where: { id: reported.id },
            data: { isBanned: true },
          });
        }
      }

      return { updated, messageConversation };
    }
  );

  if (
    (input.action === "warn_user" || input.action === "ban_user") &&
    report.reportedId
  ) {
    await createInAppNotification({
      userId: report.reportedId,
      actorProfileId: current.profileId,
      type: input.action === "ban_user" ? "moderation_ban" : "moderation_warning",
      title:
        input.action === "ban_user"
          ? "Your account has been restricted"
          : "Moderator warning",
      body: input.notes ?? "A moderator reviewed a report involving your account.",
      targetType: report.targetType,
      targetId: report.targetId,
      metadata: { reportId: report.id, action: input.action },
    });
  }

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "admin",
    action: "report.resolve",
    targetType: report.targetType,
    targetId: report.targetId,
    metadata: {
      reportId: report.id,
      action: input.action,
      status,
    },
  });
  if (messageConversation) {
    await Promise.all([
      broadcastConversationRealtimeEvent(
        messageConversation.id,
        "conversation_updated",
        {
          action: "message_report_resolved",
          reportId: report.id,
        }
      ),
      broadcastProfileRealtimeEvent(
        messageConversation.participantAId,
        "conversation_updated",
        {
          action: "message_report_resolved",
          reportId: report.id,
        }
      ),
      broadcastProfileRealtimeEvent(
        messageConversation.participantBId,
        "conversation_updated",
        {
          action: "message_report_resolved",
          reportId: report.id,
        }
      ),
    ]);
  }

  return resolved;
}

async function getReportedUserId(
  current: CurrentUserProfile,
  targetType: ReportCreateInput["targetType"],
  targetId: string
) {
  return withDbRequestContext(current, async (tx) => {
    if (targetType === "user") {
      const user = await tx.user.findUnique({ where: { id: targetId } });
      if (!user) throw new Error("report.target_not_found");
      return user.id;
    }

    if (targetType === "profile") {
      const profile = await tx.profile.findUnique({ where: { id: targetId } });
      if (!profile) throw new Error("report.target_not_found");
      return profile.userId;
    }

    if (targetType === "thread") {
      const thread = await tx.thread.findUnique({
        where: { id: targetId },
        include: { author: true },
      });
      if (!thread) throw new Error("report.target_not_found");
      return thread.author.userId;
    }

    if (targetType === "post") {
      const post = await tx.post.findUnique({
        where: { id: targetId },
        include: { author: true },
      });
      if (!post) throw new Error("report.target_not_found");
      return post.author.userId;
    }

    if (targetType === "feed_post") {
      const post = await tx.feedPost.findUnique({
        where: { id: targetId },
        include: { author: true },
      });
      if (!post) throw new Error("report.target_not_found");
      return post.author.userId;
    }

    if (targetType === "feed_comment") {
      const comment = await tx.feedComment.findUnique({
        where: { id: targetId },
        include: { author: true },
      });
      if (!comment) throw new Error("report.target_not_found");
      return comment.author.userId;
    }

    if (targetType === "listing") {
      const listing = await tx.listing.findUnique({
        where: { id: targetId },
        include: { profile: true },
      });
      if (!listing) throw new Error("report.target_not_found");
      return listing.profile.userId;
    }

    const message = await tx.message.findFirst({
      where: {
        id: targetId,
        recipientId: current.profileId,
        deletedByRecipientAt: null,
      },
      include: {
        sender: true,
      },
    });
    if (!message) throw new Error("report.target_not_found");
    return message.sender.userId;
  });
}
