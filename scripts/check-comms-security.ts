import "./load-env";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { syncAuthUser } from "../src/lib/auth-sync";
import { prisma } from "../src/lib/db";
import {
  getConversationForProfile,
  sendConversationMessage,
  setConversationBlock,
  startOrGetConversation,
} from "../src/lib/conversation-service";
import {
  createCallRoomForConversation,
  createCallTokenForCurrentUser,
} from "../src/lib/call-service";
import { getMediaForCurrentUser } from "../src/lib/media-service";
import { checkRateLimit } from "../src/lib/rate-limit";
import { PRIVATE_USER_MEDIA_BUCKET } from "../src/lib/storage-paths";
import type { CurrentUserProfile } from "../src/lib/auth";

type SecUser = CurrentUserProfile & { isBanned: false; deletionRequestedAt: null };

main().catch((err) => {
  console.error("Comms security check failed:");
  console.error(String(err));
  process.exit(1);
});

async function main() {
  const marker = `comms_sec_${randomUUID().replaceAll("-", "").slice(0, 12)}`;

  const savedEnv: Record<string, string | undefined> = {
    LIVEKIT_URL: process.env.LIVEKIT_URL,
    LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
  };
  process.env.LIVEKIT_URL = "wss://livekit.comms-sec.example.test";
  process.env.LIVEKIT_API_KEY = "comms-sec-key";
  process.env.LIVEKIT_API_SECRET = "comms-sec-secret";

  const trackedUserIds: string[] = [];
  const trackedProfileIds: string[] = [];
  const trackedConvIds: string[] = [];
  const trackedCallRoomIds: string[] = [];
  const trackedMediaIds: string[] = [];
  const rateLimitKeys: string[] = [];

  try {
    // Stale sweep: remove any leftover rows from crashed prior runs
    await sweepStale(marker);

    const [a, b, c, d] = await Promise.all([
      createSecUser(marker, "a", "Sec A"),
      createSecUser(marker, "b", "Sec B"),
      createSecUser(marker, "c", "Sec C"),
      createSecUser(marker, "d", "Sec D"),
    ]);
    for (const u of [a, b, c, d]) {
      trackedUserIds.push(u.dbUserId);
      trackedProfileIds.push(u.profileId);
    }

    // Create A-B conversation
    const abConv = await startOrGetConversation(a, b.profileId);
    trackedConvIds.push(abConv.id);

    // Create A-D conversation BEFORE banning D so startOrGetConversation can proceed
    const adConv = await startOrGetConversation(a, d.profileId);
    trackedConvIds.push(adConv.id);

    // Ban D
    await prisma.user.update({ where: { id: d.dbUserId }, data: { isBanned: true } });

    // ── Stranger cannot read A-B conversation ─────────────────────────────────
    await assert.rejects(
      () => getConversationForProfile(c, abConv.id),
      (err: Error) => err.message === "conversation.not_found",
    );
    console.log("PASS: stranger cannot read conversation");

    // ── Stranger cannot send into A-B conversation ────────────────────────────
    await assert.rejects(
      () => sendConversationMessage(c, abConv.id, { body: "stranger message", mediaIds: [] }),
      (err: Error) => err.message === "conversation.not_found",
    );
    console.log("PASS: stranger cannot send message");

    // ── Block / unblock ───────────────────────────────────────────────────────
    await sendConversationMessage(a, abConv.id, { body: "block test seed", mediaIds: [] });
    await setConversationBlock(a, abConv.id, true);
    await assert.rejects(
      () => sendConversationMessage(b, abConv.id, { body: "blocked attempt", mediaIds: [] }),
      (err: Error) => err.message === "conversation.blocked",
    );
    await setConversationBlock(a, abConv.id, false);
    const afterUnblock = await sendConversationMessage(b, abConv.id, {
      body: "unblocked send",
      mediaIds: [],
    });
    assert.ok(afterUnblock.id, "send succeeds after unblock");
    console.log("PASS: block prevents send; unblock restores");

    // ── Banned recipient ──────────────────────────────────────────────────────
    await assert.rejects(
      () => sendConversationMessage(a, adConv.id, { body: "to banned user", mediaIds: [] }),
      (err: Error) => err.message === "conversation.recipient_unavailable",
    );
    console.log("PASS: banned recipient rejected");

    // ── Media scoping ─────────────────────────────────────────────────────────
    const fakeMedia = await prisma.mediaAsset.create({
      data: {
        uploaderId: a.dbUserId,
        storageBucket: PRIVATE_USER_MEDIA_BUCKET,
        storagePath: `users/${a.dbUserId}/messages/pending/${marker}-scoping.bin`,
        publicUrl: null,
        mediaType: "image",
        originalName: "scoping-test.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 1024,
        linkedEntityType: null,
        linkedEntityId: null,
        expiresAt: null,
        scanStatus: "clean",
      },
    });
    trackedMediaIds.push(fakeMedia.id);
    await sendConversationMessage(a, abConv.id, {
      body: "media attach",
      mediaIds: [fakeMedia.id],
    });
    await assert.rejects(
      () => getMediaForCurrentUser(c, fakeMedia.id),
      (err: Error) => err.message === "media.not_found",
    );
    console.log("PASS: media not accessible by non-participant");

    // ── Call token scoping ────────────────────────────────────────────────────
    const abRoom = await createCallRoomForConversation(a, abConv.id);
    trackedCallRoomIds.push(abRoom.id);
    await assert.rejects(
      () => createCallTokenForCurrentUser(c, abRoom.id),
      (err: Error) => err.message === "call.room_not_found",
    );
    console.log("PASS: non-participant cannot get call token");

    // ── Rate limit: sequential ────────────────────────────────────────────────
    const seqKey = `${marker}_seq`;
    rateLimitKeys.push(seqKey);
    const seqLimit = 5;
    for (let i = 1; i <= seqLimit; i++) {
      const r = await checkRateLimit(seqKey, seqLimit, 60_000);
      assert.equal(r.allowed, true, `call ${i}/${seqLimit} should be allowed`);
      assert.equal(r.remaining, seqLimit - i);
    }
    const seqDeny = await checkRateLimit(seqKey, seqLimit, 60_000);
    assert.equal(seqDeny.allowed, false, "call beyond limit denied");
    assert.equal(seqDeny.remaining, 0);
    console.log("PASS: rate limit sequential");

    // ── Rate limit: window reset ──────────────────────────────────────────────
    const windowKey = `${marker}_window`;
    rateLimitKeys.push(windowKey);
    const wr1 = await checkRateLimit(windowKey, 2, 4000);
    assert.equal(wr1.allowed, true);
    await checkRateLimit(windowKey, 2, 4000);
    const wr3 = await checkRateLimit(windowKey, 2, 4000);
    assert.equal(wr3.allowed, false, "3rd call exhausts limit");
    const waitMs = wr1.resetAt - Date.now() + 150;
    await new Promise((res) => setTimeout(res, Math.max(waitMs, 0)));
    const wr4 = await checkRateLimit(windowKey, 2, 4000);
    assert.equal(wr4.allowed, true, "allowed again after window reset");
    console.log("PASS: rate limit window reset");

    // ── Rate limit: concurrent atomicity ──────────────────────────────────────
    const atomicKey = `${marker}_atomic`;
    rateLimitKeys.push(atomicKey);
    const atomicResults = await Promise.all(
      Array.from({ length: 10 }, () => checkRateLimit(atomicKey, 10, 60_000)),
    );
    assert.equal(
      atomicResults.filter((r) => r.allowed).length,
      10,
      "all 10 concurrent calls should be allowed",
    );
    const overflow = await checkRateLimit(atomicKey, 10, 60_000);
    assert.equal(overflow.allowed, false, "11th call denied");
    console.log("PASS: rate limit atomicity (10 concurrent + 1 overflow)");
  } finally {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }

    for (const key of rateLimitKeys) {
      await prisma
        .$executeRaw`DELETE FROM "RateLimit" WHERE "key" = ${key}`.catch(() => null);
    }

    await cleanupSecEntities(
      marker,
      trackedUserIds,
      trackedProfileIds,
      trackedConvIds,
      trackedCallRoomIds,
      trackedMediaIds,
    );
    await prisma.$disconnect();
  }
}

