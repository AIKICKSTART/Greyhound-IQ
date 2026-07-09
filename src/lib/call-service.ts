import { randomUUID } from "node:crypto";
import type { WebhookEvent } from "livekit-server-sdk";
import { createAuditLog } from "@/lib/account-service";
import type { CurrentUserProfile } from "@/lib/auth";
import {
  CALL_ROOM_JOIN_TTL_MS,
  callRoomJoinWhere,
  createLiveKitCallToken,
} from "@/lib/call-token";
import {
  assertProfilesCanInteract,
  getConversationForProfile,
} from "@/lib/conversation-service";
import {
  withDbRequestContext,
  withDbSystemContext,
  type DbContextUser,
} from "@/lib/db-context";
import { assertPaidFeatureAccess } from "@/lib/tier-access";
import { deleteLiveKitRoom, liveKitConfig } from "@/lib/livekit-admin";
import { createInAppNotification } from "@/lib/notification-service";
import {
  broadcastConversationRealtimeEvent,
  broadcastProfileRealtimeEvent,
} from "@/lib/realtime-service";

export async function getActiveCallRoomForConversation(
  current: DbContextUser,
  conversationId: string
) {
  const conversation = await getConversationForProfile(
    current,
    conversationId
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

  return findActiveCallRoom(conversation.id, current);
}

// Read-only: newest pending invite for a conversation's active call room.
// Callers must have already authorized access to the conversation.
export function getPendingCallInviteForConversation(
  current: DbContextUser,
  conversationId: string
) {
  return withDbRequestContext(current, (tx) => tx.callInvite.findFirst({
    where: {
      status: "pending",
      callRoom: { conversationId, status: "active" },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      callRoomId: true,
      toProfileId: true,
      expiresAt: true,
      fromProfile: { select: { displayName: true } },
      callRoom: { select: { callType: true } },
    },
  }));
}

// Read-only: pending invites ringing THIS profile across all conversations —
// powers the hub incoming-call card. RLS scopes rows; the where clause keeps
// intent explicit and drops expired invites.
export function listPendingCallInvitesForProfile(current: DbContextUser) {
  return withDbRequestContext(current, (tx) => tx.callInvite.findMany({
    where: {
      status: "pending",
      toProfileId: current.profileId,
      expiresAt: { gt: new Date() },
      callRoom: { status: "active" },
    },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: {
      id: true,
      callRoomId: true,
      expiresAt: true,
      fromProfile: { select: { id: true, displayName: true } },
      callRoom: { select: { callType: true, conversationId: true } },
    },
  }));
}

// Read-only: recent terminal call events for the conversation thread log.
// Callers must have already authorized access to the conversation.
export function getRecentCallLogForConversation(
  current: DbContextUser,
  conversationId: string,
  limit = 10
) {
  return withDbRequestContext(current, (tx) => tx.callEvent.findMany({
    where: {
      eventType: { in: ["room_ended", "room_expired", "invite_missed"] },
      callRoom: { conversationId },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      eventType: true,
      createdAt: true,
      callRoom: { select: { callType: true, createdAt: true, endedAt: true } },
    },
  }));
}

export async function createCallRoomForConversation(
  current: CurrentUserProfile,
  conversationId: string,
  callType: "voice" | "video" = "video"
) {
  assertPaidFeatureAccess(current);
  const conversation = await getConversationForProfile(
    current,
    conversationId
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

  const existingRoom = await findActiveCallRoom(conversation.id, current);
  if (existingRoom) return existingRoom;

  const roomName = `ghiq-${conversation.id}-${randomUUID()}`;
  const inviteExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const room = await withDbRequestContext(current, async (tx) => {
    const created = await tx.callRoom.create({
      data: {
        conversationId: conversation.id,
        createdByProfileId: current.profileId,
        roomName,
        status: "active",
        callType,
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
  await broadcastProfileRealtimeEvent(otherProfileId, "call_invite_created", {
    conversationId: conversation.id,
    roomId: room.id,
  });

  return room;
}

export async function createCallTokenForCurrentUser(
  current: CurrentUserProfile,
  roomId: string
) {
  // Deliberately NOT tier-gated: free members may JOIN calls a paid member
  // started. callRoomJoinWhere only matches rooms holding an explicit
  // CallPermission.canJoin row for this profile, and only a paid initiator
  // (createCallRoomForConversation, still assertPaidFeatureAccess-gated) can
  // create those rows. Block + room-TTL checks below still apply.
  const config = liveKitConfig();
  const room = await withDbRequestContext(current, (tx) => tx.callRoom.findFirst({
    where: callRoomJoinWhere(roomId, current.profileId),
    include: {
      conversation: true,
    },
  }));
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

  await withDbRequestContext(current, async (tx) => {
    await tx.callParticipant.updateMany({
      where: { callRoomId: room.id, profileId: current.profileId },
      data: {
        joinedAt: issuedAt,
        lastTokenIssuedAt: issuedAt,
        leftAt: null,
      },
    });
    // Joining directly via token counts as accepting a pending invite.
    await tx.callInvite.updateMany({
      where: {
        callRoomId: room.id,
        toProfileId: current.profileId,
        status: "pending",
      },
      data: { status: "accepted" },
    });
    await tx.callEvent.create({
      data: {
        callRoomId: room.id,
        profileId: current.profileId,
        eventType: "token_issued",
        metadataJson: JSON.stringify({ expiresAt: signed.expiresAtSeconds }),
      },
    });
  });

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
  const room = await withDbRequestContext(current, (tx) => tx.callRoom.findFirst({
    where: {
      id: roomId,
      permissions: {
        some: {
          profileId: current.profileId,
          canJoin: true,
        },
      },
    },
  }));
  if (!room) throw new Error("call.room_not_found");
  if (room.status !== "active") return room;

  const ended = await endCallRoom(room, {
    eventType: "room_ended",
    profileId: current.profileId,
    metadata: { endedByProfileId: current.profileId },
    leftAtProfileId: current.profileId,
  });

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action: "call.room.end",
    targetType: "call_room",
    targetId: room.id,
    metadata: { endedAt: ended?.endedAt?.toISOString() ?? null },
  });
  await deleteLiveKitRoom(room.roomName);

  return ended ?? room;
}

export async function respondToCallInviteForCurrentUser(
  current: CurrentUserProfile,
  roomId: string,
  action: "accept" | "decline"
) {
  const invite = await withDbRequestContext(current, (tx) => tx.callInvite.findFirst({
    where: {
      callRoomId: roomId,
      toProfileId: current.profileId,
      status: "pending",
      expiresAt: { gt: new Date() },
      callRoom: { status: "active" },
    },
    include: { callRoom: true },
    orderBy: { createdAt: "desc" },
  }));
  if (!invite) throw new Error("call.invite_not_found");

  const status = action === "accept" ? "accepted" : "declined";
  await withDbRequestContext(current, async (tx) => {
    await tx.callInvite.update({
      where: { id: invite.id },
      data: { status },
    });
    await tx.callEvent.create({
      data: {
        callRoomId: invite.callRoomId,
        profileId: current.profileId,
        eventType: action === "accept" ? "invite_accepted" : "invite_declined",
      },
    });
  });

  if (action === "decline") {
    // Callee declined: the call is over for everyone.
    await endCallRoom(invite.callRoom, {
      eventType: "room_ended",
      profileId: current.profileId,
      metadata: {
        endedByProfileId: current.profileId,
        reason: "invite_declined",
      },
    });
    await deleteLiveKitRoom(invite.callRoom.roomName);
  }

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action: action === "accept" ? "call.invite.accept" : "call.invite.decline",
    targetType: "call_invite",
    targetId: invite.id,
    metadata: { roomId: invite.callRoomId },
  });

  return { id: invite.id, status };
}

export async function handleLiveKitWebhookEvent(event: WebhookEvent) {
  const roomName = event.room?.name;
  if (!roomName?.startsWith("ghiq-")) return;

  const room = await withDbSystemContext((tx) =>
    tx.callRoom.findUnique({ where: { roomName } })
  );
  if (!room) return;

  if (event.event === "room_finished") {
    if (room.status !== "active") return;
    await endCallRoom(room, { eventType: "room_finished" });
    return;
  }

  if (
    event.event === "participant_joined" ||
    event.event === "participant_left"
  ) {
    const profileId = event.participant?.identity;
    if (!profileId) return;
    const joined = event.event === "participant_joined";
    await withDbSystemContext(async (tx) => {
      // Only touch participants provisioned at room creation; unknown
      // identities are ignored. Gating on the null column keeps retried
      // webhook deliveries idempotent.
      const updated = await tx.callParticipant.updateMany({
        where: joined
          ? { callRoomId: room.id, profileId, joinedAt: null }
          : { callRoomId: room.id, profileId, leftAt: null },
        data: joined ? { joinedAt: new Date() } : { leftAt: new Date() },
      });
      if (updated.count === 0) return;
      await tx.callEvent.create({
        data: {
          callRoomId: room.id,
          profileId,
          eventType: event.event,
        },
      });
    });
  }
}

export async function runCallMaintenance() {
  const now = new Date();

  const staleRooms = await withDbSystemContext((tx) =>
    tx.callRoom.findMany({
      where: {
        status: "active",
        createdAt: { lt: new Date(now.getTime() - CALL_ROOM_JOIN_TTL_MS) },
      },
    })
  );
  for (const room of staleRooms) {
    await endCallRoom(room, { eventType: "room_expired" });
    await deleteLiveKitRoom(room.roomName);
  }

  const expiredInvites = await withDbSystemContext((tx) =>
    tx.callInvite.findMany({
      where: { status: "pending", expiresAt: { lt: now } },
      include: {
        callRoom: true,
        toProfile: { select: { userId: true } },
      },
    })
  );
  for (const invite of expiredInvites) {
    await withDbSystemContext(async (tx) => {
      await tx.callInvite.update({
        where: { id: invite.id },
        data: { status: "missed" },
      });
      await tx.callEvent.create({
        data: {
          callRoomId: invite.callRoomId,
          profileId: invite.toProfileId,
          eventType: "invite_missed",
        },
      });
    });
    await createInAppNotification({
      userId: invite.toProfile.userId,
      actorProfileId: invite.fromProfileId,
      type: "call_missed",
      title: `Missed ${invite.callRoom.callType === "voice" ? "voice" : "video"} call`,
      href: invite.callRoom.conversationId
        ? `/pulse/${invite.callRoom.conversationId}`
        : null,
      targetType: "call_room",
      targetId: invite.callRoomId,
    });
    if (invite.callRoom.conversationId) {
      await broadcastConversationRealtimeEvent(
        invite.callRoom.conversationId,
        "conversation_updated",
        { action: "call_invite_missed", roomId: invite.callRoomId }
      );
    }
  }

  return { endedStale: staleRooms.length, missedInvites: expiredInvites.length };
}

// Shared DB end path: marks the room ended, closes participant rows, records
// the event, and broadcasts call_room_ended. Callers handle LiveKit teardown.
async function endCallRoom(
  room: { id: string; conversationId: string | null },
  event: {
    eventType: string;
    profileId?: string;
    metadata?: Record<string, unknown>;
    leftAtProfileId?: string;
  }
) {
  const endedAt = new Date();
  const ended = await withDbSystemContext(async (tx) => {
    // Compare-and-set: only the first caller to flip active->ended proceeds.
    // A concurrent user-end + room_finished webhook would otherwise both emit
    // duplicate events and broadcasts.
    const flip = await tx.callRoom.updateMany({
      where: { id: room.id, status: "active" },
      data: { status: "ended", endedAt },
    });
    const current = await tx.callRoom.findUnique({ where: { id: room.id } });
    if (flip.count === 0) return { room: current, transitioned: false };

    await tx.callParticipant.updateMany({
      where: event.leftAtProfileId
        ? { callRoomId: room.id, profileId: event.leftAtProfileId }
        : { callRoomId: room.id, leftAt: null },
      data: { leftAt: endedAt },
    });
    await tx.callEvent.create({
      data: {
        callRoomId: room.id,
        profileId: event.profileId ?? null,
        eventType: event.eventType,
        metadataJson: event.metadata ? JSON.stringify(event.metadata) : null,
      },
    });
    return { room: current, transitioned: true };
  });

  if (ended.transitioned && ended.room?.conversationId) {
    await broadcastConversationRealtimeEvent(
      ended.room.conversationId,
      "call_room_ended",
      { roomId: ended.room.id }
    );
  }

  return ended.room;
}

function findActiveCallRoom(conversationId: string, current: DbContextUser) {
  return withDbRequestContext(current, (tx) => tx.callRoom.findFirst({
    where: {
      conversationId,
      status: "active",
      permissions: {
        some: {
          profileId: current.profileId,
          canJoin: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  }));
}

function otherConversationProfileId(
  conversation: { participantAId: string; participantBId: string },
  profileId: string
) {
  return conversation.participantAId === profileId
    ? conversation.participantBId
    : conversation.participantAId;
}
