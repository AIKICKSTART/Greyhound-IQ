import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "./master-audit-requirements";
import { PRODUCT_MASTER_EVIDENCE } from "./master-audit-evidence";
import {
  PRODUCT_AGENT_RUN_LIFECYCLE_MASTER_EVIDENCE,
  PRODUCT_AGENT_RUN_LIFECYCLE_REQUIREMENT_IDS,
} from "./product-agent-run-lifecycle-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

const requirementIds = [...PRODUCT_AGENT_RUN_LIFECYCLE_REQUIREMENT_IDS];
const requirementIdSet = new Set<string>(requirementIds);
assert.deepEqual(requirementIds, [
  "ROUTE.AI.secret-safety",
  "ROUTE.AI.states",
  "ROUTE.AI.cancel",
]);
assert.equal(new Set(requirementIds).size, 3);
assert.deepEqual(
  Object.keys(PRODUCT_AGENT_RUN_LIFECYCLE_MASTER_EVIDENCE).toSorted(),
  requirementIds.toSorted(),
);

const productRequirementIds = new Set(
  PRODUCT_MASTER_REQUIREMENTS.map(({ id }) => id),
);
for (const requirementId of requirementIds) {
  assert.equal(productRequirementIds.has(requirementId), true, requirementId);
  const evidence = PRODUCT_AGENT_RUN_LIFECYCLE_MASTER_EVIDENCE[requirementId];
  assert.equal(evidence.status, "tested", requirementId);
  assert.equal(evidence.evidence.some((path) => path.startsWith("output/")), false);
  assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
  for (const path of evidence.evidence) assert.equal(existsSync(path), true, path);
  assert.deepEqual(PRODUCT_MASTER_EVIDENCE[requirementId], evidence);
}

const openAiRouteRequirements = MASTER_AUDIT_REQUIREMENTS.filter(
  (requirement) =>
    requirement.section === "routes.ai-tools" &&
    !requirementIdSet.has(requirement.id) &&
    !isMasterRequirementComplete(requirement),
);
assert.deepEqual(
  openAiRouteRequirements.map(({ id }) => id),
  [],
);
assert.equal(
  "ROUTE.AI.related-routes" in PRODUCT_AGENT_RUN_LIFECYCLE_MASTER_EVIDENCE,
  false,
);

const currentCompleted = MASTER_AUDIT_REQUIREMENTS.filter(
  isMasterRequirementComplete,
).length;
const withoutThisBatch = MASTER_AUDIT_REQUIREMENTS.map((requirement) =>
  requirementIdSet.has(requirement.id)
    ? { ...requirement, status: "not-started", evidence: [] }
    : requirement,
).filter(isMasterRequirementComplete).length;
assert.equal(currentCompleted - withoutThisBatch, 3);

console.log(
  "Product AI run lifecycle evidence passed: three source-backed route gates closed; related route discovery is independently verified.",
);