async function createSecUser(
  marker: string,
  label: string,
  displayName: string,
): Promise<SecUser> {
  const [firstName = displayName, lastName = ""] = displayName.split(" ");
  const auth = {
    id: `workos_${marker}_${label}`,
    email: `${marker}-${label}@example.invalid`,
    firstName,
    lastName,
  };
  const user = await syncAuthUser(auth);
  assert.ok(user.profile, "profile created by syncAuthUser");
  const profile = user.profile;
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

async function sweepStale(currentMarker: string) {
  // ponytail: broad prefix sweep removes rows from any crashed prior run; the
  // current-run marker is distinct via UUID so it won't touch in-flight rows.
  const emailPrefix = "comms_sec_";
  const users = await prisma.user.findMany({
    where: {
      email: { startsWith: emailPrefix, endsWith: "@example.invalid" },
      NOT: { email: { startsWith: currentMarker } },
    },
    select: { id: true, profile: { select: { id: true } } },
  });
  if (users.length === 0) return;
  const staleUserIds = users.map((u) => u.id);
  const staleProfileIds = users.flatMap((u) => (u.profile ? [u.profile.id] : []));
  const staleConvs = await prisma.conversation.findMany({
    where: {
      OR: [
        { participantAId: { in: staleProfileIds } },
        { participantBId: { in: staleProfileIds } },
      ],
    },
    select: { id: true },
  });
  const staleConvIds = staleConvs.map((c) => c.id);
  const staleRooms = await prisma.callRoom.findMany({
    where: {
      OR: [
        { createdByProfileId: { in: staleProfileIds } },
        { participants: { some: { profileId: { in: staleProfileIds } } } },
      ],
    },
    select: { id: true },
  });
  const staleRoomIds = staleRooms.map((r) => r.id);

  await prisma.callPermission.deleteMany({ where: { OR: [{ callRoomId: { in: staleRoomIds } }, { profileId: { in: staleProfileIds } }] } });
  await prisma.callParticipant.deleteMany({ where: { OR: [{ callRoomId: { in: staleRoomIds } }, { profileId: { in: staleProfileIds } }] } });
  await prisma.callInvite.deleteMany({ where: { OR: [{ callRoomId: { in: staleRoomIds } }, { fromProfileId: { in: staleProfileIds } }, { toProfileId: { in: staleProfileIds } }] } });
  await prisma.callReport.deleteMany({ where: { OR: [{ callRoomId: { in: staleRoomIds } }, { reporterProfileId: { in: staleProfileIds } }] } });
  await prisma.callRoom.deleteMany({ where: { id: { in: staleRoomIds } } });
  await prisma.messageMedia.deleteMany({ where: { message: { conversationId: { in: staleConvIds } } } });
  await prisma.messageReaction.deleteMany({ where: { profileId: { in: staleProfileIds } } });
  await prisma.messageReadReceipt.deleteMany({ where: { profileId: { in: staleProfileIds } } });
  await prisma.messageDeliveryReceipt.deleteMany({ where: { profileId: { in: staleProfileIds } } });
  await prisma.message.deleteMany({ where: { OR: [{ conversationId: { in: staleConvIds } }, { senderId: { in: staleProfileIds } }] } });
  await prisma.conversationParticipant.deleteMany({ where: { OR: [{ conversationId: { in: staleConvIds } }, { profileId: { in: staleProfileIds } }] } });
  await prisma.conversation.deleteMany({ where: { id: { in: staleConvIds } } });
  await prisma.mediaAsset.deleteMany({ where: { uploaderId: { in: staleUserIds } } });
  await prisma.notification.deleteMany({ where: { userId: { in: staleUserIds } } });
  await prisma.trustSafetyFlag.deleteMany({ where: { OR: [{ userId: { in: staleUserIds } }, { profileId: { in: staleProfileIds } }] } });
  await prisma.userBlock.deleteMany({ where: { OR: [{ blockerProfileId: { in: staleProfileIds } }, { blockedProfileId: { in: staleProfileIds } }] } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: staleUserIds } } });
  await prisma.userPresence.deleteMany({ where: { profileId: { in: staleProfileIds } } });
  await prisma.profile.deleteMany({ where: { id: { in: staleProfileIds } } });
  await prisma.user.deleteMany({ where: { id: { in: staleUserIds } } });
}

