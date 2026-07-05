import { createAuditLog } from "@/lib/account-service";
import type { CurrentUserProfile } from "@/lib/auth";
import { prisma, safeQuery } from "@/lib/db";
import { logWarn } from "@/lib/logger";
import { assertMediaAttachable } from "@/lib/media-service";
import { findBannedPhraseMatch } from "@/lib/moderation-service";
import {
  createInAppNotificationDeduped,
  notificationBodySnippet,
} from "@/lib/notification-service";
import {
  broadcastConversationRealtimeEvent,
  broadcastProfileRealtimeEvent,
} from "@/lib/realtime-service";
import { PRIVATE_USER_MEDIA_BUCKET } from "@/lib/storage-paths";
import type { Prisma } from "@prisma/client";

const CONVERSATION_INCLUDE = {
  participantA: {
    include: {
      user: {
        select: {
          email: true,
          subscriptionTier: true,
        },
      },
    },
  },
  participantB: {
    include: {
      user: {
        select: {
          email: true,
          subscriptionTier: true,
        },
      },
    },
  },
  participants: true,
} as const;

const MESSAGE_INCLUDE = {
  sender: true,
  recipient: true,
  media: {
    orderBy: { position: "asc" },
    include: { media: true },
  },
  deliveryReceipts: true,
  readReceipts: true,
  reactions: {
    orderBy: { createdAt: "asc" },
    include: { profile: true },
  },
} as const;

export function canonicalProfilePair(profileAId: string, profileBId: string) {
  return profileAId < profileBId
    ? { participantAId: profileAId, participantBId: profileBId }
    : { participantAId: profileBId, participantBId: profileAId };
}

export async function listConversationsForProfile(profileId: string) {
  return prisma.conversation.findMany({
    where: {
      OR: [
        { participantAId: profileId },
        { participantBId: profileId },
        { participants: { some: { profileId } } },
      ],
    },
    orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
    include: {
      ...CONVERSATION_INCLUDE,
      messages: {
        where: visibleMessageWhere(profileId),
        orderBy: { createdAt: "desc" },
        take: 1,
        include: MESSAGE_INCLUDE,
      },
    },
    take: 50,
  });
}

export async function getConversationForProfile(
  conversationId: string,
  profileId: string,
  opts?: { before?: string; limit?: number }
) {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      OR: [
        { participantAId: profileId },
        { participantBId: profileId },
        { participants: { some: { profileId } } },
      ],
    },
    include: CONVERSATION_INCLUDE,
  });
  if (!conversation) throw new Error("conversation.not_found");

  const messageWhere: Prisma.MessageWhereInput = {
    conversationId,
    ...visibleMessageWhere(profileId),
  };
  if (opts?.before) {
    const cursor = await prisma.message.findFirst({
      where: { id: opts.before, conversationId },
      select: { createdAt: true },
    });
    if (!cursor) throw new Error("message.not_found");
    messageWhere.createdAt = { lt: cursor.createdAt };
  }
  const messages = await prisma.message.findMany({
    where: messageWhere,
    orderBy: { createdAt: "desc" },
    take: Math.min(opts?.limit ?? 50, 50),
    include: MESSAGE_INCLUDE,
  });
  messages.reverse();

  return { ...conversation, messages };
}

export async function startOrGetConversation(
  current: CurrentUserProfile,
  recipientIdOrProfileId: string
) {
  const recipient = await prisma.profile.findFirst({
    where: {
      OR: [
        { id: recipientIdOrProfileId },
        { userId: recipientIdOrProfileId },
      ],
    },
    include: {
      user: {
        select: {
          isBanned: true,
          deletionRequestedAt: true,
        },
      },
    },
  });
  if (!recipient) throw new Error("conversation.recipient_not_found");
  if (recipient.user.isBanned || recipient.user.deletionRequestedAt) {
    throw new Error("conversation.recipient_unavailable");
  }
  if (recipient.id === current.profileId) {
    throw new Error("conversation.cannot_message_self");
  }
  await assertProfilesCanInteract(current.profileId, recipient.id);

  const pair = canonicalProfilePair(current.profileId, recipient.id);
  return prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.upsert({
      where: {
        participantAId_participantBId: pair,
      },
      update: {},
      create: pair,
      include: CONVERSATION_INCLUDE,
    });
    await ensureConversationParticipants(tx, conversation);
    return conversation;
  });
}

