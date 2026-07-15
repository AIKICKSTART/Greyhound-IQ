import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { resolveActiveIdentityCookie } from "../src/lib/identity-cookie";
import {
  mediaFinalizeSchema,
  mediaMetadataUpdateSchema,
  mediaSignUploadSchema,
  normalizeUploadFilename,
  validateWebVttCaption,
  WEBVTT_MAX_BYTES,
} from "../src/lib/media-validation";
import { sniffMatchesMimeType } from "../src/lib/media-sniff";
import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  buildExternalInputSurfaceMasterEvidence,
  evaluateExternalInputSurfaceFacts,
  EXTERNAL_INPUT_SURFACE_FACTS,
  EXTERNAL_INPUT_SURFACE_MASTER_EVIDENCE,
  EXTERNAL_INPUT_SURFACE_REQUIREMENT_IDS,
  OPEN_EXTERNAL_INPUT_SURFACE_GAPS,
  VERIFIED_EXTERNAL_INPUT_SURFACE_IDS,
  type ExternalInputSurfaceFact,
} from "./external-input-surface-evidence";

assert.equal(EXTERNAL_INPUT_SURFACE_REQUIREMENT_IDS.length, 21);
assert.equal(VERIFIED_EXTERNAL_INPUT_SURFACE_IDS.length, 5);
assert.equal(Object.keys(OPEN_EXTERNAL_INPUT_SURFACE_GAPS).length, 16);
assert.deepEqual(
  [
    ...VERIFIED_EXTERNAL_INPUT_SURFACE_IDS,
    ...Object.keys(OPEN_EXTERNAL_INPUT_SURFACE_GAPS),
  ].toSorted(),
  [...EXTERNAL_INPUT_SURFACE_REQUIREMENT_IDS].toSorted(),
  "all 21 external-input surfaces must be either proven or explicitly open",
);

const immutableRequirementIds = new Set(
  SECURITY_MASTER_REQUIREMENTS.map(({ id }) => id),
);
for (const requirementId of EXTERNAL_INPUT_SURFACE_REQUIREMENT_IDS) {
  assert.ok(
    immutableRequirementIds.has(requirementId),
    `${requirementId}: missing immutable requirement`,
  );
}

const ownedPages = [{ id: "owned-page", title: "Owned" }];
assert.deepEqual(resolveActiveIdentityCookie(undefined, ownedPages), {
  kind: "personal",
});
assert.deepEqual(resolveActiveIdentityCookie("personal", ownedPages), {
  kind: "personal",
});
assert.deepEqual(resolveActiveIdentityCookie("other-users-page", ownedPages), {
  kind: "personal",
});
assert.deepEqual(resolveActiveIdentityCookie("../administrator", ownedPages), {
  kind: "personal",
});
assert.deepEqual(resolveActiveIdentityCookie("owned-page", ownedPages), {
  kind: "page",
  page: ownedPages[0],
});

const cookieBoundarySources = collectFiles("src")
  .filter((path) => /\.(?:ts|tsx)$/.test(path) && !/\.test\./.test(path))
  .filter((path) => {
    const source = read(path);
    return /\bcookies\s*\(\)|request\.cookies\.(?:get|has|set|delete)\s*\(/.test(
      source,
    );
  })
  .toSorted();
assert.deepEqual(cookieBoundarySources, [
  "src/app/actions.ts",
  "src/lib/identity.ts",
  "src/proxy.ts",
]);

const identitySource = read("src/lib/identity.ts");
const actionsSource = read("src/app/actions.ts");
const proxySource = read("src/proxy.ts");
assert.match(
  identitySource,
  /resolveActiveIdentityCookie\(value, ownedPages\)/,
);
assert.match(
  actionsSource,
  /setActiveIdentityAction[\s\S]*listCustomPagesForCurrentUser\(current\)[\s\S]*pages\.some\(\(page\) => page\.id === requested\)[\s\S]*store\.set\(ACTIVE_IDENTITY_COOKIE, value/,
);
assert.match(actionsSource, /httpOnly: true/);
assert.match(actionsSource, /sameSite: "lax"/);
assert.match(actionsSource, /secure: process\.env\.NODE_ENV === "production"/);
assert.match(proxySource, /request\.cookies\.has\(sessionCookieName\)/);
assert.doesNotMatch(proxySource, /request\.cookies\.get\(sessionCookieName\)/);

assert.equal(normalizeUploadFilename("../../race-card.jpg"), "race-card.jpg");
assert.equal(
  normalizeUploadFilename("..\\private\\race card.jpg"),
  "race-card.jpg",
);
assert.equal(normalizeUploadFilename("\u0000..."), "upload.bin");
assert.equal(normalizeUploadFilename("a".repeat(200)).length, 160);

const upload = mediaSignUploadSchema.parse({
  filename: "..\\private\\race card.jpg",
  mimeType: "image/jpeg",
  sizeBytes: 1024,
});
assert.equal(upload.filename, "race-card.jpg");
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
  mediaSignUploadSchema.safeParse({
    filename: "race-card.exe",
    mimeType: "application/x-msdownload",
    sizeBytes: 1024,
  }).success,
  false,
);

const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);
const executable = Uint8Array.from([0x4d, 0x5a, 0x90, 0x00]);
assert.equal(sniffMatchesMimeType(jpeg, "image/jpeg"), true);
assert.equal(sniffMatchesMimeType(executable, "image/jpeg"), false);
assert.equal(sniffMatchesMimeType(jpeg, "image/png"), false);

