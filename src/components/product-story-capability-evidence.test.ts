import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  DEMO_SCREEN_COUNT,
  DEMO_SCREEN_FAMILIES,
} from "./demo-experience-registry";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCT_STORY_CAPABILITY_EVIDENCE_FILE,
  PRODUCT_STORY_CAPABILITY_EVIDENCE_SCOPE,
  PRODUCT_STORY_CAPABILITY_EXPECTED_GAIN,
  PRODUCT_STORY_CAPABILITY_MASTER_EVIDENCE,
  PRODUCT_STORY_CAPABILITY_OPEN_REQUIREMENT_IDS,
  PRODUCT_STORY_CAPABILITY_PREEXISTING_REQUIREMENT_IDS,
  PRODUCT_STORY_CAPABILITY_REQUIREMENT_IDS,
  PRODUCT_STORY_CAPABILITY_SOURCE_STATIC_BINDINGS,
  PRODUCT_STORY_CAPABILITY_SOURCE_STATIC_REQUIREMENT_IDS,
  PRODUCT_STORY_CAPABILITY_TEST_FILE,
} from "./product-story-capability-evidence";
import { PRODUCTION_SCREEN_INTERACTION_CONTRACTS } from "./screen-contracts/production-screen-coverage";
import {
  DESIGN_LAB_USER_STORY_MANIFESTS,
} from "./screen-contracts/design-lab-user-stories";
import {
  DESIGN_LAB_HYDRATED_INVENTORY_COVERAGE,
  DESIGN_LAB_HYDRATED_STORY_CASES,
} from "../../scripts/audit-design-lab-hydrated-stories";

// screen-evidence-test-id: PRODUCT-STORY-CAPABILITY-EVIDENCE

const EXPECTED_PREEXISTING_IDS = [
  "STORY.CAP.view",
  "STORY.CAP.search",
  "STORY.CAP.filter",
] as const;
const EXPECTED_SOURCE_STATIC_IDS = [
  "STORY.CAP.sort",
  "STORY.CAP.create",
  "STORY.CAP.edit",
  "STORY.CAP.delete",
  "STORY.CAP.save",
  "STORY.CAP.unsave",
  "STORY.CAP.publish",
  "STORY.CAP.unpublish",
  "STORY.CAP.comment",
  "STORY.CAP.react",
  "STORY.CAP.share",
  "STORY.CAP.report",
  "STORY.CAP.block",
  "STORY.CAP.join",
  "STORY.CAP.leave",
  "STORY.CAP.invite",
  "STORY.CAP.accept",
  "STORY.CAP.decline",
  "STORY.CAP.message",
  "STORY.CAP.call",
  "STORY.CAP.upload",
  "STORY.CAP.download",
  "STORY.CAP.export",
  "STORY.CAP.subscribe",
  "STORY.CAP.cancel",
  "STORY.CAP.retry",
  "STORY.CAP.recover",
  "STORY.CAP.auth-return",
  "STORY.CAP.billing-return",
] as const;
const EXPECTED_ALL_IDS = [
  ...EXPECTED_PREEXISTING_IDS,
  ...EXPECTED_SOURCE_STATIC_IDS,
] as const;
const DEFERRED_ROUTE_AUDIT_TESTS = new Set([
  "src/components/screen-contracts/public-racing-user-stories.test.ts",
  "src/components/screen-contracts/community-user-stories.test.ts",
  "src/components/screen-contracts/marketplace-account-user-stories.test.ts",
  "src/components/screen-contracts/admin-user-stories.test.ts",
  "src/components/screen-contracts/ai-user-stories.test.ts",
]);

