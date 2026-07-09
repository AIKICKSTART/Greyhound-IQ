import "server-only";

import { createAuditLog } from "@/lib/account-service";
import type { CurrentUserProfile } from "@/lib/auth-types";
import {
  assertProfilesCanInteract,
  canonicalProfilePair,
} from "@/lib/conversation-service";
import { withDbRequestContext, type DbContextUser } from "@/lib/db-context";
import { createInAppNotificationDeduped } from "@/lib/notification-service";
import { broadcastProfileRealtimeEvent } from "@/lib/realtime-service";

const FRIEND_PROFILE_SELECT = {
  id: true,
  displayName: true,
  state: true,
  kennelName: true,
  role: true,
  verified: true,
  user: {
    select: {
      email: true,
      subscriptionTier: true,
    },
  },
} as const;

export type FriendListItem = {
  friendshipId: string;
  profileId: string;
  displayName: string;
  email: string | null;
  state: string | null;
  kennelName: string | null;
  role: string;
  verified: boolean;
  tier: string | null;
  conversationId: string | null;
};

export async function listFriendsForProfile(current: DbContextUser) {
  return withDbRequestContext(current, async (tx) => {
    const friendships = await tx.friendship.findMany({
      where: {
        status: "accepted",
        OR: [
          { profileAId: current.profileId },
          { profileBId: current.profileId },
        ],
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      include: {
        profileA: { select: FRIEND_PROFILE_SELECT },
        profileB: { select: FRIEND_PROFILE_SELECT },
      },
    });

    const pairs = friendships.map((friendship) => {
      const friend =
        friendship.profileAId === current.profileId
          ? friendship.profileB
          : friendship.profileA;
      return {
        friendship,
        friend,
        pair: canonicalProfilePair(current.profileId, friend.id),
      };
    });

    const conversations =
      pairs.length > 0
        ? await tx.conversation.findMany({
            where: { OR: pairs.map((item) => item.pair) },
            select: {
              id: true,
              participantAId: true,
              participantBId: true,
            },
          })
        : [];
    const conversationByPair = new Map(
      conversations.map((conversation) => [
        conversationKey(conversation),
        conversation.id,
      ])
    );

    return pairs.map(({ friendship, friend, pair }): FriendListItem => ({
      friendshipId: friendship.id,
      profileId: friend.id,
      displayName: friend.displayName,
      email: friend.user?.email ?? null,
      state: friend.state,
      kennelName: friend.kennelName,
      role: friend.role,
      verified: friend.verified,
      tier: friend.user?.subscriptionTier ?? null,
      conversationId: conversationByPair.get(conversationKey(pair)) ?? null,
    }));
  });
}

function conversationKey(pair: {
  participantAId: string;
  participantBId: string;
}) {
  return `${pair.participantAId}:${pair.participantBId}`;
}

export type FriendRequestItem = {
  friendshipId: string;
  direction: "incoming" | "outgoing";
  profileId: string;
  displayName: string;
  state: string | null;
  kennelName: string | null;
  verified: boolean;
  createdAt: Date;
};

export type FriendshipState =
  | { status: "none" }
  | { status: "pending"; friendshipId: string; direction: "incoming" | "outgoing" }
  | { status: "accepted"; friendshipId: string };

// Same canonical ordering as conversations, mapped to Friendship columns.
function friendshipPair(profileAId: string, profileBId: string) {
  const pair = canonicalProfilePair(profileAId, profileBId);
  return { profileAId: pair.participantAId, profileBId: pair.participantBId };
}

const REQUEST_PROFILE_SELECT = {
  id: true,
  displayName: true,
  state: true,
  kennelName: true,
  verified: true,
  user: { select: { id: true, isBanned: true, deletionRequestedAt: true } },
} as const;

export async function sendFriendRequest(
  current: CurrentUserProfile,
  otherProfileId: string
) {
  if (otherProfileId === current.profileId) {
    throw new Error("friend.cannot_add_self");
  }
  await assertProfilesCanInteract(
    current.profileId,
    otherProfileId,
    "friend.blocked"
  );

  const pair = friendshipPair(current.profileId, otherProfileId);
  const { friendship, recipientUserId } = await withDbRequestContext(
    current,
    async (tx) => {
      const other = await tx.profile.findFirst({
        where: { id: otherProfileId },
        select: REQUEST_PROFILE_SELECT,
      });
      if (!other) throw new Error("friend.profile_not_found");
      if (other.user.isBanned || other.user.deletionRequestedAt) {
        throw new Error("friend.profile_unavailable");
      }
      const existing = await tx.friendship.findUnique({
        where: { profileAId_profileBId: pair },
        select: { id: true, status: true },
      });
      if (existing) {
        throw new Error(
          existing.status === "accepted"
            ? "friend.already_friends"
            : "friend.request_exists"
        );
      }
      const created = await tx.friendship.create({
        data: {
          ...pair,
          status: "pending",
          requestedByProfileId: current.profileId,
        },
      });
      return { friendship: created, recipientUserId: other.user.id };
    }
  );

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action: "friend.request.send",
    targetType: "friendship",
    targetId: friendship.id,
    metadata: { otherProfileId },
  });
  await createInAppNotificationDeduped({
    userId: recipientUserId,
    actorProfileId: current.profileId,
    type: "friend_request",
    title: `${current.displayName} sent you a friend request`,
    href: "/feed",
    targetType: "friendship",
    targetId: friendship.id,
  });
  await broadcastProfileRealtimeEvent(otherProfileId, "friend_updated", {
    friendshipId: friendship.id,
  });
  return friendship;
}

