import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import {
  mediaFinalizeSchema,
  mediaSignUploadSchema,
  normalizeUploadFilename,
  uploadFilenameMatchesMimeType,
} from "../src/lib/media-validation";
import {
  UPLOAD_VALIDATION_EVIDENCE_SCOPE,
  UPLOAD_VALIDATION_MASTER_EVIDENCE,
  UPLOAD_VALIDATION_REMAINING_REQUIREMENT_IDS,
  UPLOAD_VALIDATION_REQUIREMENT_IDS,
  UPLOAD_VALIDATION_TRACES,
} from "./upload-validation-evidence";

assert.equal(UPLOAD_VALIDATION_REQUIREMENT_IDS.length, 20);
assert.deepEqual(UPLOAD_VALIDATION_REMAINING_REQUIREMENT_IDS, []);
assert.match(UPLOAD_VALIDATION_EVIDENCE_SCOPE, /does not claim deployed/i);
assert.match(UPLOAD_VALIDATION_EVIDENCE_SCOPE, /dimension ceilings/i);
assert.match(UPLOAD_VALIDATION_EVIDENCE_SCOPE, /duration ceilings/i);
assert.match(UPLOAD_VALIDATION_EVIDENCE_SCOPE, /messages and listings/i);
assert.match(UPLOAD_VALIDATION_EVIDENCE_SCOPE, /client metadata.*claim.*match/i);
assert.match(UPLOAD_VALIDATION_EVIDENCE_SCOPE, /unlisted workflows/i);

assert.deepEqual(
  UPLOAD_VALIDATION_TRACES.map(
    ({ requirementId, attachmentTarget }) => ({ requirementId, attachmentTarget }),
  ),
  [
    {
      requirementId: "security.trace.21.message-media-upload",
      attachmentTarget: "message",
    },
    {
      requirementId: "security.trace.28.listing-media-upload",
      attachmentTarget: "listing",
    },
  ],
);
for (const trace of UPLOAD_VALIDATION_TRACES) {
  assert.ok(trace.actor.length > 30, `${trace.requirementId}: actor missing`);
  assert.equal(trace.steps.length, 3, `${trace.requirementId}: trace drifted`);
  for (const step of trace.steps) {
    for (const [field, value] of Object.entries(step)) {
      assert.ok(value.trim(), `${trace.requirementId}: ${field} missing`);
    }
    assert.equal(existsSync(step.sourceFile), true, step.sourceFile);
    assert.equal(existsSync(step.test), true, step.test);
  }
}

assert.equal(normalizeUploadFilename("../../race card.JPG"), "race-card.JPG");
assert.equal(uploadFilenameMatchesMimeType("race-card.JPG", "image/jpeg"), true);
assert.equal(uploadFilenameMatchesMimeType("race-card.exe", "image/jpeg"), false);
assert.equal(
  mediaSignUploadSchema.safeParse({
    filename: "race-card.png",
    mimeType: "image/jpeg",
    sizeBytes: 1024,
  }).success,
  false,
);
assert.equal(
  mediaSignUploadSchema.safeParse({
    filename: "bundle.zip",
    mimeType: "application/zip",
    sizeBytes: 1024,
  }).success,
  false,
);
assert.equal(
  mediaSignUploadSchema.safeParse({
    filename: "race-card.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 1024,
    scanStatus: "clean",
  }).success,
  false,
);
assert.equal(
  mediaFinalizeSchema.safeParse({
    sha256: "a".repeat(64),
    widthPx: 20_001,
  }).success,
  false,
);
assert.equal(mediaFinalizeSchema.safeParse({ scanStatus: "clean" }).success, false);

const signRoute = source("src/app/api/media/sign-upload/route.ts");
assertIncludes("sign upload route", signRoute, [
  "requireCurrentUserProfile()",
  "readBoundedJsonRequest(request)",
  "mediaSignUploadSchema.parse(",
  "{ failClosed: true }",
  "createSignedUploadIntent(",
]);

const finalizeRoute = source("src/app/api/media/[id]/finalize/route.ts");
assertIncludes("finalize route", finalizeRoute, [
  "requireCurrentUserProfile()",
  "readBoundedJsonRequest(request)",
  "mediaFinalizeSchema.parse(",
  "{ failClosed: true }",
  "finalizeMediaUpload(current, id, parsed)",
]);

