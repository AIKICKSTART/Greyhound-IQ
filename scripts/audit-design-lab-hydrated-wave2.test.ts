import assert from "node:assert/strict";

import { DESIGN_LAB_USER_STORY_MANIFESTS } from "../src/components/screen-contracts/design-lab-user-stories";
import {
  DESIGN_LAB_HYDRATED_WAVE2_EVIDENCE_BOUNDARY,
  DESIGN_LAB_HYDRATED_WAVE2_INVENTORY_COVERAGE,
  DESIGN_LAB_HYDRATED_WAVE2_ROUTES,
  DESIGN_LAB_HYDRATED_WAVE2_SCENARIOS,
  canonicalJsonEquals,
  findDesignLabHydratedWave2AuditIssues,
  resolveWave2TransitionPointMode,
} from "./audit-design-lab-hydrated-wave2";
import {
  DESIGN_LAB_STORY_AUDIT_PATH,
  DESIGN_LAB_STORY_RUNTIME_CASES,
} from "./audit-design-lab-user-stories";

// screen-evidence-test-id: DL-HYDRATED-WAVE2-RUNTIME

const expectedCounts = {
  "/design-lab/role-blueprints": {
    scenarios: 26,
    actions: 10,
    states: 26,
    fixtures: 26,
  },
  "/feed/device-preview": {
    scenarios: 20,
    actions: 15,
    states: 20,
    fixtures: 20,
  },
  "/marketplace/design-lab": {
    scenarios: 9,
    actions: 7,
    states: 8,
    fixtures: 8,
  },
} as const;

assert.deepEqual(
  [...DESIGN_LAB_HYDRATED_WAVE2_ROUTES],
  Object.keys(expectedCounts),
);
assert.equal(DESIGN_LAB_HYDRATED_WAVE2_SCENARIOS.length, 55);
assert.equal(DESIGN_LAB_HYDRATED_WAVE2_INVENTORY_COVERAGE.length, 55);
assert.deepEqual(
  DESIGN_LAB_HYDRATED_WAVE2_INVENTORY_COVERAGE.map(
    (coverage) => coverage.scenarioId,
  ),
  DESIGN_LAB_HYDRATED_WAVE2_SCENARIOS.map((scenario) => scenario.id),
  "Every scenario must own one typed coverage row in the same stable order",
);
assert.equal(
  new Set(DESIGN_LAB_HYDRATED_WAVE2_SCENARIOS.map((scenario) => scenario.id))
    .size,
  DESIGN_LAB_HYDRATED_WAVE2_SCENARIOS.length,
);

for (const coverage of DESIGN_LAB_HYDRATED_WAVE2_INVENTORY_COVERAGE) {
  assert.deepEqual(Object.keys(coverage).toSorted(), [
    "actionIds",
    "fixtureIds",
    "route",
    "scenarioId",
    "stateIds",
  ]);
}

for (const route of DESIGN_LAB_HYDRATED_WAVE2_ROUTES) {
  const expected = expectedCounts[route];
  const manifest = DESIGN_LAB_USER_STORY_MANIFESTS.find(
    (candidate) => candidate.route === route,
  );
  assert.ok(manifest);
  const scenarios = DESIGN_LAB_HYDRATED_WAVE2_SCENARIOS.filter(
    (scenario) => scenario.route === route,
  );
  const coverage = DESIGN_LAB_HYDRATED_WAVE2_INVENTORY_COVERAGE.filter(
    (row) => row.route === route,
  );
  assert.equal(scenarios.length, expected.scenarios);
  assertExactIds(
    coverage.flatMap((row) => row.actionIds),
    manifest.actions.map((item) => item.id),
  );
  assertExactIds(
    coverage.flatMap((row) => row.stateIds),
    manifest.states.map((item) => item.id),
  );
  assertExactIds(
    coverage.flatMap((row) => row.fixtureIds),
    manifest.designLab.map((item) => item.fixtureId),
  );
  assert.equal(manifest.actions.length, expected.actions);
  assert.equal(manifest.states.length, expected.states);
  assert.equal(manifest.designLab.length, expected.fixtures);
  assert.deepEqual(manifest.forms, []);
  assert.equal(manifest.coverage.forms.status, "excluded");
  assert.equal(manifest.coverage.permissions.status, "tested");
  assert.equal(manifest.coverage.onboarding.status, "tested");
}