const EXPECTED_SHARED_ACTION_SEMANTICS = [
  {
    route: "/feed",
    actionId: "FEED.ACTION.POST.SAVE",
    requirements: [
      ["STORY.CAP.save", "saves"],
      ["STORY.CAP.unsave", "unsaves"],
    ],
  },
  {
    route: "/account/pages/[id]",
    actionId: "ACCOUNT-PAGE.ACTION.PUBLISH.TOGGLE",
    requirements: [
      ["STORY.CAP.publish", "publishes"],
      ["STORY.CAP.unpublish", "unpublishes"],
    ],
  },
  {
    route: "/feed",
    actionId: "FEED.ACTION.CALL.MANAGE",
    requirements: [
      ["STORY.CAP.join", "joins"],
      ["STORY.CAP.leave", "leaves"],
    ],
  },
  {
    route: "/feed",
    actionId: "FEED.ACTION.FRIEND.REQUEST.RESPOND",
    requirements: [
      ["STORY.CAP.accept", "accepts"],
      ["STORY.CAP.decline", "declines"],
    ],
  },
  {
    route: "/account",
    actionId: "ACCOUNT.ACTION.DATA-EXPORT.REQUEST",
    requirements: [
      ["STORY.CAP.download", "downloads"],
      ["STORY.CAP.export", "export"],
    ],
  },
] as const;

assert.deepEqual(
  PRODUCT_STORY_CAPABILITY_PREEXISTING_REQUIREMENT_IDS,
  EXPECTED_PREEXISTING_IDS,
);
assert.deepEqual(
  PRODUCT_STORY_CAPABILITY_SOURCE_STATIC_REQUIREMENT_IDS,
  EXPECTED_SOURCE_STATIC_IDS,
  "The reviewed +29 source-static batch must retain its immutable IDs and order",
);
assert.deepEqual(
  PRODUCT_STORY_CAPABILITY_SOURCE_STATIC_BINDINGS.map(
    ({ requirementId }) => requirementId,
  ),
  EXPECTED_SOURCE_STATIC_IDS,
  "Every reviewed +29 capability must have exactly one binding",
);
assert.deepEqual(PRODUCT_STORY_CAPABILITY_REQUIREMENT_IDS, EXPECTED_ALL_IDS);
assert.deepEqual(
  PRODUCT_STORY_CAPABILITY_OPEN_REQUIREMENT_IDS,
  [],
);
assert.equal(PRODUCT_STORY_CAPABILITY_EXPECTED_GAIN, 29);
assert.deepEqual(
  Object.keys(PRODUCT_STORY_CAPABILITY_MASTER_EVIDENCE),
  EXPECTED_ALL_IDS,
  "Only the three pre-existing and 29 reviewed source-static stories may receive evidence",
);

const promptCapabilityIds = PRODUCT_MASTER_REQUIREMENTS.filter((requirement) =>
  requirement.id.startsWith("STORY.CAP."),
).map((requirement) => requirement.id);
assert.equal(promptCapabilityIds.length, 32);
assert.deepEqual(
  EXPECTED_ALL_IDS.toSorted(),
  promptCapabilityIds.toSorted(),
  "The three pre-existing and +29 source-static batches must exactly cover every atomic capability",
);

for (const [requirementId, record] of Object.entries(
  PRODUCT_STORY_CAPABILITY_MASTER_EVIDENCE,
)) {
  assert.equal(record.status, "tested", `${requirementId}: unexpected status`);
  assert.equal(record.evidence[0], PRODUCT_STORY_CAPABILITY_EVIDENCE_FILE);
  assert.equal(record.evidence[1], PRODUCT_STORY_CAPABILITY_TEST_FILE);
  assert.equal(new Set(record.evidence).size, record.evidence.length);
  for (const evidencePath of record.evidence) {
    assert.equal(existsSync(evidencePath), true, `${requirementId}: ${evidencePath}`);
    assert.equal(
      DEFERRED_ROUTE_AUDIT_TESTS.has(evidencePath),
      false,
      `${requirementId}: source-fingerprint-dependent route audit stays deferred`,
    );
  }
}
for (const residual of [
  "does not execute mutations",
  "prove request-level authorization",
  "validate local runtime",
  "staging or production behavior",
  "approve production readiness",
]) {
  assert.ok(
    PRODUCT_STORY_CAPABILITY_EVIDENCE_SCOPE.includes(residual),
    `source-static scope must preserve the residual: ${residual}`,
  );
}

const interactionActionsByRoute = new Map(
  Object.entries(PRODUCTION_SCREEN_INTERACTION_CONTRACTS).map(
    ([route, contract]) => [route, contract.actions] as const,
  ),
);
const focusedTestSourceByPath = new Map<string, string>();

