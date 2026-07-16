import { createAuditLog } from "@/lib/account-service";
import type { CurrentUserProfile } from "@/lib/auth";
import { safeQuery } from "@/lib/db";
import {
  withDbRequestContext,
  withDbSystemContext,
  type DbContextUser,
} from "@/lib/db-context";
import { logRequestWarn } from "@/lib/logger";
import { resolveDemoProfilePortrait } from "@/lib/demo-profile-media";
import { assertMediaAttachable } from "@/lib/media-service";
import { findBannedPhraseMatch } from "@/lib/moderation-service";
import {
  createInAppNotificationDeduped,
  notificationBodySnippet,
} from "@/lib/notification-service";
import {
  broadcastConversationRealtimeEvent,
  broadcastProfileRealtimeEvent,
  revokeConversationRealtimeGrants,
} from "@/lib/realtime-service";
import {
  requireOwnedActor,
  type SocialActorSummary,
} from "@/lib/social-actor-service";
import { PRIVATE_USER_MEDIA_BUCKET } from "@/lib/storage-paths";
import { assertPaidFeatureAccess } from "@/lib/tier-access";
import type { Prisma } from "@prisma/client";

const CONVERSATION_ACTOR_SELECT = {
  id: true,
  kind: true,
  handle: true,
  displayName: true,
  avatarUrl: true,
  ownerProfileId: true,
  profileId: true,
  pageId: true,
  published: true,
} as const;

const CONVERSATION_INCLUDE = {
  participantA: {
    select: { id: true, displayName: true, avatarUrl: true, kennelName: true, state: true },
  },
  participantB: {
    select: { id: true, displayName: true, avatarUrl: true, kennelName: true, state: true },
  },
  participantAActor: { select: CONVERSATION_ACTOR_SELECT },
  participantBActor: { select: CONVERSATION_ACTOR_SELECT },
  participants: {
    include: { actor: { select: CONVERSATION_ACTOR_SELECT } },
  },
} as const;

function withDemoConversationPortraits<
  T extends Prisma.ConversationGetPayload<{ include: typeof CONVERSATION_INCLUDE }>,
>(conversation: T) {
  return {
    ...conversation,
    participantA: {
      ...conversation.participantA,
      avatarUrl: resolveDemoProfilePortrait(
        conversation.participantA.displayName,
        conversation.participantA.avatarUrl,
      ),
    },
    participantB: {
      ...conversation.participantB,
      avatarUrl: resolveDemoProfilePortrait(
        conversation.participantB.displayName,
        conversation.participantB.avatarUrl,
      ),
    },
    participantAActor: conversation.participantAActor
      ? {
          ...conversation.participantAActor,
          avatarUrl: resolveDemoProfilePortrait(
            conversation.participantAActor.displayName,
            conversation.participantAActor.avatarUrl,
          ),
        }
      : null,
    participantBActor: conversation.participantBActor
      ? {
          ...conversation.participantBActor,
          avatarUrl: resolveDemoProfilePortrait(
            conversation.participantBActor.displayName,
            conversation.participantBActor.avatarUrl,
          ),
        }
      : null,
  };
}

// The conversation list only renders the last message's sender/body/read state
// and whether it carried media — not the full thread of receipts/reactions.
const CONVERSATION_LIST_MESSAGE_SELECT = {
  id: true,
  body: true,
  createdAt: true,
  senderId: true,
  senderActor: { select: CONVERSATION_ACTOR_SELECT },
  recipientActor: { select: CONVERSATION_ACTOR_SELECT },
  read: true,
  readAt: true,
  _count: { select: { media: true } },
} as const;

const MESSAGE_INCLUDE = {
  sender: { select: { displayName: true } },
  senderActor: { select: CONVERSATION_ACTOR_SELECT },
  recipientActor: { select: CONVERSATION_ACTOR_SELECT },
  media: {
    orderBy: { position: "asc" },
    include: { media: true },
  },
  deliveryReceipts: true,
  readReceipts: true,
  reactions: {
    orderBy: { createdAt: "asc" },
    select: { profileId: true },
  },
} as const;

