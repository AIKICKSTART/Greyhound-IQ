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

// screen-evidence-test-id: MARKETPLACE-ACCOUNT-STORY-CONTRACT

const REPO_ROOT = process.cwd();
const TARGET_FAMILY_KEYS = ["marketplace", "account"] as const;
const EXPECTED_SCREEN_TUPLES = [
  [
    "marketplace",
    "/listings",
    "MARKETPLACE.STORY.LISTINGS-DIRECTORY",
    "/listings",
    "src/app/listings/page.tsx",
    "/marketplace",
  ],
  [
    "marketplace",
    "/listings/[id]",
    "MARKETPLACE.STORY.LISTING-DETAIL",
    "/listings/demo-listing-racing-toolkit",
    "src/app/listings/[id]/page.tsx",
    "/marketplace/demo-listing-racing-toolkit",
  ],
  [
    "marketplace",
    "/listings/[id]/edit",
    "MARKETPLACE.STORY.LISTING-EDIT",
    "/listings/demo-listing-racing-toolkit/edit",
    "src/app/listings/[id]/edit/page.tsx",
    "/marketplace/demo-listing-racing-toolkit/edit",
  ],
  [
    "marketplace",
    "/listings/new",
    "MARKETPLACE.STORY.LISTING-CREATE",
    "/listings/new",
    "src/app/listings/new/page.tsx",
    "/marketplace/new",
  ],
  [
    "marketplace",
    "/marketplace",
    "MARKETPLACE.STORY.MARKETPLACE-DIRECTORY",
    "/marketplace",
    "src/app/marketplace/page.tsx",
    "/marketplace",
  ],
  [
    "marketplace",
    "/marketplace/[id]",
    "MARKETPLACE.STORY.MARKETPLACE-DETAIL",
    "/marketplace/demo-listing-racing-toolkit",
    "src/app/marketplace/[id]/page.tsx",
    "/marketplace/demo-listing-racing-toolkit",
  ],
  [
    "marketplace",
    "/marketplace/[id]/edit",
    "MARKETPLACE.STORY.MARKETPLACE-EDIT",
    "/marketplace/demo-listing-racing-toolkit/edit",
    "src/app/marketplace/[id]/edit/page.tsx",
    "/marketplace/demo-listing-racing-toolkit/edit",
  ],
  [
    "marketplace",
    "/marketplace/new",
    "MARKETPLACE.STORY.MARKETPLACE-CREATE",
    "/marketplace/new",
    "src/app/marketplace/new/page.tsx",
    "/marketplace/new",
  ],
  [
    "account",
    "/account",
    "ACCOUNT.STORY.OVERVIEW",
    "/account",
    "src/app/account/page.tsx",
    "/account",
  ],
  [
    "account",
    "/account/appearance",
    "ACCOUNT.STORY.APPEARANCE-PREVIEW",
    "/account/appearance",
    "src/app/account/appearance/page.tsx",
    "/account/appearance",
  ],
  [
    "account",
    "/account/billing",
    "ACCOUNT.STORY.BILLING",
    "/account/billing",
    "src/app/account/billing/page.tsx",
    "/account/billing",
  ],
  [
    "account",
    "/account/listings",
    "ACCOUNT.STORY.LISTINGS",
    "/account/listings",
    "src/app/account/listings/page.tsx",
    "/account/listings",
  ],
  [
    "account",
    "/account/listings/archived",
    "ACCOUNT.STORY.LISTINGS-ARCHIVED",
    "/account/listings/archived",
    "src/app/account/listings/archived/page.tsx",
    "/account/listings/archived",
  ],
  [
    "account",
    "/account/listings/drafts",
    "ACCOUNT.STORY.LISTINGS-DRAFTS",
    "/account/listings/drafts",
    "src/app/account/listings/drafts/page.tsx",
    "/account/listings/drafts",
  ],
  [
    "account",
    "/account/notifications",
    "ACCOUNT.STORY.NOTIFICATIONS",
    "/account/notifications",
    "src/app/account/notifications/page.tsx",
    "/account/notifications",
  ],
  [
    "account",
    "/account/pages",
    "ACCOUNT.STORY.MANAGED-PAGES",
    "/account/pages",
    "src/app/account/pages/page.tsx",
    "/account/pages",
  ],
  [
    "account",
    "/account/pages/[id]",
    "ACCOUNT.STORY.MANAGED-PAGE-DETAIL",
    "/account/pages/demo-custom-page-control-room",
    "src/app/account/pages/[id]/page.tsx",
    "/account/pages/demo-custom-page-control-room",
  ],
  [
    "account",
    "/account/privacy",
    "ACCOUNT.STORY.PRIVACY",
    "/account/privacy",
    "src/app/account/privacy/page.tsx",
    "/account/privacy",
  ],
  [
    "account",
    "/account/profile",
    "ACCOUNT.STORY.PROFILE-STUDIO",
    "/account/profile",
    "src/app/account/profile/page.tsx",
    "/account/profile",
  ],
  [
    "account",
    "/account/saved-listings",
    "ACCOUNT.STORY.SAVED-LISTINGS",
    "/account/saved-listings",
    "src/app/account/saved-listings/page.tsx",
    "/account/saved-listings",
  ],
  [
    "account",
    "/account/security",
    "ACCOUNT.STORY.SECURITY",
    "/account/security",
    "src/app/account/security/page.tsx",
    "/account/security",
  ],
  [
    "account",
    "/account/support",
    "ACCOUNT.STORY.SUPPORT",
    "/account/support",
    "src/app/account/support/page.tsx",
    "/account/support",
  ],
  [
    "account",
    "/account/support/[id]",
    "ACCOUNT.STORY.SUPPORT-DETAIL",
    "/account/support/demo-support-ticket-control-room",
    "src/app/account/support/[id]/page.tsx",
    "/account/support/demo-support-ticket-control-room",
  ],
  [
    "account",
    "/account/team",
    "ACCOUNT.STORY.TEAM",
    "/account/team",
    "src/app/account/team/page.tsx",
    "/account/team",
  ],
  [
    "account",
    "/account/usage",
    "ACCOUNT.STORY.USAGE",
    "/account/usage",
    "src/app/account/usage/page.tsx",
    "/account/usage",
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
  "Marketplace and Account render stories cannot be tested against a stale source fingerprint."
);

const targetFamilies = DEMO_SCREEN_FAMILIES.filter((family) =>
  TARGET_FAMILY_KEYS.includes(
    family.key as (typeof TARGET_FAMILY_KEYS)[number]
  )
);
assert.deepEqual(
  targetFamilies.map((family) => family.key),
  TARGET_FAMILY_KEYS,
  "The production story batch must use the existing Marketplace and Account families."
);
const targetScreens = targetFamilies.flatMap((family) =>
  family.screens.map((screen) => ({ family, screen }))
);
assert.equal(
  targetScreens.length,
  EXPECTED_SCREEN_TUPLES.length,
  "The authoritative registry currently contains 8 Marketplace and 17 Account screens."
);

const storyIds = new Set<string>();
for (const [index, { family, screen }] of targetScreens.entries()) {
  const [
    expectedFamily,
    expectedRoute,
    expectedStoryId,
    expectedSamplePath,
    expectedSourcePath,
    expectedFinalPath,
  ] = EXPECTED_SCREEN_TUPLES[index];
  assert.equal(family.key, expectedFamily);
  assert.equal(screen.route, expectedRoute);
  assert.equal(screen.href ?? screen.route, expectedSamplePath);

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
  assert.equal(story.id, expectedStoryId);
  assert.match(story.id, /^(MARKETPLACE|ACCOUNT)\.STORY\.[A-Z][A-Z-]+$/);
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

  assert.equal(story.trigger, `Open ${expectedSamplePath}`);
  assert.equal(story.evidence.routeAudit.route, expectedRoute);
  assert.equal(
    story.evidence.routeAudit.path,
    "output/demo-route-audit/latest.json"
  );
  assert.equal(story.evidence.source.path, expectedSourcePath);
  assert.deepEqual(story.evidence.test, {
    path:
      "src/components/screen-contracts/marketplace-account-user-stories.test.ts",
    testId: "MARKETPLACE-ACCOUNT-STORY-CONTRACT",
  });

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

  const auditRows = routeAudit.results.filter((row) => row.route === expectedRoute);
  assert.equal(
    auditRows.length,
    1,
    `${expectedRoute} must map 1:1 to one canonical route-audit row.`
  );
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
  assert.equal(screenContract.coverage.userStories.status, "tested");
  assert.deepEqual(screenContract.coverage.userStories.evidence, [
    expectedSourcePath,
    story.evidence.routeAudit.path,
    story.evidence.test.path,
  ]);
  assert.deepEqual(story.coverage, { status: "tested" });
}

assert.equal(storyIds.size, EXPECTED_SCREEN_TUPLES.length);
assert.equal(DEMO_ROUTE_AUDIT_EVALUATION.valid, true);

console.log(
  `marketplace/account baseline story contract passed (${storyIds.size} tested render stories; canonical audit source current)`
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
