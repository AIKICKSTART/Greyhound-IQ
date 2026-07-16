import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  fingerprintRepositoryFiles,
  parseDesignLabSourceFiles,
} from "../../../scripts/design-lab-source-fingerprint";
import {
  DEMO_ROUTE_AUDIT_EVALUATION,
  DEMO_SCREEN_FAMILIES,
  SCREEN_CONTRACT_BY_ROUTE,
} from "../demo-experience-registry";

// screen-evidence-test-id: AI-STORY-CONTRACT

const REPO_ROOT = process.cwd();
const EXPECTED_SCREEN_TUPLES = [
  [
    "ai",
    "/agents",
    "AI.STORY.AGENT-CONSOLE",
    "/agents",
    "src/app/agents/page.tsx",
    "/agents",
    "ai-tools-user",
  ],
] as const;
type AuditRow = {
  family: string;
  route: string;
  samplePath: string;
  finalUrl: string;
  status: number | null;
  demoHeader: string | null;
  hasMain: boolean;
  hasH1: boolean;
  hasReactStreamError: boolean;
  errorMarkers: unknown[];
  passed: boolean;
  error: string | null;
};

type AuditArtifact = {
  sourceSha256: string;
  sourceFileCount: number;
  results: AuditRow[];
};

const routeAudit = JSON.parse(
  readFileSync(join(REPO_ROOT, "output/demo-route-audit/latest.json"), "utf8")
) as AuditArtifact;
const routeAuditSourceFiles = parseDesignLabSourceFiles(routeAudit);
assert.ok(routeAuditSourceFiles, "Route audit must declare its source-file manifest.");
const currentFingerprint = fingerprintRepositoryFiles(
  REPO_ROOT,
  routeAuditSourceFiles,
);
assert.equal(
  routeAudit.sourceSha256 === currentFingerprint.sha256 &&
    routeAudit.sourceFileCount === currentFingerprint.fileCount,
  true,
  "The AI render story cannot be tested against a stale source fingerprint."
);

const aiFamily = DEMO_SCREEN_FAMILIES.find((family) => family.key === "ai");
assert.ok(aiFamily, "The authoritative registry must retain the AI family.");
assert.equal(aiFamily.screens.length, EXPECTED_SCREEN_TUPLES.length);

for (const [index, screen] of aiFamily.screens.entries()) {
  const [
    expectedFamily,
    expectedRoute,
    expectedStoryId,
    expectedSamplePath,
    expectedSourcePath,
    expectedFinalPath,
    expectedRole,
  ] = EXPECTED_SCREEN_TUPLES[index];

  assert.equal(expectedFamily, "ai");
  assert.equal(screen.route, expectedRoute);
  assert.equal(screen.href ?? screen.route, expectedSamplePath);

  const story = screen.userStory;
  assert.ok(story, `${screen.route} must have exactly one inline baseline story.`);
  assert.deepEqual(Object.keys(story).toSorted(), [
    "acceptance",
    "actor",
    "coverage",
    "evidence",
    "id",
    "outcome",
    "trigger",
  ]);
  assert.equal(story.id, expectedStoryId);
  assert.match(story.id, /^AI\.STORY\.[A-Z][A-Z-]+$/);
  assert.ok(story.actor.trim().length >= 20);
  assert.ok(story.outcome.trim().length >= 120);
  for (const [part, value] of Object.entries(story.acceptance)) {
    assert.ok(value.trim().length >= 20, `${story.id} acceptance ${part} is too vague.`);
  }
  assert.equal(story.trigger, `Open ${expectedSamplePath}`);
  assert.equal(story.evidence.routeAudit.route, expectedRoute);
  assert.equal(
    story.evidence.routeAudit.path,
    "output/demo-route-audit/latest.json"
  );
  assert.equal(story.evidence.source.path, expectedSourcePath);
  assert.deepEqual(story.evidence.test, {
    path: "src/components/screen-contracts/ai-user-stories.test.ts",
    testId: "AI-STORY-CONTRACT",
  });

  const absoluteSourcePath = join(REPO_ROOT, expectedSourcePath);
  assert.equal(existsSync(absoluteSourcePath), true, `${expectedSourcePath} must exist.`);
  const source = readFileSync(absoluteSourcePath, "utf8");
  assert.ok(story.evidence.source.renderAssertions.length >= 3);
  for (const assertion of story.evidence.source.renderAssertions) {
    assert.equal(
      source.includes(assertion),
      true,
      `${story.id} source assertion is absent: ${assertion}`
    );
  }

  const auditRows = routeAudit.results.filter((row) => row.route === expectedRoute);
  assert.equal(auditRows.length, 1, `${expectedRoute} must have one audit row.`);
  assertCanonicalPassingAuditRow(
    auditRows[0],
    expectedFamily,
    expectedRoute,
    expectedSamplePath,
    expectedFinalPath
  );

  const screenContract = SCREEN_CONTRACT_BY_ROUTE.get(expectedRoute);
  assert.ok(screenContract, `${expectedRoute} must resolve to one screen contract.`);
  assert.equal(screenContract.description, story.outcome);
  assert.deepEqual(screenContract.actors, [story.actor]);
  assert.deepEqual(screenContract.roles, [expectedRole, "administrator"]);
  assert.deepEqual(screenContract.tiers, ["pro", "pro_plus"]);
  assert.equal(screenContract.authentication, "required");
  assert.equal(screenContract.coverage.userStories.status, "tested");
  assert.deepEqual(screenContract.coverage.userStories.evidence, [
    expectedSourcePath,
    story.evidence.routeAudit.path,
    story.evidence.test.path,
  ]);
  assert.deepEqual(story.coverage, { status: "tested" });
  assert.match(story.acceptance.given, /remain unverified/i);
}