assert.doesNotThrow(() =>
  validateWebVttCaption(
    new TextEncoder().encode("WEBVTT\n\n00:00.000 --> 00:01.000\nRace start\n"),
  ),
);
assert.throws(() =>
  validateWebVttCaption(new TextEncoder().encode("<script>alert(1)</script>")),
);
assert.throws(() =>
  validateWebVttCaption(new Uint8Array(WEBVTT_MAX_BYTES + 1)),
);

assert.deepEqual(
  mediaFinalizeSchema.parse({
    widthPx: 1920,
    heightPx: 1080,
    durationSec: 12,
    altText: " Fast\n greyhound\u0000at the track ",
  }),
  {
    widthPx: 1920,
    heightPx: 1080,
    durationSec: 12,
    altText: "Fast greyhound at the track",
  },
);
assert.equal(mediaFinalizeSchema.safeParse({ widthPx: 20_001 }).success, false);
assert.equal(
  mediaFinalizeSchema.safeParse({ durationSec: 3_601 }).success,
  false,
);
assert.equal(
  mediaFinalizeSchema.safeParse({ altText: "ok", scanStatus: "clean" }).success,
  false,
);
assert.deepEqual(
  mediaMetadataUpdateSchema.parse({
    altText: " Race\n winner ",
    storagePath: "attacker/chosen/path.jpg",
  }),
  { altText: "Race winner" },
  "unknown metadata fields must not reach the service",
);
assert.equal(mediaMetadataUpdateSchema.safeParse({}).success, false);

const signRoute = read("src/app/api/media/sign-upload/route.ts");
const finalizeRoute = read("src/app/api/media/[id]/finalize/route.ts");
const captionRoute = read("src/app/api/media/[id]/caption/route.ts");
const mediaRoute = read("src/app/api/media/[id]/route.ts");
const mediaService = read("src/lib/media-service.ts");
const webhookBody = read("src/lib/webhook-request-body.ts");
const stripeWebhookRoute = read("src/app/api/webhooks/stripe/route.ts");
const lagoWebhookRoute = read("src/app/api/webhooks/lago/route.ts");
const liveKitWebhookRoute = read("src/app/api/livekit/webhook/route.ts");
assert.match(
  signRoute,
  /mediaSignUploadSchema\.parse\(await readBoundedJsonRequest\(request\)\)/,
);
assert.match(signRoute, /createSignedUploadIntent\(\s*current,\s*parsed,/);
assert.match(
  finalizeRoute,
  /mediaFinalizeSchema\.parse\(await readBoundedJsonRequest\(request\)\)[\s\S]*finalizeMediaUpload\(current, id, parsed\)/,
);
assert.match(captionRoute, /readWebVttUpload\(request\)/);
assert.match(
  mediaRoute,
  /mediaMetadataUpdateSchema\.parse\([\s\S]*await readBoundedJsonRequest\(request\)[\s\S]*\)/,
);
assert.match(
  mediaService,
  /createSignedUploadIntent[\s\S]*assertMediaSize\([\s\S]*buildObjectPath\(/,
);
assert.match(
  mediaService,
  /finalizeMediaUpload[\s\S]*assertStoredBytesMatchMimeType\([\s\S]*objectStorage\.getObjectInfo\(\{/,
);
assert.match(
  mediaService,
  /function buildObjectPath[\s\S]*randomUUID\(\)[\s\S]*normalizeUploadFilename\(input\.filename\)[\s\S]*quarantine/,
);
assert.match(webhookBody, /request\.headers\.get\("content-length"\)/);
assert.match(webhookBody, /request\.body\.getReader\(\)/);
assert.match(webhookBody, /value\.byteLength > maxBytes - byteLength/);
assert.match(stripeWebhookRoute, /readBoundedWebhookBody\(request\)/);
assert.match(lagoWebhookRoute, /readBoundedWebhookBody\(request\)/);
assert.match(liveKitWebhookRoute, /readBoundedWebhookText\(request\)/);
assert.match(
  stripeWebhookRoute + lagoWebhookRoute + liveKitWebhookRoute,
  /webhookBodyErrorResponse\(err\)/,
);

assert.deepEqual(
  Object.keys(EXTERNAL_INPUT_SURFACE_MASTER_EVIDENCE).toSorted(),
  [...VERIFIED_EXTERNAL_INPUT_SURFACE_IDS].toSorted(),
);
for (const [requirementId, gap] of Object.entries(
  OPEN_EXTERNAL_INPUT_SURFACE_GAPS,
)) {
  assert.ok(gap.length > 60, `${requirementId}: gap must be specific`);
  assert.equal(
    EXTERNAL_INPUT_SURFACE_MASTER_EVIDENCE[requirementId],
    undefined,
  );
}

for (const fact of Object.keys(
  EXTERNAL_INPUT_SURFACE_FACTS,
) as ExternalInputSurfaceFact[]) {
  const facts = { ...EXTERNAL_INPUT_SURFACE_FACTS, [fact]: false };
  const evaluation = evaluateExternalInputSurfaceFacts(facts);
  const evidence = buildExternalInputSurfaceMasterEvidence(facts);
  assert.equal(
    Object.entries(evaluation)
      .filter(([, complete]) => !complete)
      .every(([requirementId]) => evidence[requirementId] === undefined),
    true,
    `${fact}: a missing control must withhold every dependent gate`,
  );
}

console.log(
  "External-input surface evidence passed: 5 verified controls and 16 explicit gaps cover all 21 requirements",
);

function collectFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name).replaceAll("\\", "/");
    return entry.isDirectory() ? collectFiles(path) : [path];
  });
}

function read(path: string) {
  return readFileSync(path, "utf8");
}
