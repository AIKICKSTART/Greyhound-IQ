import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  moveMediaItem,
  promoteMediaItem,
} from "./media-attachment-fields";
import {
  PRODUCT_MARKETPLACE_MEDIA_ORDERING_EVIDENCE_FILE,
  PRODUCT_MARKETPLACE_MEDIA_ORDERING_EXPECTED_GAIN,
  PRODUCT_MARKETPLACE_MEDIA_ORDERING_MASTER_EVIDENCE,
  PRODUCT_MARKETPLACE_MEDIA_ORDERING_REQUIREMENT_IDS,
  PRODUCT_MARKETPLACE_MEDIA_ORDERING_SCOPE,
  PRODUCT_MARKETPLACE_MEDIA_ORDERING_TEST_FILE,
} from "./product-marketplace-media-ordering-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-MARKETPLACE-MEDIA-ORDERING

const EXPECTED_REQUIREMENTS = {
  "ROUTE.MARKET.primary-image": "Support selecting a primary image.",
  "ROUTE.MARKET.reorder-media": "Support reordering media.",
} as const;

assert.deepEqual(
  PRODUCT_MARKETPLACE_MEDIA_ORDERING_REQUIREMENT_IDS,
  Object.keys(EXPECTED_REQUIREMENTS),
);
assert.equal(PRODUCT_MARKETPLACE_MEDIA_ORDERING_EXPECTED_GAIN, 2);
assert.deepEqual(
  Object.keys(PRODUCT_MARKETPLACE_MEDIA_ORDERING_MASTER_EVIDENCE),
  Object.keys(EXPECTED_REQUIREMENTS),
);

for (const [id, requirementText] of Object.entries(EXPECTED_REQUIREMENTS)) {
  const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
    (candidate) => candidate.id === id,
  );
  assert.ok(requirement, id);
  assert.equal(requirement.requirement, requirementText);
  const evidence =
    PRODUCT_MARKETPLACE_MEDIA_ORDERING_MASTER_EVIDENCE[
      id as keyof typeof PRODUCT_MARKETPLACE_MEDIA_ORDERING_MASTER_EVIDENCE
    ];
  assert.equal(evidence.status, "tested");
  assert.deepEqual(evidence.evidence.slice(0, 2), [
    PRODUCT_MARKETPLACE_MEDIA_ORDERING_EVIDENCE_FILE,
    PRODUCT_MARKETPLACE_MEDIA_ORDERING_TEST_FILE,
  ]);
  assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
  evidence.evidence.forEach((path) => assert.equal(existsSync(path), true, path));
}

assert.match(PRODUCT_MARKETPLACE_MEDIA_ORDERING_SCOPE, /source and unit/i);
assert.match(PRODUCT_MARKETPLACE_MEDIA_ORDERING_SCOPE, /visible order/i);
assert.match(PRODUCT_MARKETPLACE_MEDIA_ORDERING_SCOPE, /listing-media positions/i);
assert.match(PRODUCT_MARKETPLACE_MEDIA_ORDERING_SCOPE, /does not prove hydrated/i);
assert.match(PRODUCT_MARKETPLACE_MEDIA_ORDERING_SCOPE, /existing listing edit/i);

const sample = [{ key: "a" }, { key: "b" }, { key: "c" }];
assert.deepEqual(
  promoteMediaItem(sample, "c").map(({ key }) => key),
  ["c", "a", "b"],
);
assert.deepEqual(
  moveMediaItem(sample, "b", 1).map(({ key }) => key),
  ["a", "c", "b"],
);

const componentSource = source("src/components/media-attachment-fields.tsx");
for (const assertion of [
  'allowReorder = mediaContext === "listings"',
  "promoteMediaItem(current, item.key)",
  "moveMediaItem(current, item.key, -1)",
  "moveMediaItem(current, item.key, 1)",
  "Primary image",
  "Make primary",
  'item.step === "done" && item.mediaId',
  'name={fieldName}',
  'value={item.mediaId}',
]) {
  assert.ok(componentSource.includes(assertion), assertion);
}

const createPageSource = source("src/app/listings/new/page.tsx");
assert.ok(
  createPageSource.includes(
    '<MediaAttachmentFields mediaContext="listings" maxFiles={11} />',
  ),
);

const actionSource = source("src/app/actions.ts");
assert.ok(actionSource.includes('mediaIds: fields(formData, "mediaIds")'));
assert.ok(actionSource.includes("mediaIds: parsed.mediaIds"));

const mediaServiceSource = source("src/lib/media-service.ts");
assert.ok(
  mediaServiceSource.includes(
    "data: mediaIds.map((mediaId, position) => ({",
  ),
);
assert.ok(mediaServiceSource.includes("position,"));

const evidenceSource = source(
  PRODUCT_MARKETPLACE_MEDIA_ORDERING_EVIDENCE_FILE,
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);

console.log(
  "Marketplace media ordering evidence passed in isolation: explicit primary promotion and persisted deterministic ordering are ready for exact +2 central wiring.",
);

function source(path: string) {
  return readFileSync(path, "utf8");
}
