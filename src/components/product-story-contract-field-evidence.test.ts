import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  DEMO_SCREEN_FAMILIES,
  SCREEN_CONTRACT_BY_ROUTE,
  SCREEN_CONTRACTS,
  type DemoScreenUserStory,
  type ScreenContract,
} from "./demo-experience-registry";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCT_STORY_CONTRACT_FIELD_EVIDENCE_FILE,
  PRODUCT_STORY_CONTRACT_FIELD_EXPECTED_GAIN,
  PRODUCT_STORY_CONTRACT_FIELD_MASTER_EVIDENCE,
  PRODUCT_STORY_CONTRACT_FIELD_OPEN_REQUIREMENT_IDS,
  PRODUCT_STORY_CONTRACT_FIELD_REQUIREMENT_IDS,
  PRODUCT_STORY_CONTRACT_FIELD_TEST_FILE,
} from "./product-story-contract-field-evidence";
import { DESIGN_LAB_USER_STORY_MANIFESTS } from "./screen-contracts/design-lab-user-stories";

// screen-evidence-test-id: PRODUCT-STORY-CONTRACT-FIELD-EVIDENCE

const EXPECTED_CLOSED_IDS = [
  "STORY.FIELD.actor",
  "STORY.FIELD.value",
  "STORY.FIELD.entry-points",
  "STORY.FIELD.preconditions",
  "STORY.FIELD.permissions",
  "STORY.FIELD.subscription",
  "STORY.FIELD.feature-flags",
  "STORY.FIELD.required-data",
  "STORY.FIELD.happy-path",
  "STORY.FIELD.actions",
  "STORY.FIELD.forms",
  "STORY.FIELD.navigation-result",
  "STORY.FIELD.fixtures",
  "STORY.FIELD.tests",
] as const;
const EXPECTED_OPEN_IDS = [
  "STORY.FIELD.goal",
  "STORY.FIELD.alternative-paths",
  "STORY.FIELD.failure-paths",
  "STORY.FIELD.blocked-private-paths",
  "STORY.FIELD.fields",
  "STORY.FIELD.validation",
  "STORY.FIELD.loading",
  "STORY.FIELD.empty",
  "STORY.FIELD.success",
  "STORY.FIELD.recoverable-error",
  "STORY.FIELD.analytics-audit",
  "STORY.FIELD.onboarding",
  "STORY.FIELD.accessibility",
  "STORY.FIELD.mobile",
] as const;

assert.deepEqual(PRODUCT_STORY_CONTRACT_FIELD_REQUIREMENT_IDS, EXPECTED_CLOSED_IDS);
assert.deepEqual(
  PRODUCT_STORY_CONTRACT_FIELD_OPEN_REQUIREMENT_IDS,
  EXPECTED_OPEN_IDS,
);
assert.equal(PRODUCT_STORY_CONTRACT_FIELD_EXPECTED_GAIN, 14);
assert.deepEqual(
  Object.keys(PRODUCT_STORY_CONTRACT_FIELD_MASTER_EVIDENCE),
  EXPECTED_CLOSED_IDS,
  "Only the 14 reviewed structured story fields may receive evidence",
);

const promptFieldIds = PRODUCT_MASTER_REQUIREMENTS.filter((requirement) =>
  requirement.id.startsWith("STORY.FIELD."),
).map((requirement) => requirement.id);
assert.equal(promptFieldIds.length, 28);
assert.deepEqual(
  [...EXPECTED_CLOSED_IDS, ...EXPECTED_OPEN_IDS].toSorted(),
  promptFieldIds.toSorted(),
  "The +14 batch and 14 preserved gaps must partition every story field",
);

for (const [requirementId, record] of Object.entries(
  PRODUCT_STORY_CONTRACT_FIELD_MASTER_EVIDENCE,
)) {
  assert.equal(record.status, "tested", `${requirementId}: unexpected status`);
  assert.equal(record.evidence[0], PRODUCT_STORY_CONTRACT_FIELD_EVIDENCE_FILE);
  assert.equal(record.evidence[1], PRODUCT_STORY_CONTRACT_FIELD_TEST_FILE);
  assert.equal(new Set(record.evidence).size, record.evidence.length);
  record.evidence.forEach((path) =>
    assert.equal(existsSync(path), true, `${requirementId}: ${path}`),
  );
}
EXPECTED_OPEN_IDS.forEach((requirementId) =>
  assert.equal(
    requirementId in PRODUCT_STORY_CONTRACT_FIELD_MASTER_EVIDENCE,
    false,
    `${requirementId} must remain open`,
  ),
);

