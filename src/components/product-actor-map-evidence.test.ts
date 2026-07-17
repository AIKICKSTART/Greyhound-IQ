import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  DEMO_SCREEN_FAMILIES,
  SCREEN_CONTRACT_BY_ROUTE,
  SCREEN_CONTRACTS,
} from "./demo-experience-registry";
import {
  PRODUCT_ACTOR_MAP_EVIDENCE_FILE,
  PRODUCT_ACTOR_MAP_EXPECTED_GAIN,
  PRODUCT_ACTOR_MAP_MASTER_EVIDENCE,
  PRODUCT_ACTOR_MAP_REQUIREMENT_IDS,
  PRODUCT_ACTOR_MAP_SCOPE,
  PRODUCT_ACTOR_MAP_SUMMARY,
  PRODUCT_ACTOR_MAP_TEST_FILE,
} from "./product-actor-map-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import { DESIGN_LAB_USER_STORY_MANIFESTS } from "./screen-contracts/design-lab-user-stories";
import { TEAM_ROLES } from "@/lib/organization-team-policy";

// screen-evidence-test-id: PRODUCT-ACTOR-MAP-EVIDENCE

assert.deepEqual(PRODUCT_ACTOR_MAP_REQUIREMENT_IDS, [
  "COMPLETE.EVIDENCE.actors-mapped",
]);
assert.equal(PRODUCT_ACTOR_MAP_EXPECTED_GAIN, 1);
assert.deepEqual(Object.keys(PRODUCT_ACTOR_MAP_MASTER_EVIDENCE), [
  "COMPLETE.EVIDENCE.actors-mapped",
]);

const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
  ({ id }) => id === "COMPLETE.EVIDENCE.actors-mapped",
);
assert.ok(requirement);
assert.equal(
  requirement.requirement,
  "Provide evidence that every supported actor was mapped.",
);

const evidence =
  PRODUCT_ACTOR_MAP_MASTER_EVIDENCE["COMPLETE.EVIDENCE.actors-mapped"];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_ACTOR_MAP_EVIDENCE_FILE,
  PRODUCT_ACTOR_MAP_TEST_FILE,
]);
assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
evidence.evidence.forEach((path) =>
  assert.equal(existsSync(path), true, path),
);

const evidenceSource = readFileSync(PRODUCT_ACTOR_MAP_EVIDENCE_FILE, "utf8");
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);
assert.match(
  PRODUCT_ACTOR_MAP_SCOPE,
  new RegExp(`all ${PRODUCT_ACTOR_MAP_SUMMARY.screenCount} canonical screen contracts`, "i"),
);
assert.match(
  PRODUCT_ACTOR_MAP_SCOPE,
  new RegExp(`${PRODUCT_ACTOR_MAP_SUMMARY.actorAssignmentCount} screen-to-actor assignments`, "i"),
);
assert.match(
  PRODUCT_ACTOR_MAP_SCOPE,
  new RegExp(`${PRODUCT_ACTOR_MAP_SUMMARY.actorValueCount} distinct descriptive actor values`, "i"),
);
assert.match(
  PRODUCT_ACTOR_MAP_SCOPE,
  new RegExp(`${PRODUCT_ACTOR_MAP_SUMMARY.roleValueCount} role identifiers`, "i"),
);
assert.match(
  PRODUCT_ACTOR_MAP_SCOPE,
  new RegExp(
    `all ${PRODUCT_ACTOR_MAP_SUMMARY.runtimeTeamAuthorityCount} runtime team authority actors`,
    "i",
  ),
);
assert.match(
  PRODUCT_ACTOR_MAP_SCOPE,
  /supported screen-actor inventory and source-static team-authority mapping only/i,
);
assert.match(PRODUCT_ACTOR_MAP_SCOPE, /does not prove live identity-provider behavior/i);
assert.match(PRODUCT_ACTOR_MAP_SCOPE, /production readiness/i);

const screens = DEMO_SCREEN_FAMILIES.flatMap((family) => family.screens);
const designLabRoutes = new Set(
  DESIGN_LAB_USER_STORY_MANIFESTS.map(({ route }) => route),
);
const inlineScreens = screens.filter(({ route }) => !designLabRoutes.has(route));

assert.equal(screens.length, PRODUCT_ACTOR_MAP_SUMMARY.screenCount);
assert.equal(SCREEN_CONTRACTS.length, PRODUCT_ACTOR_MAP_SUMMARY.screenCount);
assert.equal(SCREEN_CONTRACT_BY_ROUTE.size, PRODUCT_ACTOR_MAP_SUMMARY.screenCount);
assert.equal(
  inlineScreens.length,
  PRODUCT_ACTOR_MAP_SUMMARY.screenCount -
    PRODUCT_ACTOR_MAP_SUMMARY.designLabScreenCount,
);
assert.equal(
  DESIGN_LAB_USER_STORY_MANIFESTS.length,
  PRODUCT_ACTOR_MAP_SUMMARY.designLabScreenCount,
);

