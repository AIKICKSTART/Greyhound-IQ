import "server-only";

import { canonicalProfilePair } from "@/lib/conversation-service";
import { withDbRequestContext, type DbContextUser } from "@/lib/db-context";

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
