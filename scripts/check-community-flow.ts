import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  createCallRoomForConversation,
  createCallTokenForCurrentUser,
  endCallRoomForCurrentUser,
} from "../src/lib/call-service";
import {
  markConversationRead,
  sendConversationMessage,
  startOrGetConversation,
  toggleConversationMessageReaction,
} from "../src/lib/conversation-service";
import {
  createFeedCommentForCurrentUser,
  createFeedPostForCurrentUser,
  toggleFeedPostReactionForCurrentUser,
} from "../src/lib/feed-service";
import {
  approveListingForModerator,
  createListingEnquiryForCurrentUser,
  createListingForCurrentUser,
  createMarketplaceCategoryForModerator,
  toggleSavedListingForCurrentUser,
} from "../src/lib/listing-service";
import { syncAuthUser } from "../src/lib/auth-sync";
import { prisma } from "../src/lib/db";

type CheckUser = {
  id: string;
  dbUserId: string;
  profileId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  name: string;
  tier: "free";
  role: string;
  isBanned: false;
  deletionRequestedAt: null;
  displayName: string;
  profileRole: string;
  verified: boolean;
};

const marker = `community_flow_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
const ids = {
  users: new Set<string>(),
  profiles: new Set<string>(),
  feedPosts: new Set<string>(),
  conversations: new Set<string>(),
  callRooms: new Set<string>(),
  listings: new Set<string>(),
  categories: new Set<string>(),
};
const liveKitEnv = {
  LIVEKIT_URL: process.env.LIVEKIT_URL,
  LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
};

main().catch((err) => {
  console.error("Community flow check failed:");
  console.error(String(err));
  process.exit(1);
});

async function main() {
  try {
    process.env.LIVEKIT_URL = "wss://livekit.community-flow.example.test";
    process.env.LIVEKIT_API_KEY = "community-flow-key";
    process.env.LIVEKIT_API_SECRET = "community-flow-secret";

    const seller = await createCurrent("seller", "Flow Seller", "member");
    const buyer = await createCurrent("buyer", "Flow Buyer", "member");
    const admin = await createCurrent("admin", "Flow Admin", "admin");

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
    assert.ok(sellerToken.token.split(".").length === 3);
    assert.ok(buyerToken.token.split(".").length === 3);
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

    console.log("Community flow check passed");
  } finally {
    restoreLiveKitEnv();
    await cleanup();
    await prisma.$disconnect();
  }
}

async function createCurrent(
  label: string,
  displayName: string,
  role: string
): Promise<CheckUser> {
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

async function cleanup() {
  const userIds = [...ids.users];
  const profileIds = [...ids.profiles];
  const targetIds = [
    ...ids.feedPosts,
    ...ids.conversations,
    ...ids.callRooms,
    ...ids.listings,
    ...ids.categories,
    ...profileIds,
  ];

  await prisma.callRoom.deleteMany({ where: { id: { in: [...ids.callRooms] } } });
  await prisma.listing.deleteMany({ where: { id: { in: [...ids.listings] } } });
  await prisma.feedPost.deleteMany({ where: { id: { in: [...ids.feedPosts] } } });
  await prisma.conversation.deleteMany({
    where: { id: { in: [...ids.conversations] } },
  });
  await prisma.marketplaceCategory.deleteMany({
    where: { id: { in: [...ids.categories] } },
  });
  await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.trustSafetyFlag.deleteMany({
    where: {
      OR: [{ userId: { in: userIds } }, { profileId: { in: profileIds } }],
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

function restoreLiveKitEnv() {
  for (const [key, value] of Object.entries(liveKitEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}
