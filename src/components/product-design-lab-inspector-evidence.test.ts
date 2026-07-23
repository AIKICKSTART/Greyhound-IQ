import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { DESIGN_LAB_INSPECTOR_DIMENSIONS } from "./design-lab-contract-inspector-model";
import {
  PRODUCT_DESIGN_LAB_INSPECTOR_EVIDENCE_FILE,
  PRODUCT_DESIGN_LAB_INSPECTOR_MASTER_EVIDENCE,
  PRODUCT_DESIGN_LAB_INSPECTOR_REQUIREMENT_IDS,
  PRODUCT_DESIGN_LAB_INSPECTOR_TEST_FILE,
} from "./product-design-lab-inspector-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

const expectedIds = PRODUCT_MASTER_REQUIREMENTS.filter(
  (requirement) => requirement.section === "design-lab.inspector",
).map((requirement) => requirement.id);

assert.equal(expectedIds.length, 19);
assert.deepEqual(
  PRODUCT_DESIGN_LAB_INSPECTOR_REQUIREMENT_IDS.toSorted(),
  expectedIds.toSorted(),
);
assert.deepEqual(
  Object.keys(PRODUCT_DESIGN_LAB_INSPECTOR_MASTER_EVIDENCE).toSorted(),
  expectedIds.toSorted(),
);
assert.deepEqual(
  DESIGN_LAB_INSPECTOR_DIMENSIONS.map((dimension) => dimension.id).toSorted(),
  expectedIds.toSorted(),
);

for (const requirementId of expectedIds) {
  const record = PRODUCT_DESIGN_LAB_INSPECTOR_MASTER_EVIDENCE[requirementId];
  assert.equal(record.status, "tested", requirementId);
  assert.ok(record.evidence.includes(PRODUCT_DESIGN_LAB_INSPECTOR_EVIDENCE_FILE));
  assert.ok(record.evidence.includes(PRODUCT_DESIGN_LAB_INSPECTOR_TEST_FILE));
  for (const evidencePath of record.evidence) {
    assert.equal(existsSync(evidencePath), true, evidencePath);
  }
}

const evidenceSource = readFileSync(
  PRODUCT_DESIGN_LAB_INSPECTOR_EVIDENCE_FILE,
  "utf8",
);
for (const serverOnlySignal of ["node:fs", "readFileSync", "process.cwd"]) {
  assert.equal(evidenceSource.includes(serverOnlySignal), false, serverOnlySignal);
}

console.log("Product Design Lab inspector evidence passed (19 exact closures)");
