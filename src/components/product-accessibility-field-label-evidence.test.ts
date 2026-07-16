import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  PRODUCT_ACCESSIBILITY_FIELD_LABEL_EVIDENCE_FILE,
  PRODUCT_ACCESSIBILITY_FIELD_LABEL_MASTER_EVIDENCE,
  PRODUCT_ACCESSIBILITY_FIELD_LABEL_REQUIREMENT_IDS,
  PRODUCT_ACCESSIBILITY_FIELD_LABEL_SCOPE,
  PRODUCT_ACCESSIBILITY_FIELD_LABEL_TEST_FILE,
} from "./product-accessibility-field-label-evidence";
import { buildProductFieldContractSourceRegistry } from "./product-field-contract-source-registry";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-ACCESSIBILITY-FIELD-LABEL-EVIDENCE

const REPOSITORY_ROOT = path.resolve(__dirname, "../..");
const NATIVE_FORM_CONTROL_TAGS = new Set(["input", "select", "textarea"]);
const EXPECTED_DIRECT_FIELD_COUNT = 214;

assert.deepEqual(PRODUCT_ACCESSIBILITY_FIELD_LABEL_REQUIREMENT_IDS, [
  "GLOBAL.A11Y.names",
  "GLOBAL.A11Y.labels",
]);

const productRequirementIds = new Set(
  PRODUCT_MASTER_REQUIREMENTS.map(({ id }) => id),
);
for (const requirementId of PRODUCT_ACCESSIBILITY_FIELD_LABEL_REQUIREMENT_IDS) {
  assert.equal(productRequirementIds.has(requirementId), true, requirementId);
  const evidence = PRODUCT_ACCESSIBILITY_FIELD_LABEL_MASTER_EVIDENCE[requirementId];
  assert.equal(evidence.status, "tested", requirementId);
  assert.deepEqual(evidence.evidence.slice(0, 2), [
    PRODUCT_ACCESSIBILITY_FIELD_LABEL_EVIDENCE_FILE,
    PRODUCT_ACCESSIBILITY_FIELD_LABEL_TEST_FILE,
  ]);
  assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
  evidence.evidence.forEach((evidencePath) =>
    assert.equal(existsSync(resolveRepoPath(evidencePath)), true, evidencePath),
  );
}

assert.match(PRODUCT_ACCESSIBILITY_FIELD_LABEL_SCOPE, /source-static/i);
assert.match(PRODUCT_ACCESSIBILITY_FIELD_LABEL_SCOPE, /placeholders never/i);
assert.match(PRODUCT_ACCESSIBILITY_FIELD_LABEL_SCOPE, /does not prove visual rendering/i);
assert.match(PRODUCT_ACCESSIBILITY_FIELD_LABEL_SCOPE, /field-specific error linkage/i);

const uniqueRecords = [
  ...new Map(
    buildProductFieldContractSourceRegistry().records.map((record) => [
      `${record.sourceFile}:${record.sourceLine}:${record.sourceColumn}`,
      record,
    ]),
  ).values(),
];
const directFields = uniqueRecords.filter(
  (record) =>
    !record.hidden && NATIVE_FORM_CONTROL_TAGS.has(record.controlTag),
);

assert.equal(directFields.length, EXPECTED_DIRECT_FIELD_COUNT);
assert.deepEqual(
  directFields
    .filter((record) => record.accessibleLabel === null)
    .map(fieldLocation),
  [],
  "Each direct native field requires a persistent accessible label; placeholders do not count.",
);

const mediaAttachmentFields = uniqueRecords.filter(
  (record) => record.controlTag === "MediaAttachmentFields",
);
assert.ok(mediaAttachmentFields.length > 0);
const mediaAttachmentSource = source("src/components/media-attachment-fields.tsx");
assert.match(mediaAttachmentSource, /Attach media/);
assert.match(mediaAttachmentSource, /type="file"/);
assert.match(mediaAttachmentSource, /\bhidden\b/);

console.log(
  `Accessibility field-label evidence passed: ${directFields.length} direct native fields have persistent accessible labels across ${new Set(directFields.map((record) => record.sourceFile)).size} reachable source files.`,
);

function fieldLocation(record: (typeof uniqueRecords)[number]) {
  return `${record.sourceFile}:${record.sourceLine}:${record.sourceColumn}`;
}

function source(sourcePath: string) {
  return readFileSync(resolveRepoPath(sourcePath), "utf8");
}

function resolveRepoPath(sourcePath: string) {
  return path.resolve(REPOSITORY_ROOT, sourcePath);
}
