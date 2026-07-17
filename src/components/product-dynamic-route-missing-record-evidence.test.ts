import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { SCREEN_CONTRACTS } from "./demo-experience-registry";
import {
  PRODUCT_DYNAMIC_ROUTE_MISSING_RECORD_EVIDENCE_FILE,
  PRODUCT_DYNAMIC_ROUTE_MISSING_RECORD_EXPECTED_GAIN,
  PRODUCT_DYNAMIC_ROUTE_MISSING_RECORD_MASTER_EVIDENCE,
  PRODUCT_DYNAMIC_ROUTE_MISSING_RECORD_REQUIREMENT_IDS,
  PRODUCT_DYNAMIC_ROUTE_MISSING_RECORD_SCOPE,
  PRODUCT_DYNAMIC_ROUTE_MISSING_RECORD_TEST_FILE,
} from "./product-dynamic-route-missing-record-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import { PRODUCTION_SCREEN_MEMBER_STATE_CONTRACTS } from "./screen-contracts/production-screen-member-access-state-evidence";
import { PRODUCTION_SCREEN_MESSAGING_STATE_CONTRACTS } from "./screen-contracts/production-screen-messaging-access-state-evidence";
import { PRODUCTION_SCREEN_STATE_CONTRACTS } from "./screen-contracts/screen-state-evidence";

// screen-evidence-test-id: PRODUCT-DYNAMIC-ROUTE-MISSING-RECORD-EVIDENCE

const EXPECTED_DYNAMIC_ROUTES = [
  "/account/pages/[id]",
  "/account/support/[id]",
  "/dogs/[id]",
  "/forum/[slug]",
  "/forum/threads/[id]",
  "/groups/[slug]",
  "/groups/threads/[id]",
  "/listings/[id]",
  "/listings/[id]/edit",
  "/marketplace/[id]",
  "/marketplace/[id]/edit",
  "/meetings/[id]",
  "/messages/[id]",
  "/p/[handle]",
  "/pulse/[id]",
  "/races/[id]",
  "/tracks/[id]",
] as const;
const PRIVATE_INACCESSIBLE_ROUTES = new Set([
  "/messages/[id]",
  "/pulse/[id]",
]);

assert.deepEqual(PRODUCT_DYNAMIC_ROUTE_MISSING_RECORD_REQUIREMENT_IDS, [
  "GLOBAL.FUNC.missing-record",
]);
assert.equal(PRODUCT_DYNAMIC_ROUTE_MISSING_RECORD_EXPECTED_GAIN, 1);
assert.deepEqual(
  Object.keys(PRODUCT_DYNAMIC_ROUTE_MISSING_RECORD_MASTER_EVIDENCE),
  ["GLOBAL.FUNC.missing-record"],
);

const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
  ({ id }) => id === "GLOBAL.FUNC.missing-record",
);
assert.ok(requirement);
assert.equal(requirement.requirement, "Handle missing records safely.");

const evidence =
  PRODUCT_DYNAMIC_ROUTE_MISSING_RECORD_MASTER_EVIDENCE[
    "GLOBAL.FUNC.missing-record"
  ];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_DYNAMIC_ROUTE_MISSING_RECORD_EVIDENCE_FILE,
  PRODUCT_DYNAMIC_ROUTE_MISSING_RECORD_TEST_FILE,
]);
assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
evidence.evidence.forEach((path) =>
  assert.equal(existsSync(path), true, path),
);

const evidenceSource = readFileSync(
  PRODUCT_DYNAMIC_ROUTE_MISSING_RECORD_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);
assert.match(PRODUCT_DYNAMIC_ROUTE_MISSING_RECORD_SCOPE, /all 17 registered dynamic screen routes/i);
assert.match(PRODUCT_DYNAMIC_ROUTE_MISSING_RECORD_SCOPE, /ordered source assertion reaching notFound\(\)/i);
assert.match(PRODUCT_DYNAMIC_ROUTE_MISSING_RECORD_SCOPE, /record existence is not disclosed/i);
assert.match(PRODUCT_DYNAMIC_ROUTE_MISSING_RECORD_SCOPE, /canonical registered dynamic screen inventory only/i);
assert.match(PRODUCT_DYNAMIC_ROUTE_MISSING_RECORD_SCOPE, /production readiness/i);

