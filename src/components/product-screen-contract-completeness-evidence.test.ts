import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "./master-audit-requirements";
import {
  DEMO_SCREEN_FAMILIES,
  SCREEN_CONTRACT_BY_ROUTE,
  SCREEN_CONTRACTS,
} from "./demo-experience-registry";
import { PRODUCT_MASTER_EVIDENCE } from "./master-audit-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCT_SCREEN_CONTRACT_COMPLETENESS_EVIDENCE_FILE,
  PRODUCT_SCREEN_CONTRACT_COMPLETENESS_EXPECTED_GAIN,
  PRODUCT_SCREEN_CONTRACT_COMPLETENESS_MASTER_EVIDENCE,
  PRODUCT_SCREEN_CONTRACT_COMPLETENESS_REQUIREMENT_IDS,
  PRODUCT_SCREEN_CONTRACT_COMPLETENESS_SCOPE,
  PRODUCT_SCREEN_CONTRACT_COMPLETENESS_TEST_FILE,
} from "./product-screen-contract-completeness-evidence";
import { PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_CONTRACTS } from "./screen-contracts/production-screen-admin-access-state-evidence";
import { PRODUCTION_SCREEN_MEMBER_PERMISSION_CONTRACTS } from "./screen-contracts/production-screen-member-access-state-evidence";
import { PRODUCTION_SCREEN_MESSAGING_PERMISSION_CONTRACTS } from "./screen-contracts/production-screen-messaging-access-state-evidence";
import {
  DESIGN_LAB_SCREEN_PERMISSION_CONTRACTS,
  PUBLIC_SCREEN_PERMISSION_CONTRACTS,
} from "./screen-contracts/screen-permission-evidence";

const completedIds = [
  ...PRODUCT_SCREEN_CONTRACT_COMPLETENESS_REQUIREMENT_IDS,
];

assert.equal(completedIds.length, 3);
assert.equal(new Set(completedIds).size, completedIds.length);
assert.equal(PRODUCT_SCREEN_CONTRACT_COMPLETENESS_EXPECTED_GAIN, 3);
assert.deepEqual(
  Object.keys(PRODUCT_SCREEN_CONTRACT_COMPLETENESS_MASTER_EVIDENCE),
  completedIds,
);

const productRequirementIds = new Set(
  PRODUCT_MASTER_REQUIREMENTS.map(({ id }) => id),
);
for (const requirementId of completedIds) {
  assert.equal(productRequirementIds.has(requirementId), true, requirementId);
  const evidence =
    PRODUCT_SCREEN_CONTRACT_COMPLETENESS_MASTER_EVIDENCE[requirementId];
  assert.equal(evidence.status, "tested", requirementId);
  assert.deepEqual(
    evidence.evidence.slice(0, 2),
    [
      PRODUCT_SCREEN_CONTRACT_COMPLETENESS_EVIDENCE_FILE,
      PRODUCT_SCREEN_CONTRACT_COMPLETENESS_TEST_FILE,
    ],
    requirementId,
  );
  assert.equal(
    new Set(evidence.evidence).size,
    evidence.evidence.length,
    `${requirementId} contains duplicate evidence paths`,
  );
  assert.equal(
    evidence.evidence.some((evidencePath) => evidencePath.startsWith("output/")),
    false,
    `${requirementId} must not depend on stale browser output`,
  );
  for (const evidencePath of evidence.evidence) {
    assert.equal(existsSync(evidencePath), true, evidencePath);
  }
  assert.deepEqual(
    PRODUCT_MASTER_EVIDENCE[requirementId],
    evidence,
    `${requirementId} must be wired into the product master evidence registry`,
  );
}

const evidenceSource = readFileSync(
  PRODUCT_SCREEN_CONTRACT_COMPLETENESS_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);