const actorValues = new Set<string>();
const roleValues = new Set<string>();
let actorAssignments = 0;

for (const contract of SCREEN_CONTRACTS) {
  assert.equal(contract.actors.length, 1, `${contract.route}: actor assignment`);
  contract.actors.forEach((actor) => {
    assertNonEmpty(actor, `${contract.route} actor`);
    actorValues.add(actor);
    actorAssignments += 1;
  });
  assert.ok(
    ["public", "optional", "required"].includes(contract.authentication),
    `${contract.route}: authentication`,
  );
  assert.ok(contract.roles.length > 0, `${contract.route}: supported roles`);
  assert.ok(contract.tiers.length > 0, `${contract.route}: supported tiers`);
  contract.roles.forEach((role) => {
    assertNonEmpty(role, `${contract.route} role`);
    roleValues.add(role);
  });
  contract.tiers.forEach((tier) =>
    assertNonEmpty(tier, `${contract.route} tier`),
  );
  assert.ok(
    contract.coverage.userStories.evidence.length > 0,
    `${contract.route}: user-story evidence`,
  );
  contract.coverage.userStories.evidence.forEach((path) =>
    assert.equal(existsSync(path), true, `${contract.route}: ${path}`),
  );
  contract.permissionRules.forEach((rule) => {
    assertNonEmpty(rule.actor, `${contract.route} permission actor`);
    assertNonEmpty(rule.enforcedBy, `${contract.route} permission enforcement`);
    assert.ok(["allow", "deny"].includes(rule.decision));
  });
}

assert.equal(actorAssignments, PRODUCT_ACTOR_MAP_SUMMARY.actorAssignmentCount);
assert.equal(actorValues.size, PRODUCT_ACTOR_MAP_SUMMARY.actorValueCount);
assert.equal(roleValues.size, PRODUCT_ACTOR_MAP_SUMMARY.roleValueCount);
assert.deepEqual([...roleValues].toSorted(), [
  "admin",
  "administrator",
  "ai-tools-user",
  "community-participant",
  "marketplace-buyer",
  "marketplace-seller",
  "member",
  "moderator",
  "owner",
  "page-manager",
  "racing-member",
  "reviewer",
  "support-operator",
  "team-member",
  "visitor",
]);

const teamContract = SCREEN_CONTRACT_BY_ROUTE.get("/account/team");
assert.ok(teamContract);
assert.deepEqual(teamContract.roles, [...TEAM_ROLES]);
assert.match(
  teamContract.actors[0] ?? "",
  /organization member, team administrator, owner, or invited account/i,
);
assert.equal(
  PRODUCT_ACTOR_MAP_SUMMARY.runtimeTeamAuthorityCount,
  TEAM_ROLES.length,
);
const teamPolicySource = readFileSync(
  "src/lib/organization-team-policy.ts",
  "utf8",
);
for (const policyFunction of [
  "resolveTeamAuthority",
  "canInviteTeamRole",
  "canRemoveTeamMember",
  "canChangeTeamMemberRole",
  "canLeaveTeam",
]) {
  assert.match(teamPolicySource, new RegExp(`function ${policyFunction}\\b`));
}

for (const screen of inlineScreens) {
  assert.ok(screen.userStory, `${screen.route}: inline user story`);
  const contract = SCREEN_CONTRACT_BY_ROUTE.get(screen.route);
  assert.ok(contract, screen.route);
  assert.deepEqual(contract.actors, [screen.userStory.actor], screen.route);
}

for (const manifest of DESIGN_LAB_USER_STORY_MANIFESTS) {
  const contract = SCREEN_CONTRACT_BY_ROUTE.get(manifest.route);
  assert.ok(contract, manifest.route);
  assert.ok(manifest.userStories.length > 0, manifest.route);
  manifest.userStories.forEach((story) => {
    assertNonEmpty(story.actor, `${story.id} actor`);
    assertNonEmpty(story.outcome, `${story.id} outcome`);
  });
  assert.ok(contract.roles.includes("reviewer"), manifest.route);
  assert.equal(contract.authentication, "optional", manifest.route);
}

console.log(
  `Actor-map evidence passed in isolation: ${PRODUCT_ACTOR_MAP_SUMMARY.actorAssignmentCount} screen assignments, ${PRODUCT_ACTOR_MAP_SUMMARY.actorValueCount} descriptive actors, ${PRODUCT_ACTOR_MAP_SUMMARY.roleValueCount} role identifiers, and ${PRODUCT_ACTOR_MAP_SUMMARY.designLabScreenCount} detailed Design Lab reviewer stories; exact +1 central wiring is ready.`,
);

function assertNonEmpty(value: string, label: string) {
  assert.ok(value.trim().length > 0, `${label} must be non-empty`);
}
