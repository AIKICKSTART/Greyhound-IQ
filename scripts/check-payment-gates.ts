import "./load-env";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.REALTIME_BROADCAST_DISABLED ??= "true";

import type { CurrentUserProfile } from "../src/lib/auth-types";
import { syncAuthUser } from "../src/lib/auth-sync";
import { withDbRequestContext, withDbSystemContext } from "../src/lib/db-context";
import { prisma } from "../src/lib/db";
import {
  createFeedCommentForCurrentUser,
  createFeedPostForCurrentUser,
  toggleFeedPostReactionForCurrentUser,
} from "../src/lib/feed-service";
import {
  createListingEnquiryForCurrentUser,
  createListingForCurrentUser,
  toggleSavedListingForCurrentUser,
} from "../src/lib/listing-service";
import { startOrGetConversation } from "../src/lib/conversation-service";

const marker = `pay_gate_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
const runDirectDbChecks = process.env.CHECK_RLS_DB === "true";

main().catch((err) => {
  console.error("Payment gate check failed:");
  console.error(String(err));
  process.exit(1);
});

async function main() {
  const users: CurrentUserProfile[] = [];
  try {
    await cleanup(await staleGateUsers());

    const free = await createGateUser("free", "free");
    const pro = await createGateUser("pro", "pro");
    const seller = await createGateUser("seller", "pro");
    users.push(free, pro, seller);

    await assertRaceDataReadable();
    console.log("PASS: race data remains readable");

    await assert.rejects(
      () => createListingForCurrentUser(free, listingInput("free blocked")),
      /payment\.required/
    );
    console.log("PASS: Free cannot create marketplace listing");

    const proListing = await createListingForCurrentUser(
      pro,
      listingInput("pro creates listing")
    );
    assert.ok(proListing.id);
    console.log("PASS: Pro can create marketplace listing");

    const publicListing = await createPublicListing(seller);
    await toggleSavedListingForCurrentUser(free, publicListing.id);
    console.log("PASS: Free can save public marketplace listing");

    await assert.rejects(
      () => createListingEnquiryForCurrentUser(free, publicListing.id, `${marker} enquiry`),
      /payment\.required/
    );
    console.log("PASS: Free cannot enquire/message seller");

    const enquiry = await createListingEnquiryForCurrentUser(
      pro,
      publicListing.id,
      `${marker} pro enquiry`
    );
    assert.ok(enquiry.conversationId);
    console.log("PASS: Pro can enquire/message seller");

    await assert.rejects(
      () => startOrGetConversation(free, seller.profileId),
      /payment\.required/
    );
    console.log("PASS: Free cannot start direct chat");

    const conversation = await startOrGetConversation(pro, seller.profileId);
    assert.ok(conversation.id);
    console.log("PASS: Pro can start direct chat");

    await assert.rejects(
      () => createFeedPostForCurrentUser(free, { body: `${marker} free blocked post` }),
      /payment\.required/
    );
    console.log("PASS: Free cannot post community feed");

    const feedPost = await createFeedPostForCurrentUser(pro, {
      body: `${marker} pro feed post`,
    });
    assert.ok(feedPost.id);
    await createFeedCommentForCurrentUser(seller, feedPost.id, {
      body: `${marker} pro feed comment`,
    });
    await toggleFeedPostReactionForCurrentUser(seller, feedPost.id);
    console.log("PASS: Pro can post/comment/react in community feed");

    await assert.rejects(
      () => createFeedCommentForCurrentUser(free, feedPost.id, { body: `${marker} nope` }),
      /payment\.required/
    );
    await assert.rejects(
      () => toggleFeedPostReactionForCurrentUser(free, feedPost.id),
      /payment\.required/
    );
    console.log("PASS: Free cannot comment/react in community feed");

    if (runDirectDbChecks) {
      await assertDirectDbGuards(free, pro);
    } else {
      console.log("SKIP: direct DB RLS trigger checks (set CHECK_RLS_DB=true)");
    }
  } finally {
    await cleanup(users);
    await prisma.$disconnect();
  }
}

async function createGateUser(label: string, tier: "free" | "pro") {
  const auth = {
    id: `workos_${marker}_${label}`,
    email: `${marker}-${label}@example.invalid`,
    firstName: "Gate",
    lastName: label,
  };
  const user = await syncAuthUser(auth);
  await withDbSystemContext((tx) =>
    tx.user.update({
      where: { id: user.id },
      data: { subscriptionTier: tier },
    })
  );
  const fresh = await withDbSystemContext((tx) =>
    tx.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { profile: true },
    })
  );
  assert.ok(fresh.profile);
  return {
    id: auth.id,
    dbUserId: fresh.id,
    profileId: fresh.profile.id,
    email: fresh.email,
    firstName: auth.firstName,
    lastName: auth.lastName,
    name: fresh.name ?? auth.email,
    tier,
    role: fresh.profile.role,
    isBanned: false,
    deletionRequestedAt: null,
    displayName: fresh.profile.displayName,
    profileRole: fresh.profile.role,
    verified: fresh.profile.verified,
  } satisfies CurrentUserProfile;
}

async function staleGateUsers() {
  const rows = await withDbSystemContext((tx) =>
    tx.user.findMany({
      where: { email: { startsWith: "pay_gate_", endsWith: "@example.invalid" } },
      include: { profile: true },
    })
  );
  return rows.flatMap((user) => {
    if (!user.profile) return [];
    return [{
      id: user.workosUserId ?? user.id,
      dbUserId: user.id,
      profileId: user.profile.id,
      email: user.email,
      firstName: null,
      lastName: null,
      name: user.name ?? user.email,
      tier: user.subscriptionTier === "pro" ? "pro" : "free",
      role: user.profile.role,
      isBanned: user.isBanned,
      deletionRequestedAt: user.deletionRequestedAt,
      displayName: user.profile.displayName,
      profileRole: user.profile.role,
      verified: user.profile.verified,
    } satisfies CurrentUserProfile];
  });
}

function listingInput(label: string) {
  return {
    type: "wanted",
    title: `${marker} ${label}`,
    description: `${marker} ${label} description long enough for validation.`,
    welfareAcknowledged: false,
    legalAcknowledged: false,
  };
}

async function createPublicListing(current: CurrentUserProfile) {
  return withDbRequestContext(current, (tx) =>
    tx.listing.create({
      data: {
        profileId: current.profileId,
        type: "wanted",
        listingType: "wanted",
        title: `${marker} public listing`,
        description: `${marker} public listing description long enough.`,
        contactPreference: "message",
        status: "active",
        moderationStatus: "approved",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
  );
}

async function assertRaceDataReadable() {
  await Promise.all([
    prisma.dog.findMany({ take: 1, select: { id: true } }),
    prisma.race.findMany({ take: 1, select: { id: true } }),
    prisma.result.findMany({ take: 1, select: { id: true } }),
  ]);
}

async function assertDirectDbGuards(
  free: CurrentUserProfile,
  pro: CurrentUserProfile
) {
  await assert.rejects(
    () =>
      withDbRequestContext(free, (tx) =>
        tx.listing.create({
          data: {
            profileId: free.profileId,
            type: "wanted",
            listingType: "wanted",
            title: `${marker} direct free listing`,
            description: `${marker} direct free listing description.`,
            contactPreference: "message",
          },
        })
      ),
    /payment\.required/
  );

  const listing = await withDbRequestContext(pro, (tx) =>
    tx.listing.create({
      data: {
        profileId: pro.profileId,
        type: "wanted",
        listingType: "wanted",
        title: `${marker} direct pro listing`,
        description: `${marker} direct pro listing description.`,
        contactPreference: "message",
      },
    })
  );
  assert.ok(listing.id);

  await assert.rejects(
    () =>
      withDbRequestContext(free, (tx) =>
        tx.profile.update({
          where: { id: free.profileId },
          data: { kennelName: `${marker} kennel` },
        })
      ),
    /payment\.required/
  );

  await withDbRequestContext(pro, (tx) =>
    tx.profile.update({
      where: { id: pro.profileId },
      data: { kennelName: `${marker} kennel` },
    })
  );
  console.log("PASS: direct DB paid-write guards reject Free and allow Pro");
}

async function cleanup(users: CurrentUserProfile[]) {
  const userIds = users.map((user) => user.dbUserId);
  const profileIds = users.map((user) => user.profileId);
  if (userIds.length === 0) return;

  await withDbSystemContext(async (tx) => {
    const listings = await tx.listing.findMany({
      where: { OR: [{ profileId: { in: profileIds } }, { title: { contains: marker } }] },
      select: { id: true },
    });
    const listingIds = listings.map((listing) => listing.id);
    const conversations = await tx.conversation.findMany({
      where: {
        OR: [
          { participantAId: { in: profileIds } },
          { participantBId: { in: profileIds } },
        ],
      },
      select: { id: true },
    });
    const conversationIds = conversations.map((conversation) => conversation.id);
    const messages = await tx.message.findMany({
      where: {
        OR: [
          { conversationId: { in: conversationIds } },
          { senderId: { in: profileIds } },
          { recipientId: { in: profileIds } },
        ],
      },
      select: { id: true },
    });
    const messageIds = messages.map((message) => message.id);
    const feedPosts = await tx.feedPost.findMany({
      where: { OR: [{ authorProfileId: { in: profileIds } }, { body: { contains: marker } }] },
      select: { id: true },
    });
    const feedPostIds = feedPosts.map((post) => post.id);
    const threads = await tx.thread.findMany({
      where: { OR: [{ authorId: { in: profileIds } }, { title: { contains: marker } }] },
      select: { id: true },
    });
    const threadIds = threads.map((thread) => thread.id);

    await tx.notification.deleteMany({
      where: { OR: [{ userId: { in: userIds } }, { actorProfileId: { in: profileIds } }] },
    });
    await tx.listingEnquiry.deleteMany({
      where: { OR: [{ listingId: { in: listingIds } }, { fromProfileId: { in: profileIds } }, { toProfileId: { in: profileIds } }] },
    });
    await tx.savedListing.deleteMany({
      where: { OR: [{ profileId: { in: profileIds } }, { listingId: { in: listingIds } }] },
    });
    await tx.listingMedia.deleteMany({ where: { listingId: { in: listingIds } } });
    await tx.listingAttribute.deleteMany({ where: { listingId: { in: listingIds } } });
    await tx.listingLocation.deleteMany({ where: { listingId: { in: listingIds } } });
    await tx.listingStatusHistory.deleteMany({ where: { listingId: { in: listingIds } } });
    await tx.listingSearchIndex.deleteMany({ where: { listingId: { in: listingIds } } });
    await tx.listingReport.deleteMany({ where: { listingId: { in: listingIds } } });
    await tx.listingModerationAction.deleteMany({ where: { listingId: { in: listingIds } } });
    await tx.listingView.deleteMany({ where: { listingId: { in: listingIds } } });
    await tx.listing.deleteMany({ where: { id: { in: listingIds } } });

    await tx.messageReaction.deleteMany({
      where: { OR: [{ messageId: { in: messageIds } }, { profileId: { in: profileIds } }] },
    });
    await tx.messageReadReceipt.deleteMany({
      where: { OR: [{ messageId: { in: messageIds } }, { profileId: { in: profileIds } }] },
    });
    await tx.messageDeliveryReceipt.deleteMany({
      where: { OR: [{ messageId: { in: messageIds } }, { profileId: { in: profileIds } }] },
    });
    await tx.messageMedia.deleteMany({ where: { messageId: { in: messageIds } } });
    await tx.messageModerationAction.deleteMany({ where: { messageId: { in: messageIds } } });
    await tx.message.deleteMany({ where: { id: { in: messageIds } } });
    await tx.conversationParticipant.deleteMany({
      where: { OR: [{ conversationId: { in: conversationIds } }, { profileId: { in: profileIds } }] },
    });
    await tx.conversation.deleteMany({ where: { id: { in: conversationIds } } });

    await tx.feedReaction.deleteMany({
      where: { OR: [{ postId: { in: feedPostIds } }, { profileId: { in: profileIds } }] },
    });
    await tx.feedComment.deleteMany({
      where: { OR: [{ postId: { in: feedPostIds } }, { authorProfileId: { in: profileIds } }] },
    });
    await tx.feedPostMedia.deleteMany({ where: { postId: { in: feedPostIds } } });
    await tx.feedPost.deleteMany({ where: { id: { in: feedPostIds } } });

    await tx.post.deleteMany({
      where: { OR: [{ threadId: { in: threadIds } }, { authorId: { in: profileIds } }, { body: { contains: marker } }] },
    });
    await tx.thread.deleteMany({ where: { id: { in: threadIds } } });

    const remainingConversations = await tx.conversation.findMany({
      where: {
        OR: [
          { participantAId: { in: profileIds } },
          { participantBId: { in: profileIds } },
        ],
      },
      select: { id: true },
    });
    const remainingConversationIds = remainingConversations.map((conversation) => conversation.id);
    await tx.messageMedia.deleteMany({ where: { message: { conversationId: { in: remainingConversationIds } } } });
    await tx.message.deleteMany({ where: { conversationId: { in: remainingConversationIds } } });
    await tx.conversationParticipant.deleteMany({
      where: { OR: [{ conversationId: { in: remainingConversationIds } }, { profileId: { in: profileIds } }] },
    });
    await tx.conversation.deleteMany({ where: { id: { in: remainingConversationIds } } });

    const remainingListings = await tx.listing.findMany({
      where: {
        OR: [{ profileId: { in: profileIds } }, { title: { contains: marker } }],
      },
      select: { id: true },
    });
    const remainingListingIds = remainingListings.map((listing) => listing.id);
    await tx.listingEnquiry.deleteMany({
      where: { OR: [{ listingId: { in: remainingListingIds } }, { fromProfileId: { in: profileIds } }, { toProfileId: { in: profileIds } }] },
    });
    await tx.savedListing.deleteMany({
      where: { OR: [{ profileId: { in: profileIds } }, { listingId: { in: remainingListingIds } }] },
    });
    await tx.listingMedia.deleteMany({ where: { listingId: { in: remainingListingIds } } });
    await tx.listingAttribute.deleteMany({ where: { listingId: { in: remainingListingIds } } });
    await tx.listingLocation.deleteMany({ where: { listingId: { in: remainingListingIds } } });
    await tx.listingStatusHistory.deleteMany({ where: { listingId: { in: remainingListingIds } } });
    await tx.listingSearchIndex.deleteMany({ where: { listingId: { in: remainingListingIds } } });
    await tx.listingReport.deleteMany({ where: { listingId: { in: remainingListingIds } } });
    await tx.listingModerationAction.deleteMany({ where: { listingId: { in: remainingListingIds } } });
    await tx.listingView.deleteMany({ where: { listingId: { in: remainingListingIds } } });
    await tx.listing.deleteMany({ where: { id: { in: remainingListingIds } } });

    await tx.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await tx.profile.deleteMany({ where: { id: { in: profileIds } } });
    await tx.user.deleteMany({ where: { id: { in: userIds } } });
  });
}