for (const binding of PRODUCT_STORY_CAPABILITY_SOURCE_STATIC_BINDINGS) {
  const actions = interactionActionsByRoute.get(binding.route);
  assert.ok(actions, `${binding.requirementId}: missing route ${binding.route}`);
  const action = actions.find(({ id }) => id === binding.actionId);
  assert.ok(
    action,
    `${binding.requirementId}: ${binding.route} is missing ${binding.actionId}`,
  );
  assert.ok(
    action.result.trim(),
    `${binding.requirementId}: action result must be non-empty`,
  );
  assert.ok(
    action.enforcement?.trim(),
    `${binding.requirementId}: action enforcement must be non-empty`,
  );
  for (const resultSignal of binding.resultIncludes) {
    assert.ok(
      action.result.toLowerCase().includes(resultSignal),
      `${binding.requirementId}: action result must include ${resultSignal}`,
    );
  }
  assert.deepEqual(
    action.testIds,
    [binding.testId],
    `${binding.requirementId}: action must bind to its one focused test`,
  );
  assert.equal(
    existsSync(binding.testPath),
    true,
    `${binding.requirementId}: missing focused test ${binding.testPath}`,
  );
  const focusedTestSource =
    focusedTestSourceByPath.get(binding.testPath) ??
    readFileSync(binding.testPath, "utf8");
  focusedTestSourceByPath.set(binding.testPath, focusedTestSource);
  assert.ok(
    focusedTestSource.includes(
      `screen-evidence-test-id: ${binding.testId}`,
    ),
    `${binding.requirementId}: focused test marker does not match ${binding.testId}`,
  );

  const evidenceRecord =
    PRODUCT_STORY_CAPABILITY_MASTER_EVIDENCE[binding.requirementId];
  assert.equal(evidenceRecord.status, "tested");
  assert.ok(evidenceRecord.evidence.includes(binding.testPath));
  assert.ok(
    evidenceRecord.evidence.includes(
      "src/components/screen-contracts/production-screen-coverage.ts",
    ),
  );
}

for (const sharedAction of EXPECTED_SHARED_ACTION_SEMANTICS) {
  const actions = interactionActionsByRoute.get(sharedAction.route);
  assert.ok(actions);
  const action = actions.find(({ id }) => id === sharedAction.actionId);
  assert.ok(action);
  for (const [requirementId, resultSignal] of sharedAction.requirements) {
    const binding = PRODUCT_STORY_CAPABILITY_SOURCE_STATIC_BINDINGS.find(
      (candidate) => candidate.requirementId === requirementId,
    );
    assert.ok(binding, `${requirementId}: missing shared-action binding`);
    assert.equal(binding.route, sharedAction.route);
    assert.equal(binding.actionId, sharedAction.actionId);
    const bindingResultSignals: readonly string[] = binding.resultIncludes;
    assert.ok(bindingResultSignals.includes(resultSignal));
    assert.ok(
      action.result.toLowerCase().includes(resultSignal),
      `${requirementId}: shared action must prove ${resultSignal}`,
    );
  }
}

const nonDesignLabScreens = DEMO_SCREEN_FAMILIES.filter(
  (family) => family.key !== "design-lab",
).flatMap((family) => family.screens);
assert.equal(DEMO_SCREEN_COUNT, 97);
assert.equal(nonDesignLabScreens.length, 91);
for (const screen of nonDesignLabScreens) {
  assert.ok(screen.userStory, `${screen.route} needs its inline viewing story`);
  assert.match(
    screen.userStory.acceptance.when,
    /\b(?:open|opens|render|renders)\b/i,
    `${screen.userStory.id} must perform viewing in When`,
  );
  assert.ok(
    screen.userStory.acceptance.then.trim().length >= 20,
    `${screen.userStory.id} needs an observable viewing outcome`,
  );
}

const designLabRoutes = new Set(
  DEMO_SCREEN_FAMILIES.find((family) => family.key === "design-lab")?.screens.map(
    (screen) => screen.route,
  ),
);
assert.equal(designLabRoutes.size, 6);
assert.deepEqual(
  DESIGN_LAB_USER_STORY_MANIFESTS.map((manifest) => manifest.route).toSorted(),
  [...designLabRoutes].toSorted(),
);
for (const manifest of DESIGN_LAB_USER_STORY_MANIFESTS) {
  assert.ok(
    manifest.userStories.some((story) =>
      story.acceptance.some(
        (scenario) =>
          /\b(?:open|opens|read|reads|inspect|inspects|load|loads)\b/i.test(
            scenario.when,
          ) && scenario.then.trim().length >= 20,
      ),
    ),
    `${manifest.route} needs an independently testable viewing scenario`,
  );
}