export function canonicalProfilePair(profileAId: string, profileBId: string) {
  return profileAId < profileBId
    ? { participantAId: profileAId, participantBId: profileBId }
    : { participantAId: profileBId, participantBId: profileAId };
}

export async function listConversationsForProfile(current: DbContextUser) {
  return withDbRequestContext(current, async (tx) => {
    const conversations = await tx.conversation.findMany({
      where: {
        OR: [
          { participantAId: current.profileId },
          { participantBId: current.profileId },
        ],
      },
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
      include: {
        ...CONVERSATION_INCLUDE,
        messages: {
          where: visibleMessageWhere(current.profileId),
          orderBy: { createdAt: "desc" },
          take: 1,
          select: CONVERSATION_LIST_MESSAGE_SELECT,
        },
      },
      take: 50,
    });
    return conversations.map(withDemoConversationPortraits);
  });
}

export async function getConversationForProfile(
  current: DbContextUser,
  conversationId: string,
  opts?: { before?: string; limit?: number }
) {
  return withDbRequestContext(current, async (tx) => {
    const conversation = await tx.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [
          { participantAId: current.profileId },
          { participantBId: current.profileId },
        ],
      },
      include: CONVERSATION_INCLUDE,
    });
    if (!conversation) throw new Error("conversation.not_found");

    const messageWhere: Prisma.MessageWhereInput = {
      conversationId,
      ...visibleMessageWhere(current.profileId),
    };
    if (opts?.before) {
      const cursor = await tx.message.findFirst({
        where: { id: opts.before, conversationId },
        select: { createdAt: true },
      });
      if (!cursor) throw new Error("message.not_found");
      messageWhere.createdAt = { lt: cursor.createdAt };
    }
    const messages = await tx.message.findMany({
      where: messageWhere,
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(1, Math.trunc(opts?.limit ?? 50)), 50),
      include: MESSAGE_INCLUDE,
    });
    messages.reverse();

    return { ...withDemoConversationPortraits(conversation), messages };
  });
}

export async function searchConversationMessages(
  current: DbContextUser,
  conversationId: string,
  rawQuery: string,
  options?: { before?: string | null; limit?: number }
) {
  const query = rawQuery.trim().replace(/\s+/g, " ").slice(0, 100);
  if (query.length < 2) return { items: [], nextCursor: null };
  const limit = Math.min(Math.max(Math.trunc(options?.limit ?? 20), 1), 50);
  return withDbRequestContext(current, async (tx) => {
    const conversation = await tx.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [
          { participantAId: current.profileId },
          { participantBId: current.profileId },
        ],
      },
      select: { id: true },
    });
    if (!conversation) throw new Error("conversation.not_found");
    const cursor = options?.before
      ? await tx.message.findFirst({
          where: { id: options.before, conversationId },
          select: { id: true, createdAt: true },
        })
      : null;
    if (options?.before && !cursor) throw new Error("message.not_found");
    const rows = await tx.message.findMany({
      where: {
        conversationId,
        body: { contains: query, mode: "insensitive" },
        AND: [
          visibleMessageWhere(current.profileId),
          ...(cursor
            ? [
                {
                  OR: [
                    { createdAt: { lt: cursor.createdAt } },
                    { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                  ],
                },
              ]
            : []),
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: Math.min(Math.max(1, limit + 1), 51),
      include: MESSAGE_INCLUDE,
    });
    const items = rows.slice(0, limit);
    return {
      items,
      nextCursor: rows.length > limit ? items.at(-1)?.id ?? null : null,
    };
  });
}

export type ConversationStartOptions = {
  senderActorId?: string | null;
};

type ConversationActorIdentity = Pick<
  SocialActorSummary,
  | "id"
  | "kind"
  | "handle"
  | "displayName"
  | "avatarUrl"
  | "ownerProfileId"
  | "profileId"
  | "pageId"
  | "published"
>;