const validation = source("src/lib/media-validation.ts");
assertIncludes("media validation", validation, [
  "MEDIA_MIME_LIMITS",
  "MEDIA_EXTENSIONS",
  ".strict()",
  "uploadFilenameMatchesMimeType(value.filename, value.mimeType)",
  "File extension does not match media type",
  "normalizeUploadFilename",
  "MEDIA_MAX_DIMENSION_PX",
  "MEDIA_MAX_DURATION_SEC",
  "validateDecodedMediaMetadata",
  "media.dimensions_exceeded",
  "media.duration_exceeded",
  "media.metadata_mismatch",
]);
assert.equal(validation.includes('"application/zip"'), false);

const service = source("src/lib/media-service.ts");
assertIncludes("media service", service, [
  "assertUploadAllowedForContext(bucket, mediaContext, current)",
  "uploaderId: current.dbUserId",
  "id: mediaId,\n      uploaderId: current.dbUserId,",
  "objectStorage.getObjectInfo({",
  "storageObjectSize(objectInfo, media.sizeBytes)",
  "assertMediaSize(",
  "await assertStoredBytesMatchMimeType(bucket, media)",
  "objectStorage.readObjectHead({",
  "sniffMatchesMimeType(head, media.mimeType as MediaMimeType)",
  "await objectStorage.deleteObject({",
  "const filename = `${randomUUID()}-${normalizeUploadFilename(input.filename)}`",
  "return `users/${sanitizePathSegment(input.userId)}/quarantine/",
  "const MEDIA_MAINTENANCE_BUDGET_MS = 12 * 60 * 1000",
  ".timeout({ seconds: imageProcessingTimeoutSeconds(deadlineAt) })",
  "await probeMedia(inputPath, deadlineAt)",
  "timeout: Math.min(ffmpegTimeoutMs(), remainingMs)",
  "media.processing_deadline_exceeded",
  "timeout: clamScanTimeoutMs()",
]);
assert.equal(
  service.match(/validateDecodedMediaMetadata\(/g)?.length,
  3,
  "decoded metadata must be enforced for image, video, and audio processing",
);
assert.match(
  service,
  /context === "site"[\s\S]*isModeratorRole\(current\.profileRole\)[\s\S]*auth\.forbidden/,
);

const conversationService = source("src/lib/conversation-service.ts");
assert.match(
  conversationService,
  /sendConversationMessage[\s\S]*assertMediaAttachable\(current, mediaIds, 4,[\s\S]*allowPending: true/,
);
assert.match(
  conversationService,
  /media\.some\(\(item\) => item\.storageBucket !== PRIVATE_USER_MEDIA_BUCKET\)/,
);

const listingService = source("src/lib/listing-service.ts");
assert.match(
  listingService,
  /assertListingMediaAttachable[\s\S]*assertMediaAttachable\(current, mediaIds, 11\)[\s\S]*assertListingMediaPolicy\(media\)/,
);

const sniffTests = source("src/lib/media-sniff.test.ts");
assertIncludes("magic-byte tests", sniffTests, [
  'sniffMatchesMimeType(PNG, "image/jpeg"), false',
  'sniffMatchesMimeType(EXE, "image/jpeg"), false',
  'sniffMatchesMimeType(JPEG, "image/jpeg"), true',
  'sniffMatchesMimeType(PDF, "application/pdf"), true',
]);

for (const [requirementId, evidence] of Object.entries(
  UPLOAD_VALIDATION_MASTER_EVIDENCE,
)) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.equal(
    isMasterRequirementComplete({ ...requirement, ...evidence }),
    true,
    `${requirementId}: evidence overlay does not complete requirement`,
  );
  assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
  for (const path of evidence.evidence) {
    assert.equal(existsSync(path), true, `${requirementId}: missing ${path}`);
  }
}

console.log(
  "Upload validation evidence passed: 20 signed-upload/finalize/scan/decoded-metadata and message/listing attachment controls verified",
);

function source(path: string) {
  return readFileSync(path, "utf8");
}

function assertIncludes(label: string, contents: string, signals: readonly string[]) {
  for (const signal of signals) {
    assert.equal(contents.includes(signal), true, `${label}: missing ${signal}`);
  }
}