const dynamicScreens = SCREEN_CONTRACTS.filter(({ route }) =>
  route.includes("["),
).toSorted((left, right) => left.route.localeCompare(right.route));
assert.deepEqual(
  dynamicScreens.map(({ route }) => route),
  EXPECTED_DYNAMIC_ROUTES,
);
assert.equal(dynamicScreens.length, 17);

type SourceAssertion = {
  sourcePath: string;
  orderedText: readonly string[];
};
type StateWithSourceAssertions = {
  id: string;
  testIds: readonly string[];
  sourceAssertions: readonly SourceAssertion[];
};
type StateContract = {
  route: string;
  sourcePath: string;
  states: readonly StateWithSourceAssertions[];
};

const stateContracts = [
  ...PRODUCTION_SCREEN_STATE_CONTRACTS,
  ...PRODUCTION_SCREEN_MESSAGING_STATE_CONTRACTS,
  ...PRODUCTION_SCREEN_MEMBER_STATE_CONTRACTS,
] as readonly StateContract[];
const stateContractByRoute = new Map(
  stateContracts.map((contract) => [contract.route, contract] as const),
);
assert.equal(stateContractByRoute.size, stateContracts.length);

const safeStateIds = new Set<string>();
for (const screen of dynamicScreens) {
  assert.doesNotMatch(screen.concreteRoute, /[\[\]]/, screen.route);
  assert.equal(screen.coverage.states.status, "verified", screen.route);

  const contract = stateContractByRoute.get(screen.route);
  assert.ok(contract, `${screen.route}: missing state contract`);
  assert.equal(contract.sourcePath, screen.sourceFiles[0], screen.route);

  const expectedSuffix = PRIVATE_INACCESSIBLE_ROUTES.has(screen.route)
    ? ".INACCESSIBLE"
    : ".MISSING";
  const safeStates = contract.states.filter(({ id }) =>
    id.endsWith(expectedSuffix),
  );
  assert.equal(
    safeStates.length,
    1,
    `${screen.route}: needs one ${expectedSuffix} state`,
  );

  const [safeState] = safeStates;
  assert.equal(safeStateIds.has(safeState.id), false, safeState.id);
  safeStateIds.add(safeState.id);
  assert.ok(safeState.testIds.length > 0, safeState.id);
  assert.ok(safeState.sourceAssertions.length > 0, safeState.id);
  assert.equal(
    screen.stateRules.some(({ id }) => id === safeState.id),
    true,
    `${screen.route}: safe state missing from canonical screen contract`,
  );

  const notFoundAssertions = safeState.sourceAssertions.filter(
    ({ orderedText }) => orderedText.some((text) => text.includes("notFound()")),
  );
  assert.ok(
    notFoundAssertions.length > 0,
    `${safeState.id}: missing notFound source assertion`,
  );
  for (const sourceAssertion of safeState.sourceAssertions) {
    assert.equal(existsSync(sourceAssertion.sourcePath), true, sourceAssertion.sourcePath);
    assertOrdered(
      readFileSync(sourceAssertion.sourcePath, "utf8"),
      sourceAssertion.orderedText,
      `${safeState.id}: ${sourceAssertion.sourcePath}`,
    );
  }
}

assert.equal(safeStateIds.size, 17);
assert.equal(
  [...safeStateIds].filter((id) => id.endsWith(".MISSING")).length,
  15,
);
assert.equal(
  [...safeStateIds].filter((id) => id.endsWith(".INACCESSIBLE")).length,
  2,
);

console.log(
  "Dynamic-route missing-record evidence passed in isolation: 17/17 registered dynamic screens have source-backed notFound handling; exact +1 central wiring is ready.",
);

function assertOrdered(
  source: string,
  orderedText: readonly string[],
  label: string,
) {
  let cursor = 0;
  for (const text of orderedText) {
    const index = source.indexOf(text, cursor);
    assert.notEqual(index, -1, `${label}: missing ordered text ${text}`);
    cursor = index + text.length;
  }
}
