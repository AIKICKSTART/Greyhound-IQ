import assert from "node:assert/strict";

import {
  DESIGN_LAB_HYDRATED_INVENTORY_TESTED_ROUTES,
  DESIGN_LAB_USER_STORY_MANIFESTS,
} from "../src/components/screen-contracts/design-lab-user-stories";
import {
  DESIGN_LAB_COMBINED_ACCEPTANCE_COVERAGE,
  DESIGN_LAB_HYDRATED_EVIDENCE_BOUNDARY,
  DESIGN_LAB_HYDRATED_INVENTORY_COVERAGE,
  DESIGN_LAB_HYDRATED_STORY_CASES,
  canonicalJsonEquals,
  findDesignLabHydratedStoryAuditIssues,
} from "./audit-design-lab-hydrated-stories";
import {
  DESIGN_LAB_STORY_AUDIT_PATH,
  DESIGN_LAB_STORY_RUNTIME_CASES,
} from "./audit-design-lab-user-stories";
import { DESIGN_LAB_HYDRATED_WAVE2_ROUTES } from "./audit-design-lab-hydrated-wave2";

// screen-evidence-test-id: DL-HYDRATED-STORY-RUNTIME

const expectedAcceptanceIds = DESIGN_LAB_USER_STORY_MANIFESTS.slice(0, 3)
  .flatMap((manifest) =>
    manifest.userStories.flatMap((story) =>
      story.acceptance.map((_, index) => `${story.id}.${index + 1}`),
    ),
  )
  .toSorted();
assert.deepEqual(
  DESIGN_LAB_COMBINED_ACCEPTANCE_COVERAGE.map((item) => item.acceptanceId).toSorted(),
  expectedAcceptanceIds,
);
const httpScenarioIds = new Set(DESIGN_LAB_STORY_RUNTIME_CASES.map((item) => item.id));
const hydratedScenarioIds = new Set(DESIGN_LAB_HYDRATED_STORY_CASES.map((item) => item.id));
for (const coverage of DESIGN_LAB_COMBINED_ACCEPTANCE_COVERAGE) {
  assert.ok(coverage.httpScenarioIds.length + coverage.hydratedScenarioIds.length > 0);
  assert.ok(coverage.httpScenarioIds.every((id) => httpScenarioIds.has(id)));
  assert.ok(coverage.hydratedScenarioIds.every((id) => hydratedScenarioIds.has(id)));
}

const inventoryScenarioIds = DESIGN_LAB_HYDRATED_INVENTORY_COVERAGE.map(
  (coverage) => coverage.scenarioId,
);
assert.deepEqual(
  inventoryScenarioIds.toSorted(),
  DESIGN_LAB_HYDRATED_STORY_CASES.map((storyCase) => storyCase.id).toSorted(),
  "Every hydrated scenario must own one exact inventory-coverage row",
);
assert.equal(new Set(inventoryScenarioIds).size, inventoryScenarioIds.length);
const wave1TestedRoutes = [
  ...new Set(DESIGN_LAB_HYDRATED_INVENTORY_COVERAGE.map((row) => row.route)),
];
assert.deepEqual(
  wave1TestedRoutes.toSorted(),
  DESIGN_LAB_USER_STORY_MANIFESTS.slice(0, 3)
    .map((manifest) => manifest.route)
    .toSorted(),
  "Wave 1 must retain exact runtime inventory coverage for its three routes",
);
assert.deepEqual(
  [...new Set([...wave1TestedRoutes, ...DESIGN_LAB_HYDRATED_WAVE2_ROUTES])].toSorted(),
  [...DESIGN_LAB_HYDRATED_INVENTORY_TESTED_ROUTES].toSorted(),
  "Only routes with exact Wave 1 or Wave 2 runtime inventory coverage may be promoted",
);

