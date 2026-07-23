import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { DOWNLOAD_CONTROL_MASTER_EVIDENCE } from "./download-control-evidence";

const blobRoute = readFileSync("src/app/api/media/[id]/blob/route.ts", "utf8");
const urlRoute = readFileSync("src/app/api/media/[id]/url/route.ts", "utf8");
const mediaService = readFileSync("src/lib/media-service.ts", "utf8");
const mediaServiceTest = readFileSync("src/lib/media-service.test.ts", "utf8");
const storagePaths = readFileSync("src/lib/storage-paths.ts", "utf8");
const exportRoute = readFileSync("src/app/api/users/me/export/route.ts", "utf8");

assert.match(mediaService, /return viewer\?\.dbUserId === uploaderId/);
assert.match(
  mediaServiceTest,
  /canAccessMediaByOwnership\("owner-user", \{ dbUserId: "moderator-user" \}\)[\s\S]*false/,
);
assert.match(mediaService, /return \{ id: mediaId, uploaderId: dbUserId, deletedAt: null \}/);
assert.match(mediaService, /if \(!authorized\) throw new Error\("media\.not_found"\)/);
assert.match(mediaService, /assertMediaReady\(media\)/);

assert.match(
  storagePaths,
  /const PUBLIC_BUCKETS = new Set<ObjectStorageBucket>\(\[\s*SITE_ASSETS_BUCKET,\s*\]\)/,
);
assert.doesNotMatch(
  storagePaths.match(/const PUBLIC_BUCKETS[\s\S]*?\]\);/)?.[0] ?? "",
  /PRIVATE_USER_MEDIA_BUCKET|PUBLIC_USER_MEDIA_BUCKET/,
);
assert.match(urlRoute, /requireCurrentUserProfile\(\)/);
assert.match(
  mediaService,
  /objectStorage\.createSignedDownload\([\s\S]*expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS/,
);
assert.match(mediaService, /signedUrlTtlSeconds: DOWNLOAD_URL_TTL_SECONDS/);
assert.match(mediaService, /newAccessAfterDeletion: "denied"/);
assert.match(mediaService, /issuedUrlBehavior:[\s\S]*15-minute expiry/);

assert.match(blobRoute, /"Content-Disposition": "inline"/);
assert.match(blobRoute, /"Content-Type": delivery\.mimeType/);
assert.match(blobRoute, /"X-Content-Type-Options": "nosniff"/);
assert.match(
  mediaServiceTest,
  /assert\.throws\(\(\) => parseMediaDeliveryVariant\("\.\.\/\.\.\/private-object"\)\)/,
);
assert.match(
  mediaServiceTest,
  /assert\.throws\(\(\) => parseMediaDeliveryVariant\("hls-segment-360-0\/\.\.\/\.\.\/x"\)\)/,
);

assert.match(exportRoute, /const USER_EXPORT_RATE_LIMIT = 3/);
assert.match(exportRoute, /USER_EXPORT_RATE_LIMIT_WINDOW_MS = 60 \* 60 \* 1000/);
assert.match(exportRoute, /\{ failClosed: true \}/);
assert.match(exportRoute, /"content-disposition": `attachment; filename="greyhoundiq-export-/);
assert.match(exportRoute, /const PRIVATE_NO_STORE = \{ "cache-control": USER_EXPORT_CACHE_CONTROL \}/);

const expectedIds = [
  "security.download-control.ownership-visibility",
  "security.download-control.tenant",
  "security.download-control.signed-url",
  "security.download-control.disposition",
  "security.download-control.mime",
  "security.download-control.path",
  "security.download-control.private-url",
  "security.download-control.revocation",
  "security.download-control.deleted-blocked",
  "security.download-control.large-export-rate",
] as const;

assert.equal(Object.keys(DOWNLOAD_CONTROL_MASTER_EVIDENCE).length, 10);
for (const requirementId of expectedIds) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    DOWNLOAD_CONTROL_MASTER_EVIDENCE[requirementId],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
}

console.log("download controls passed: 9 verified controls and one scoped tenant exclusion");
