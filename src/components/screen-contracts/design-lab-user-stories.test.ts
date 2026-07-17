import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";

import {
  DEMO_SCREEN_FAMILIES,
  SCREEN_CONTRACT_BY_ROUTE,
} from "../demo-experience-registry";
import {
  DESIGN_LAB_USER_STORY_MANIFESTS,
  type DesignLabAcceptanceScenario,
} from "./design-lab-user-stories";
import {
  DESIGN_LAB_SCREEN_PERMISSION_CONTRACTS,
  SCREEN_PERMISSION_EVIDENCE_TEST,
} from "./screen-permission-evidence";
import type { FamilyScreenManifest } from "./types";
import {
  assertScreenManifestShape,
  resolveScreenEvidence,
} from "../../../scripts/screen-evidence";

// screen-evidence-test-id: DL-STORY-MANIFEST
const designLabFamily = DEMO_SCREEN_FAMILIES.find(
  (family) => family.key === "design-lab"
);
assert.ok(designLabFamily, "Design Lab family must exist");

const manifests: readonly FamilyScreenManifest[] =
  DESIGN_LAB_USER_STORY_MANIFESTS;

assertScreenManifestShape({
  families: [designLabFamily],
  manifests,
});

resolveScreenEvidence({
  manifests,
  repoRoot: process.cwd(),
  testedCommitSha: "0000000000000000000000000000000000000000",
});

const expectedRoutes = designLabFamily.screens.map((screen) => screen.route).sort();
const manifestRoutes = manifests.map((manifest) => manifest.route).sort();
assert.deepEqual(manifestRoutes, expectedRoutes);
const permissionContractByRoute = new Map<
  string,
  (typeof DESIGN_LAB_SCREEN_PERMISSION_CONTRACTS)[number]
>(
  DESIGN_LAB_SCREEN_PERMISSION_CONTRACTS.map((contract) => [
    contract.route,
    contract,
  ] as const),
);
assert.equal(permissionContractByRoute.size, 6);

const storyIds = new Set<string>();
let testedStoryCount = 0;
const testedRoutes = new Set([
  "/design-lab",
  "/design-lab/demo-experience",
  "/design-lab/dock-skins",
  "/design-lab/role-blueprints",
  "/feed/device-preview",
  "/marketplace/design-lab",
]);
for (const manifest of DESIGN_LAB_USER_STORY_MANIFESTS) {
  const permissionContract = permissionContractByRoute.get(manifest.route);
  assert.ok(permissionContract, `${manifest.route} needs a permission contract`);
  assert.deepEqual(manifest.permissions, permissionContract.permissions);
  assert.equal(manifest.coverage.permissions.status, "tested");
  assert.ok(
    manifest.tests.some(
      (test) =>
        test.id === SCREEN_PERMISSION_EVIDENCE_TEST.id &&
        test.path === SCREEN_PERMISSION_EVIDENCE_TEST.path,
    ),
  );
  assert.deepEqual(
    SCREEN_CONTRACT_BY_ROUTE.get(manifest.route)?.permissionRules,
    permissionContract.permissions,
  );
  assert.ok(manifest.userStories.length > 0, `${manifest.route} needs a user story`);
  const expectedStatus = testedRoutes.has(manifest.route) ? "tested" : "captured";
  if (expectedStatus === "tested") testedStoryCount += manifest.userStories.length;
  assert.equal(manifest.coverage.userStories.status, expectedStatus);
  assert.equal(
    SCREEN_CONTRACT_BY_ROUTE.get(manifest.route)?.coverage.userStories.status,
    expectedStatus,
    `${manifest.route} registry coverage must match its manifest`,
  );
  assert.ok(
    manifest.coverage.userStories.evidence.some(
      (evidence) => evidence.kind === "source" && existsSync(path.resolve(evidence.path))
    ),
    `${manifest.route} needs source evidence`
  );
  if (
    [
      "/design-lab",
      "/design-lab/demo-experience",
      "/design-lab/dock-skins",
    ].includes(manifest.route)
  ) {
    assert.ok(
      manifest.coverage.userStories.evidence.some(
        (evidence) =>
          evidence.kind === "test" &&
          evidence.path === "scripts/audit-design-lab-hydrated-stories.test.ts" &&
          evidence.testId === "DL-HYDRATED-STORY-RUNTIME"
      ),
      `${manifest.route} needs hydrated interaction-test evidence`
    );
  }

  for (const story of manifest.userStories) {
    assert.ok(!storyIds.has(story.id), `Duplicate story ID: ${story.id}`);
    storyIds.add(story.id);
    assert.match(story.id, /^DL\.STORY\.[A-Z0-9-]+$/);
    assert.ok(story.actor.trim().length >= 10, `${story.id} needs a specific actor`);
    assert.ok(story.outcome.trim().length >= 40, `${story.id} needs a meaningful outcome`);
    assert.ok(story.acceptance.length >= 2, `${story.id} needs acceptance paths`);
    story.acceptance.forEach((scenario) => assertScenario(story.id, scenario));
  }
}
assert.equal(testedStoryCount, 6);

function assertScenario(storyId: string, scenario: DesignLabAcceptanceScenario) {
  for (const [part, value] of Object.entries(scenario)) {
    assert.ok(
      value.trim().length >= 20,
      `${storyId} acceptance ${part} must be independently reviewable`
    );
  }
}

console.log(
  `Design Lab user stories registered: ${storyIds.size} stories across ${manifests.length} routes; ${testedStoryCount} independently tested.`
);