async function cleanupSecEntities(
  marker: string,
  userIds: string[],
  profileIds: string[],
  convIds: string[],
  callRoomIds: string[],
  mediaIds: string[],
) {
  void marker; // marker used for stale sweep only
  if (profileIds.length === 0 && userIds.length === 0) return;

  await prisma.callPermission.deleteMany({ where: { OR: [{ callRoomId: { in: callRoomIds } }, { profileId: { in: profileIds } }] } });
  await prisma.callParticipant.deleteMany({ where: { OR: [{ callRoomId: { in: callRoomIds } }, { profileId: { in: profileIds } }] } });
  await prisma.callInvite.deleteMany({ where: { OR: [{ callRoomId: { in: callRoomIds } }, { fromProfileId: { in: profileIds } }, { toProfileId: { in: profileIds } }] } });
  await prisma.callReport.deleteMany({ where: { OR: [{ callRoomId: { in: callRoomIds } }, { reporterProfileId: { in: profileIds } }] } });
  await prisma.callRoom.deleteMany({ where: { id: { in: callRoomIds } } });
  if (mediaIds.length > 0) {
    await prisma.messageMedia.deleteMany({ where: { mediaId: { in: mediaIds } } });
  }
  await prisma.messageReaction.deleteMany({ where: { profileId: { in: profileIds } } });
  await prisma.messageReadReceipt.deleteMany({ where: { profileId: { in: profileIds } } });
  await prisma.messageDeliveryReceipt.deleteMany({ where: { profileId: { in: profileIds } } });
  await prisma.message.deleteMany({
    where: {
      OR: [
        { conversationId: { in: convIds } },
        { senderId: { in: profileIds } },
        { recipientId: { in: profileIds } },
      ],
    },
  });
  await prisma.conversationParticipant.deleteMany({
    where: {
      OR: [{ conversationId: { in: convIds } }, { profileId: { in: profileIds } }],
    },
  });
  await prisma.conversation.deleteMany({ where: { id: { in: convIds } } });
  if (mediaIds.length > 0) {
    await prisma.mediaAsset.deleteMany({ where: { id: { in: mediaIds } } });
  }
  await prisma.notification.deleteMany({
    where: { OR: [{ userId: { in: userIds } }, { actorProfileId: { in: profileIds } }] },
  });
  await prisma.trustSafetyFlag.deleteMany({
    where: { OR: [{ userId: { in: userIds } }, { profileId: { in: profileIds } }] },
  });
  await prisma.userBlock.deleteMany({
    where: {
      OR: [
        { blockerProfileId: { in: profileIds } },
        { blockedProfileId: { in: profileIds } },
      ],
    },
  });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
  await prisma.userPresence.deleteMany({ where: { profileId: { in: profileIds } } });
  await prisma.profile.deleteMany({ where: { id: { in: profileIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}