for (const manifest of DESIGN_LAB_USER_STORY_MANIFESTS.slice(0, 3)) {
  const rows = DESIGN_LAB_HYDRATED_INVENTORY_COVERAGE.filter(
    (coverage) => coverage.route === manifest.route,
  );
  assertExactInventory(
    manifest.route,
    "action",
    rows.flatMap((row) => row.actionIds),
    manifest.actions.map((action) => action.id),
  );
  assertExactInventory(
    manifest.route,
    "state",
    rows.flatMap((row) => row.stateIds),
    manifest.states.map((state) => state.id),
  );
  assertExactInventory(
    manifest.route,
    "fixture",
    rows.flatMap((row) => row.fixtureIds),
    manifest.designLab.map((fixture) => fixture.fixtureId),
  );
}
for (const manifest of DESIGN_LAB_USER_STORY_MANIFESTS) {
  const expectedStatus = DESIGN_LAB_HYDRATED_INVENTORY_TESTED_ROUTES.some(
    (route) => route === manifest.route,
  )
    ? "tested"
    : "captured";
  assert.equal(manifest.coverage.actions.status, expectedStatus);
  assert.equal(manifest.coverage.states.status, expectedStatus);
  assert.equal(manifest.coverage.designLab.status, expectedStatus);
  assert.equal(manifest.coverage.permissions.status, "tested");
  assert.equal(manifest.coverage.onboarding.status, "tested");
}

const binding = {
  headSha: "a".repeat(40),
  sourceSha256: "b".repeat(64),
  sourceFileCount: 10,
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
  acceptanceCoverage: unknown;
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
    mutatingRequests: Array<{ method: string; url: string }>;
    popupPaths: string[];
    inventoryCoverage: unknown;
    passed: boolean;
    failures: string[];
  }>;
};

const validAudit: MutableAudit = {
  schemaVersion: 1,
  auditKind: "design-lab-hydrated-user-stories",
  evidenceBoundary: DESIGN_LAB_HYDRATED_EVIDENCE_BOUNDARY,
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
  acceptanceCoverage: DESIGN_LAB_COMBINED_ACCEPTANCE_COVERAGE,
  inventoryCoverage: DESIGN_LAB_HYDRATED_INVENTORY_COVERAGE,
  testedCommitSha: binding.headSha,
  sourceSha256: binding.sourceSha256,
  sourceFileCount: binding.sourceFileCount,
  expectedScenarios: DESIGN_LAB_HYDRATED_STORY_CASES.length,
  passedScenarios: DESIGN_LAB_HYDRATED_STORY_CASES.length,
  results: DESIGN_LAB_HYDRATED_STORY_CASES.map((storyCase) => {
    const inventoryCoverage = DESIGN_LAB_HYDRATED_INVENTORY_COVERAGE.find(
      (coverage) => coverage.scenarioId === storyCase.id,
    );
    assert.ok(inventoryCoverage);
    return {
      id: storyCase.id,
      route: storyCase.route,
      requestPath: storyCase.requestPath,
      httpStatus: 200,
      requestIdPresent: true,
      requestId: "12345678-abcd-4abc-8abc-1234567890ab",
      demoMode: "full-access-read-only",
      observed: storyCase.expectedObserved,
      mutatingRequests: [],
      popupPaths: [...(storyCase.expectedPopupPaths ?? [])],
      inventoryCoverage,
      passed: true,
      failures: [],
    };
  }),
};