export async function startOrGetConversation(
  current: CurrentUserProfile,
  recipientIdOrProfileId: string,
  options?: ConversationStartOptions
) {
  const identities = await withDbRequestContext(current, async (tx) => {
    const senderActor = await requireOwnedActor(
      current,
      options?.senderActorId,
      tx
    );
    const recipient = await resolveConversationRecipient(
      tx,
      recipientIdOrProfileId
    );
    return { senderActor, recipient };
  });
  const { senderActor, recipient } = identities;
  if (!recipient) throw new Error("conversation.recipient_not_found");
  if (senderActor.kind === "page") {
    assertPaidFeatureAccess(current);
    if (!senderActor.published) throw new Error("actor.page_unpublished");
  }
  await assertProfileCanReceiveMessage(recipient.profileId);
  if (recipient.profileId === current.profileId) {
    throw new Error("conversation.cannot_message_self");
  }
  await assertProfilesCanInteract(current.profileId, recipient.profileId);

  const pair = canonicalProfilePair(current.profileId, recipient.profileId);
  const actorPair =
    pair.participantAId === current.profileId
      ? {
          participantAActorId: senderActor.id,
          participantBActorId: recipient.actor.id,
        }
      : {
          participantAActorId: recipient.actor.id,
          participantBActorId: senderActor.id,
        };

  return withDbRequestContext(current, async (tx) => {
    let conversation = await tx.conversation.findFirst({
      where: { ...pair, ...actorPair },
      include: CONVERSATION_INCLUDE,
    });
    if (!conversation && !actorConversationMultiplexEnabled()) {
      const legacyPair = await tx.conversation.findFirst({
        where: pair,
        include: CONVERSATION_INCLUDE,
      });
      if (
        legacyPair &&
        (legacyPair.participantAActorId || legacyPair.participantBActorId)
      ) {
        throw new Error("conversation.actor_pair_conflict");
      }
      conversation = legacyPair;
    }
    if (!conversation) {
      try {
        conversation = await tx.conversation.create({
          data: { ...pair, ...actorPair },
          include: CONVERSATION_INCLUDE,
        });
      } catch (err) {
        if (!isUniqueConstraintError(err)) throw err;
        conversation = await tx.conversation.findFirst({
          where: { ...pair, ...actorPair },
          include: CONVERSATION_INCLUDE,
        });
      }
    }
    if (!conversation) throw new Error("conversation.create_failed");
    assertConversationActorPair(conversation, actorPair);
    if (
      conversation.participantAActorId !== actorPair.participantAActorId ||
      conversation.participantBActorId !== actorPair.participantBActorId
    ) {
      conversation = await tx.conversation.update({
        where: { id: conversation.id },
        data: actorPair,
        include: CONVERSATION_INCLUDE,
      });
    }
    await ensureConversationParticipants(tx, conversation);
    return conversation;
  });
}

