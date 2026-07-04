import { createAuditLog } from "@/lib/account-service";
import type { CurrentUserProfile } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertMediaAttachable } from "@/lib/media-service";
import { findBannedPhraseMatch } from "@/lib/moderation-service";
import {
  createInAppNotification,
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
  profileId: string
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
    include: {
      ...CONVERSATION_INCLUDE,
      messages: {
        where: visibleMessageWhere(profileId),
        orderBy: { createdAt: "asc" },
        take: 50,
        include: MESSAGE_INCLUDE,
      },
    },
  });
  if (!conversation) throw new Error("conversation.not_found");
  return conversation;
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
  const media = await assertMediaAttachable(current, mediaIds, 4);
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
        mediaIdsJson: mediaIds.length > 0 ? JSON.stringify(mediaIds) : null,
        media:
          mediaIds.length > 0
            ? {
                create: mediaIds.map((mediaId, position) => ({
                  mediaId,
                  position,
                })),
              }
            : undefined,
        deliveryReceipts: {
          create: {
            profileId: recipientId,
            deliveredAt: createdAt,
          },
        },
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
  await createInAppNotification({
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
