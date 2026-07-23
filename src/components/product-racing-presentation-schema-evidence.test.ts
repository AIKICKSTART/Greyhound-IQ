import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "./master-audit-requirements";
import { PRODUCT_MASTER_EVIDENCE } from "./master-audit-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCT_RACING_PRESENTATION_SCHEMA_EVIDENCE_FILE,
  PRODUCT_RACING_PRESENTATION_SCHEMA_EXPECTED_GAIN,
  PRODUCT_RACING_PRESENTATION_SCHEMA_MASTER_EVIDENCE,
  PRODUCT_RACING_PRESENTATION_SCHEMA_REQUIREMENT_IDS,
  PRODUCT_RACING_PRESENTATION_SCHEMA_SCOPE,
  PRODUCT_RACING_PRESENTATION_SCHEMA_TEST_FILE,
} from "./product-racing-presentation-schema-evidence";
import { PRODUCT_RACING_STRUCTURE_OPEN_REQUIREMENT_IDS } from "./product-racing-structure-evidence";
import {
  RACING_PRESENTATION_ROUTES,
  RACING_ROUTE_PRESENTATION_SCHEMAS,
  RACING_SHARED_PRESENTATION_SCHEMA,
} from "./racing-presentation-schema";

const completedIds = [...PRODUCT_RACING_PRESENTATION_SCHEMA_REQUIREMENT_IDS];
assert.deepEqual(completedIds, ["RACING.STRUCT.schema"]);
assert.equal(PRODUCT_RACING_PRESENTATION_SCHEMA_EXPECTED_GAIN, 1);
assert.deepEqual(
  Object.keys(PRODUCT_RACING_PRESENTATION_SCHEMA_MASTER_EVIDENCE),
  completedIds,
);

const productRequirementIds = new Set(
  PRODUCT_MASTER_REQUIREMENTS.map(({ id }) => id),
);
for (const requirementId of completedIds) {
  assert.equal(productRequirementIds.has(requirementId), true, requirementId);
  assert.equal(
    (PRODUCT_RACING_STRUCTURE_OPEN_REQUIREMENT_IDS as readonly string[]).includes(
      requirementId,
    ),
    false,
  );
  const record =
    PRODUCT_RACING_PRESENTATION_SCHEMA_MASTER_EVIDENCE[requirementId];
  assert.equal(record.status, "tested");
  assert.deepEqual(record.evidence.slice(0, 2), [
    PRODUCT_RACING_PRESENTATION_SCHEMA_EVIDENCE_FILE,
    PRODUCT_RACING_PRESENTATION_SCHEMA_TEST_FILE,
  ]);
  assert.equal(record.evidence.some((path) => path.startsWith("output/")), false);
  for (const evidencePath of record.evidence) {
    assert.equal(existsSync(evidencePath), true, evidencePath);
  }
  assert.deepEqual(PRODUCT_MASTER_EVIDENCE[requirementId], record);
}

const evidenceSource = readFileSync(
  PRODUCT_RACING_PRESENTATION_SCHEMA_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);
assert.match(PRODUCT_RACING_PRESENTATION_SCHEMA_SCOPE, /all ten registered public racing routes/i);
assert.match(PRODUCT_RACING_PRESENTATION_SCHEMA_SCOPE, /25 route-specific presentations/i);
assert.match(PRODUCT_RACING_PRESENTATION_SCHEMA_SCOPE, /column keys, labels, types, nullability/i);
assert.match(PRODUCT_RACING_PRESENTATION_SCHEMA_SCOPE, /does not prove browser rendering/i);
assert.match(PRODUCT_RACING_PRESENTATION_SCHEMA_SCOPE, /broader no-invention requirement/i);
assert.match(PRODUCT_RACING_PRESENTATION_SCHEMA_SCOPE, /production readiness/i);

assert.equal(RACING_PRESENTATION_ROUTES.length, 10);
assert.equal(RACING_ROUTE_PRESENTATION_SCHEMAS.length, 10);
assert.equal(
  RACING_ROUTE_PRESENTATION_SCHEMAS.reduce(
    (total, { presentations }) => total + presentations.length,
    0,
  ),
  25,
);
assert.equal(RACING_SHARED_PRESENTATION_SCHEMA.columns.length, 4);

const selectedIdSet = new Set<string>(completedIds);
const currentCompleted = MASTER_AUDIT_REQUIREMENTS.filter(
  isMasterRequirementComplete,
).length;
const withoutThisBatch = MASTER_AUDIT_REQUIREMENTS.map((requirement) =>
  selectedIdSet.has(requirement.id)
    ? { ...requirement, status: "not-started", evidence: [] }
    : requirement,
).filter(isMasterRequirementComplete).length;
assert.equal(
  currentCompleted - withoutThisBatch,
  PRODUCT_RACING_PRESENTATION_SCHEMA_EXPECTED_GAIN,
  "This isolated evidence batch must add exactly one completed requirement",
);

console.log(
  "Product racing presentation-schema evidence passed: all 10 racing routes and 25 presentations are source-bound, and 1 gate closed.",
);
