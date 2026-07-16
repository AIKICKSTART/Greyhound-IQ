import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "./master-audit-requirements";
import { PRODUCT_MASTER_EVIDENCE } from "./master-audit-evidence";
import {
  PRODUCT_E2E_JOURNEY_BINDINGS,
  PRODUCT_E2E_JOURNEY_EVIDENCE_FILE,
  PRODUCT_E2E_JOURNEY_EVIDENCE_SCOPE,
  PRODUCT_E2E_JOURNEY_EVIDENCE_TEST_FILE,
  PRODUCT_E2E_JOURNEY_EXPECTED_GAIN,
  PRODUCT_E2E_JOURNEY_MASTER_EVIDENCE,
  PRODUCT_E2E_JOURNEY_OPEN_GAPS,
  PRODUCT_E2E_JOURNEY_OPEN_REQUIREMENT_IDS,
  PRODUCT_E2E_JOURNEY_REQUIREMENT_IDS,
} from "./product-e2e-journey-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCTION_SCREEN_INTERACTION_CONTRACTS,
} from "./screen-contracts/production-screen-coverage";
import { SCREEN_CONTRACT_BY_ROUTE } from "./demo-experience-registry";

const e2eRequirementIds = PRODUCT_MASTER_REQUIREMENTS.filter(
  ({ section }) => section === "verification.e2e-journeys",
).map(({ id }) => id);
const completedIds = [...PRODUCT_E2E_JOURNEY_REQUIREMENT_IDS];
const openIds = [...PRODUCT_E2E_JOURNEY_OPEN_REQUIREMENT_IDS];

assert.equal(completedIds.length, 15);
assert.equal(openIds.length, 7);
assert.equal(PRODUCT_E2E_JOURNEY_EXPECTED_GAIN, 15);
assert.equal(new Set(completedIds).size, completedIds.length);
assert.equal(new Set(openIds).size, openIds.length);
assert.deepEqual(
  [...completedIds, ...openIds].toSorted(),
  e2eRequirementIds.toSorted(),
  "the closed source-static journeys and explicit runtime gaps must partition VERIFY.E2E",
);
assert.deepEqual(
  PRODUCT_E2E_JOURNEY_BINDINGS.map(({ requirementId }) => requirementId),
  completedIds,
);
assert.deepEqual(Object.keys(PRODUCT_E2E_JOURNEY_MASTER_EVIDENCE).toSorted(), completedIds.toSorted());
assert.match(PRODUCT_E2E_JOURNEY_EVIDENCE_SCOPE, /source-static/i);
assert.match(PRODUCT_E2E_JOURNEY_EVIDENCE_SCOPE, /does not execute browser clicks or mutations/i);
assert.match(PRODUCT_E2E_JOURNEY_EVIDENCE_SCOPE, /does not.*live identity.*billing.*media.*call.*AI provider flow/i);
assert.match(PRODUCT_E2E_JOURNEY_EVIDENCE_SCOPE, /rendered mobile layout/i);

const productRequirementIds = new Set(PRODUCT_MASTER_REQUIREMENTS.map(({ id }) => id));
type InteractionContract = {
  actions: readonly { id: string }[];
  forms: readonly { id: string }[];
};
const interactionContracts =
  PRODUCTION_SCREEN_INTERACTION_CONTRACTS as unknown as Readonly<
    Record<string, InteractionContract>
  >;

for (const binding of PRODUCT_E2E_JOURNEY_BINDINGS) {
  assert.equal(productRequirementIds.has(binding.requirementId), true);
  const record = PRODUCT_E2E_JOURNEY_MASTER_EVIDENCE[binding.requirementId];
  assert.equal(record.status, "tested");
  assert.deepEqual(record.evidence.slice(0, 2), [
    PRODUCT_E2E_JOURNEY_EVIDENCE_FILE,
    PRODUCT_E2E_JOURNEY_EVIDENCE_TEST_FILE,
  ]);
  assert.equal(new Set(record.evidence).size, record.evidence.length);
  assert.deepEqual(PRODUCT_MASTER_EVIDENCE[binding.requirementId], record);

  const routeInteractions = binding.routes.map((route) => {
    const screen = SCREEN_CONTRACT_BY_ROUTE.get(route);
    assert.ok(screen, `${binding.requirementId}: missing screen ${route}`);
    assert.equal(screen.productionEnabled, true, `${binding.requirementId}: ${route}`);
    assert.equal(screen.coverage.actions.status, "verified", `${binding.requirementId}: ${route}`);
    const interaction = interactionContracts[route];
    assert.ok(interaction, `${binding.requirementId}: missing interaction ${route}`);
    return interaction;
  });
  const actionIds = new Set(
    routeInteractions.flatMap(({ actions }) => actions.map(({ id }) => id)),
  );
  const formIds = new Set(
    routeInteractions.flatMap(({ forms }) => forms.map(({ id }) => id)),
  );
  for (const actionId of binding.actionIds) {
    assert.equal(actionIds.has(actionId), true, `${binding.requirementId}: ${actionId}`);
  }
  for (const formId of binding.formIds) {
    assert.equal(formIds.has(formId), true, `${binding.requirementId}: ${formId}`);
  }
  for (const evidencePath of record.evidence) {
    assert.equal(existsSync(evidencePath), true, `${binding.requirementId}: ${evidencePath}`);
  }
}

for (const requirementId of openIds) {
  assert.equal(requirementId in PRODUCT_E2E_JOURNEY_MASTER_EVIDENCE, false, requirementId);
  assert.ok(PRODUCT_E2E_JOURNEY_OPEN_GAPS[requirementId].length > 130, requirementId);
}

const selectedIdSet = new Set<string>(completedIds);
const currentCompleted = MASTER_AUDIT_REQUIREMENTS.filter(isMasterRequirementComplete).length;
const withoutThisBatch = MASTER_AUDIT_REQUIREMENTS.map((requirement) =>
  selectedIdSet.has(requirement.id)
    ? { ...requirement, status: "not-started", evidence: [] }
    : requirement,
).filter(isMasterRequirementComplete).length;
assert.equal(currentCompleted - withoutThisBatch, PRODUCT_E2E_JOURNEY_EXPECTED_GAIN);

console.log(
  "Product E2E journey evidence passed: 15 local source-static journeys closed; 7 runtime or exhaustive-proof gaps remain open.",
);
