import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  createCallRoomForConversation,
  createCallTokenForCurrentUser,
  endCallRoomForCurrentUser,
} from "@/lib/call-service";
import type { CurrentUserProfile } from "@/lib/auth";
import { syncAuthUser } from "@/lib/auth-sync";
import {
  markConversationRead,
  sendConversationMessage,
  startOrGetConversation,
  toggleConversationMessageReaction,
} from "@/lib/conversation-service";
import { prisma } from "@/lib/db";
import {
  createFeedCommentForCurrentUser,
  createFeedPostForCurrentUser,
  toggleFeedPostReactionForCurrentUser,
} from "@/lib/feed-service";
import {
  approveListingForModerator,
  createListingEnquiryForCurrentUser,
  createListingForCurrentUser,
  createMarketplaceCategoryForModerator,
  toggleSavedListingForCurrentUser,
} from "@/lib/listing-service";

type ProbeCurrentUser = CurrentUserProfile & {
  isBanned: false;
  deletionRequestedAt: null;
};

type ProbeIds = {
  users: Set<string>;
  profiles: Set<string>;
  feedPosts: Set<string>;
  conversations: Set<string>;
  callRooms: Set<string>;
  listings: Set<string>;
  categories: Set<string>;
};

export type CommunityFlowProbeResult = {
  ok: true;
  checks: {
    feedPost: true;
    feedComment: true;
    feedReaction: true;
    conversation: true;
    message: true;
    messageReadReceipt: true;
    messageReaction: true;
    callRoom: true;
    callTokens: true;
    callEnded: true;
    listing: true;
    listingApproved: true;
    listingEnquiry: true;
    listingSaved: true;
    cleanup: boolean;
  };
  timestamp: string;
};

