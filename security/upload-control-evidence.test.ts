import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import { resolveMediaBucket } from "../src/lib/media-validation";
import { PRIVATE_USER_MEDIA_BUCKET } from "../src/lib/storage-paths";
import { UPLOAD_CONTROL_MASTER_EVIDENCE } from "./upload-control-evidence";

const mediaService = readFileSync("src/lib/media-service.ts", "utf8");
const objectStorage = readFileSync("src/lib/object-storage.ts", "utf8");
const storageAdapter = readFileSync("src/lib/supabase-object-storage.ts", "utf8");
const storage = readFileSync("src/lib/supabase-storage.ts", "utf8");
const mediaTests = readFileSync("src/lib/media-service.test.ts", "utf8");

assert.match(
  mediaService,
  /const filename = `\$\{randomUUID\(\)\}-\$\{normalizeUploadFilename\(input\.filename\)\}`/,
);
assert.match(
  mediaService,
  /return `users\/\$\{sanitizePathSegment\(input\.userId\)\}\/quarantine\//,
);
assert.match(
  mediaService,
  /objectStorage\.createSignedUpload\(\{\s*bucket,\s*key: objectPath,\s*\}\)/,
);
assert.match(
  storageAdapter,
  /createSignedUpload\(input\)[\s\S]*operations\.createSignedUpload\(\s*input\.bucket,\s*input\.key/,
);
assert.match(objectStorage, /port\.createSignedUpload\(\{ bucket, key \}\)/);
assert.match(
  storage,
  /createSignedUploadUrl\(objectPath, \{ upsert: false \}\)/,
);
assert.doesNotMatch(mediaService, /public\/uploads|src\/app\/uploads/);

for (const context of [
  "avatars",
  "dogs",
  "listings",
  "feed",
  "forum",
  "messages",
  "verification",
  "agent-outputs",
  "custom-page",
] as const) {
  assert.equal(resolveMediaBucket({ mediaContext: context }), PRIVATE_USER_MEDIA_BUCKET);
}
assert.match(mediaService, /const UPLOAD_URL_TTL_MS = 2 \* 60 \* 60 \* 1000/);
assert.match(mediaService, /const DOWNLOAD_URL_TTL_SECONDS = 15 \* 60/);
assert.match(storage, /createSignedUrl\(objectPath, expiresInSeconds\)/);

assert.match(mediaService, /return process\.env\.NODE_ENV === "production" \? "clamav" : "metadata"/);
assert.match(mediaService, /if \(scanMode === "clamav"\) await assertClamAvReady\(\)/);
assert.match(mediaService, /scanStorageObjectWithClamAv\(/);
assert.match(mediaService, /await assertStoredBytesMatchMimeType\(bucket, media/);

assert.match(mediaService, /sharp\(inputPath\)[\s\S]*\.rotate\(\)[\s\S]*\.webp\(\{ quality: 82/);
assert.doesNotMatch(
  mediaService,
  /sharp\(inputPath\)[\s\S]{0,500}\.withMetadata\(/,
  "image variants must be decoded/re-encoded without copying source metadata",
);
assert.match(mediaService, /const posterPath = `\$\{basePath\}\/video\/poster\.jpg`/);
assert.match(mediaService, /await runFfmpeg\(/);
assert.match(mediaService, /timeout: Math\.min\(ffmpegTimeoutMs\(\), remainingMs\)/);

assert.match(mediaService, /scanStatus: "pending"/);
assert.match(mediaService, /processingStatus: "pending"/);
assert.match(mediaService, /function assertPrivateProcessingBucket/);
assert.match(mediaService, /if \(media\.scanStatus === "pending"\) throw new Error\("media\.scan_pending"\)/);
assert.match(mediaService, /if \(media\.processingStatus !== "ready"\)/);

assert.match(mediaService, /const leaseCutoff = new Date\(now\.getTime\(\) - mediaProcessingLeaseMs\(\)\)/);
assert.match(mediaService, /processingAttempts: \{ increment: 1 \}/);
assert.match(mediaService, /media\.derivative_cleanup_failed/);
assert.match(mediaService, /notifyMediaProcessingVerdict\(media, "failed"/);

assert.match(mediaService, /expiresAt: \{ lt: now \}/);
assert.match(mediaService, /take: MEDIA_MAINTENANCE_LIMIT/);
assert.match(
  mediaService,
  /await objectStorage\.deleteObject\(\{\s*bucket: media\.storageBucket,\s*key: media\.storagePath/,
);
assert.match(mediaService, /expiredDeleteErrors/);

for (const action of [
  "media.sign_upload",
  "media.finalize",
  "media.metadata_update",
  "media.delete",
]) {
  assert.match(mediaService, new RegExp(`action: "${action.replace(".", "\\.")}"`));
}
assert.match(mediaTests, /parseMediaDeliveryVariant\("hls-segment-360-0\/\.\.\/\.\.\/x"\)/);

const expectedIds = Object.keys(UPLOAD_CONTROL_MASTER_EVIDENCE);
assert.equal(expectedIds.length, 12);
for (const requirementId of expectedIds) {
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    UPLOAD_CONTROL_MASTER_EVIDENCE[requirementId],
  );
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.equal(isMasterRequirementComplete(requirement), true);
}

console.log(
  "Upload controls passed: 12 source-backed private quarantine, scanning, derivative, recovery, expiry, and audit controls",
);