export async function respondToFriendRequest(
  current: CurrentUserProfile,
  friendshipId: string,
  response: "accept" | "decline"
) {
  const { otherProfileId } = await withDbRequestContext(current, async (tx) => {
    const friendship = await tx.friendship.findFirst({
      where: {
        id: friendshipId,
        status: "pending",
        // Recipient only: a participant who did not send it. RLS enforces the
        // same shape; this keeps the error readable instead of a bare 42501.
        requestedByProfileId: { not: current.profileId },
        OR: [
          { profileAId: current.profileId },
          { profileBId: current.profileId },
        ],
      },
      select: { id: true, profileAId: true, profileBId: true },
    });
    if (!friendship) throw new Error("friend.request_not_found");

    if (response === "accept") {
      await tx.friendship.update({
        where: { id: friendship.id },
        data: { status: "accepted" },
      });
    } else {
      await tx.friendship.delete({ where: { id: friendship.id } });
    }
    return {
      otherProfileId:
        friendship.profileAId === current.profileId
          ? friendship.profileBId
          : friendship.profileAId,
    };
  });

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action:
      response === "accept" ? "friend.request.accept" : "friend.request.decline",
    targetType: "friendship",
    targetId: friendshipId,
  });
  if (response === "accept") {
    const otherUserId = await withDbRequestContext(current, (tx) =>
      tx.profile
        .findFirst({ where: { id: otherProfileId }, select: { userId: true } })
        .then((profile) => profile?.userId ?? null)
    );
    if (otherUserId) {
      await createInAppNotificationDeduped({
        userId: otherUserId,
        actorProfileId: current.profileId,
        type: "friend_accept",
        title: `${current.displayName} accepted your friend request`,
        href: "/feed",
        targetType: "friendship",
        targetId: friendshipId,
      });
    }
  }
  await broadcastProfileRealtimeEvent(otherProfileId, "friend_updated", {
    friendshipId,
  });
}

export async function removeFriend(
  current: CurrentUserProfile,
  friendshipId: string
) {
  const { otherProfileId } = await withDbRequestContext(current, async (tx) => {
    const friendship = await tx.friendship.findFirst({
      where: {
        id: friendshipId,
        OR: [
          { profileAId: current.profileId },
          { profileBId: current.profileId },
        ],
      },
      select: { id: true, profileAId: true, profileBId: true },
    });
    if (!friendship) throw new Error("friend.not_found");
    await tx.friendship.delete({ where: { id: friendship.id } });
    return {
      otherProfileId:
        friendship.profileAId === current.profileId
          ? friendship.profileBId
          : friendship.profileAId,
    };
  });

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "user",
    action: "friend.remove",
    targetType: "friendship",
    targetId: friendshipId,
  });
  await broadcastProfileRealtimeEvent(otherProfileId, "friend_updated", {
    friendshipId,
  });
}

export async function listFriendRequestsForProfile(current: DbContextUser) {
  return withDbRequestContext(current, async (tx) => {
    const pending = await tx.friendship.findMany({
      where: {
        status: "pending",
        OR: [
          { profileAId: current.profileId },
          { profileBId: current.profileId },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        profileA: { select: REQUEST_PROFILE_SELECT },
        profileB: { select: REQUEST_PROFILE_SELECT },
      },
    });

    return pending.map((friendship): FriendRequestItem => {
      const other =
        friendship.profileAId === current.profileId
          ? friendship.profileB
          : friendship.profileA;
      return {
        friendshipId: friendship.id,
        direction:
          friendship.requestedByProfileId === current.profileId
            ? "outgoing"
            : "incoming",
        profileId: other.id,
        displayName: other.displayName,
        state: other.state,
        kennelName: other.kennelName,
        verified: other.verified,
        createdAt: friendship.createdAt,
      };
    });
  });
}

export async function getFriendshipState(
  current: DbContextUser,
  otherProfileId: string
): Promise<FriendshipState> {
  if (otherProfileId === current.profileId) return { status: "none" };
  const pair = friendshipPair(current.profileId, otherProfileId);
  const friendship = await withDbRequestContext(current, (tx) =>
    tx.friendship.findUnique({
      where: { profileAId_profileBId: pair },
      select: { id: true, status: true, requestedByProfileId: true },
    })
  );
  if (!friendship) return { status: "none" };
  if (friendship.status === "accepted") {
    return { status: "accepted", friendshipId: friendship.id };
  }
  return {
    status: "pending",
    friendshipId: friendship.id,
    direction:
      friendship.requestedByProfileId === current.profileId
        ? "outgoing"
        : "incoming",
  };
}