export async function runCommunityFlowProbe({
  cleanupStale = true,
  liveKitMode = "configured",
  strictRealtime = false,
}: {
  cleanupStale?: boolean;
  liveKitMode?: "configured" | "fake";
  strictRealtime?: boolean;
} = {}): Promise<CommunityFlowProbeResult> {
  const marker = `community_flow_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const ids: ProbeIds = {
    users: new Set<string>(),
    profiles: new Set<string>(),
    feedPosts: new Set<string>(),
    conversations: new Set<string>(),
    callRooms: new Set<string>(),
    listings: new Set<string>(),
    categories: new Set<string>(),
  };
  const env = captureProbeEnv();
  let primaryError: unknown;
  let result: CommunityFlowProbeResult | null = null;

  try {
    if (cleanupStale) {
      await cleanupCommunityFlowProbeRows({
        emailStartsWith: "community_flow_",
        categorySlugStartsWith: "community_flow_",
        ids,
        includeTrackedIds: false,
      });
    }

    if (strictRealtime) process.env.REALTIME_BROADCAST_STRICT = "true";
    if (liveKitMode === "fake") {
      process.env.LIVEKIT_URL = "wss://livekit.community-flow.example.test";
      process.env.LIVEKIT_API_KEY = "community-flow-key";
      process.env.LIVEKIT_API_SECRET = "community-flow-secret";
    }

    const seller = await createProbeCurrent(marker, ids, "seller", "Flow Seller", "member");
    const buyer = await createProbeCurrent(marker, ids, "buyer", "Flow Buyer", "member");
    const admin = await createProbeCurrent(marker, ids, "admin", "Flow Admin", "admin");

    const post = await createFeedPostForCurrentUser(seller, {
      body: "Community flow check feed post.",
      mediaIds: [],
    });
    ids.feedPosts.add(post.id);
    const comment = await createFeedCommentForCurrentUser(buyer, post.id, {
      body: "Community flow check comment.",
    });
    assert.equal(comment.postId, post.id);
    const reaction = await toggleFeedPostReactionForCurrentUser(buyer, post.id);
    assert.equal(reaction.liked, true);

    const conversation = await startOrGetConversation(seller, buyer.profileId);
    ids.conversations.add(conversation.id);
    const message = await sendConversationMessage(seller, conversation.id, {
      body: "Community flow check message.",
      mediaIds: [],
    });
    assert.equal(message.conversationId, conversation.id);
    assert.equal(await markConversationRead(buyer, conversation.id), 1);
    await toggleConversationMessageReaction(buyer, conversation.id, message.id);

    const room = await createCallRoomForConversation(seller, conversation.id);
    ids.callRooms.add(room.id);
    const sellerToken = await createCallTokenForCurrentUser(seller, room.id);
    const buyerToken = await createCallTokenForCurrentUser(buyer, room.id);
    assert.equal(sellerToken.roomId, room.id);
    assert.equal(buyerToken.roomId, room.id);
    assert.equal(sellerToken.token.split(".").length, 3);
    assert.equal(buyerToken.token.split(".").length, 3);
    const ended = await endCallRoomForCurrentUser(seller, room.id);
    assert.equal(ended.status, "ended");

    const category = await createMarketplaceCategoryForModerator(admin, {
      name: "Community Flow Check",
      slug: marker,
      description: "Temporary launch verification category.",
      sortOrder: 9999,
    });
    ids.categories.add(category.id);
    const listing = await createListingForCurrentUser(seller, {
      type: "dog_for_sale",
      categoryId: category.id,
      title: "Community flow check listing",
      description: "Temporary marketplace listing for launch verification.",
      state: "NSW",
      contactPreference: "message",
      welfareAcknowledged: true,
      legalAcknowledged: true,
      mediaIds: [],
    });
    ids.listings.add(listing.id);
    const approved = await approveListingForModerator(admin, listing.id);
    assert.equal(approved.status, "active");
    const enquiry = await createListingEnquiryForCurrentUser(
      buyer,
      listing.id,
      "Community flow check enquiry."
    );
    assert.equal(enquiry.enquiry.listingId, listing.id);
    assert.equal(enquiry.conversationId, conversation.id);
    const saved = await toggleSavedListingForCurrentUser(buyer, listing.id);
    assert.equal(saved.saved, true);

    result = {
      ok: true,
      checks: {
        feedPost: true,
        feedComment: true,
        feedReaction: true,
        conversation: true,
        message: true,
        messageReadReceipt: true,
        messageReaction: true,
        callRoom: true,
        callTokens: true,
        callEnded: true,
        listing: true,
        listingApproved: true,
        listingEnquiry: true,
        listingSaved: true,
        cleanup: false,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    primaryError = err;
    throw err;
  } finally {
    restoreProbeEnv(env);
    try {
      await cleanupCommunityFlowProbeRows({
        emailStartsWith: `${marker}-`,
        categorySlugStartsWith: marker,
        ids,
        includeTrackedIds: true,
      });
      if (result) result.checks.cleanup = true;
    } catch (err) {
      if (!primaryError) throw err;
    }
  }

  if (!result) throw new Error("community_flow_probe.failed");
  return result;
}

async function createProbeCurrent(
  marker: string,
  ids: ProbeIds,
  label: string,
  displayName: string,
  role: string
): Promise<ProbeCurrentUser> {
  const [firstName, lastName] = displayName.split(" ");
  const auth = {
    id: `workos_${marker}_${label}`,
    email: `${marker}-${label}@example.invalid`,
    firstName,
    lastName,
  };
  const user = await syncAuthUser(auth);
  ids.users.add(user.id);
  assert.ok(user.profile);

  const profile =
    user.profile.role === role
      ? user.profile
      : await prisma.profile.update({
          where: { id: user.profile.id },
          data: { role },
        });
  ids.profiles.add(profile.id);

  return {
    id: auth.id,
    dbUserId: user.id,
    profileId: profile.id,
    email: auth.email,
    firstName,
    lastName,
    name: displayName,
    tier: "free",
    role: profile.role,
    isBanned: false,
    deletionRequestedAt: null,
    displayName,
    profileRole: profile.role,
    verified: profile.verified,
  };
}

async function cleanupCommunityFlowProbeRows({
  emailStartsWith,
  categorySlugStartsWith,
  ids,
  includeTrackedIds,
}: {
  emailStartsWith: string;
  categorySlugStartsWith: string;
  ids: ProbeIds;
  includeTrackedIds: boolean;
}) {
  const trackedUserIds = includeTrackedIds ? [...ids.users] : [];
  const trackedProfileIds = includeTrackedIds ? [...ids.profiles] : [];
  const trackedFeedPostIds = includeTrackedIds ? [...ids.feedPosts] : [];
  const trackedConversationIds = includeTrackedIds ? [...ids.conversations] : [];
  const trackedCallRoomIds = includeTrackedIds ? [...ids.callRooms] : [];
  const trackedListingIds = includeTrackedIds ? [...ids.listings] : [];
  const trackedCategoryIds = includeTrackedIds ? [...ids.categories] : [];

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { id: { in: trackedUserIds } },
        {
          email: {
            startsWith: emailStartsWith,
            endsWith: "@example.invalid",
          },
        },
      ],
    },
    select: { id: true, profile: { select: { id: true } } },
  });
  const userIds = unique([...trackedUserIds, ...users.map((user) => user.id)]);
  const profileIds = unique([
    ...trackedProfileIds,
    ...users.map((user) => user.profile?.id),
  ]);

  const categories = await prisma.marketplaceCategory.findMany({
    where: {
      OR: [
        { id: { in: trackedCategoryIds } },
        { slug: { startsWith: categorySlugStartsWith } },
      ],
    },
    select: { id: true },
  });
  const categoryIds = unique([
    ...trackedCategoryIds,
    ...categories.map((category) => category.id),
  ]);

  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [
        { id: { in: trackedConversationIds } },
        { participantAId: { in: profileIds } },
        { participantBId: { in: profileIds } },
        { participants: { some: { profileId: { in: profileIds } } } },
      ],
    },
    select: { id: true },
  });
  const conversationIds = unique([
    ...trackedConversationIds,
    ...conversations.map((conversation) => conversation.id),
  ]);

  const callRooms = await prisma.callRoom.findMany({
    where: {
      OR: [
        { id: { in: trackedCallRoomIds } },
        { conversationId: { in: conversationIds } },
        { createdByProfileId: { in: profileIds } },
        { participants: { some: { profileId: { in: profileIds } } } },
        {
          invites: {
            some: {
              OR: [
                { fromProfileId: { in: profileIds } },
                { toProfileId: { in: profileIds } },
              ],
            },
          },
        },
        { reports: { some: { reporterProfileId: { in: profileIds } } } },
        { permissions: { some: { profileId: { in: profileIds } } } },
      ],
    },
    select: { id: true },
  });
  const callRoomIds = unique([
    ...trackedCallRoomIds,
    ...callRooms.map((room) => room.id),
  ]);

  const listings = await prisma.listing.findMany({
    where: {
      OR: [
        { id: { in: trackedListingIds } },
        { profileId: { in: profileIds } },
        { reviewedById: { in: profileIds } },
        { categoryId: { in: categoryIds } },
        { savedBy: { some: { profileId: { in: profileIds } } } },
        {
          enquiries: {
            some: {
              OR: [
                { fromProfileId: { in: profileIds } },
                { toProfileId: { in: profileIds } },
              ],
            },
          },
        },
        {
          listingReports: {
            some: {
              OR: [
                { reporterProfileId: { in: profileIds } },
                { resolvedByProfileId: { in: profileIds } },
              ],
            },
          },
        },
        {
          moderationActions: {
            some: { actorProfileId: { in: profileIds } },
          },
        },
        { viewEvents: { some: { viewerProfileId: { in: profileIds } } } },
      ],
    },
    select: { id: true },
  });
  const listingIds = unique([
    ...trackedListingIds,
    ...listings.map((listing) => listing.id),
  ]);

  const feedPosts = await prisma.feedPost.findMany({
    where: {
      OR: [
        { id: { in: trackedFeedPostIds } },
        { authorProfileId: { in: profileIds } },
        { comments: { some: { authorProfileId: { in: profileIds } } } },
        { reactions: { some: { profileId: { in: profileIds } } } },
      ],
    },
    select: { id: true },
  });
  const feedPostIds = unique([
    ...trackedFeedPostIds,
    ...feedPosts.map((post) => post.id),
  ]);

  const targetIds = [
    ...feedPostIds,
    ...conversationIds,
    ...callRoomIds,
    ...listingIds,
    ...categoryIds,
    ...profileIds,
  ];

  await prisma.callPermission.deleteMany({
    where: {
      OR: [
        { callRoomId: { in: callRoomIds } },
        { profileId: { in: profileIds } },
      ],
    },
  });
  await prisma.callParticipant.deleteMany({
    where: {
      OR: [
        { callRoomId: { in: callRoomIds } },
        { profileId: { in: profileIds } },
      ],
    },
  });
  await prisma.callInvite.deleteMany({
    where: {
      OR: [
        { callRoomId: { in: callRoomIds } },
        { fromProfileId: { in: profileIds } },
        { toProfileId: { in: profileIds } },
      ],
    },
  });
  await prisma.callReport.deleteMany({
    where: {
      OR: [
        { callRoomId: { in: callRoomIds } },
        { reporterProfileId: { in: profileIds } },
      ],
    },
  });
  await prisma.callRoom.deleteMany({ where: { id: { in: callRoomIds } } });

  await prisma.messageReaction.deleteMany({
    where: { profileId: { in: profileIds } },
  });
  await prisma.messageReadReceipt.deleteMany({
    where: { profileId: { in: profileIds } },
  });
  await prisma.messageDeliveryReceipt.deleteMany({
    where: { profileId: { in: profileIds } },
  });
  await prisma.message.deleteMany({
    where: {
      OR: [
        { conversationId: { in: conversationIds } },
        { senderId: { in: profileIds } },
        { recipientId: { in: profileIds } },
      ],
    },
  });
  await prisma.conversationParticipant.deleteMany({
    where: {
      OR: [
        { conversationId: { in: conversationIds } },
        { profileId: { in: profileIds } },
      ],
    },
  });

  await prisma.savedListing.deleteMany({
    where: {
      OR: [
        { listingId: { in: listingIds } },
        { profileId: { in: profileIds } },
      ],
    },
  });
  await prisma.listingEnquiry.deleteMany({
    where: {
      OR: [
        { listingId: { in: listingIds } },
        { conversationId: { in: conversationIds } },
        { fromProfileId: { in: profileIds } },
        { toProfileId: { in: profileIds } },
      ],
    },
  });
  await prisma.listingReport.deleteMany({
    where: {
      OR: [
        { listingId: { in: listingIds } },
        { reporterProfileId: { in: profileIds } },
        { resolvedByProfileId: { in: profileIds } },
      ],
    },
  });
  await prisma.listingView.deleteMany({
    where: {
      OR: [
        { listingId: { in: listingIds } },
        { viewerProfileId: { in: profileIds } },
      ],
    },
  });
  await prisma.listingStatusHistory.deleteMany({
    where: {
      OR: [
        { listingId: { in: listingIds } },
        { actorProfileId: { in: profileIds } },
      ],
    },
  });
  await prisma.listingModerationAction.deleteMany({
    where: {
      OR: [
        { listingId: { in: listingIds } },
        { actorProfileId: { in: profileIds } },
      ],
    },
  });
  await prisma.listing.deleteMany({ where: { id: { in: listingIds } } });

  await prisma.feedReaction.deleteMany({
    where: {
      OR: [
        { postId: { in: feedPostIds } },
        { profileId: { in: profileIds } },
      ],
    },
  });
  await prisma.feedComment.deleteMany({
    where: {
      OR: [
        { postId: { in: feedPostIds } },
        { authorProfileId: { in: profileIds } },
      ],
    },
  });
  await prisma.feedPost.deleteMany({ where: { id: { in: feedPostIds } } });

  await prisma.conversation.deleteMany({
    where: { id: { in: conversationIds } },
  });
  await prisma.marketplaceCategory.deleteMany({
    where: { id: { in: categoryIds } },
  });
  await prisma.notification.deleteMany({
    where: {
      OR: [
        { userId: { in: userIds } },
        { actorProfileId: { in: profileIds } },
        { targetId: { in: targetIds } },
      ],
    },
  });
  await prisma.trustSafetyFlag.deleteMany({
    where: {
      OR: [
        { userId: { in: userIds } },
        { profileId: { in: profileIds } },
        { targetId: { in: targetIds } },
      ],
    },
  });
  await prisma.userBlock.deleteMany({
    where: {
      OR: [
        { blockerProfileId: { in: profileIds } },
        { blockedProfileId: { in: profileIds } },
      ],
    },
  });
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { actorId: { in: userIds } },
        { targetId: { in: targetIds } },
      ],
    },
  });
  await prisma.profile.deleteMany({ where: { id: { in: profileIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

function captureProbeEnv() {
  return {
    LIVEKIT_URL: process.env.LIVEKIT_URL,
    LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
    REALTIME_BROADCAST_STRICT: process.env.REALTIME_BROADCAST_STRICT,
  };
}

function restoreProbeEnv(env: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}
