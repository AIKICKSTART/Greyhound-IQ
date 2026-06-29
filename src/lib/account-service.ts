import { prisma } from "@/lib/db";
import type { CurrentUserProfile } from "@/lib/auth";

const ACCOUNT_DELETION_GRACE_DAYS = 30;
const DELETED_EMAIL_DOMAIN = "deleted.greyhoundiq.local";
const DELETION_REQUEST_EMAIL_PREFIX = "deletion-requested";
const DELETED_PROFILE_NAME = "Deleted user";
const DELETED_THREAD_TITLE = "Deleted thread";
const DELETED_POST_BODY = "This post was removed after account deletion.";
const DELETED_MESSAGE_BODY = "This message was removed after account deletion.";
const DELETED_LISTING_TITLE = "Deleted listing";
const DELETED_LISTING_DESCRIPTION =
  "This listing was removed after account deletion.";
const DELETED_MEMORY_CONTENT = "Account memory removed after account deletion.";

interface AuditInput {
  actorId?: string | null;
  actorType: "user" | "agent" | "system" | "admin";
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AccountDeletionMaintenanceResult {
  finalizedCount: number;
  messagesScrubbed: number;
  postsScrubbed: number;
  threadsScrubbed: number;
  listingsArchived: number;
  mediaDeleted: number;
  memoriesDeleted: number;
  contextsDeleted: number;
  agentRunsScrubbed: number;
  ranAt: string;
  cutoff: string;
}

export async function createAuditLog(input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      actorType: input.actorType,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}

export async function requestAccountDeletion(
  current: CurrentUserProfile,
  meta: { ip?: string | null; userAgent?: string | null } = {}
) {
  const requestedAt = new Date();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: current.dbUserId },
      data: {
        email: deletionRequestEmailForUser(current.dbUserId),
        isBanned: true,
        deletionRequestedAt: requestedAt,
      },
    }),
    prisma.auditLog.create({
      data: {
        actorId: current.dbUserId,
        actorType: "user",
        action: "user.delete",
        targetType: "user",
        targetId: current.dbUserId,
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
        metadata: JSON.stringify({
          status: "requested",
          graceDays: 30,
          requestedAt: requestedAt.toISOString(),
        }),
      },
    }),
  ]);

  return requestedAt;
}

export async function runAccountDeletionMaintenance(
  now = new Date()
): Promise<AccountDeletionMaintenanceResult> {
  const cutoff = accountDeletionCutoffDate(now);
  const pendingUsers = await prisma.user.findMany({
    where: {
      isBanned: true,
      deletionRequestedAt: { lte: cutoff },
    },
    select: {
      id: true,
      email: true,
      deletionRequestedAt: true,
      profile: { select: { id: true } },
    },
  });

  const result: AccountDeletionMaintenanceResult = {
    finalizedCount: 0,
    messagesScrubbed: 0,
    postsScrubbed: 0,
    threadsScrubbed: 0,
    listingsArchived: 0,
    mediaDeleted: 0,
    memoriesDeleted: 0,
    contextsDeleted: 0,
    agentRunsScrubbed: 0,
    ranAt: now.toISOString(),
    cutoff: cutoff.toISOString(),
  };

  for (const user of pendingUsers) {
    const profileId = user.profile?.id ?? null;
    const counts = await prisma.$transaction(async (tx) => {
      const profileCounts = profileId
        ? await scrubProfileOwnedContent(tx, profileId, now)
        : emptyProfileCounts();

      const media = await tx.mediaAsset.updateMany({
        where: { uploaderId: user.id, deletedAt: null },
        data: {
          originalName: null,
          sha256: null,
          deletedAt: now,
        },
      });

      const memories = await tx.memoryEntry.updateMany({
        where: { userId: user.id, deletedAt: null },
        data: {
          content: DELETED_MEMORY_CONTENT,
          sourceRef: null,
          importance: 0.1,
          deletedAt: now,
        },
      });

      const contexts = await tx.conversationContext.deleteMany({
        where: { userId: user.id },
      });

      const agentRuns = await tx.agentRun.updateMany({
        where: { userId: user.id },
        data: {
          userId: null,
          inputJson: "{}",
          outputJson: null,
          toolInvocations: null,
          createdMemoryIds: null,
          error: null,
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          email: deletedEmailForUser(user.id),
          name: null,
          subscriptionTier: "free",
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          supabaseUid: null,
          isBanned: true,
          deletionRequestedAt: null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorType: "system",
          action: "user.delete.finalize",
          targetType: "user",
          targetId: user.id,
          metadata: JSON.stringify({
            anonymizedEmail: deletedEmailForUser(user.id),
            requestedAt: user.deletionRequestedAt?.toISOString() ?? null,
            finalizedAt: now.toISOString(),
            ...profileCounts,
            mediaDeleted: media.count,
            memoriesDeleted: memories.count,
            contextsDeleted: contexts.count,
            agentRunsScrubbed: agentRuns.count,
          }),
        },
      });

      return {
        ...profileCounts,
        mediaDeleted: media.count,
        memoriesDeleted: memories.count,
        contextsDeleted: contexts.count,
        agentRunsScrubbed: agentRuns.count,
      };
    });

    result.finalizedCount += 1;
    result.messagesScrubbed += counts.messagesScrubbed;
    result.postsScrubbed += counts.postsScrubbed;
    result.threadsScrubbed += counts.threadsScrubbed;
    result.listingsArchived += counts.listingsArchived;
    result.mediaDeleted += counts.mediaDeleted;
    result.memoriesDeleted += counts.memoriesDeleted;
    result.contextsDeleted += counts.contextsDeleted;
    result.agentRunsScrubbed += counts.agentRunsScrubbed;
  }

  if (result.finalizedCount > 0) {
    await createAuditLog({
      actorType: "system",
      action: "user.delete.maintenance",
      targetType: "user",
      metadata: { ...result },
    });
  }

  return result;
}