export async function sendConversationMessage(
  current: CurrentUserProfile,
  conversationId: string,
  input: { body: string; mediaIds?: string[] }
) {
  // Personal text messaging is available to every tier. The participant check
  // below and giq_message_write_guard enforce the same boundary under RLS.
  const conversation = await getConversationForProfile(
    current,
    conversationId,
  );
  assertNotBlocked(conversation.blockedById);

  const { senderActor, recipientActor } =
    await resolveConversationActorsForSender(current, conversation);
  const recipientId = recipientActor.ownerProfileId;
  await assertProfilesCanInteract(current.profileId, recipientId);
  const recipientUserId = await assertProfileCanReceiveMessage(recipientId);
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

  const message = await withDbRequestContext(current, async (tx) => {
    await ensureConversationParticipants(tx, conversation);
    const created = await tx.message.create({
      data: {
        conversationId: conversation.id,
        senderId: current.profileId,
        senderActorId: senderActor.id,
        recipientId,
        recipientActorId: recipientActor.id,
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
      senderActorId: senderActor.id,
      recipientActorId: recipientActor.id,
      mediaCount: mediaIds.length,
      phraseFlag: phraseMatch?.id,
    },
  });
  await broadcastConversationRefresh(conversation, "message_created", {
    messageId: message.id,
    senderProfileId: current.profileId,
    recipientProfileId: recipientId,
    senderActorId: senderActor.id,
    recipientActorId: recipientActor.id,
  });
  await createInAppNotificationDeduped({
    userId: recipientUserId,
    actorProfileId: current.profileId,
    actorId: senderActor.id,
    type: "message",
    title: `New message from ${senderActor.displayName}`,
    body: notificationBodySnippet(input.body),
    href: `/pulse/${conversation.id}`,
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
    current,
    conversationId,
  );
  const { senderActor: currentActor } =
    await resolveConversationActorsForSender(current, conversation);
  const result = await withDbRequestContext(current, async (tx) => {
    const unread = await tx.message.findMany({
      where: {
        conversationId,
        recipientId: current.profileId,
        readAt: null,
        deletedByRecipientAt: null,
      },
      orderBy: { createdAt: "asc" },
      take: 200,
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
    await tx.messageReadReceipt.createMany({
      data: messageIds.map((messageId) => ({
        messageId,
        profileId: current.profileId,
        readAt: now,
      })),
      skipDuplicates: true,
    });
    await tx.conversationParticipant.upsert({
      where: {
        conversationId_profileId: {
          conversationId: conversation.id,
          profileId: current.profileId,
        },
      },
      update: {
        actorId: currentActor.id,
        lastReadMessageId: messageIds[messageIds.length - 1],
      },
      create: {
        conversationId: conversation.id,
        profileId: current.profileId,
        actorId: currentActor.id,
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
  current: DbContextUser,
  conversationId: string
) {
  await getConversationForProfile(current, conversationId, {
    limit: 1,
  });
  const { undelivered, created } = await withDbRequestContext(
    current,
    async (tx) => {
      const undelivered = await tx.message.findMany({
        where: {
          conversationId,
          recipientId: current.profileId,
          deletedByRecipientAt: null,
          deliveryReceipts: { none: { profileId: current.profileId } },
        },
        orderBy: { createdAt: "asc" },
        take: 200,
        select: { id: true },
      });
      if (undelivered.length === 0) {
        return { undelivered, created: { count: 0 } };
      }

      const created = await tx.messageDeliveryReceipt.createMany({
        data: undelivered.map((message) => ({
          messageId: message.id,
          profileId: current.profileId,
        })),
        skipDuplicates: true,
      });
      return { undelivered, created };
    }
  );
  if (undelivered.length === 0) return { delivered: 0 };
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
export async function countUnreadMessagesByConversation(current: DbContextUser) {
  return safeQuery(async () => {
    const groups = await withDbRequestContext(current, (tx) =>
      tx.message.groupBy({
        by: ["conversationId"],
        where: {
          recipientId: current.profileId,
          readAt: null,
          deletedByRecipientAt: null,
        },
        _count: { _all: true },
        orderBy: { conversationId: "asc" },
        take: 5_000,
      })
    );
    const counts = new Map<string, number>();
    for (const group of groups) {
      if (group.conversationId) counts.set(group.conversationId, group._count._all);
    }
    return counts;
  }, new Map<string, number>());
}

export async function countUnreadMessagesTotal(current: DbContextUser) {
  return safeQuery(
    () =>
      withDbRequestContext(current, (tx) =>
        tx.message.count({
          where: {
            recipientId: current.profileId,
            readAt: null,
            deletedByRecipientAt: null,
          },
        })
      ),
    0
  );
}

export async function softDeleteConversationMessage(
  current: CurrentUserProfile,
  conversationId: string,
  messageId: string
) {
  const conversation = await getConversationForProfile(
    current,
    conversationId,
  );
  const message = await withDbRequestContext(current, (tx) =>
    tx.message.findFirst({
      where: { id: messageId, conversationId },
    })
  );
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

  const updated = await withDbRequestContext(current, (tx) =>
    tx.message.update({
      where: { id: message.id },
      data,
    })
  );

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
    current,
    conversationId,
  );

  if (!blocked && conversation.blockedById !== current.profileId) {
    throw new Error("auth.forbidden");
  }

  const blockedProfileId = otherProfileId(conversation, current.profileId);
  const updated = await withDbRequestContext(current, async (tx) => {
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

  if (blocked) {
    await revokeConversationRealtimeGrants(conversation.id, [
      current.profileId,
      blockedProfileId,
    ]);
  }

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
    current,
    conversationId,
  );
  const message = await withDbRequestContext(current, (tx) =>
    tx.message.findFirst({
      where: {
        id: messageId,
        conversationId: conversation.id,
        OR: [
          { senderId: current.profileId, deletedBySenderAt: null },
          { recipientId: current.profileId, deletedByRecipientAt: null },
        ],
      },
      select: { id: true },
    })
  );
  if (!message) throw new Error("message.not_found");

  const existing = await withDbRequestContext(current, (tx) =>
    tx.messageReaction.findUnique({
      where: {
        messageId_profileId_reactionType: {
          messageId,
          profileId: current.profileId,
          reactionType,
        },
      },
    })
  );

  if (existing) {
    await withDbRequestContext(current, (tx) =>
      tx.messageReaction.delete({ where: { id: existing.id } })
    );
  } else {
    await withDbRequestContext(current, (tx) =>
      tx.messageReaction.create({
        data: {
          messageId,
          profileId: current.profileId,
          reactionType,
        },
      })
    );
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
  const block = await withDbSystemContext((tx) =>
    tx.userBlock.findFirst({
      where: {
        OR: [
          { blockerProfileId: profileAId, blockedProfileId: profileBId },
          { blockerProfileId: profileBId, blockedProfileId: profileAId },
        ],
      },
      select: { id: true },
    })
  );
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

async function resolveConversationRecipient(
  tx: Prisma.TransactionClient,
  recipientIdOrProfileId: string
): Promise<{
  profileId: string;
  actor: ConversationActorIdentity;
} | null> {
  const actor = await tx.socialActor.findFirst({
    where: {
      id: recipientIdOrProfileId,
      published: true,
    },
    select: {
      ...CONVERSATION_ACTOR_SELECT,
      ownerProfile: {
        select: {
          id: true,
        },
      },
    },
  });
  if (actor) {
    return {
      profileId: actor.ownerProfile.id,
      actor,
    };
  }

  const profile = await tx.profile.findFirst({
    where: {
      OR: [
        { id: recipientIdOrProfileId },
        { userId: recipientIdOrProfileId },
      ],
    },
    select: {
      id: true,
      socialActor: { select: CONVERSATION_ACTOR_SELECT },
    },
  });
  if (!profile?.socialActor) return null;
  return {
    profileId: profile.id,
    actor: profile.socialActor,
  };
}

function assertConversationActorPair(
  conversation: {
    participantAActorId: string | null;
    participantBActorId: string | null;
  },
  actorPair: {
    participantAActorId: string;
    participantBActorId: string;
  }
) {
  if (
    (conversation.participantAActorId &&
      conversation.participantAActorId !== actorPair.participantAActorId) ||
    (conversation.participantBActorId &&
      conversation.participantBActorId !== actorPair.participantBActorId)
  ) {
    throw new Error("conversation.actor_pair_conflict");
  }
}

function isUniqueConstraintError(err: unknown) {
  return (err as { code?: string } | null)?.code === "P2002";
}

function actorConversationMultiplexEnabled() {
  const configured = process.env.ACTOR_CONVERSATION_MULTIPLEX_ENABLED;
  if (configured === "true") return true;
  if (configured === "false") return false;
  return process.env.NODE_ENV !== "production";
}

async function resolveConversationActorsForSender(
  current: DbContextUser,
  conversation: {
    id: string;
    participantAId: string;
    participantAActorId: string | null;
    participantAActor: ConversationActorIdentity | null;
    participantBId: string;
    participantBActorId: string | null;
    participantBActor: ConversationActorIdentity | null;
  }
) {
  if (
    current.profileId !== conversation.participantAId &&
    current.profileId !== conversation.participantBId
  ) {
    throw new Error("conversation.not_found");
  }

  let participantAActor = conversation.participantAActor;
  let participantBActor = conversation.participantBActor;
  if (!participantAActor || !participantBActor) {
    // The caller is already authorized for this 1:1 conversation. A system
    // read preserves its fixed actor identity even if a profile becomes hidden.
    const actorIds = [
      conversation.participantAActorId,
      conversation.participantBActorId,
    ].filter((id): id is string => Boolean(id));
    const fallbackActors = await withDbSystemContext((tx) =>
      tx.socialActor.findMany({
        where: {
          OR: [
            { id: { in: actorIds } },
            {
              profileId: {
                in: [conversation.participantAId, conversation.participantBId],
              },
            },
          ],
        },
        select: CONVERSATION_ACTOR_SELECT,
        take: 4,
      })
    );
    participantAActor ??=
      fallbackActors.find(
        (actor) => actor.id === conversation.participantAActorId
      ) ??
      fallbackActors.find(
        (actor) => actor.profileId === conversation.participantAId
      ) ??
      null;
    participantBActor ??=
      fallbackActors.find(
        (actor) => actor.id === conversation.participantBActorId
      ) ??
      fallbackActors.find(
        (actor) => actor.profileId === conversation.participantBId
      ) ??
      null;
  }
  if (!participantAActor || !participantBActor) {
    throw new Error("conversation.actor_not_found");
  }
  if (
    participantAActor.ownerProfileId !== conversation.participantAId ||
    participantBActor.ownerProfileId !== conversation.participantBId
  ) {
    throw new Error("conversation.actor_pair_invalid");
  }

  if (
    conversation.participantAActorId !== participantAActor.id ||
    conversation.participantBActorId !== participantBActor.id
  ) {
    await withDbRequestContext(current, async (tx) => {
      const updated = await tx.conversation.update({
        where: { id: conversation.id },
        data: {
          participantAActorId: participantAActor.id,
          participantBActorId: participantBActor.id,
        },
      });
      await ensureConversationParticipants(tx, updated);
    });
  }

  const currentIsA = current.profileId === conversation.participantAId;
  const senderActor = currentIsA ? participantAActor : participantBActor;
  const recipientActor = currentIsA ? participantBActor : participantAActor;
  if (senderActor.ownerProfileId !== current.profileId) {
    throw new Error("actor.not_owned");
  }
  return { senderActor, recipientActor };
}

async function ensureConversationParticipants(
  tx: Prisma.TransactionClient,
  conversation: {
    id: string;
    participantAId: string;
    participantAActorId: string | null;
    participantBId: string;
    participantBActorId: string | null;
  }
) {
  for (const { profileId, actorId } of [
    {
      profileId: conversation.participantAId,
      actorId: conversation.participantAActorId,
    },
    {
      profileId: conversation.participantBId,
      actorId: conversation.participantBActorId,
    },
  ]) {
    await tx.conversationParticipant.upsert({
      where: {
        conversationId_profileId: {
          conversationId: conversation.id,
          profileId,
        },
      },
      update: { actorId },
      create: {
        conversationId: conversation.id,
        profileId,
        actorId,
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
    await withDbSystemContext((tx) =>
      tx.userPresence.upsert({
        where: { profileId },
        update: { lastSeenAt: now, status: "online" },
        create: { profileId, lastSeenAt: now, status: "online" },
      })
    );
  } catch (err) {
    await logRequestWarn("presence.upsert_failed", { profileId }, err);
  }
}

async function assertProfileCanReceiveMessage(profileId: string) {
  const profile = await withDbSystemContext((tx) =>
    tx.profile.findFirst({
      where: {
        id: profileId,
        user: {
          isBanned: false,
          deletionRequestedAt: null,
        },
      },
      select: { userId: true },
    })
  );
  if (!profile) throw new Error("conversation.recipient_unavailable");
  return profile.userId;
}

async function refreshConversationLastMessageAt(conversationId: string) {
  const lastVisibleToEitherParticipant = await withDbSystemContext((tx) =>
    tx.message.findFirst({
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
    })
  );

  await withDbSystemContext((tx) =>
    tx.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: lastVisibleToEitherParticipant?.createdAt ?? null },
    })
  );
}