export async function sendConversationMessage(
  current: CurrentUserProfile,
  conversationId: string,
  input: { body: string; mediaIds?: string[] }
) {
  const conversation = await getConversationForProfile(
    conversationId,
    current.profileId
  );
  assertNotBlocked(conversation.blockedById);

  const recipientId =
    conversation.participantAId === current.profileId
      ? conversation.participantBId
      : conversation.participantAId;
  await assertProfilesCanInteract(current.profileId, recipientId);
  await assertProfileCanReceiveMessage(recipientId);
  const mediaIds = input.mediaIds ?? [];
  const media = await assertMediaAttachable(current, mediaIds, 4, {
    allowPending: true,
  });
  if (media.some((item) => item.storageBucket !== PRIVATE_USER_MEDIA_BUCKET)) {
    throw new Error("message.media_must_be_private");
  }
  const phraseMatch = await findBannedPhraseMatch(input.body, "message");
  if (phraseMatch?.action === "block") throw new Error("message.blocked_phrase");
  const createdAt = new Date();

  const message = await prisma.$transaction(async (tx) => {
    await ensureConversationParticipants(tx, conversation);
    const created = await tx.message.create({
      data: {
        conversationId: conversation.id,
        senderId: current.profileId,
        recipientId,
        body: input.body,
        createdAt,
        media:
          mediaIds.length > 0
            ? {
                create: mediaIds.map((mediaId, position) => ({
                  mediaId,
                  position,
                })),
              }
            : undefined,
      },
      include: MESSAGE_INCLUDE,
    });
    await tx.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: createdAt },
    });
    if (mediaIds.length > 0) {
      await tx.mediaAsset.updateMany({
        where: { id: { in: mediaIds } },
        data: {
          linkedEntityType: "message",
          linkedEntityId: created.id,
        },
      });
    }
    if (phraseMatch) {
      await tx.trustSafetyFlag.create({
        data: {
          profileId: current.profileId,
          userId: current.dbUserId,
          targetType: "message",
          targetId: created.id,
          flagType: "banned_phrase",
          severity: "medium",
          reason: phraseMatch.reason ?? `Matched phrase: ${phraseMatch.phrase}`,
        },
      });
    }
    return created;
  });
  void touchPresence(current.profileId);

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action: "message.create",
    targetType: "conversation",
    targetId: conversation.id,
    metadata: {
      messageId: message.id,
      recipientProfileId: recipientId,
      mediaCount: mediaIds.length,
      phraseFlag: phraseMatch?.id,
    },
  });
  await broadcastConversationRefresh(conversation, "message_created", {
    messageId: message.id,
    senderProfileId: current.profileId,
    recipientProfileId: recipientId,
  });
  await createInAppNotificationDeduped({
    userId: message.recipient.userId,
    actorProfileId: current.profileId,
    type: "message",
    title: `New message from ${current.displayName}`,
    body: notificationBodySnippet(input.body),
    href: `/messages/${conversation.id}`,
    targetType: "message",
    targetId: message.id,
  });

  return message;
}

