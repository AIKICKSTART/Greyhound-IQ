import assert from "node:assert/strict";

import {
  SCREEN_CONTRACTS,
  SCREEN_CONTRACT_CHECKLIST,
  SCREEN_CONTRACT_COVERAGE_AREAS,
} from "./demo-experience-registry";
import {
  buildRequiredInputRegistryMasterEvidence,
  evaluateRequiredInputRegistrySnapshot,
  REQUIRED_INPUT_REGISTRY_EVIDENCE_TEST,
  REQUIRED_INPUT_REGISTRY_MASTER_EVIDENCE,
  REQUIRED_INPUT_REGISTRY_REQUIREMENT_IDS,
  REQUIRED_INPUT_REGISTRY_SNAPSHOT,
  type RequiredInputRegistrySnapshot,
} from "./security-required-input-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
  type MasterAuditRequirement,
} from "./master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "./master-audit-evidence";
import { evaluateDesignLabReleaseGate } from "./design-lab-release-gate";

const requirementIds = Object.values(REQUIRED_INPUT_REGISTRY_REQUIREMENT_IDS);
const evaluation = evaluateRequiredInputRegistrySnapshot(
  REQUIRED_INPUT_REGISTRY_SNAPSHOT,
);
const registeredActionIds = SCREEN_CONTRACTS.flatMap(
  ({ primaryActions, secondaryActions }) => [
    ...primaryActions,
    ...secondaryActions,
  ],
);
const registeredFormIds = SCREEN_CONTRACTS.flatMap(({ forms }) =>
  forms.map((form) => form.split(" -> ", 1)[0]),
);

assert.deepEqual(
  REQUIRED_INPUT_REGISTRY_SNAPSHOT.actionIds,
  [...new Set(registeredActionIds)].toSorted(),
  "the action registry must contain every distinct screen action exactly once, including actions shared by canonical and redirect-alias screens",
);
assert.deepEqual(
  REQUIRED_INPUT_REGISTRY_SNAPSHOT.formIds,
  [...new Set(registeredFormIds)].toSorted(),
  "the form registry must contain every distinct screen form exactly once, including forms shared by canonical and redirect-alias screens",
);

assert.deepEqual(
  Object.values(evaluation),
  requirementIds.map(() => true),
  "every current required input registry must be non-empty, unique, and connected to its screen-gate area",
);
assert.deepEqual(
  Object.keys(REQUIRED_INPUT_REGISTRY_MASTER_EVIDENCE).sort(),
  [...requirementIds].sort(),
);
assert.equal(
  SECURITY_MASTER_EVIDENCE["security.required-input-registry.extend-incomplete"],
  undefined,
  "registry existence must not claim that every registry is complete",
);

for (const requirementId of requirementIds) {
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    REQUIRED_INPUT_REGISTRY_MASTER_EVIDENCE[requirementId],
  );
  assert.ok(
    SECURITY_MASTER_EVIDENCE[requirementId].evidence.includes(
      REQUIRED_INPUT_REGISTRY_EVIDENCE_TEST,
    ),
  );
  const combined = MASTER_AUDIT_REQUIREMENTS.find(
    (requirement) => requirement.id === requirementId,
  );
  assert.ok(combined, `${requirementId} must feed the combined master gate`);
  assert.equal(isMasterRequirementComplete(combined), true);
}

const missingRegistryCases: readonly [
  keyof typeof REQUIRED_INPUT_REGISTRY_REQUIREMENT_IDS,
  keyof RequiredInputRegistrySnapshot,
][] = [
  ["product", "productIds"],
  ["userStory", "userStoryIds"],
  ["route", "routeIds"],
  ["action", "actionIds"],
  ["form", "formIds"],
  ["field", "fieldSchemas"],
  ["designLab", "designLabRoutes"],
];

for (const [registry, snapshotField] of missingRegistryCases) {
  const withoutRegistry = {
    ...REQUIRED_INPUT_REGISTRY_SNAPSHOT,
    [snapshotField]: [],
  };
  const requirementId = REQUIRED_INPUT_REGISTRY_REQUIREMENT_IDS[registry];
  assert.equal(
    evaluateRequiredInputRegistrySnapshot(withoutRegistry)[registry],
    false,
    `${requirementId} must fail when its registry disappears`,
  );
  assert.equal(
    buildRequiredInputRegistryMasterEvidence(withoutRegistry)[requirementId],
    undefined,
    `${requirementId} must not receive completion evidence when its registry disappears`,
  );
}

for (const area of ["route", "userStories", "actions", "forms", "designLab"] as const) {
  assert.ok(SCREEN_CONTRACT_COVERAGE_AREAS.includes(area));
  assert.equal(
    SCREEN_CONTRACT_CHECKLIST.find((item) => item.area === area)?.total,
    REQUIRED_INPUT_REGISTRY_SNAPSHOT.routeIds.length,
    `${area} must remain an input to the screen portion of the release gate`,
  );
}

const combinedIds = new Set(MASTER_AUDIT_REQUIREMENTS.map(({ id }) => id));
assert.equal(
  REQUIRED_INPUT_REGISTRY_SNAPSHOT.productIds.every((id) =>
    combinedIds.has(id),
  ),
  true,
  "the product registry must remain in the combined master gate",
);

const currentGate = evaluateDesignLabReleaseGate();
const requirementsWithoutInputEvidence: readonly MasterAuditRequirement[] =
  MASTER_AUDIT_REQUIREMENTS.map((requirement) =>
    requirementIds.includes(
      requirement.id as (typeof requirementIds)[number],
    )
      ? { ...requirement, status: "not-assessed", evidence: [] }
      : requirement,
  );
const gateWithoutInputEvidence = evaluateDesignLabReleaseGate(
  undefined,
  requirementsWithoutInputEvidence,
);

assert.equal(gateWithoutInputEvidence.totalChecks, currentGate.totalChecks);
assert.equal(
  currentGate.completedChecks - gateWithoutInputEvidence.completedChecks,
  requirementIds.length,
  "all seven required-input registry decisions must feed the combined release gate",
);
assert.equal(gateWithoutInputEvidence.status, "blocked");

console.log(
  `Required-input registry evidence passed: ${requirementIds.length} master requirements feed ${REQUIRED_INPUT_REGISTRY_SNAPSHOT.routeIds.length} screen contracts; extend-incomplete remains open`,
);
