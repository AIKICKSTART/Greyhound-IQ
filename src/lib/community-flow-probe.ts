import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  createCallRoomForConversation,
  createCallTokenForCurrentUser,
  endCallRoomForCurrentUser,
  getPendingCallInviteForConversation,
  handleLiveKitWebhookEvent,
  respondToCallInviteForCurrentUser,
  runCallMaintenance,
} from "@/lib/call-service";
import type { CurrentUserProfile } from "@/lib/auth";
import { syncAuthUser } from "@/lib/auth-sync";
import {
  countUnreadMessagesByConversation,
  getConversationForProfile,
  markConversationDelivered,
  markConversationRead,
  sendConversationMessage,
  startOrGetConversation,
  toggleConversationMessageReaction,
} from "@/lib/conversation-service";
import { withDbSystemContext } from "@/lib/db-context";
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
import { createMediaDownloadUrl } from "@/lib/media-service";
import { PRIVATE_USER_MEDIA_BUCKET } from "@/lib/storage-paths";
import type { WebhookEvent } from "livekit-server-sdk";

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
  mediaAssets: Set<string>;
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
    mediaAssets: new Set<string>(),
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
    const freeSeller = { ...seller, tier: "free" as const };
    const freeBuyer = { ...buyer, tier: "free" as const };

    const post = await createFeedPostForCurrentUser(freeSeller, {
      body: "Community flow check feed post.",
      mediaIds: [],
    });
    ids.feedPosts.add(post.id);
    const comment = await createFeedCommentForCurrentUser(freeBuyer, post.id, {
      body: "Community flow check comment.",
    });
    assert.equal(comment.postId, post.id);
    const reaction = await toggleFeedPostReactionForCurrentUser(freeBuyer, post.id);
    assert.equal(reaction.liked, true);

    const conversation = await startOrGetConversation(seller, buyer.profileId);
    ids.conversations.add(conversation.id);
    const message = await sendConversationMessage(seller, conversation.id, {
      body: "Community flow check message.",
      mediaIds: [],
    });
    assert.equal(message.conversationId, conversation.id);

    // ── Delivered semantics ──────────────────────────────────────────────────
    const receiptsBeforeDeliver = await withDbSystemContext((tx) =>
      tx.messageDeliveryReceipt.count({
        where: { messageId: message.id, profileId: buyer.profileId },
      }),
    );
    assert.equal(receiptsBeforeDeliver, 0, "no delivery receipt before markConversationDelivered");

    const deliveredResult = await markConversationDelivered(buyer, conversation.id);
    assert.equal(deliveredResult.delivered, 1, "markConversationDelivered delivers 1 message");

    const deliveryReceipt = await withDbSystemContext((tx) =>
      tx.messageDeliveryReceipt.findFirst({
        where: { messageId: message.id, profileId: buyer.profileId },
      }),
    );
    assert.ok(deliveryReceipt, "delivery receipt row exists after markConversationDelivered");

    const unreadMapBefore = await countUnreadMessagesByConversation(buyer);
    assert.equal(
      unreadMapBefore.get(conversation.id),
      1,
      "1 unread message in conversation before read",
    );

    // Presence: touchPresence is fire-and-forget in sendConversationMessage; the
    // DB roundtrips above give it time to complete.
    const presenceRow = await withDbSystemContext((tx) =>
      tx.userPresence.findFirst({
        where: { profileId: seller.profileId },
      }),
    );
    assert.ok(presenceRow, "UserPresence row exists for sender after send");
    assert.ok(presenceRow.lastSeenAt, "lastSeenAt is populated");
    // ── End delivered semantics ──────────────────────────────────────────────

    assert.equal(await markConversationRead(buyer, conversation.id), 1);

    // ── Unread count + read receipt ──────────────────────────────────────────
    const unreadMapAfterRead = await countUnreadMessagesByConversation(buyer);
    assert.equal(
      unreadMapAfterRead.get(conversation.id) ?? 0,
      0,
      "0 unread after markConversationRead",
    );
    const readReceiptRow = await withDbSystemContext((tx) =>
      tx.messageReadReceipt.findFirst({
        where: { messageId: message.id, profileId: buyer.profileId },
      }),
    );
    assert.ok(readReceiptRow, "read receipt row exists after markConversationRead");
    // ── End unread/read receipt ──────────────────────────────────────────────

    await toggleConversationMessageReaction(buyer, conversation.id, message.id);

    // ── Notification dedupe ──────────────────────────────────────────────────
    const msg2 = await sendConversationMessage(seller, conversation.id, {
      body: "Community flow check message 2.",
      mediaIds: [],
    });
    assert.ok(msg2.id);
    const notifCount = await withDbSystemContext((tx) =>
      tx.notification.count({
        where: {
          userId: buyer.dbUserId,
          type: "message",
          href: `/pulse/${conversation.id}`,
          readAt: null,
        },
      }),
    );
    assert.equal(notifCount, 1, "exactly 1 unread message notification (deduped)");
    // ── End notification dedupe ──────────────────────────────────────────────

    // ── Pagination ───────────────────────────────────────────────────────────
    const bulkBase = Date.now();
    // System context: raw bulk inserts must clear the pro-write trigger.
    await withDbSystemContext(async (tx) => {
      for (let i = 0; i < 60; i++) {
        await tx.message.create({
          data: {
            conversationId: conversation.id,
            senderId: seller.profileId,
            recipientId: buyer.profileId,
            body: `pagination-test-msg-${i}`,
            createdAt: new Date(bulkBase + i * 10),
          },
        });
      }
    });
    const page1 = await getConversationForProfile(seller, conversation.id);
    assert.equal(page1.messages.length, 50, "default returns 50 messages");
    const newestInPage1 = page1.messages[page1.messages.length - 1];
    assert.equal(
      newestInPage1.body,
      "pagination-test-msg-59",
      "newest message is the last bulk message",
    );
    const oldestInPage1 = page1.messages[0];
    const page2 = await getConversationForProfile(seller, conversation.id, {
      before: oldestInPage1.id,
    });
    assert.ok(page2.messages.length > 0, "page2 has older messages");
    // page2 messages must all be older than the oldest message in page1
    const oldestCreatedAt = oldestInPage1.createdAt;
    assert.ok(
      page2.messages.every((m) => m.createdAt <= oldestCreatedAt),
      "page2 messages are all older than page1's oldest message",
    );
    if (page2.messages.length > 1) {
      assert.ok(
        page2.messages[0].createdAt <= page2.messages[page2.messages.length - 1].createdAt,
        "page2 messages are in ascending order",
      );
    }
    // ── End pagination ───────────────────────────────────────────────────────

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

    // ── Invite lifecycle ─────────────────────────────────────────────────────

    // Decline: room ended + invite declined
    const declineRoom = await createCallRoomForConversation(seller, conversation.id);
    ids.callRooms.add(declineRoom.id);
    const pendingInvite = await getPendingCallInviteForConversation(
      seller,
      conversation.id
    );
    assert.ok(pendingInvite, "pending invite exists after room creation");
    assert.equal(pendingInvite.toProfileId, buyer.profileId, "invite targets buyer");

    const declineResult = await respondToCallInviteForCurrentUser(
      buyer,
      declineRoom.id,
      "decline",
    );
    assert.equal(declineResult.status, "declined");
    const declineRoomRow = await withDbSystemContext((tx) => tx.callRoom.findUnique({ where: { id: declineRoom.id } }));
    assert.equal(declineRoomRow?.status, "ended", "room ended after decline");

    // Accept: token issuance works
    const acceptRoom = await createCallRoomForConversation(seller, conversation.id);
    ids.callRooms.add(acceptRoom.id);
    const acceptResult = await respondToCallInviteForCurrentUser(
      buyer,
      acceptRoom.id,
      "accept",
    );
    assert.equal(acceptResult.status, "accepted");
    const acceptToken = await createCallTokenForCurrentUser(buyer, acceptRoom.id);
    assert.equal(acceptToken.roomId, acceptRoom.id);
    assert.equal(acceptToken.token.split(".").length, 3, "accepted invite token is valid JWT");
    await endCallRoomForCurrentUser(seller, acceptRoom.id);

    // Missed: backdate invite, run maintenance, assert missed + notification
    const missedRoom = await createCallRoomForConversation(seller, conversation.id);
    ids.callRooms.add(missedRoom.id);
    const pendingInvite3 = await withDbSystemContext((tx) =>
      tx.callInvite.findFirst({
        where: { callRoomId: missedRoom.id, status: "pending" },
      }),
    );
    assert.ok(pendingInvite3, "pending invite exists for missed-room test");
    await withDbSystemContext((tx) =>
      tx.callInvite.update({
        where: { id: pendingInvite3.id },
        data: { expiresAt: new Date(Date.now() - 5_000) },
      }),
    );
    await runCallMaintenance();
    const invite3Updated = await withDbSystemContext((tx) =>
      tx.callInvite.findUnique({
        where: { id: pendingInvite3.id },
      }),
    );
    assert.equal(invite3Updated?.status, "missed", "invite marked missed by maintenance");
    const missedNotif = await withDbSystemContext((tx) =>
      tx.notification.findFirst({
        where: { userId: buyer.dbUserId, type: "call_missed" },
      }),
    );
    assert.ok(missedNotif, "call_missed notification created for callee");
    const missedRoomRow = await withDbSystemContext((tx) => tx.callRoom.findUnique({ where: { id: missedRoom.id } }));
    assert.equal(missedRoomRow?.status, "active", "room remains active after invite missed");
    // ── End invite lifecycle ─────────────────────────────────────────────────

    // ── Webhook reconciliation ───────────────────────────────────────────────
    const webhookRoom = await createCallRoomForConversation(seller, conversation.id);
    ids.callRooms.add(webhookRoom.id);

    await handleLiveKitWebhookEvent({
      event: "room_finished",
      room: { name: webhookRoom.roomName },
    } as unknown as WebhookEvent);

    const webhookRoomRow = await withDbSystemContext((tx) => tx.callRoom.findUnique({ where: { id: webhookRoom.id } }));
    assert.equal(webhookRoomRow?.status, "ended", "webhook event ends room");

    const webhookParticipants = await withDbSystemContext((tx) =>
      tx.callParticipant.findMany({
        where: { callRoomId: webhookRoom.id },
      }),
    );
    assert.ok(
      webhookParticipants.every((p) => p.leftAt !== null),
      "all participants have leftAt set after webhook",
    );

    // Idempotence: second call must not throw or add events
    const eventsBefore = await withDbSystemContext((tx) =>
      tx.callEvent.count({
        where: { callRoomId: webhookRoom.id },
      }),
    );
    await handleLiveKitWebhookEvent({
      event: "room_finished",
      room: { name: webhookRoom.roomName },
    } as unknown as WebhookEvent);
    const eventsAfter = await withDbSystemContext((tx) =>
      tx.callEvent.count({
        where: { callRoomId: webhookRoom.id },
      }),
    );
    assert.equal(eventsAfter, eventsBefore, "webhook idempotent: no additional events on replay");
    // ── End webhook reconciliation ───────────────────────────────────────────

    // ── Media pending-attach ─────────────────────────────────────────────────
    const probeMedia = await withDbSystemContext((tx) =>
      tx.mediaAsset.create({
        data: {
          uploaderId: seller.dbUserId,
          storageBucket: PRIVATE_USER_MEDIA_BUCKET,
          storagePath: `users/${seller.dbUserId}/messages/pending/${marker}-probe.bin`,
          publicUrl: null,
          mediaType: "image",
          originalName: "probe-media.jpg",
          mimeType: "image/jpeg",
          sizeBytes: 1024,
          linkedEntityType: null,
          linkedEntityId: null,
          expiresAt: null,
          scanStatus: "pending",
        },
      }),
    );
    ids.mediaAssets.add(probeMedia.id);

    const mediaMsg = await sendConversationMessage(seller, conversation.id, {
      body: "Media attachment probe",
      mediaIds: [probeMedia.id],
    });
    const mediaMsgRow = await withDbSystemContext((tx) =>
      tx.messageMedia.findFirst({
        where: { mediaId: probeMedia.id },
      }),
    );
    assert.ok(mediaMsgRow, "MessageMedia row exists after attaching pending media");
    assert.equal(mediaMsgRow.messageId, mediaMsg.id);

    await withDbSystemContext((tx) =>
      tx.mediaAsset.update({
        where: { id: probeMedia.id },
        data: { scanStatus: "infected" },
      }),
    );
    await assert.rejects(
      () => createMediaDownloadUrl(seller, probeMedia.id),
      (err: Error) => err.message === "media.infected",
      "createMediaDownloadUrl rejects infected media",
    );
    // ── End media pending-attach ─────────────────────────────────────────────

    const category = await createMarketplaceCategoryForModerator(admin, {
      name: "Community Flow Check",
      slug: marker,
      description: "Temporary launch verification category.",
      sortOrder: 9999,
    });
    ids.categories.add(category.id);
    // Goods type: exercises the listing → approve → enquiry → save flow without
    // tripping the dog fraud gate (which needs a registered + owned dog).
    const listing = await createListingForCurrentUser(seller, {
      type: "equipment",
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
  const userProfile = user.profile;

  const profile =
    userProfile.role === role
      ? userProfile
      : await withDbSystemContext((tx) =>
          tx.profile.update({
            where: { id: userProfile.id },
            data: { role },
          }),
        );
  ids.profiles.add(profile.id);

  return {
    id: auth.id,
    dbUserId: user.id,
    profileId: profile.id,
    email: auth.email,
    firstName,
    lastName,
    name: displayName,
    tier: "pro",
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
  const trackedMediaAssetIds = includeTrackedIds ? [...ids.mediaAssets] : [];

  const users = await withDbSystemContext((tx) =>
    tx.user.findMany({
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
    }),
  );
  const userIds = unique([...trackedUserIds, ...users.map((user) => user.id)]);
  const profileIds = unique([
    ...trackedProfileIds,
    ...users.map((user) => user.profile?.id),
  ]);

  const categories = await withDbSystemContext((tx) =>
    tx.marketplaceCategory.findMany({
      where: {
        OR: [
          { id: { in: trackedCategoryIds } },
          { slug: { startsWith: categorySlugStartsWith } },
        ],
      },
      select: { id: true },
    }),
  );
  const categoryIds = unique([
    ...trackedCategoryIds,
    ...categories.map((category) => category.id),
  ]);

  const conversations = await withDbSystemContext((tx) =>
    tx.conversation.findMany({
      where: {
        OR: [
          { id: { in: trackedConversationIds } },
          { participantAId: { in: profileIds } },
          { participantBId: { in: profileIds } },
          { participants: { some: { profileId: { in: profileIds } } } },
        ],
      },
      select: { id: true },
    }),
  );
  const conversationIds = unique([
    ...trackedConversationIds,
    ...conversations.map((conversation) => conversation.id),
  ]);

  const callRooms = await withDbSystemContext((tx) =>
    tx.callRoom.findMany({
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
    }),
  );
  const callRoomIds = unique([
    ...trackedCallRoomIds,
    ...callRooms.map((room) => room.id),
  ]);

  const listings = await withDbSystemContext((tx) =>
    tx.listing.findMany({
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
    }),
  );
  const listingIds = unique([
    ...trackedListingIds,
    ...listings.map((listing) => listing.id),
  ]);

  const feedPosts = await withDbSystemContext((tx) =>
    tx.feedPost.findMany({
      where: {
        OR: [
          { id: { in: trackedFeedPostIds } },
          { authorProfileId: { in: profileIds } },
          { comments: { some: { authorProfileId: { in: profileIds } } } },
          { reactions: { some: { profileId: { in: profileIds } } } },
        ],
      },
      select: { id: true },
    }),
  );
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

  await withDbSystemContext((tx) =>
    tx.callPermission.deleteMany({
      where: {
        OR: [
          { callRoomId: { in: callRoomIds } },
          { profileId: { in: profileIds } },
        ],
      },
    }),
  );
  await withDbSystemContext((tx) =>
    tx.callParticipant.deleteMany({
      where: {
        OR: [
          { callRoomId: { in: callRoomIds } },
          { profileId: { in: profileIds } },
        ],
      },
    }),
  );
  await withDbSystemContext((tx) =>
    tx.callInvite.deleteMany({
      where: {
        OR: [
          { callRoomId: { in: callRoomIds } },
          { fromProfileId: { in: profileIds } },
          { toProfileId: { in: profileIds } },
        ],
      },
    }),
  );
  await withDbSystemContext((tx) =>
    tx.callReport.deleteMany({
      where: {
        OR: [
          { callRoomId: { in: callRoomIds } },
          { reporterProfileId: { in: profileIds } },
        ],
      },
    }),
  );
  await withDbSystemContext((tx) => tx.callRoom.deleteMany({ where: { id: { in: callRoomIds } } }));

  // Delete probe media attachments before messages
  if (trackedMediaAssetIds.length > 0) {
    await withDbSystemContext((tx) =>
      tx.messageMedia.deleteMany({
        where: { mediaId: { in: trackedMediaAssetIds } },
      }),
    );
  }

  await withDbSystemContext((tx) =>
    tx.messageReaction.deleteMany({
      where: { profileId: { in: profileIds } },
    }),
  );
  await withDbSystemContext((tx) =>
    tx.messageReadReceipt.deleteMany({
      where: { profileId: { in: profileIds } },
    }),
  );
  await withDbSystemContext((tx) =>
    tx.messageDeliveryReceipt.deleteMany({
      where: { profileId: { in: profileIds } },
    }),
  );
  await withDbSystemContext((tx) =>
    tx.message.deleteMany({
      where: {
        OR: [
          { conversationId: { in: conversationIds } },
          { senderId: { in: profileIds } },
          { recipientId: { in: profileIds } },
        ],
      },
    }),
  );
  await withDbSystemContext((tx) =>
    tx.conversationParticipant.deleteMany({
      where: {
        OR: [
          { conversationId: { in: conversationIds } },
          { profileId: { in: profileIds } },
        ],
      },
    }),
  );

  // Delete probe media assets after message cleanup
  if (trackedMediaAssetIds.length > 0) {
    await withDbSystemContext((tx) =>
      tx.mediaAsset.deleteMany({
        where: { id: { in: trackedMediaAssetIds } },
      }),
    );
  }

  await withDbSystemContext((tx) =>
    tx.savedListing.deleteMany({
      where: {
        OR: [
          { listingId: { in: listingIds } },
          { profileId: { in: profileIds } },
        ],
      },
    }),
  );
  await withDbSystemContext((tx) =>
    tx.listingEnquiry.deleteMany({
      where: {
        OR: [
          { listingId: { in: listingIds } },
          { conversationId: { in: conversationIds } },
          { fromProfileId: { in: profileIds } },
          { toProfileId: { in: profileIds } },
        ],
      },
    }),
  );
  await withDbSystemContext((tx) =>
    tx.listingReport.deleteMany({
      where: {
        OR: [
          { listingId: { in: listingIds } },
          { reporterProfileId: { in: profileIds } },
          { resolvedByProfileId: { in: profileIds } },
        ],
      },
    }),
  );
  await withDbSystemContext((tx) =>
    tx.listingView.deleteMany({
      where: {
        OR: [
          { listingId: { in: listingIds } },
          { viewerProfileId: { in: profileIds } },
        ],
      },
    }),
  );
  await withDbSystemContext((tx) =>
    tx.listingStatusHistory.deleteMany({
      where: {
        OR: [
          { listingId: { in: listingIds } },
          { actorProfileId: { in: profileIds } },
        ],
      },
    }),
  );
  await withDbSystemContext((tx) =>
    tx.listingModerationAction.deleteMany({
      where: {
        OR: [
          { listingId: { in: listingIds } },
          { actorProfileId: { in: profileIds } },
        ],
      },
    }),
  );
  await withDbSystemContext((tx) => tx.listing.deleteMany({ where: { id: { in: listingIds } } }));

  await withDbSystemContext((tx) =>
    tx.feedReaction.deleteMany({
      where: {
        OR: [
          { postId: { in: feedPostIds } },
          { profileId: { in: profileIds } },
        ],
      },
    }),
  );
  await withDbSystemContext((tx) =>
    tx.feedComment.deleteMany({
      where: {
        OR: [
          { postId: { in: feedPostIds } },
          { authorProfileId: { in: profileIds } },
        ],
      },
    }),
  );
  await withDbSystemContext((tx) => tx.feedPost.deleteMany({ where: { id: { in: feedPostIds } } }));

  await withDbSystemContext((tx) =>
    tx.conversation.deleteMany({
      where: { id: { in: conversationIds } },
    }),
  );
  await withDbSystemContext((tx) =>
    tx.marketplaceCategory.deleteMany({
      where: { id: { in: categoryIds } },
    }),
  );
  await withDbSystemContext((tx) =>
    tx.notification.deleteMany({
      where: {
        OR: [
          { userId: { in: userIds } },
          { actorProfileId: { in: profileIds } },
          { targetId: { in: targetIds } },
        ],
      },
    }),
  );
  await withDbSystemContext((tx) =>
    tx.trustSafetyFlag.deleteMany({
      where: {
        OR: [
          { userId: { in: userIds } },
          { profileId: { in: profileIds } },
          { targetId: { in: targetIds } },
        ],
      },
    }),
  );
  await withDbSystemContext((tx) =>
    tx.userBlock.deleteMany({
      where: {
        OR: [
          { blockerProfileId: { in: profileIds } },
          { blockedProfileId: { in: profileIds } },
        ],
      },
    }),
  );
  await withDbSystemContext((tx) =>
    tx.auditLog.deleteMany({
      where: {
        OR: [
          { actorId: { in: userIds } },
          { targetId: { in: targetIds } },
        ],
      },
    }),
  );
  await withDbSystemContext((tx) =>
    tx.userPresence.deleteMany({
      where: { profileId: { in: profileIds } },
    }),
  );
  await withDbSystemContext((tx) => tx.profile.deleteMany({ where: { id: { in: profileIds } } }));
  await withDbSystemContext((tx) => tx.user.deleteMany({ where: { id: { in: userIds } } }));
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