export function accountDeletionCutoffDate(date = new Date()) {
  const cutoff = new Date(date);
  cutoff.setDate(cutoff.getDate() - ACCOUNT_DELETION_GRACE_DAYS);
  return cutoff;
}

function deletedEmailForUser(userId: string) {
  return `deleted-${userId}@${DELETED_EMAIL_DOMAIN}`;
}

function deletionRequestEmailForUser(userId: string) {
  return `${DELETION_REQUEST_EMAIL_PREFIX}-${userId}@${DELETED_EMAIL_DOMAIN}`;
}

type AccountTransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];

type ProfileContentCounts = Pick<
  AccountDeletionMaintenanceResult,
  "messagesScrubbed" | "postsScrubbed" | "threadsScrubbed" | "listingsArchived"
>;

async function scrubProfileOwnedContent(
  tx: AccountTransactionClient,
  profileId: string,
  now: Date
): Promise<ProfileContentCounts> {
  const messages = await tx.message.updateMany({
    where: {
      OR: [{ senderId: profileId }, { recipientId: profileId }],
    },
    data: {
      body: DELETED_MESSAGE_BODY,
      mediaIdsJson: null,
      deletedBySenderAt: now,
      deletedByRecipientAt: now,
    },
  });

  const posts = await tx.post.updateMany({
    where: { authorId: profileId },
    data: {
      body: DELETED_POST_BODY,
      editedAt: now,
    },
  });

  const threads = await tx.thread.updateMany({
    where: { authorId: profileId },
    data: {
      title: DELETED_THREAD_TITLE,
      locked: true,
    },
  });

  const listings = await tx.listing.updateMany({
    where: { profileId },
    data: {
      title: DELETED_LISTING_TITLE,
      description: DELETED_LISTING_DESCRIPTION,
      price: null,
      state: null,
      dogId: null,
      imageUrl: null,
      status: "archived",
      archivedAt: now,
    },
  });

  await tx.profile.update({
    where: { id: profileId },
    data: {
      displayName: DELETED_PROFILE_NAME,
      bio: null,
      avatarUrl: null,
      state: null,
      kennelName: null,
      kennelPrefix: null,
      role: "member",
      verified: false,
      website: null,
      phone: null,
    },
  });

  return {
    messagesScrubbed: messages.count,
    postsScrubbed: posts.count,
    threadsScrubbed: threads.count,
    listingsArchived: listings.count,
  };
}

function emptyProfileCounts(): ProfileContentCounts {
  return {
    messagesScrubbed: 0,
    postsScrubbed: 0,
    threadsScrubbed: 0,
    listingsArchived: 0,
  };
}
