import { randomUUID } from "node:crypto";
import { createAuditLog } from "@/lib/account-service";
import type { CurrentUserProfile } from "@/lib/auth";
import {
  callRoomJoinWhere,
  createLiveKitCallToken,
  type LiveKitConfig,
} from "@/lib/call-token";
import {
  assertProfilesCanInteract,
  getConversationForProfile,
} from "@/lib/conversation-service";
import { prisma } from "@/lib/db";
import { broadcastConversationRealtimeEvent } from "@/lib/realtime-service";

export async function getActiveCallRoomForConversation(
  current: { profileId: string },
  conversationId: string
) {
  const conversation = await getConversationForProfile(
    conversationId,
    current.profileId
  );
  if (conversation.blockedById) return null;

  const otherProfileId = otherConversationProfileId(
    conversation,
    current.profileId
  );
  await assertProfilesCanInteract(
    current.profileId,
    otherProfileId,
    "call.blocked"
  );

  return findActiveCallRoom(conversation.id, current.profileId);
}

export async function createCallRoomForConversation(
  current: CurrentUserProfile,
  conversationId: string
) {
  const conversation = await getConversationForProfile(
    conversationId,
    current.profileId
  );
  if (conversation.blockedById) throw new Error("call.blocked");

  const otherProfileId =
    conversation.participantAId === current.profileId
      ? conversation.participantBId
      : conversation.participantAId;
  await assertProfilesCanInteract(
    current.profileId,
    otherProfileId,
    "call.blocked"
  );

  const existingRoom = await findActiveCallRoom(
    conversation.id,
    current.profileId
  );
  if (existingRoom) return existingRoom;

  const roomName = `ghiq-${conversation.id}-${randomUUID()}`;
  const inviteExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const room = await prisma.$transaction(async (tx) => {
    const created = await tx.callRoom.create({
      data: {
        conversationId: conversation.id,
        createdByProfileId: current.profileId,
        roomName,
        status: "active",
        startsAt: new Date(),
        participants: {
          create: [
            { profileId: current.profileId, role: "host" },
            { profileId: otherProfileId, role: "participant" },
          ],
        },
        permissions: {
          create: [
            { profileId: current.profileId, canJoin: true, canInvite: true },
            { profileId: otherProfileId, canJoin: true, canInvite: false },
          ],
        },
        invites: {
          create: {
            fromProfileId: current.profileId,
            toProfileId: otherProfileId,
            status: "pending",
            expiresAt: inviteExpiresAt,
          },
        },
      },
    });
    await tx.callEvent.create({
      data: {
        callRoomId: created.id,
        profileId: current.profileId,
        eventType: "room_created",
        metadataJson: JSON.stringify({ conversationId: conversation.id }),
      },
    });
    return created;
  });

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action: "call.room.create",
    targetType: "call_room",
    targetId: room.id,
    metadata: { conversationId: conversation.id, inviteExpiresAt },
  });
  await broadcastConversationRealtimeEvent(conversation.id, "call_room_created", {
    roomId: room.id,
  });

  return room;
}

export async function createCallTokenForCurrentUser(
  current: CurrentUserProfile,
  roomId: string
) {
  const config = liveKitConfig();
  const room = await prisma.callRoom.findFirst({
    where: callRoomJoinWhere(roomId, current.profileId),
    include: {
      conversation: true,
    },
  });
  if (!room) throw new Error("call.room_not_found");
  if (room.conversation?.blockedById) throw new Error("call.blocked");
  if (room.conversation) {
    const otherProfileId =
      room.conversation.participantAId === current.profileId
        ? room.conversation.participantBId
        : room.conversation.participantAId;
    await assertProfilesCanInteract(
      current.profileId,
      otherProfileId,
      "call.blocked"
    );
  }

  const signed = createLiveKitCallToken(current, room.roomName, config);
  const issuedAt = new Date();

  await prisma.$transaction([
    prisma.callParticipant.updateMany({
      where: { callRoomId: room.id, profileId: current.profileId },
      data: {
        joinedAt: issuedAt,
        lastTokenIssuedAt: issuedAt,
        leftAt: null,
      },
    }),
    prisma.callEvent.create({
      data: {
        callRoomId: room.id,
        profileId: current.profileId,
        eventType: "token_issued",
        metadataJson: JSON.stringify({ expiresAt: signed.expiresAtSeconds }),
      },
    }),
  ]);

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action: "call.token.issue",
    targetType: "call_room",
    targetId: room.id,
    metadata: { expiresAt: new Date(signed.expiresAtSeconds * 1000).toISOString() },
  });

  return {
    roomId: room.id,
    roomName: room.roomName,
    url: config.url,
    token: signed.token,
    expiresAt: new Date(signed.expiresAtSeconds * 1000).toISOString(),
  };
}

export async function endCallRoomForCurrentUser(
  current: CurrentUserProfile,
  roomId: string
) {
  const room = await prisma.callRoom.findFirst({
    where: {
      id: roomId,
      permissions: {
        some: {
          profileId: current.profileId,
          canJoin: true,
        },
      },
    },
  });
  if (!room) throw new Error("call.room_not_found");
  if (room.status !== "active") return room;

  const endedAt = new Date();
  const ended = await prisma.$transaction(async (tx) => {
    const updated = await tx.callRoom.update({
      where: { id: room.id },
      data: {
        status: "ended",
        endedAt,
      },
    });
    await tx.callParticipant.updateMany({
      where: { callRoomId: room.id, profileId: current.profileId },
      data: { leftAt: endedAt },
    });
    await tx.callEvent.create({
      data: {
        callRoomId: room.id,
        profileId: current.profileId,
        eventType: "room_ended",
        metadataJson: JSON.stringify({ endedByProfileId: current.profileId }),
      },
    });
    return updated;
  });

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action: "call.room.end",
    targetType: "call_room",
    targetId: room.id,
    metadata: { endedAt: endedAt.toISOString() },
  });
  if (ended.conversationId) {
    await broadcastConversationRealtimeEvent(
      ended.conversationId,
      "call_room_ended",
      { roomId: ended.id }
    );
  }

  return ended;
}

function findActiveCallRoom(conversationId: string, profileId: string) {
  return prisma.callRoom.findFirst({
    where: {
      conversationId,
      status: "active",
      permissions: {
        some: {
          profileId,
          canJoin: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

function otherConversationProfileId(
  conversation: { participantAId: string; participantBId: string },
  profileId: string
) {
  return conversation.participantAId === profileId
    ? conversation.participantBId
    : conversation.participantAId;
}

function liveKitConfig(): LiveKitConfig {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) throw new Error("call.not_configured");
  return { url, apiKey, apiSecret };
}