export async function markConversationRead(
  current: CurrentUserProfile,
  conversationId: string
) {
  const now = new Date();
  const conversation = await getConversationForProfile(
    conversationId,
    current.profileId
  );
  const result = await prisma.$transaction(async (tx) => {
    const unread = await tx.message.findMany({
      where: {
        conversationId,
        recipientId: current.profileId,
        readAt: null,
        deletedByRecipientAt: null,
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (unread.length === 0) return 0;

    const messageIds = unread.map((message) => message.id);
    await tx.message.updateMany({
      where: { id: { in: messageIds } },
      data: {
        read: true,
        readAt: now,
      },
    });
    // Read implies delivered.
    await tx.messageDeliveryReceipt.createMany({
      data: messageIds.map((messageId) => ({
        messageId,
        profileId: current.profileId,
        deliveredAt: now,
      })),
      skipDuplicates: true,
    });
    for (const messageId of messageIds) {
      await tx.messageReadReceipt.upsert({
        where: {
          messageId_profileId: {
            messageId,
            profileId: current.profileId,
          },
        },
        update: { readAt: now },
        create: {
          messageId,
          profileId: current.profileId,
          readAt: now,
        },
      });
    }
    await tx.conversationParticipant.upsert({
      where: {
        conversationId_profileId: {
          conversationId: conversation.id,
          profileId: current.profileId,
        },
      },
      update: { lastReadMessageId: messageIds[messageIds.length - 1] },
      create: {
        conversationId: conversation.id,
        profileId: current.profileId,
        lastReadMessageId: messageIds[messageIds.length - 1],
      },
    });
    return unread.length;
  });
  void touchPresence(current.profileId);

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action: "message.read",
    targetType: "conversation",
    targetId: conversationId,
    metadata: { count: result },
  });
  await broadcastConversationRefresh(conversation, "conversation_updated", {
    action: "message_read",
    profileId: current.profileId,
    count: result,
  });

  return result;
}

export async function markConversationDelivered(
  current: CurrentUserProfile,
  conversationId: string
) {
  await getConversationForProfile(conversationId, current.profileId, {
    limit: 1,
  });
  const undelivered = await prisma.message.findMany({
    where: {
      conversationId,
      recipientId: current.profileId,
      deletedByRecipientAt: null,
      deliveryReceipts: { none: { profileId: current.profileId } },
    },
    select: { id: true },
  });
  if (undelivered.length === 0) return { delivered: 0 };

  const created = await prisma.messageDeliveryReceipt.createMany({
    data: undelivered.map((message) => ({
      messageId: message.id,
      profileId: current.profileId,
    })),
    skipDuplicates: true,
  });
  if (created.count > 0) {
    await broadcastConversationRealtimeEvent(
      conversationId,
      "conversation_updated",
      { action: "message_delivered" }
    );
  }
  return { delivered: created.count };
}

// Rendered in the global header/inbox — must survive a DB blip, so both wrap
// safeQuery with an empty fallback rather than throwing up through the shell.
export async function countUnreadMessagesByConversation(profileId: string) {
  return safeQuery(async () => {
    const groups = await prisma.message.groupBy({
      by: ["conversationId"],
      where: {
        recipientId: profileId,
        readAt: null,
        deletedByRecipientAt: null,
      },
      _count: { _all: true },
    });
    const counts = new Map<string, number>();
    for (const group of groups) {
      if (group.conversationId) counts.set(group.conversationId, group._count._all);
    }
    return counts;
  }, new Map<string, number>());
}

export async function countUnreadMessagesTotal(profileId: string) {
  return safeQuery(
    () =>
      prisma.message.count({
        where: {
          recipientId: profileId,
          readAt: null,
          deletedByRecipientAt: null,
        },
      }),
    0
  );
}

export async function softDeleteConversationMessage(
  current: CurrentUserProfile,
  conversationId: string,
  messageId: string
) {
  const conversation = await getConversationForProfile(
    conversationId,
    current.profileId
  );
  const message = await prisma.message.findFirst({
    where: { id: messageId, conversationId },
  });
  if (!message) throw new Error("message.not_found");
  if (
    message.senderId !== current.profileId &&
    message.recipientId !== current.profileId
  ) {
    throw new Error("auth.forbidden");
  }

  const now = new Date();
  const data =
    message.senderId === current.profileId
      ? { deletedBySenderAt: now }
      : { deletedByRecipientAt: now };

  const updated = await prisma.message.update({
    where: { id: message.id },
    data,
  });

  await refreshConversationLastMessageAt(conversationId);
  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action: "message.delete",
    targetType: "message",
    targetId: message.id,
    metadata: { conversationId },
  });
  await broadcastConversationRefresh(conversation, "conversation_updated", {
    action: "message_deleted",
    messageId: message.id,
  });

  return updated;
}

export async function setConversationBlock(
  current: CurrentUserProfile,
  conversationId: string,
  blocked: boolean
) {
  const conversation = await getConversationForProfile(
    conversationId,
    current.profileId
  );

  if (!blocked && conversation.blockedById !== current.profileId) {
    throw new Error("auth.forbidden");
  }

  const blockedProfileId = otherProfileId(conversation, current.profileId);
  const updated = await prisma.$transaction(async (tx) => {
    const nextConversation = await tx.conversation.update({
      where: { id: conversation.id },
      data: blocked
        ? { blockedById: current.profileId, blockedAt: new Date() }
        : { blockedById: null, blockedAt: null },
      include: CONVERSATION_INCLUDE,
    });
    if (blocked) {
      await tx.userBlock.upsert({
        where: {
          blockerProfileId_blockedProfileId: {
            blockerProfileId: current.profileId,
            blockedProfileId,
          },
        },
        update: {},
        create: {
          blockerProfileId: current.profileId,
          blockedProfileId,
        },
      });
    } else {
      await tx.userBlock.deleteMany({
        where: {
          blockerProfileId: current.profileId,
          blockedProfileId,
        },
      });
    }
    return nextConversation;
  });

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action: blocked ? "conversation.block" : "conversation.unblock",
    targetType: "conversation",
    targetId: conversation.id,
  });
  await broadcastConversationRefresh(conversation, "conversation_updated", {
    action: blocked ? "blocked" : "unblocked",
    profileId: current.profileId,
  });

  return updated;
}