const transitionScenarios = DESIGN_LAB_HYDRATED_WAVE2_SCENARIOS.filter(
  (scenario) => scenario.transition,
);
assert.equal(transitionScenarios.length, 32);
for (const scenario of transitionScenarios) {
  assert.notEqual(
    scenario.requestPath,
    scenario.transition?.destinationPath,
    `${scenario.id}: transition must start from a different URL state`,
  );
  assert.ok(
    scenario.inventoryCoverage.actionIds.length > 0,
    `${scenario.id}: every browser transition must own an action ID`,
  );
}
for (const scenario of DESIGN_LAB_HYDRATED_WAVE2_SCENARIOS.filter(
  (candidate) => !candidate.transition,
)) {
  assert.deepEqual(
    scenario.inventoryCoverage.actionIds,
    [],
    `${scenario.id}: a fixture-only load may not claim an action`,
  );
}

const marketplaceProfileScenario = DESIGN_LAB_HYDRATED_WAVE2_SCENARIOS.find(
  (scenario) => scenario.id === "DL.WAVE2.MARKETPLACE.ACTION.PROFILE",
);
assert.ok(marketplaceProfileScenario);
assert.equal(
  resolveWave2TransitionPointMode("marketplace-profile", "from"),
  "marketplace",
);
assert.equal(
  resolveWave2TransitionPointMode("marketplace-profile", "to"),
  "marketplace-profile",
);
assert.deepEqual(marketplaceProfileScenario.expectedObserved, {
  transition: {
    from: {
      currentPath: "/marketplace/design-lab?template=M1",
      template: "M1",
    },
    clickedHref: "/dogs/cmr0fg5ki00a4ephcaj4sdctc",
    to: {
      currentPath: "/dogs/cmr0fg5ki00a4ephcaj4sdctc",
      heading: "GreyhoundIQ Demo Rocket",
    },
  },
});

assert.equal(
  canonicalJsonEquals(
    { beta: 2, alpha: { nested: [{ second: 2, first: 1 }] } },
    { alpha: { nested: [{ first: 1, second: 2 }] }, beta: 2 },
  ),
  true,
);
assert.equal(canonicalJsonEquals({ value: 1 }, { value: 2 }), false);
assert.equal(canonicalJsonEquals(["first", "second"], ["second", "first"]), false);

const binding = {
  headSha: "a".repeat(40),
  sourceSha256: "b".repeat(64),
  sourceFileCount: 50,
  companionHttpAuditSha256: "c".repeat(64),
  now: Date.parse("2026-07-14T00:00:00.000Z"),
};
type MutableAudit = {
  schemaVersion: number;
  auditKind: string;
  evidenceBoundary: string;
  generatedAt: string;
  baseUrl: string;
  browser: { product: string; protocolVersion: string };
  companionHttpAudit: {
    path: string;
    auditKind: string;
    sha256: string;
    sourceSha256: string;
    expectedScenarios: number;
    passedScenarios: number;
  };
  inventoryCoverage: unknown;
  testedCommitSha: string;
  sourceSha256: string;
  sourceFileCount: number;
  expectedScenarios: number;
  passedScenarios: number;
  results: Array<{
    id: string;
    route: string;
    requestPath: string;
    httpStatus: number;
    requestIdPresent: boolean;
    requestId: string;
    demoMode: string;
    observed: unknown;
    actionGetObserved: boolean | null;
    mutatingRequests: Array<{ method: string; url: string }>;
    runtimeExceptions: string[];
    inventoryCoverage: unknown;
    passed: boolean;
    failures: string[];
  }>;
};