const nonDesignLabScreens = DEMO_SCREEN_FAMILIES.filter(
  (family) => family.key !== "design-lab"
).flatMap((family) => family.screens);
assert.equal(nonDesignLabScreens.length, 91);
assert.equal(nonDesignLabScreens.filter((screen) => screen.userStory).length, 91);
assert.equal(
  nonDesignLabScreens.filter((screen) => screen.userStory?.coverage.status === "captured")
    .length,
  0
);
assert.equal(
  nonDesignLabScreens.filter((screen) => screen.userStory?.coverage.status === "tested")
    .length,
  91
);
assert.equal(
  nonDesignLabScreens.filter(
    (screen) => SCREEN_CONTRACT_BY_ROUTE.get(screen.route)?.productionEnabled
  ).length,
  90
);
assert.deepEqual(
  nonDesignLabScreens
    .filter(
      (screen) => !SCREEN_CONTRACT_BY_ROUTE.get(screen.route)?.productionEnabled
    )
    .map((screen) => screen.route),
  ["/account/appearance"]
);
const designLabFamily = DEMO_SCREEN_FAMILIES.find(
  (family) => family.key === "design-lab"
);
assert.ok(designLabFamily);
assert.equal(designLabFamily.screens.length, 6);
assert.equal(
  designLabFamily.screens.every((screen) => screen.userStory === undefined),
  true,
  "Design Lab routes must retain their separate detailed manifest authority."
);
assert.equal(DEMO_ROUTE_AUDIT_EVALUATION.valid, true);

console.log(
  "AI baseline story contract passed (91/91 non-Design-Lab render stories: 90 production-enabled plus the production-disabled Appearance preview; runtime role, tier and execution remain unverified)"
);

function assertCanonicalPassingAuditRow(
  row: AuditRow,
  family: string,
  route: string,
  samplePath: string,
  finalPath: string
) {
  assert.equal(row.family, family);
  assert.equal(row.route, route);
  assert.equal(row.samplePath, samplePath);
  assert.equal(row.status, 200);
  assert.equal(row.demoHeader, "full-access-read-only");
  assert.equal(row.hasMain, true);
  assert.equal(row.hasH1, true);
  assert.equal(row.hasReactStreamError, false);
  assert.deepEqual(row.errorMarkers, []);
  assert.equal(row.error, null);
  assert.equal(row.passed, true);
  const finalUrl = new URL(row.finalUrl);
  assert.equal(finalUrl.origin, "http://localhost:3000");
  assert.equal(finalUrl.pathname, finalPath);
}