assert.match(PRODUCT_SCREEN_CONTRACT_COMPLETENESS_SCOPE, /all 103 registered screens/i);
assert.match(
  PRODUCT_SCREEN_CONTRACT_COMPLETENESS_SCOPE,
  /all 90 production-enabled screens/i,
);
assert.match(
  PRODUCT_SCREEN_CONTRACT_COMPLETENESS_SCOPE,
  /screen-level permissions output and route-level default production-screen Design Lab representation only/i,
);
assert.match(
  PRODUCT_SCREEN_CONTRACT_COMPLETENESS_SCOPE,
  /does not prove deployed identity or IAM configuration/i,
);
assert.match(
  PRODUCT_SCREEN_CONTRACT_COMPLETENESS_SCOPE,
  /object- or field-level authorization/i,
);
assert.match(PRODUCT_SCREEN_CONTRACT_COMPLETENESS_SCOPE, /browser rendering/i);
assert.match(PRODUCT_SCREEN_CONTRACT_COMPLETENESS_SCOPE, /production readiness/i);

assert.equal(SCREEN_CONTRACTS.length, 103);
assert.equal(SCREEN_CONTRACT_BY_ROUTE.size, 103);
assert.equal(DEMO_SCREEN_FAMILIES.length, 8);

const declaredActorByRoute = new Map(
  DEMO_SCREEN_FAMILIES.flatMap((family) =>
    family.screens.map(
      (screen) => [
        screen.route,
        screen.userStory?.actor ?? family.audience,
      ] as const,
    ),
  ),
);
assert.equal(declaredActorByRoute.size, 103);

for (const screen of SCREEN_CONTRACTS) {
  const declaredActor = declaredActorByRoute.get(screen.route);
  assert.ok(declaredActor?.trim(), screen.route);
  assert.deepEqual(screen.actors, [declaredActor], screen.route);
  assert.ok(["public", "optional", "required"].includes(screen.authentication));
  assert.ok(screen.roles.length > 0, screen.route);
  assert.ok(screen.roles.every((role) => role.trim().length > 0), screen.route);
  assert.ok(screen.tiers.length > 0, screen.route);
  assert.ok(screen.tiers.every((tier) => tier.trim().length > 0), screen.route);
}

assert.deepEqual(
  [...new Set(SCREEN_CONTRACTS.flatMap(({ roles }) => roles))].toSorted(),
  [
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
  ],
);
assert.deepEqual(
  [...new Set(SCREEN_CONTRACTS.flatMap(({ tiers }) => tiers))].toSorted(),
  ["free", "pro", "pro_plus"],
);

const permissionContracts = [
  ...PUBLIC_SCREEN_PERMISSION_CONTRACTS,
  ...DESIGN_LAB_SCREEN_PERMISSION_CONTRACTS,
  ...PRODUCTION_SCREEN_MESSAGING_PERMISSION_CONTRACTS,
  ...PRODUCTION_SCREEN_MEMBER_PERMISSION_CONTRACTS,
  ...PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_CONTRACTS,
];
const permissionContractByRoute = new Map(
  permissionContracts.map((contract) => [contract.route, contract] as const),
);
assert.equal(permissionContracts.length, 103);
assert.equal(permissionContractByRoute.size, 103);
assert.deepEqual(
  [...permissionContractByRoute.keys()].toSorted(),
  SCREEN_CONTRACTS.map(({ route }) => route).toSorted(),
);

const permissionActors = new Set<string>();
for (const screen of SCREEN_CONTRACTS) {
  const contract = permissionContractByRoute.get(screen.route);
  assert.ok(contract, screen.route);
  assert.equal(contract.sourcePath, screen.sourceFiles[0], screen.route);
  assert.ok(contract.permissions.length > 0, screen.route);
  assert.deepEqual(screen.permissionRules, contract.permissions, screen.route);
  assert.equal(screen.coverage.permissions.status, "tested", screen.route);
  for (const permission of contract.permissions) {
    assert.ok(permission.actor.trim(), screen.route);
    assert.ok(permission.enforcedBy.trim(), screen.route);
    assert.ok(["allow", "deny"].includes(permission.decision), screen.route);
    assert.ok(permission.testIds.length > 0, screen.route);
    permissionActors.add(permission.actor);
  }
}
assert.equal(permissionActors.size, 41);