const validAudit: MutableAudit = {
  schemaVersion: 1,
  auditKind: "design-lab-hydrated-wave2",
  evidenceBoundary: DESIGN_LAB_HYDRATED_WAVE2_EVIDENCE_BOUNDARY,
  generatedAt: "2026-07-14T00:00:00.000Z",
  baseUrl: "http://localhost:3000",
  browser: { product: "Chrome/138.0", protocolVersion: "1.3" },
  companionHttpAudit: {
    path: DESIGN_LAB_STORY_AUDIT_PATH,
    auditKind: "design-lab-user-stories",
    sha256: binding.companionHttpAuditSha256,
    sourceSha256: binding.sourceSha256,
    expectedScenarios: DESIGN_LAB_STORY_RUNTIME_CASES.length,
    passedScenarios: DESIGN_LAB_STORY_RUNTIME_CASES.length,
  },
  inventoryCoverage: DESIGN_LAB_HYDRATED_WAVE2_INVENTORY_COVERAGE,
  testedCommitSha: binding.headSha,
  sourceSha256: binding.sourceSha256,
  sourceFileCount: binding.sourceFileCount,
  expectedScenarios: DESIGN_LAB_HYDRATED_WAVE2_SCENARIOS.length,
  passedScenarios: DESIGN_LAB_HYDRATED_WAVE2_SCENARIOS.length,
  results: DESIGN_LAB_HYDRATED_WAVE2_SCENARIOS.map((scenario) => ({
    id: scenario.id,
    route: scenario.route,
    requestPath: scenario.requestPath,
    httpStatus: 200,
    requestIdPresent: true,
    requestId: "12345678-abcd-4abc-8abc-1234567890ab",
    demoMode: "full-access-read-only",
    observed: scenario.expectedObserved,
    actionGetObserved: scenario.transition ? true : null,
    mutatingRequests: [],
    runtimeExceptions: [],
    inventoryCoverage: scenario.inventoryCoverage,
    passed: true,
    failures: [],
  })),
};

assert.deepEqual(findDesignLabHydratedWave2AuditIssues(validAudit, binding), []);
const staleMarketplaceProfileAudit = structuredClone(validAudit);
staleMarketplaceProfileAudit.results.find(
  (result) => result.id === marketplaceProfileScenario.id,
)!.observed = {
  transition: {
    from: {
      currentPath: marketplaceProfileScenario.requestPath,
      heading: "M1–M6 page-template catalogue",
    },
    clickedHref: marketplaceProfileScenario.transition?.destinationPath,
    to: {
      currentPath: marketplaceProfileScenario.transition?.destinationPath,
      heading: "GreyhoundIQ Demo Rocket",
    },
  },
};
assert.ok(
  findDesignLabHydratedWave2AuditIssues(
    staleMarketplaceProfileAudit,
    binding,
  ).includes(
    `Wave 2 scenario ${marketplaceProfileScenario.id} must have one exact passing row.`,
  ),
  "The validator must reject a pre-click profile heading in place of the selected Marketplace template state",
);
for (const invalidTopLevel of [
  { ...validAudit, schemaVersion: 2 },
  { ...validAudit, auditKind: "wrong" },
  { ...validAudit, evidenceBoundary: "production proven" },
  { ...validAudit, baseUrl: "https://greyhoundsiq.com" },
  { ...validAudit, browser: { product: "not-chrome", protocolVersion: "1.3" } },
  { ...validAudit, inventoryCoverage: [] },
  { ...validAudit, testedCommitSha: "d".repeat(40) },
  { ...validAudit, sourceSha256: "d".repeat(64) },
  { ...validAudit, sourceFileCount: 51 },
  { ...validAudit, generatedAt: "not-a-date" },
  { ...validAudit, generatedAt: "2026-07-12T23:59:59.000Z" },
  { ...validAudit, generatedAt: "2026-07-14T00:06:00.000Z" },
]) {
  assert.ok(findDesignLabHydratedWave2AuditIssues(invalidTopLevel, binding).length > 0);
}

for (const mutate of [
  (audit: MutableAudit) => audit.results.splice(0, 1),
  (audit: MutableAudit) => {
    audit.results[0].observed = { wrong: true };
  },
  (audit: MutableAudit) => {
    audit.results.find((result) => result.actionGetObserved === true)!.actionGetObserved = false;
  },
  (audit: MutableAudit) => {
    audit.results[0].mutatingRequests = [
      { method: "POST", url: "http://localhost:3000/api/unsafe" },
    ];
  },
  (audit: MutableAudit) => {
    audit.results[0].runtimeExceptions = ["failure"];
  },
  (audit: MutableAudit) => {
    audit.results[0].inventoryCoverage = null;
  },
  (audit: MutableAudit) => {
    audit.results[0].passed = false;
  },
  (audit: MutableAudit) => {
    audit.passedScenarios -= 1;
  },
]) {
  const invalid = structuredClone(validAudit);
  mutate(invalid);
  assert.ok(findDesignLabHydratedWave2AuditIssues(invalid, binding).length > 0);
}

console.log("Design Lab hydrated wave 2 contract passed");

function assertExactIds(actual: readonly string[], expected: readonly string[]) {
  assert.equal(new Set(actual).size, actual.length);
  assert.deepEqual([...actual].toSorted(), [...expected].toSorted());
}