const screens = DEMO_SCREEN_FAMILIES.flatMap((family) => family.screens);
const inlineScreens = DEMO_SCREEN_FAMILIES.filter(
  (family) => family.key !== "design-lab",
).flatMap((family) => family.screens);
const designLabScreens = DEMO_SCREEN_FAMILIES.find(
  (family) => family.key === "design-lab",
)?.screens;

assert.equal(screens.length, 97);
assert.equal(SCREEN_CONTRACTS.length, 97);
assert.equal(SCREEN_CONTRACT_BY_ROUTE.size, 97);
assert.equal(new Set(screens.map(({ route }) => route)).size, 97);
assert.equal(inlineScreens.length, 91);
assert.equal(designLabScreens?.length, 6);
assert.equal(inlineScreens.filter(({ userStory }) => userStory).length, 91);
assert.equal(DESIGN_LAB_USER_STORY_MANIFESTS.length, 6);
assert.deepEqual(
  DESIGN_LAB_USER_STORY_MANIFESTS.map(({ route }) => route).toSorted(),
  designLabScreens?.map(({ route }) => route).toSorted(),
);

for (const contract of SCREEN_CONTRACTS) assertRouteRecord(contract);

for (const screen of inlineScreens) {
  assert.ok(screen.userStory, `${screen.route} needs one inline story`);
  const contract = SCREEN_CONTRACT_BY_ROUTE.get(screen.route);
  assert.ok(contract, `${screen.route} needs a route record`);
  assertInlineStory(screen.route, screen.userStory, contract);
  assert.equal(contract.concreteRoute, screen.href ?? screen.route);
}

let detailedStoryCount = 0;
let detailedScenarioCount = 0;
for (const manifest of DESIGN_LAB_USER_STORY_MANIFESTS) {
  const contract = SCREEN_CONTRACT_BY_ROUTE.get(manifest.route);
  assert.ok(contract, `${manifest.route} needs a route record`);
  assert.ok(manifest.userStories.length > 0, `${manifest.route} needs a story`);

  const storyEvidence = manifest.coverage.userStories.evidence;
  assert.ok(
    storyEvidence.some(({ kind }) => kind === "source"),
    `${manifest.route} needs story source evidence`,
  );
  assert.ok(
    storyEvidence.some(({ kind }) => kind === "test"),
    `${manifest.route} needs story test evidence`,
  );
  storyEvidence.forEach(({ path }) =>
    assert.equal(existsSync(path), true, `${manifest.route}: ${path}`),
  );
  assert.ok(manifest.tests.length > 0, `${manifest.route} needs tests`);
  manifest.tests.forEach((test) => {
    assertNonEmpty(test.id, `${manifest.route} test ID`);
    assert.equal(existsSync(test.path), true, `${manifest.route}: ${test.path}`);
  });

  for (const story of manifest.userStories) {
    detailedStoryCount += 1;
    assertNonEmpty(story.actor, `${story.id} actor`);
    assertNonEmpty(story.outcome, `${story.id} value`);
    assert.ok(story.acceptance.length > 0, `${story.id} needs a happy path`);
    for (const scenario of story.acceptance) {
      detailedScenarioCount += 1;
      assertNonEmpty(scenario.given, `${story.id} Given`);
      assertNonEmpty(scenario.when, `${story.id} When`);
      assertNonEmpty(scenario.then, `${story.id} Then`);
    }
  }
}
assert.equal(detailedStoryCount, 6);
assert.equal(detailedScenarioCount, 13);

const evidenceSource = readFileSync(
  PRODUCT_STORY_CONTRACT_FIELD_EVIDENCE_FILE,
  "utf8",
);
for (const serverOnlySignal of [
  'from "node:',
  "from 'node:",
  "readFileSync",
  "process.cwd",
]) {
  assert.equal(
    evidenceSource.includes(serverOnlySignal),
    false,
    `client-safe evidence module contains ${serverOnlySignal}`,
  );
}

console.log(
  "Story contract field evidence passed: 14/28 fields across 97 route records, 91 inline stories, and 13 detailed Design Lab scenarios",
);

