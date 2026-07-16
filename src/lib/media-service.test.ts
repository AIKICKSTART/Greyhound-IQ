import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildWaveform,
  canAccessActorMediaAudience,
  canAccessMediaByOwnership,
  clamAvDefinitionsNeedRefresh,
  entitlementLimitExceeded,
  feedPostStatusForMedia,
  isNewestProfileMediaCandidate,
  MediaRangeNotSatisfiableError,
  ownedMediaWhere,
  parseClamAvDefinitionDate,
  parseMediaByteRange,
  parseMediaDeliveryVariant,
} from "./media-service";
import {
  mediaFinalizeSchema,
  mediaMetadataUpdateSchema,
  mediaSignUploadSchema,
  normalizeUploadFilename,
} from "./media-validation";

assert.deepEqual(parseMediaByteRange(null, 1000), null);
assert.deepEqual(parseMediaByteRange("bytes=100-199", 1000), {
  start: 100,
  end: 199,
});
assert.deepEqual(parseMediaByteRange("bytes=900-", 1000), {
  start: 900,
  end: 999,
});
assert.deepEqual(parseMediaByteRange("bytes=-100", 1000), {
  start: 900,
  end: 999,
});
assert.deepEqual(parseMediaByteRange("bytes=950-2000", 1000), {
  start: 950,
  end: 999,
});
assert.throws(
  () => parseMediaByteRange("bytes=1000-1001", 1000),
  MediaRangeNotSatisfiableError
);
assert.throws(
  () => parseMediaByteRange("bytes=0-1,3-4", 1000),
  MediaRangeNotSatisfiableError
);

for (const variant of [
  "original",
  "playback",
  "poster",
  "hls",
  "caption",
  "image-640",
  "hls-rendition-720",
  "hls-segment-360-0",
]) {
  assert.equal(parseMediaDeliveryVariant(variant), variant);
}
assert.throws(() => parseMediaDeliveryVariant("../../private-object"));
assert.throws(() => parseMediaDeliveryVariant("hls-segment-360-0/../../x"));

assert.deepEqual(ownedMediaWhere("owner-user", "media-1"), {
  id: "media-1",
  uploaderId: "owner-user",
  deletedAt: null,
});
assert.equal(
  canAccessMediaByOwnership("owner-user", { dbUserId: "owner-user" }),
  true
);
assert.equal(
  canAccessMediaByOwnership("owner-user", { dbUserId: "moderator-user" }),
  false,
  "a moderator must not receive private media solely because of their role"
);
assert.equal(entitlementLimitExceeded(10_000, 1_000, -1), false);
assert.equal(entitlementLimitExceeded(9, 1, 10), false);
assert.equal(entitlementLimitExceeded(10, 1, 10), true);
const profileCandidates = [
  { id: "older", createdAt: "2026-07-11T00:00:00.000Z" },
  { id: "newer", createdAt: "2026-07-11T00:00:01.000Z" },
];
assert.equal(isNewestProfileMediaCandidate("older", profileCandidates), false);
assert.equal(isNewestProfileMediaCandidate("newer", profileCandidates), true);
assert.equal(
  isNewestProfileMediaCandidate("b", [
    { id: "a", createdAt: "2026-07-11T00:00:00.000Z" },
    { id: "b", createdAt: "2026-07-11T00:00:00.000Z" },
  ]),
  true,
);

const clamDefinitionDate = parseClamAvDefinitionDate(
  "ClamAV 1.4.3/27812/Fri Jul 10 12:00:00 2026"
);
assert.ok(clamDefinitionDate);
assert.equal(clamDefinitionDate.getFullYear(), 2026);
assert.equal(parseClamAvDefinitionDate("ClamAV 1.4.3"), null);
assert.equal(
  clamAvDefinitionsNeedRefresh(
    new Date("2026-07-09T12:00:00Z"),
    Date.parse("2026-07-10T12:00:00Z"),
    24 * 60 * 60 * 1000
  ),
  true
);
assert.equal(
  clamAvDefinitionsNeedRefresh(
    new Date("2026-07-10T00:00:01Z"),
    Date.parse("2026-07-10T12:00:00Z"),
    24 * 60 * 60 * 1000
  ),
  false
);

assert.equal(
  mediaFinalizeSchema.parse({ altText: "  Fast\n greyhound\u0000at the track  " })
    .altText,
  "Fast greyhound at the track"
);
assert.equal(
  mediaMetadataUpdateSchema.parse({ altText: "  Race winner  " }).altText,
  "Race winner"
);
assert.throws(() => mediaMetadataUpdateSchema.parse({}));
assert.equal(normalizeUploadFilename("../../race-card.jpg"), "race-card.jpg");
assert.equal(normalizeUploadFilename("..."), "upload.bin");
assert.equal(
  mediaSignUploadSchema.parse({
    filename: "..\\private\\race card.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 1024,
  }).filename,
  "race-card.jpg",
);
assert.equal(
  mediaSignUploadSchema.safeParse({
    filename: "race-card.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 1024,
    storagePath: "attacker/chosen/path.jpg",
  }).success,
  false,
);
assert.equal(
  mediaFinalizeSchema.safeParse({ scanStatus: "clean" }).success,
  false,
);

