import { createAuditLog } from "@/lib/account-service";
import type { CurrentUserProfile } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertMediaAttachable } from "@/lib/media-service";
import { PRIVATE_USER_MEDIA_BUCKET } from "@/lib/storage-paths";

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
} as const;

const MESSAGE_INCLUDE = {
  sender: true,
  recipient: true,
  media: {
    orderBy: { position: "asc" },
    include: { media: true },
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
      OR: [{ participantAId: profileId }, { participantBId: profileId }],
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
      OR: [{ participantAId: profileId }, { participantBId: profileId }],
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

  const pair = canonicalProfilePair(current.profileId, recipient.id);
  return prisma.conversation.upsert({
    where: {
      participantAId_participantBId: pair,
    },
    update: {},
    create: pair,
    include: CONVERSATION_INCLUDE,
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
  await assertProfileCanReceiveMessage(recipientId);
  const mediaIds = input.mediaIds ?? [];
  const media = await assertMediaAttachable(current, mediaIds, 4);
  if (media.some((item) => item.storageBucket !== PRIVATE_USER_MEDIA_BUCKET)) {
    throw new Error("message.media_must_be_private");
  }
  const createdAt = new Date();

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        conversationId: conversation.id,
        senderId: current.profileId,
        recipientId,
        body: input.body,
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
    },
  });

  return message;
}

export async function markConversationRead(
  current: CurrentUserProfile,
  conversationId: string
) {
  await getConversationForProfile(conversationId, current.profileId);
  const now = new Date();
  const result = await prisma.message.updateMany({
    where: {
      conversationId,
      recipientId: current.profileId,
      readAt: null,
      deletedByRecipientAt: null,
    },
    data: {
      read: true,
      readAt: now,
    },
  });

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action: "message.read",
    targetType: "conversation",
    targetId: conversationId,
    metadata: { count: result.count },
  });

  return result.count;
}

export async function softDeleteConversationMessage(
  current: CurrentUserProfile,
  conversationId: string,
  messageId: string
) {
  await getConversationForProfile(conversationId, current.profileId);
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

  const updated = await prisma.conversation.update({
    where: { id: conversation.id },
    data: blocked
      ? { blockedById: current.profileId, blockedAt: new Date() }
      : { blockedById: null, blockedAt: null },
    include: CONVERSATION_INCLUDE,
  });

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action: blocked ? "conversation.block" : "conversation.unblock",
    targetType: "conversation",
    targetId: conversation.id,
  });

  return updated;
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
