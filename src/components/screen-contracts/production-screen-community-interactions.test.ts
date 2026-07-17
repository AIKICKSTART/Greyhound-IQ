import assert from "node:assert/strict";

import { SCREEN_CONTRACT_BY_ROUTE } from "../demo-experience-registry";
import {
  PRODUCTION_SCREEN_COMMUNITY_INTERACTION_EVIDENCE_TEST,
  PRODUCTION_SCREEN_COMMUNITY_INTERACTION_ROUTES,
  PRODUCTION_SCREEN_FORM_EXCLUSION_ROUTES,
  PRODUCTION_SCREEN_INTERACTION_CONTRACTS,
  PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS,
} from "./production-screen-coverage";
import {
  findFormSubmissionSignals,
  findUserActionSignals,
  getLocalSourceClosure,
} from "./screen-contract-source-audit";

// screen-evidence-test-id: PRODUCTION-SCREEN-COMMUNITY-INTERACTIONS

const EXPECTED = {
  "/feed": { query: ["mode"], actions: 23, forms: 10, implementation: "src/app/feed/page.tsx" },
  "/groups": { query: [], actions: 4, forms: 0, implementation: "src/app/forum/page.tsx" },
  "/groups/[slug]": { query: [], actions: 4, forms: 1, implementation: "src/app/forum/[slug]/page.tsx" },
  "/groups/threads/[id]": { query: [], actions: 3, forms: 1, implementation: "src/app/forum/threads/[id]/page.tsx" },
  "/pulse": { query: [], actions: 5, forms: 1, implementation: "src/app/messages/page.tsx" },
  "/pulse/[id]": { query: ["before", "call", "q"], actions: 15, forms: 8, implementation: "src/app/messages/[id]/page.tsx" },
  "/pulse/friends": { query: [], actions: 3, forms: 0, implementation: "src/app/messages/friends/page.tsx" },
} as const;

const testId = PRODUCTION_SCREEN_COMMUNITY_INTERACTION_EVIDENCE_TEST.id;
const testPath = PRODUCTION_SCREEN_COMMUNITY_INTERACTION_EVIDENCE_TEST.path;
const formExclusions = new Set<string>(PRODUCTION_SCREEN_FORM_EXCLUSION_ROUTES);
const onboardingExclusions = new Set(
  Object.keys(PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS),
);

assert.deepEqual(PRODUCTION_SCREEN_COMMUNITY_INTERACTION_ROUTES, Object.keys(EXPECTED));
assert.deepEqual(
  Object.keys(PRODUCTION_SCREEN_INTERACTION_CONTRACTS).filter(
    (route) => route === "/feed" || route.startsWith("/groups") || route.startsWith("/pulse"),
  ),
  PRODUCTION_SCREEN_COMMUNITY_INTERACTION_ROUTES,
  "no unreviewed canonical community route may inherit interaction completion",
);

const actionIds: string[] = [];
const formIds: string[] = [];

for (const route of PRODUCTION_SCREEN_COMMUNITY_INTERACTION_ROUTES) {
  const expected = EXPECTED[route];
  const interaction = PRODUCTION_SCREEN_INTERACTION_CONTRACTS[route];
  const screen = SCREEN_CONTRACT_BY_ROUTE.get(route);
  assert.ok(screen, `${route}: missing screen contract`);
  assert.equal(screen.productionEnabled, true);
  assert.equal(screen.coverage.onboarding.status, "tested");
  assert.equal(onboardingExclusions.has(route), false);
  assert.deepEqual(interaction.queryParameters, expected.query);
  assert.equal(interaction.actions.length, expected.actions);
  assert.equal(interaction.forms.length, expected.forms);
  assert.deepEqual(screen.queryParameters, [...expected.query]);
  assert.deepEqual(
    screen.primaryActions,
    interaction.actions.map(({ id }) => id),
  );
  assert.deepEqual(
    screen.forms,
    interaction.forms.map(({ id, submitsTo }) => `${id} -> ${submitsTo}`),
  );
  assert.equal(screen.coverage.actions.status, "verified");
  assert.equal(
    screen.coverage.forms.status,
    expected.forms === 0 ? "excluded" : "verified",
  );
  assert.ok(screen.coverage.actions.evidence.includes(testPath));
  assert.ok(screen.coverage.forms.evidence.includes(testPath));
  assert.equal(formExclusions.has(route), expected.forms === 0);

  const closure = getLocalSourceClosure(screen.sourceFiles[0]);
  assert.ok(closure.has(expected.implementation), `${route}: implementation left source closure`);
  assert.ok([...closure].flatMap(findUserActionSignals).length > 0);
  const formSignals = [...closure].flatMap(findFormSubmissionSignals);
  assert.equal(formSignals.length === 0, expected.forms === 0);

  for (const action of interaction.actions) {
    assert.match(action.id, /^(?:FEED|GROUPS?|GROUP-THREAD|PULSE(?:-THREAD|-FRIENDS)?)\.ACTION\./);
    assert.ok(action.result.trim());
    assert.ok(action.enforcement?.trim());
    assert.deepEqual(action.testIds, [testId]);
    actionIds.push(action.id);
  }
  for (const form of interaction.forms) {
    assert.match(form.submitsTo, /^(?:GET|POST|PATCH) \/|^SERVER ACTION |^CLIENT STATE /);
    assert.ok(form.schema?.trim());
    assert.deepEqual(form.testIds, [testId]);
    formIds.push(form.id);
  }
}

assert.equal(new Set(actionIds).size, actionIds.length);
assert.equal(new Set(formIds).size, formIds.length);
assert.equal(actionIds.length, 57);
assert.equal(formIds.length, 21);

console.log(
  "Community interaction coverage passed: 7 canonical action routes, 5 verified form routes, 2 form exclusions, 57 production actions, 21 production forms, onboarding unchanged",
);