assert.equal(
  feedPostStatusForMedia([
    { processingStatus: "ready", scanStatus: "clean" },
    { processingStatus: "ready", scanStatus: "clean" },
  ]),
  "active"
);
assert.equal(
  feedPostStatusForMedia([
    { processingStatus: "ready", scanStatus: "clean" },
    { processingStatus: "processing", scanStatus: "clean" },
  ]),
  null
);
assert.equal(
  feedPostStatusForMedia([
    { processingStatus: "ready", scanStatus: "clean" },
    { processingStatus: "failed", scanStatus: "clean" },
  ]),
  "failed"
);
assert.equal(
  feedPostStatusForMedia([
    { processingStatus: "processing", scanStatus: "clean" },
    { processingStatus: "scanning", scanStatus: "infected" },
  ]),
  "failed"
);

const pcm = Buffer.alloc(8);
pcm.writeInt16LE(0, 0);
pcm.writeInt16LE(16384, 2);
pcm.writeInt16LE(-32768, 4);
pcm.writeInt16LE(8192, 6);
assert.deepEqual(buildWaveform(pcm, 2), [0.5, 1]);

const publicActor = {
  ownerProfileId: "owner",
  profileVisibility: "public",
  published: true,
};
assert.equal(
  canAccessActorMediaAudience(publicActor, {
    profileId: null,
    connected: false,
    blocked: false,
  }),
  true
);
assert.equal(
  canAccessActorMediaAudience(
    { ...publicActor, profileVisibility: "members" },
    { profileId: null, connected: false, blocked: false }
  ),
  false
);
assert.equal(
  canAccessActorMediaAudience(
    { ...publicActor, profileVisibility: "connections" },
    { profileId: "follower", connected: true, blocked: false }
  ),
  true
);
assert.equal(
  canAccessActorMediaAudience(publicActor, {
    profileId: "blocked-viewer",
    connected: true,
    blocked: true,
  }),
  false
);
assert.equal(
  canAccessActorMediaAudience(
    { ...publicActor, profileVisibility: "only_me", published: false },
    { profileId: "owner", connected: false, blocked: false }
  ),
  true
);
assert.equal(
  canAccessActorMediaAudience(
    { ...publicActor, published: false },
    { profileId: "member", connected: false, blocked: false }
  ),
  false
);

const mediaServiceSource = readFileSync(
  join(__dirname, "media-service.ts"),
  "utf8",
);
assert.doesNotMatch(mediaServiceSource, /@\/lib\/supabase-storage/);

const signedUploadSource =
  /export async function createSignedUploadIntent\([\s\S]*?(?=\nexport async function finalizeMediaUpload)/.exec(
    mediaServiceSource,
  )?.[0];
assert.ok(signedUploadSource);
assertCallOrder(
  signedUploadSource,
  "assertUploadAllowedForContext",
  "objectStorage.createSignedUpload",
  "upload authorization must run before issuing a provider grant",
);
assertCallOrder(
  signedUploadSource,
  "assertStorageQuotaAvailable",
  "objectStorage.createSignedUpload",
  "quota enforcement must run before issuing a provider grant",
);

const signedDownloadSource =
  /export async function createMediaDownloadUrl\([\s\S]*?(?=\nexport async function deleteMediaForCurrentUser)/.exec(
    mediaServiceSource,
  )?.[0];
assert.ok(signedDownloadSource);
assertCallOrder(
  signedDownloadSource,
  "getMediaForCurrentUser",
  "objectStorage.createSignedDownload",
  "owner authorization must run before issuing a private download URL",
);

const mediaBlobSource =
  /export async function getMediaBlob\([\s\S]*?(?=\nexport async function assertMediaAttachable)/.exec(
    mediaServiceSource,
  )?.[0];
assert.ok(mediaBlobSource);
assertCallOrder(
  mediaBlobSource,
  "findAuthorizedMedia",
  "objectStorage.getObjectInfo",
  "audience authorization must run before reading provider metadata",
);
assertCallOrder(
  mediaBlobSource,
  "findAuthorizedMedia",
  "objectStorage.streamObject",
  "audience authorization must run before streaming provider bytes",
);

console.log("media-service tests passed");

function assertCallOrder(
  source: string,
  before: string,
  after: string,
  message: string,
) {
  const beforeIndex = source.indexOf(before);
  const afterIndex = source.indexOf(after);
  assert.ok(beforeIndex >= 0, `${message}: missing ${before}`);
  assert.ok(afterIndex >= 0, `${message}: missing ${after}`);
  assert.ok(beforeIndex < afterIndex, message);
}
