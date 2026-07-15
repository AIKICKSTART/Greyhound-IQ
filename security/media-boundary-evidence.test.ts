import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import { MEDIA_BOUNDARY_MASTER_EVIDENCE } from "./media-boundary-evidence";

const entitlementService = readFileSync(
  "src/lib/billing/entitlement-service.ts",
  "utf8",
);
const mediaService = readFileSync("src/lib/media-service.ts", "utf8");
const mediaTests = readFileSync("src/lib/media-service.test.ts", "utf8");
const blobRoute = readFileSync(
  "src/app/api/media/[id]/blob/route.ts",
  "utf8",
);
const urlRoute = readFileSync(
  "src/app/api/media/[id]/url/route.ts",
  "utf8",
);

// Entitlements come from a server-only database snapshot (or the server-owned
// tier defaults), and malformed or out-of-range snapshots fail closed to those
// defaults. No client-supplied entitlement value enters the upload path.
assert.match(entitlementService, /import "server-only"/);
assert.match(
  entitlementService,
  /tx\.entitlementSnapshot\.findFirst\([\s\S]*userId: current\.dbUserId[\s\S]*status: "active"/,
);
assert.match(
  entitlementService,
  /return parseEntitlementLimits\(snapshot\.entitlementsJson\) \?\? fallback/,
);
assert.match(
  mediaService,
  /const entitlementLimits = await getEntitlementLimitsForCurrentUser\(current\)/,
);
assert.doesNotMatch(mediaService, /input\.(?:entitlement|storageBytes|uploadsPerMonth)/);

// Both the signed-upload decision and finalize-after-storage decision enforce
// the server limits. Finalize measures the stored object rather than trusting
// the client's declared size.
assert.match(
  mediaService,
  /createSignedUploadIntent[\s\S]*assertMonthlyUploadsAvailable\([\s\S]*assertStorageQuotaAvailable\(/,
);
assert.match(
  mediaService,
  /finalizeMediaUpload[\s\S]*objectStorage\.getObjectInfo\(\{\s*bucket,\s*key: media\.storagePath,\s*\}\)[\s\S]*storageObjectSize\([\s\S]*assertStorageQuotaAvailable\(/,
);
assert.match(
  mediaService,
  /tx\.mediaAsset\.count\(\{[\s\S]*uploaderId: current\.dbUserId[\s\S]*createdAt: \{ gte: startOfCurrentUtcMonth\(\) \}/,
);
assert.match(
  mediaService,
  /tx\.mediaAsset\.aggregate\(\{[\s\S]*uploaderId: current\.dbUserId[\s\S]*deletedAt: null[\s\S]*_sum: \{ sizeBytes: true \}/,
);
assert.match(mediaService, /throw new Error\("media\.quota_exceeded"\)/);
assert.match(mediaTests, /entitlementLimitExceeded\(10, 1, 10\), true/);
assert.match(mediaTests, /entitlementLimitExceeded\(10_000, 1_000, -1\), false/);

// Both private delivery entry points resolve the authenticated user on the
// server. The service checks the object and returns the same not-found error for
// missing and unauthorised identifiers, avoiding an object-existence oracle.
assert.match(blobRoute, /import \{ getCurrentUser \} from "@\/lib\/auth"/);
assert.match(blobRoute, /Promise\.all\(\[params, getCurrentUser\(\)\]\)/);
assert.match(blobRoute, /getMediaBlob\(\s*id,\s*current,/);
assert.match(
  urlRoute,
  /import \{ requireCurrentUserProfile \} from "@\/lib\/auth"/,
);
assert.match(urlRoute, /requireCurrentUserProfile\(\)/);
assert.match(urlRoute, /createMediaDownloadUrl\(\s*current,\s*id,/);
assert.match(
  mediaService,
  /createMediaDownloadUrl[\s\S]*getMediaForCurrentUser\(current, mediaId\)/,
);
assert.match(
  mediaService,
  /getMediaBlob[\s\S]*findAuthorizedMedia\(mediaId, viewer\)/,
);
assert.match(
  mediaService,
  /const authorized = await canViewerAccessMedia\(media, viewer\);\s*if \(!authorized\) throw new Error\("media\.not_found"\)/,
);
assert.match(
  mediaService,
  /return \{ id: mediaId, uploaderId: dbUserId, deletedAt: null \} as const/,
);
assert.match(
  mediaTests,
  /canAccessMediaByOwnership\("owner-user", \{ dbUserId: "moderator-user" \}\)[\s\S]*false/,
);

const expectedIds = Object.keys(MEDIA_BOUNDARY_MASTER_EVIDENCE);
assert.equal(expectedIds.length, 6);
for (const requirementId of expectedIds) {
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    MEDIA_BOUNDARY_MASTER_EVIDENCE[requirementId],
  );
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.equal(
    isMasterRequirementComplete({
      ...requirement,
      ...MEDIA_BOUNDARY_MASTER_EVIDENCE[requirementId],
    }),
    true,
  );
}

console.log(
  "Media boundaries passed: 6 server-entitlement, quota, object-authorization, and private-delivery controls",
);
