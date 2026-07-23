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

// screen-evidence-test-id: COMMUNITY-STORY-CONTRACT

const REPO_ROOT = process.cwd();
const EXPECTED_STORY_ID_BY_ROUTE = new Map<string, string>([
  ["/discover", "COMMUNITY.STORY.DISCOVER"],
  ["/feed", "COMMUNITY.STORY.FEED"],
  ["/forum", "COMMUNITY.STORY.FORUM-DIRECTORY"],
  ["/forum/[slug]", "COMMUNITY.STORY.FORUM-GROUP"],
  ["/forum/threads/[id]", "COMMUNITY.STORY.FORUM-THREAD"],
  ["/groups", "COMMUNITY.STORY.GROUPS-DIRECTORY"],
  ["/groups/[slug]", "COMMUNITY.STORY.GROUPS-GROUP"],
  ["/groups/threads/[id]", "COMMUNITY.STORY.GROUPS-THREAD"],
  ["/messages", "COMMUNITY.STORY.MESSAGES-INBOX"],
  ["/messages/[id]", "COMMUNITY.STORY.MESSAGES-THREAD"],
  ["/messages/friends", "COMMUNITY.STORY.MESSAGES-FRIENDS"],
  ["/p/[handle]", "COMMUNITY.STORY.PUBLIC-PROFILE"],
  ["/pulse", "COMMUNITY.STORY.PULSE-INBOX"],
  ["/pulse/[id]", "COMMUNITY.STORY.PULSE-THREAD"],
  ["/pulse/friends", "COMMUNITY.STORY.PULSE-FRIENDS"],
]);
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
assert.equal(
  auditMatchesCurrentSource,
  true,
  "Community render stories cannot be tested against a stale source fingerprint."
);

const communityFamily = DEMO_SCREEN_FAMILIES.find(
  (family) => family.key === "community"
);
assert.ok(communityFamily, "The production story batch must use the community family.");
assert.equal(
  communityFamily.screens.length,
  EXPECTED_STORY_ID_BY_ROUTE.size,
  "The authoritative registry currently contains exactly 15 community screens."
);

const storyIds = new Set<string>();
for (const screen of communityFamily.screens) {
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
  assert.equal(story.id, EXPECTED_STORY_ID_BY_ROUTE.get(screen.route));
  assert.match(story.id, /^COMMUNITY\.STORY\.[A-Z][A-Z-]+$/);
  assert.equal(storyIds.has(story.id), false, `${story.id} must be unique.`);
  storyIds.add(story.id);
  assert.ok(story.actor.trim().length >= 16, `${story.id} needs a specific actor.`);
  assert.ok(story.outcome.trim().length >= 80, `${story.id} needs a meaningful outcome.`);
  for (const [part, value] of Object.entries(story.acceptance)) {
    assert.ok(
      value.trim().length >= 20,
      `${story.id} acceptance ${part} must be independently reviewable.`
    );
  }

  const samplePath = screen.href ?? screen.route;
  assert.equal(story.trigger, `Open ${samplePath}`);
  assert.equal(story.evidence.routeAudit.route, screen.route);
  assert.equal(
    story.evidence.routeAudit.path,
    "output/demo-route-audit/latest.json"
  );
  assert.deepEqual(story.evidence.test, {
    path: "src/components/screen-contracts/community-user-stories.test.ts",
    testId: "COMMUNITY-STORY-CONTRACT",
  });

  const expectedSourcePath = `src/app${screen.route}/page.tsx`;
  assert.equal(story.evidence.source.path, expectedSourcePath);
  const absoluteSourcePath = join(REPO_ROOT, expectedSourcePath);
  assert.equal(
    existsSync(absoluteSourcePath),
    true,
    `${expectedSourcePath} must exist.`
  );
  const source = readFileSync(absoluteSourcePath, "utf8");
  assert.ok(
    story.evidence.source.renderAssertions.length >= 3,
    `${story.id} needs route-specific source assertions.`
  );
  for (const assertion of story.evidence.source.renderAssertions) {
    assert.equal(
      source.includes(assertion),
      true,
      `${story.id} source assertion is absent: ${assertion}`
    );
  }

  const auditRows = routeAudit.results.filter(
    (row) => row.route === screen.route
  );
  assert.equal(
    auditRows.length,
    1,
    `${screen.route} must map 1:1 to one canonical route-audit row.`
  );
  assertCanonicalPassingAuditRow(auditRows[0], screen.route, samplePath);

  const screenContract = SCREEN_CONTRACT_BY_ROUTE.get(screen.route);
  assert.ok(screenContract, `${screen.route} must resolve to one screen contract.`);
  assert.equal(screenContract.description, story.outcome);
  assert.deepEqual(screenContract.actors, [story.actor]);
  assert.equal(screenContract.coverage.userStories.status, "tested");
  assert.deepEqual(screenContract.coverage.userStories.evidence, [
    story.evidence.source.path,
    story.evidence.routeAudit.path,
    story.evidence.test.path,
  ]);
  assert.deepEqual(story.coverage, { status: "tested" });
}

assert.equal(storyIds.size, EXPECTED_STORY_ID_BY_ROUTE.size);
assert.equal(DEMO_ROUTE_AUDIT_EVALUATION.valid, true);

console.log(
  `community baseline story contract passed (${storyIds.size} tested render stories; canonical audit source current)`
);

function assertCanonicalPassingAuditRow(
  row: AuditRow,
  route: string,
  samplePath: string
) {
  assert.equal(row.family, "community");
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
  assert.equal(finalUrl.pathname, canonicalPath(route, samplePath));
}

function canonicalPath(route: string, samplePath: string) {
  if (route.startsWith("/forum")) {
    return samplePath.replace(/^\/forum/, "/groups");
  }
  if (route.startsWith("/messages")) {
    return samplePath.replace(/^\/messages/, "/pulse");
  }
  return samplePath;
}
