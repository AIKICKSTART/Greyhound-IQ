import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { verifyTheDogsProfileArchiveIdentity } from "./thedogs-profile-archive-identity";

const sourceId = "163170";
const profilePath = `/dogs/${sourceId}/sample-dog`;

function archive(overrides: Record<string, unknown> = {}) {
  return {
    source: "thedogs",
    sourceId,
    candidate: { sourceId, profilePath },
    parsed: {
      sourceProvider: "thedogs",
      sourceId,
      name: "Sample Dog",
      profileUrl: `https://www.thedogs.com.au${profilePath}`,
    },
    showMorePath: `${profilePath}/full-form?page=1&profile=true`,
    profileHtml: `<a href="${profilePath}">dog</a><blackbook-dog data-dog-id="${sourceId}"></blackbook-dog>`,
    ...overrides,
  };
}

assert.equal(verifyTheDogsProfileArchiveIdentity(sourceId, archive()).verified, true);
assert.equal(
  verifyTheDogsProfileArchiveIdentity(
    sourceId,
    archive({
      profileHtml: `<blackbook-dog data-dog-id="${sourceId}"></blackbook-dog>`,
    }),
  ).verified,
  true,
  "an exact returned provider dog id is sufficient when the page omits a self link",
);

const embeddedProof = verifyTheDogsProfileArchiveIdentity(
  sourceId,
  archive({
    identityProof: {
      requestedSourceId: sourceId,
      requestedProfilePath: profilePath,
      pageDogIds: [sourceId],
      showMorePath: `${profilePath}/full-form?page=1&profile=true`,
      verificationStatus: "verified-exact-provider-page-identity",
      canonicalPromotionEligible: false,
    },
  }),
);
assert.equal(embeddedProof.verified, true);
assert.equal(embeddedProof.embeddedIdentityProof, true);

for (const [label, candidate] of [
  ["archive id mismatch", archive({ sourceId: "999" })],
  [
    "returned page mismatch",
    archive({
      profileHtml: '<a href="/dogs/999/other-dog">dog</a><blackbook-dog data-dog-id="999"></blackbook-dog>',
    }),
  ],
  [
    "parsed URL mismatch",
    archive({
      parsed: {
        sourceProvider: "thedogs",
        sourceId,
        name: "Sample Dog",
        profileUrl: "https://www.thedogs.com.au/dogs/999/other-dog",
      },
    }),
  ],
  [
    "numeric placeholder name",
    archive({
      parsed: {
        sourceProvider: "thedogs",
        sourceId,
        name: sourceId,
        profileUrl: `https://www.thedogs.com.au${profilePath}`,
      },
    }),
  ],
  [
    "placeholder parent name",
    archive({
      parsed: {
        sourceProvider: "thedogs",
        sourceId,
        name: "Sample Dog",
        sire: { sourceId: "100", name: "Unknown" },
        profileUrl: `https://www.thedogs.com.au${profilePath}`,
      },
    }),
  ],
  ["foreign provider", archive({ source: "unverified" })],
] as const) {
  const result = verifyTheDogsProfileArchiveIdentity(sourceId, candidate);
  assert.equal(result.verified, false, label);
  assert.ok(result.reasons.length > 0, `${label} must report a reason`);
}

const fullAuditSource = readFileSync(
  new URL("./audit-thedogs-dog-profile-raw.ts", import.meta.url),
  "utf8",
);
for (const requiredFailClosedCheck of [
  "duplicateProfileArchiveSourceIds.length > 0",
  "latestProgressValues.some((record) => record.ok === false)",
  "pendingRawDogs.length > 0",
]) {
  assert.ok(
    fullAuditSource.includes(requiredFailClosedCheck),
    `full archive audit must fail closed on ${requiredFailClosedCheck}`,
  );
}

console.log("TheDogs profile archive identity contract passed");