const designLabFamily = DEMO_SCREEN_FAMILIES.find(
  ({ key }) => key === "design-lab",
);
assert.ok(designLabFamily);
const designLabRoutes = new Set(
  designLabFamily.screens.map(({ route }) => route),
);
assert.equal(designLabRoutes.size, 6);

const productionScreens = SCREEN_CONTRACTS.filter(
  ({ productionEnabled }) => productionEnabled,
);
assert.equal(productionScreens.length, 96);

const fixtureIds = new Set<string>();
for (const screen of productionScreens) {
  assert.ok(
    screen.entryPoints.includes("Design Lab screen explorer"),
    screen.route,
  );
  assert.ok(screen.designLabFixtureIds.length > 0, screen.route);
  assert.deepEqual(
    screen.designLabFixtureIds,
    [`DL.DEFAULT:${screen.route}`],
    screen.route,
  );
  for (const fixtureId of screen.designLabFixtureIds) {
    assert.equal(fixtureId.trim().length > 0, true, screen.route);
    assert.equal(fixtureIds.has(fixtureId), false, `${fixtureId} is duplicated`);
    fixtureIds.add(fixtureId);
  }
}
assert.equal(
  fixtureIds.size,
  productionScreens.reduce(
    (total, screen) => total + screen.designLabFixtureIds.length,
    0,
  ),
);
assert.equal(fixtureIds.size, productionScreens.length);

const screenMapSource = readFileSync(
  "src/components/demo-experience-screen-map.tsx",
  "utf8",
);
assert.match(screenMapSource, /DEMO_SCREEN_FAMILIES\.map\(\(family\)/);
assert.match(screenMapSource, /family\.screens\.map\(\(screen\)/);
assert.match(screenMapSource, /SCREEN_CONTRACT_BY_ROUTE\.get\(/);
assert.match(screenMapSource, /href=\{href\}/);

const permissionDocument = readFileSync(
  "docs/product/permissions-matrix.md",
  "utf8",
);
assert.match(
  permissionDocument,
  /Status: 97 screen-level route permission cells source\/policy tested; deployed enforcement incomplete/,
);
assert.match(permissionDocument, /all 103 registered screen cells/i);
assert.match(permissionDocument, /Twenty account\/AI and seller-management routes/);
assert.match(permissionDocument, /33 public or optionally authenticated routes/i);
assert.match(permissionDocument, /All ten screen cells map the shared signed-out view decision/i);
assert.doesNotMatch(permissionDocument, /All 90 registered screen cells/i);
assert.doesNotMatch(permissionDocument, /32 public or optionally authenticated routes/i);
assert.doesNotMatch(permissionDocument, /Thirteen account\/AI routes/);
assert.match(permissionDocument, /do(?:es)? not prove deployed IAM/i);
assert.match(permissionDocument, /object-(?:ownership|level)/i);

const selectedIdSet = new Set<string>(completedIds);
const currentCompleted = MASTER_AUDIT_REQUIREMENTS.filter(
  isMasterRequirementComplete,
).length;
const withoutThisBatch = MASTER_AUDIT_REQUIREMENTS.map((requirement) =>
  selectedIdSet.has(requirement.id)
    ? { ...requirement, status: "not-started", evidence: [] }
    : requirement,
).filter(isMasterRequirementComplete).length;
assert.equal(
  currentCompleted - withoutThisBatch,
  PRODUCT_SCREEN_CONTRACT_COMPLETENESS_EXPECTED_GAIN,
  "This isolated evidence batch must add exactly three completed requirements",
);

console.log(
  "Product screen-contract completeness evidence passed: 97 permission contracts and 90 production Design Lab fixtures; exact +3 gates closed.",
);
