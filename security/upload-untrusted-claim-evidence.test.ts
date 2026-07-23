import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  mediaFinalizeSchema,
  mediaSignUploadSchema,
  normalizeUploadFilename,
} from "../src/lib/media-validation";
import { UPLOAD_UNTRUSTED_CLAIM_MASTER_EVIDENCE } from "./upload-untrusted-claim-evidence";

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

const mediaService = readFileSync("src/lib/media-service.ts", "utf8");
const sniffTest = readFileSync("src/lib/media-sniff.test.ts", "utf8");
assert.match(
  mediaService,
  /const filename = `\$\{randomUUID\(\)\}-\$\{normalizeUploadFilename\(input\.filename\)\}`/,
);
assert.match(
  mediaService,
  /return `users\/\$\{sanitizePathSegment\(input\.userId\)\}\/quarantine\//,
);
assert.match(mediaService, /await assertStoredBytesMatchMimeType\(bucket, media\)/);
assert.match(
  mediaService,
  /objectStorage\.getObjectInfo\(\{\s*bucket,\s*key: media\.storagePath/,
);
assert.match(
  sniffTest,
  /sniffMatchesMimeType\(PNG, "image\/jpeg"\), false/,
);
assert.match(
  sniffTest,
  /sniffMatchesMimeType\(EXE, "image\/jpeg"\), false/,
);

const expectedIds = Object.keys(UPLOAD_UNTRUSTED_CLAIM_MASTER_EVIDENCE);
assert.equal(expectedIds.length, 4);
for (const requirementId of expectedIds) {
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    UPLOAD_UNTRUSTED_CLAIM_MASTER_EVIDENCE[requirementId],
  );
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.equal(isMasterRequirementComplete(requirement), true);
}

console.log("upload untrusted claims passed: four source-backed controls verified");