export async function toggleConversationMessageReaction(
  current: CurrentUserProfile,
  conversationId: string,
  messageId: string,
  reactionType = "like"
) {
  const conversation = await getConversationForProfile(
    conversationId,
    current.profileId
  );
  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      conversationId: conversation.id,
      OR: [
        { senderId: current.profileId, deletedBySenderAt: null },
        { recipientId: current.profileId, deletedByRecipientAt: null },
      ],
    },
    select: { id: true },
  });
  if (!message) throw new Error("message.not_found");

  const existing = await prisma.messageReaction.findUnique({
    where: {
      messageId_profileId_reactionType: {
        messageId,
        profileId: current.profileId,
        reactionType,
      },
    },
  });

  if (existing) {
    await prisma.messageReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.messageReaction.create({
      data: {
        messageId,
        profileId: current.profileId,
        reactionType,
      },
    });
  }

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action: existing ? "message.reaction.remove" : "message.reaction.add",
    targetType: "message",
    targetId: messageId,
    metadata: { conversationId, reactionType },
  });
  await broadcastConversationRefresh(conversation, "conversation_updated", {
    action: existing ? "message_reaction_removed" : "message_reaction_added",
    messageId,
  });
}

export async function assertProfilesCanInteract(
  profileAId: string,
  profileBId: string,
  errorCode = "conversation.blocked"
) {
  if (profileAId === profileBId) return;
  const block = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerProfileId: profileAId, blockedProfileId: profileBId },
        { blockerProfileId: profileBId, blockedProfileId: profileAId },
      ],
    },
    select: { id: true },
  });
  if (block) throw new Error(errorCode);
}

export function otherParticipant<
  T extends {
    participantAId: string;
    participantBId: string;
    participantA: unknown;
    participantB: unknown;
  },
>(conversation: T, profileId: string) {
  return conversation.participantAId === profileId
    ? conversation.participantB
    : conversation.participantA;
}

function otherProfileId(
  conversation: { participantAId: string; participantBId: string },
  profileId: string
) {
  return conversation.participantAId === profileId
    ? conversation.participantBId
    : conversation.participantAId;
}

async function ensureConversationParticipants(
  tx: Prisma.TransactionClient,
  conversation: { id: string; participantAId: string; participantBId: string }
) {
  for (const profileId of [
    conversation.participantAId,
    conversation.participantBId,
  ]) {
    await tx.conversationParticipant.upsert({
      where: {
        conversationId_profileId: {
          conversationId: conversation.id,
          profileId,
        },
      },
      update: {},
      create: {
        conversationId: conversation.id,
        profileId,
      },
    });
  }
}

async function broadcastConversationRefresh(
  conversation: { id: string; participantAId: string; participantBId: string },
  event: string,
  payload: Record<string, string | number | boolean | null>
) {
  await Promise.all([
    broadcastConversationRealtimeEvent(conversation.id, event, payload),
    broadcastProfileRealtimeEvent(conversation.participantAId, event, payload),
    broadcastProfileRealtimeEvent(conversation.participantBId, event, payload),
  ]);
}

function visibleMessageWhere(profileId: string) {
  return {
    OR: [
      { senderId: profileId, deletedBySenderAt: null },
      { recipientId: profileId, deletedByRecipientAt: null },
    ],
  };
}

function assertNotBlocked(blockedById: string | null) {
  if (blockedById) throw new Error("conversation.blocked");
}

// Fire-and-forget: presence is best-effort and must never fail the caller.
async function touchPresence(profileId: string) {
  const now = new Date();
  try {
    await prisma.userPresence.upsert({
      where: { profileId },
      update: { lastSeenAt: now, status: "online" },
      create: { profileId, lastSeenAt: now, status: "online" },
    });
  } catch (err) {
    logWarn("presence.upsert_failed", { profileId }, err);
  }
}

async function assertProfileCanReceiveMessage(profileId: string) {
  const profile = await prisma.profile.findFirst({
    where: {
      id: profileId,
      user: {
        isBanned: false,
        deletionRequestedAt: null,
      },
    },
    select: { id: true },
  });
  if (!profile) throw new Error("conversation.recipient_unavailable");
}

async function refreshConversationLastMessageAt(conversationId: string) {
  const lastVisibleToEitherParticipant = await prisma.message.findFirst({
    where: {
      conversationId,
      NOT: {
        AND: [
          { deletedBySenderAt: { not: null } },
          { deletedByRecipientAt: { not: null } },
        ],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: lastVisibleToEitherParticipant?.createdAt ?? null },
  });
}
