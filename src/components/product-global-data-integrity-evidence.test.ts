import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import {
  PRODUCT_GLOBAL_DATA_INTEGRITY_EVIDENCE_FILE,
  PRODUCT_GLOBAL_DATA_INTEGRITY_MASTER_EVIDENCE,
  PRODUCT_GLOBAL_DATA_INTEGRITY_REQUIREMENT_IDS,
  PRODUCT_GLOBAL_DATA_INTEGRITY_SCOPE,
  PRODUCT_GLOBAL_DATA_INTEGRITY_TEST_FILE,
} from "./product-global-data-integrity-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  RACING_PRODUCTION_FIXTURES,
} from "./product-racing-fixture-evidence";
import { RACING_ROUTE_PRESENTATION_SCHEMAS } from "./racing-presentation-schema";
import { RACING_STATISTIC_LINEAGE } from "./racing-statistic-lineage";

// screen-evidence-test-id: PRODUCT-GLOBAL-DATA-INTEGRITY-EVIDENCE

assert.deepEqual(PRODUCT_GLOBAL_DATA_INTEGRITY_REQUIREMENT_IDS, [
  "GLOBAL.DATA.missing-zero",
  "GLOBAL.DATA.delayed",
  "GLOBAL.DATA.conflicts",
  "GLOBAL.DATA.statistics",
]);

for (const requirementId of PRODUCT_GLOBAL_DATA_INTEGRITY_REQUIREMENT_IDS) {
  assert.equal(
    PRODUCT_MASTER_REQUIREMENTS.some(({ id }) => id === requirementId),
    true,
    requirementId,
  );
  const evidence = PRODUCT_GLOBAL_DATA_INTEGRITY_MASTER_EVIDENCE[requirementId];
  assert.equal(evidence.status, "tested", requirementId);
  assert.deepEqual(evidence.evidence.slice(0, 2), [
    PRODUCT_GLOBAL_DATA_INTEGRITY_EVIDENCE_FILE,
    PRODUCT_GLOBAL_DATA_INTEGRITY_TEST_FILE,
  ]);
  assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
  evidence.evidence.forEach((path) => assert.equal(existsSync(path), true, path));
}

assert.equal(RACING_ROUTE_PRESENTATION_SCHEMAS.length, 10);
const numericColumns = RACING_ROUTE_PRESENTATION_SCHEMAS.flatMap(({ presentations }) =>
  presentations.flatMap(({ columns }) =>
    columns.filter(({ type }) =>
      ["currency", "decimal", "integer", "percentage"].includes(type),
    ),
  ),
);
assert.ok(numericColumns.length > 0);
assert.equal(
  RACING_STATISTIC_LINEAGE.length,
  new Set(
    RACING_STATISTIC_LINEAGE.map(({ route, presentationId }) =>
      `${route}:${presentationId}`,
    ),
  ).size,
);
assert.ok(
  RACING_PRODUCTION_FIXTURES.some(
    ({ requirementId }) => requirementId === "RACING.FIX.delayed",
  ),
);
assert.ok(
  RACING_PRODUCTION_FIXTURES.some(
    ({ requirementId }) => requirementId === "RACING.FIX.source-conflict",
  ),
);
assert.match(PRODUCT_GLOBAL_DATA_INTEGRITY_SCOPE, /ten registered racing routes/i);
assert.match(PRODUCT_GLOBAL_DATA_INTEGRITY_SCOPE, /non-racing currency or time presentation/i);
assert.match(PRODUCT_GLOBAL_DATA_INTEGRITY_SCOPE, /refresh-race protection/i);
assert.match(PRODUCT_GLOBAL_DATA_INTEGRITY_SCOPE, /optimistic-update reconciliation/i);

console.log(
  "Global data-integrity evidence passed: four public-racing data contracts are source-bound; currency, time, refresh and optimistic-update gaps remain open.",
);