const workspaceManifest = DESIGN_LAB_USER_STORY_MANIFESTS.find(
  (manifest) => manifest.route === "/design-lab",
);
assert.ok(workspaceManifest);
const workspaceStory = workspaceManifest.userStories.find(
  (story) => story.id === "DL.STORY.CONTRACT-WORKSPACE",
);
assert.ok(workspaceStory);

const filterScenario = workspaceStory.acceptance.find((scenario) =>
  scenario.when.includes("filter by family"),
);
assert.deepEqual(filterScenario, {
  given:
    "The reviewer has Design Lab access in an approved local or preview environment.",
  when:
    "They open /design-lab, choose the shareable Screen library module, and filter by family.",
  then:
    "Only matching registered routes remain, each route retains its contract status and evidence summary, and the canonical gate stays visible in the mission-control ribbon.",
});

const searchScenario = workspaceStory.acceptance.find((scenario) =>
  scenario.when.includes("enters search text"),
);
assert.deepEqual(searchScenario, {
  given:
    "The Screen library contains registered routes whose route or user-story text may match the reviewer's query.",
  when:
    "The reviewer enters search text in the Screen library search control.",
  then:
    "Only matching registered routes remain; a query with no matches renders the zero-result count, and the canonical gate remains visible.",
});
assert.notEqual(filterScenario, searchScenario);

const hydratedWorkspaceCase = DESIGN_LAB_HYDRATED_STORY_CASES.find(
  (storyCase) => storyCase.id === "DL.STORY.CONTRACT-WORKSPACE.HYDRATED",
);
assert.ok(hydratedWorkspaceCase);
assert.equal(hydratedWorkspaceCase.mode, "workspace-filter");
const hydratedObserved = hydratedWorkspaceCase.expectedObserved;
assert.ok(isRecord(hydratedObserved));
assert.deepEqual(hydratedObserved.familyFiltered, {
  query: "",
  family: "racing",
  routeCount: 10,
  familyKeys: ["racing"],
});
assert.deepEqual(hydratedObserved.searchFiltered, {
  query: "/dogs/[id]",
  family: "all",
  routeCount: 1,
  familyKeys: ["racing"],
  routeHrefs: ["/dogs/cmr0fg5ki00a4ephcaj4sdctc"],
});
const emptyObserved = hydratedObserved.empty;
assert.ok(isRecord(emptyObserved));
assert.equal(emptyObserved.routeCount, 0);
assert.equal(emptyObserved.familyCount, 0);
assert.ok(typeof emptyObserved.status === "string");
assert.match(emptyObserved.status, /^Showing 0 of \d+ registered screens\.$/);
assert.equal(hydratedObserved.ribbonVisible, true);

const hydratedCoverage = DESIGN_LAB_HYDRATED_INVENTORY_COVERAGE.find(
  (coverage) =>
    coverage.scenarioId === "DL.STORY.CONTRACT-WORKSPACE.HYDRATED",
);
assert.ok(hydratedCoverage);
assert.deepEqual(hydratedCoverage.actionIds, [
  "DL.ACTION.SCREEN.SEARCH",
  "DL.ACTION.FAMILY.FILTER",
]);
assert.deepEqual(hydratedCoverage.stateIds, [
  "DL.STATE.SCREEN.FILTERED",
  "DL.STATE.SCREEN.EMPTY",
]);

const evidenceModuleSource = readFileSync(
  PRODUCT_STORY_CAPABILITY_EVIDENCE_FILE,
  "utf8",
);
for (const serverOnlySignal of [
  'from "node:',
  "from 'node:",
  "readFileSync",
  "process.cwd",
]) {
  assert.equal(
    evidenceModuleSource.includes(serverOnlySignal),
    false,
    `client-safe evidence module contains ${serverOnlySignal}`,
  );
}

console.log(
  "Story capability evidence passed: 97 viewing routes, independent Design Lab filter/search GWTs, and 29 exact source-static route/action/test bindings with runtime and staging residuals preserved",
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