assert.deepEqual(findDesignLabHydratedStoryAuditIssues(validAudit, binding), []);
assert.equal(
  canonicalJsonEquals(
    { beta: 2, alpha: { delta: 4, gamma: [{ two: 2, one: 1 }] } },
    { alpha: { gamma: [{ one: 1, two: 2 }], delta: 4 }, beta: 2 },
  ),
  true,
  "Object key order must not change structural evidence equality",
);
assert.equal(
  canonicalJsonEquals({ alpha: 1 }, { alpha: 2 }),
  false,
  "Changed values must fail structural evidence equality",
);
assert.equal(
  canonicalJsonEquals({ alpha: ["first", "second"] }, { alpha: ["second", "first"] }),
  false,
  "Array order must remain significant in structural evidence equality",
);
for (const invalidTopLevel of [
  { ...validAudit, schemaVersion: 999 },
  { ...validAudit, auditKind: "wrong-audit" },
  { ...validAudit, evidenceBoundary: "deployed image proven" },
  { ...validAudit, baseUrl: "https://greyhoundsiq.com" },
  { ...validAudit, baseUrl: "http://localhost:3000/design-lab" },
  { ...validAudit, browser: { product: "not-chrome", protocolVersion: "1.3" } },
  { ...validAudit, companionHttpAudit: { ...validAudit.companionHttpAudit, sha256: "d".repeat(64) } },
  { ...validAudit, acceptanceCoverage: [] },
  { ...validAudit, inventoryCoverage: [] },
  { ...validAudit, testedCommitSha: "c".repeat(40) },
  { ...validAudit, sourceSha256: "d".repeat(64) },
  { ...validAudit, sourceFileCount: 11 },
  { ...validAudit, generatedAt: "not-a-date" },
  { ...validAudit, generatedAt: "2026-07-12T23:59:59.000Z" },
  { ...validAudit, generatedAt: "2026-07-14T00:06:00.000Z" },
]) {
  assert.ok(findDesignLabHydratedStoryAuditIssues(invalidTopLevel, binding).length > 0);
}

const unexpected = structuredClone(validAudit);
unexpected.results.push({ ...unexpected.results[0], id: "DL.STORY.UNEXPECTED.HYDRATED" });
assert.ok(
  findDesignLabHydratedStoryAuditIssues(unexpected, binding).some((issue) =>
    issue.includes("scenario rows"),
  ),
);
const nonObjectExtra = structuredClone(validAudit) as MutableAudit & { results: unknown[] };
nonObjectExtra.results.push("unexpected");
assert.ok(
  findDesignLabHydratedStoryAuditIssues(nonObjectExtra, binding).some((issue) =>
    issue.includes("scenario rows"),
  ),
);

for (const mutate of [
  (audit: MutableAudit) => { audit.results.splice(1, 1); },
  (audit: MutableAudit) => { audit.results[0].id = audit.results[1].id; },
  (audit: MutableAudit) => { audit.results[0].route = "/wrong"; },
  (audit: MutableAudit) => { audit.results[0].requestPath = "/wrong"; },
  (audit: MutableAudit) => { audit.results[0].httpStatus = 500; },
  (audit: MutableAudit) => { audit.results[0].requestIdPresent = false; },
  (audit: MutableAudit) => { audit.results[0].requestId = ""; },
  (audit: MutableAudit) => { audit.results[0].demoMode = "off"; },
  (audit: MutableAudit) => { audit.results[0].observed = { wrong: true }; },
  (audit: MutableAudit) => {
    audit.results[0].mutatingRequests = [{ method: "POST", url: "http://localhost:3000/api" }];
  },
  (audit: MutableAudit) => { audit.results[0].popupPaths = ["/unexpected"]; },
  (audit: MutableAudit) => { audit.results[0].inventoryCoverage = null; },
  (audit: MutableAudit) => { audit.results[0].passed = false; },
  (audit: MutableAudit) => { audit.results[0].failures = ["failure"]; },
  (audit: MutableAudit) => { audit.passedScenarios -= 1; },
]) {
  const invalid = structuredClone(validAudit);
  mutate(invalid);
  assert.ok(findDesignLabHydratedStoryAuditIssues(invalid, binding).length > 0);
}

console.log("Design Lab hydrated user-story audit contract passed");

function assertExactInventory(
  route: string,
  area: string,
  coveredIds: readonly string[],
  manifestIds: readonly string[],
) {
  assert.equal(
    new Set(coveredIds).size,
    coveredIds.length,
    `${route}/${area}: a runtime scenario may cover each ID only once`,
  );
  assert.deepEqual(
    [...coveredIds].toSorted(),
    [...manifestIds].toSorted(),
    `${route}/${area}: runtime coverage must exactly equal the manifest inventory`,
  );
}