function assertRouteRecord(contract: ScreenContract) {
  assert.equal(SCREEN_CONTRACT_BY_ROUTE.get(contract.route), contract);
  assertNonEmpty(contract.concreteRoute, `${contract.route} concrete route`);
  assert.match(contract.concreteRoute, /^\//, `${contract.route} concrete route`);
  assert.doesNotMatch(
    contract.concreteRoute,
    /[\[\]]/,
    `${contract.route} concrete route must be navigable`,
  );
  assert.ok(
    ["public", "optional", "required"].includes(contract.authentication),
    `${contract.route} authentication`,
  );

  const stringArrays = [
    "actors",
    "roles",
    "tiers",
    "featureFlags",
    "dataDependencies",
    "entryPoints",
    "primaryActions",
    "secondaryActions",
    "forms",
    "designLabFixtureIds",
    "sourceFiles",
  ] as const;
  for (const field of stringArrays) {
    assert.equal(
      Object.hasOwn(contract, field),
      true,
      `${contract.route} must explicitly record ${field}`,
    );
    assert.ok(Array.isArray(contract[field]), `${contract.route} ${field}`);
    contract[field].forEach((value) =>
      assertNonEmpty(value, `${contract.route} ${field}`),
    );
  }
  assert.ok(contract.actors.length > 0, `${contract.route} needs an actor`);
  assert.ok(contract.entryPoints.length > 0, `${contract.route} needs an entry point`);
  assert.ok(contract.tiers.length > 0, `${contract.route} needs an explicit tier rule`);
  assert.ok(
    contract.designLabFixtureIds.length > 0,
    `${contract.route} needs a Design Lab fixture`,
  );
  assert.ok(contract.sourceFiles.length > 0, `${contract.route} needs source evidence`);
  contract.sourceFiles.forEach((path) =>
    assert.equal(existsSync(path), true, `${contract.route}: ${path}`),
  );

  assert.equal(
    Object.hasOwn(contract, "permissionRules"),
    true,
    `${contract.route} must explicitly record permissionRules`,
  );
  assert.ok(Array.isArray(contract.permissionRules));
  contract.permissionRules.forEach((rule) => {
    assertNonEmpty(rule.actor, `${contract.route} permission actor`);
    assert.ok(["allow", "deny"].includes(rule.decision));
    assertNonEmpty(rule.enforcedBy, `${contract.route} permission enforcement`);
    assert.ok(Array.isArray(rule.testIds));
    rule.testIds.forEach((testId: string) =>
      assertNonEmpty(testId, `${contract.route} permission test`),
    );
  });

  for (const area of ["userStories", "tests"] as const) {
    const evidence = contract.coverage[area].evidence;
    assert.ok(evidence.length > 0, `${contract.route} ${area} evidence`);
    evidence.forEach((path) =>
      assert.equal(existsSync(path), true, `${contract.route}: ${path}`),
    );
  }
  assert.ok(
    contract.coverage.userStories.evidence.some((path) => path.startsWith("src/")),
    `${contract.route} needs story source evidence`,
  );
  assert.ok(
    contract.coverage.userStories.evidence.some(isTestPath),
    `${contract.route} needs story test evidence`,
  );
  assert.ok(
    contract.coverage.tests.evidence.some(isTestPath),
    `${contract.route} needs route test evidence`,
  );
}

function assertInlineStory(
  route: string,
  story: DemoScreenUserStory,
  contract: ScreenContract,
) {
  assertNonEmpty(story.actor, `${story.id} actor`);
  assertNonEmpty(story.outcome, `${story.id} value`);
  assertNonEmpty(story.trigger, `${story.id} entry point`);
  assertNonEmpty(story.acceptance.given, `${story.id} Given`);
  assertNonEmpty(story.acceptance.when, `${story.id} When`);
  assertNonEmpty(story.acceptance.then, `${story.id} Then`);
  assert.ok(contract.actors.includes(story.actor), `${story.id} actor mapping`);
  assert.equal(contract.description, story.outcome, `${story.id} value mapping`);
  assert.ok(
    contract.entryPoints.includes(story.trigger),
    `${story.id} entry-point mapping`,
  );
  assert.equal(story.evidence.routeAudit.route, route);
  assert.equal(existsSync(story.evidence.source.path), true);
  assert.ok(story.evidence.source.renderAssertions.length > 0);
  story.evidence.source.renderAssertions.forEach((assertion) =>
    assertNonEmpty(assertion, `${story.id} render assertion`),
  );
  assert.equal(existsSync(story.evidence.test.path), true);
  assertNonEmpty(story.evidence.test.testId, `${story.id} test ID`);
  assert.equal(existsSync(story.evidence.routeAudit.path), true);
}

function assertNonEmpty(value: string, label: string) {
  assert.ok(value.trim().length > 0, `${label} must be non-empty`);
}

function isTestPath(path: string) {
  return path.endsWith(".test.ts") || path.endsWith(".test.tsx");
}
