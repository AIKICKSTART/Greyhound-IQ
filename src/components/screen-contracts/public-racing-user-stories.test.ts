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
  type DemoScreenUserStory,
} from "../demo-experience-registry";

// screen-evidence-test-id: PUBLIC-RACING-STORY-CONTRACT

const REPO_ROOT = process.cwd();
const TARGET_FAMILY_KEYS = ["public", "racing"] as const;
const EXPECTED_STORY_COUNT = 18;
const EXPECTED_STORIES = [
  ["public", "/", "/", "PUBLIC.STORY.HOME"],
  ["public", "/about", "/about", "PUBLIC.STORY.ABOUT"],
  ["public", "/auth/error", "/auth/error", "PUBLIC.STORY.AUTH-ERROR"],
  ["public", "/contact", "/contact", "PUBLIC.STORY.CONTACT"],
  ["public", "/pricing", "/pricing", "PUBLIC.STORY.PRICING"],
  ["public", "/privacy", "/privacy", "PUBLIC.STORY.PRIVACY"],
  [
    "public",
    "/responsible-use",
    "/responsible-use",
    "PUBLIC.STORY.RESPONSIBLE-USE",
  ],
  ["public", "/terms", "/terms", "PUBLIC.STORY.TERMS"],
  ["racing", "/breeding", "/breeding", "RACING.STORY.BREEDING"],
  ["racing", "/dogs", "/dogs", "RACING.STORY.DOG-SEARCH"],
  [
    "racing",
    "/dogs/[id]",
    "/dogs/demo-provider-dog",
    "RACING.STORY.DOG-DETAIL",
  ],
  ["racing", "/races", "/races", "RACING.STORY.RACE-EXPLORER"],
  [
    "racing",
    "/meetings/[id]",
    "/meetings/demo-provider-meeting",
    "RACING.STORY.MEETING-DETAIL",
  ],
  [
    "racing",
    "/races/[id]",
    "/races/demo-provider-race",
    "RACING.STORY.RACE-DETAIL",
  ],
  ["racing", "/results", "/results", "RACING.STORY.RESULTS"],
  ["racing", "/statistics", "/statistics", "RACING.STORY.STATISTICS"],
  ["racing", "/tracks", "/tracks", "RACING.STORY.TRACKS"],
  [
    "racing",
    "/tracks/[id]",
    "/tracks/demo-provider-track",
    "RACING.STORY.TRACK-DETAIL",
  ],
] as const;
const STALE_AUDIT_BLOCKER =
  "The canonical HTTP route audit predates active source changes; a fresh source-fingerprint-bound audit and independent review have not yet proved this exact render story.";

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
const auditMatchesCurrentSource =
  routeAudit.sourceSha256 === currentFingerprint.sha256 &&
  routeAudit.sourceFileCount === currentFingerprint.fileCount;

const targetFamilies = DEMO_SCREEN_FAMILIES.filter((family) =>
  TARGET_FAMILY_KEYS.includes(
    family.key as (typeof TARGET_FAMILY_KEYS)[number]
  )
);
assert.deepEqual(
  targetFamilies.map((family) => family.key),
  TARGET_FAMILY_KEYS,
  "The production story batch must use the existing public and racing families."
);

const targetScreens = targetFamilies.flatMap((family) =>
  family.screens.map((screen) => ({ family, screen }))
);
assert.equal(
  targetScreens.length,
  EXPECTED_STORY_COUNT,
  "The authoritative registry currently contains 8 public and 10 racing screens."
);
assert.equal(EXPECTED_STORIES.length, EXPECTED_STORY_COUNT);
assert.deepEqual(
  targetScreens.map(({ family, screen }) => [
    family.key,
    screen.route,
    screen.href ?? screen.route,
    screen.userStory?.id,
  ]),
  EXPECTED_STORIES,
  "The 18 production story IDs, route patterns and concrete sample paths must remain stable."
);

const storyIds = new Set<string>();
for (const { family, screen } of targetScreens) {
  const story = screen.userStory;
  assert.ok(story, `${screen.route} must have exactly one inline baseline story.`);
  assert.deepEqual(
    Object.keys(story).toSorted(),
    [
      "acceptance",
      "actor",
      "coverage",
      "evidence",
      "id",
      "outcome",
      "trigger",
    ],
    `${story.id} must remain a render-only baseline contract.`
  );
  assert.equal(storyIds.has(story.id), false, `${story.id} must be unique.`);
  storyIds.add(story.id);
  assert.match(
    story.id,
    family.key === "public"
      ? /^PUBLIC\.STORY\.[A-Z][A-Z-]+$/
      : /^RACING\.STORY\.[A-Z][A-Z-]+$/
  );

  const samplePath = screen.href ?? screen.route;
  assert.equal(story.trigger, `Open ${samplePath}`);
  assert.equal(story.evidence.routeAudit.route, screen.route);
  assert.equal(
    story.evidence.routeAudit.path,
    "output/demo-route-audit/latest.json"
  );
  assert.equal(
    story.evidence.test.path,
    "src/components/screen-contracts/public-racing-user-stories.test.ts"
  );
  assert.equal(
    story.evidence.test.testId,
    "PUBLIC-RACING-STORY-CONTRACT"
  );

  const expectedSourcePath =
    screen.route === "/"
      ? "src/app/page.tsx"
      : `src/app${screen.route}/page.tsx`;
  assert.equal(story.evidence.source.path, expectedSourcePath);
  const absoluteSourcePath = join(REPO_ROOT, expectedSourcePath);
  assert.equal(
    existsSync(absoluteSourcePath),
    true,
    `${expectedSourcePath} must exist.`
  );
  const source = readFileSync(absoluteSourcePath, "utf8");
  for (const assertion of story.evidence.source.renderAssertions) {
    assert.equal(
      source.includes(assertion),
      true,
      `${story.id} source assertion is absent: ${assertion}`
    );
  }

  const auditRows = routeAudit.results.filter((row) => row.route === screen.route);
  assert.equal(
    auditRows.length,
    1,
    `${screen.route} must map 1:1 to one canonical route-audit row.`
  );
  assertCanonicalPassingAuditRow(auditRows[0], family.key, screen.route, samplePath);

  const screenContract = SCREEN_CONTRACT_BY_ROUTE.get(screen.route);
  assert.ok(screenContract, `${screen.route} must resolve to one screen contract.`);
  assert.equal(screenContract.description, story.outcome);
  assert.deepEqual(screenContract.actors, [story.actor]);
  assert.equal(screenContract.coverage.userStories.status, story.coverage.status);
  assert.deepEqual(screenContract.coverage.userStories.evidence, [
    story.evidence.source.path,
    story.evidence.routeAudit.path,
    story.evidence.test.path,
  ]);

  assertCoverageHonesty(story, auditMatchesCurrentSource);
}

assert.equal(storyIds.size, EXPECTED_STORY_COUNT);
assert.equal(DEMO_ROUTE_AUDIT_EVALUATION.valid, true);

console.log(
  `public/racing baseline story contract passed (${storyIds.size} tested render stories; canonical audit source ${
    auditMatchesCurrentSource ? "current" : "stale"
  })`
);

function assertCanonicalPassingAuditRow(
  row: AuditRow,
  family: string,
  route: string,
  samplePath: string
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
  assert.equal(finalUrl.pathname, samplePath);
}

function assertCoverageHonesty(
  story: DemoScreenUserStory,
  auditIsCurrent: boolean
) {
  if (story.coverage.status === "tested") {
    assert.equal(
      auditIsCurrent,
      true,
      `${story.id} cannot be tested against a stale source fingerprint.`
    );
    return;
  }

  assert.equal(story.coverage.blocker.owner, "Route-audit evidence lane");
  assert.equal(story.coverage.blocker.reason, STALE_AUDIT_BLOCKER);
  if (!auditIsCurrent) {
    assert.equal(story.coverage.status, "captured");
  }
}
