import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  ADMIN_AUTHORIZATION_INVENTORY,
  type AdminRequiredRole,
} from "../../app/admin/admin-authorization-inventory";
import { getDesignLabSourceFingerprint } from "../../../scripts/design-lab-source-fingerprint";
import {
  DEMO_ROUTE_AUDIT_EVALUATION,
  DEMO_SCREEN_FAMILIES,
  SCREEN_CONTRACT_BY_ROUTE,
} from "../demo-experience-registry";

// screen-evidence-test-id: ADMIN-STORY-CONTRACT

const REPO_ROOT = process.cwd();
const EXPECTED_SCREEN_TUPLES = [
  ["admin", "/admin", "ADMIN.STORY.DASHBOARD", "/admin", "src/app/admin/page.tsx", "/admin", "admin"],
  ["admin", "/admin/account-deletion", "ADMIN.STORY.ACCOUNT-DELETION", "/admin/account-deletion", "src/app/admin/account-deletion/page.tsx", "/admin/account-deletion", "admin"],
  ["admin", "/admin/actions", "ADMIN.STORY.ACTIONS", "/admin/actions", "src/app/admin/actions/page.tsx", "/admin/actions", "admin"],
  ["admin", "/admin/audit", "ADMIN.STORY.AUDIT", "/admin/audit", "src/app/admin/audit/page.tsx", "/admin/audit", "admin"],
  ["admin", "/admin/bespoke", "ADMIN.STORY.BESPOKE", "/admin/bespoke", "src/app/admin/bespoke/page.tsx", "/admin/bespoke", "moderator"],
  ["admin", "/admin/billing", "ADMIN.STORY.BILLING", "/admin/billing", "src/app/admin/billing/page.tsx", "/admin/billing", "admin"],
  ["admin", "/admin/billing-events", "ADMIN.STORY.BILLING-EVENTS", "/admin/billing-events", "src/app/admin/billing-events/page.tsx", "/admin/billing-events", "admin"],
  ["admin", "/admin/bug-reports", "ADMIN.STORY.BUG-REPORTS", "/admin/bug-reports", "src/app/admin/bug-reports/page.tsx", "/admin/bug-reports", "moderator"],
  ["admin", "/admin/compliance", "ADMIN.STORY.COMPLIANCE", "/admin/compliance", "src/app/admin/compliance/page.tsx", "/admin/compliance", "admin"],
  ["admin", "/admin/dog-ownership", "ADMIN.STORY.DOG-OWNERSHIP", "/admin/dog-ownership", "src/app/admin/dog-ownership/page.tsx", "/admin/dog-ownership", "moderator"],
  ["admin", "/admin/entitlements", "ADMIN.STORY.ENTITLEMENTS", "/admin/entitlements", "src/app/admin/entitlements/page.tsx", "/admin/entitlements", "admin"],
  ["admin", "/admin/exports", "ADMIN.STORY.EXPORTS", "/admin/exports", "src/app/admin/exports/page.tsx", "/admin/exports", "admin"],
  ["admin", "/admin/feed", "ADMIN.STORY.FEED", "/admin/feed", "src/app/admin/feed/page.tsx", "/admin/feed", "moderator"],
  ["admin", "/admin/feedback", "ADMIN.STORY.FEEDBACK", "/admin/feedback", "src/app/admin/feedback/page.tsx", "/admin/feedback", "moderator"],
  ["admin", "/admin/invitations", "ADMIN.STORY.INVITATIONS", "/admin/invitations", "src/app/admin/invitations/page.tsx", "/admin/invitations", "admin"],
  ["admin", "/admin/invoices", "ADMIN.STORY.INVOICES", "/admin/invoices", "src/app/admin/invoices/page.tsx", "/admin/invoices", "admin"],
  ["admin", "/admin/jobs", "ADMIN.STORY.JOBS", "/admin/jobs", "src/app/admin/jobs/page.tsx", "/admin/jobs", "admin"],
  ["admin", "/admin/listings", "ADMIN.STORY.LISTINGS", "/admin/listings", "src/app/admin/listings/page.tsx", "/admin/listings", "moderator"],
  ["admin", "/admin/organizations", "ADMIN.STORY.ORGANIZATIONS", "/admin/organizations", "src/app/admin/organizations/page.tsx", "/admin/organizations", "admin"],
  ["admin", "/admin/page-rules", "ADMIN.STORY.PAGE-RULES", "/admin/page-rules", "src/app/admin/page-rules/page.tsx", "/admin/page-rules", "admin"],
  ["admin", "/admin/payments", "ADMIN.STORY.PAYMENTS", "/admin/payments", "src/app/admin/payments/page.tsx", "/admin/payments", "admin"],
  ["admin", "/admin/plans", "ADMIN.STORY.PLANS", "/admin/plans", "src/app/admin/plans/page.tsx", "/admin/plans", "admin"],
  ["admin", "/admin/reports", "ADMIN.STORY.REPORTS", "/admin/reports", "src/app/admin/reports/page.tsx", "/admin/reports", "moderator"],
  ["admin", "/admin/retention", "ADMIN.STORY.RETENTION", "/admin/retention", "src/app/admin/retention/page.tsx", "/admin/retention", "admin"],
  ["admin", "/admin/safety", "ADMIN.STORY.SAFETY", "/admin/safety", "src/app/admin/safety/page.tsx", "/admin/safety", "moderator"],
  ["admin", "/admin/site-content", "ADMIN.STORY.SITE-CONTENT", "/admin/site-content", "src/app/admin/site-content/page.tsx", "/admin/site-content", "admin"],
  ["admin", "/admin/source-health", "ADMIN.STORY.SOURCE-HEALTH", "/admin/source-health", "src/app/admin/source-health/page.tsx", "/admin/source-health", "admin"],
  ["admin", "/admin/subscriptions", "ADMIN.STORY.SUBSCRIPTIONS", "/admin/subscriptions", "src/app/admin/subscriptions/page.tsx", "/admin/subscriptions", "admin"],
  ["admin", "/admin/support", "ADMIN.STORY.SUPPORT", "/admin/support", "src/app/admin/support/page.tsx", "/admin/support", "moderator"],
  ["admin", "/admin/usage", "ADMIN.STORY.USAGE", "/admin/usage", "src/app/admin/usage/page.tsx", "/admin/usage", "admin"],
  ["admin", "/admin/users", "ADMIN.STORY.USERS", "/admin/users", "src/app/admin/users/page.tsx", "/admin/users", "admin"],
  ["admin", "/admin/webhooks", "ADMIN.STORY.WEBHOOKS", "/admin/webhooks", "src/app/admin/webhooks/page.tsx", "/admin/webhooks", "admin"],
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
const currentFingerprint = getDesignLabSourceFingerprint(REPO_ROOT);
assert.equal(
  routeAudit.sourceSha256 === currentFingerprint.sha256 &&
    routeAudit.sourceFileCount === currentFingerprint.fileCount,
  true,
  "Administration render stories cannot be tested against a stale source fingerprint."
);
assert.equal(
  ADMIN_AUTHORIZATION_INVENTORY.runtimeDenial.status,
  "unverified",
  "Source-declared Admin roles must not be presented as request-level denial proof."
);

const adminFamily = DEMO_SCREEN_FAMILIES.find(
  (family) => family.key === "admin"
);
assert.ok(adminFamily, "The authoritative registry must retain the Admin family.");
assert.equal(
  adminFamily.screens.length,
  EXPECTED_SCREEN_TUPLES.length,
  "The authoritative registry currently contains exactly 32 Admin screens."
);

const expectedRolesByRoute = new Map(
  ADMIN_AUTHORIZATION_INVENTORY.pages.map((surface) => [
    surface.id,
    surface.requiredRole,
  ])
);
assert.equal(
  expectedRolesByRoute.size,
  EXPECTED_SCREEN_TUPLES.length,
  "Every Admin page must have exactly one authorization-inventory row."
);
assert.equal(
  EXPECTED_SCREEN_TUPLES.filter((tuple) => tuple[6] === "admin").length,
  23
);
assert.equal(
  EXPECTED_SCREEN_TUPLES.filter((tuple) => tuple[6] === "moderator").length,
  9
);

const storyIds = new Set<string>();
for (const [index, screen] of adminFamily.screens.entries()) {
  const [
    expectedFamily,
    expectedRoute,
    expectedStoryId,
    expectedSamplePath,
    expectedSourcePath,
    expectedFinalPath,
    expectedRole,
  ] = EXPECTED_SCREEN_TUPLES[index];

  assert.equal(expectedFamily, "admin");
  assert.equal(screen.route, expectedRoute);
  assert.equal(screen.href ?? screen.route, expectedSamplePath);
  assert.equal(
    expectedRolesByRoute.get(expectedRoute),
    expectedRole satisfies AdminRequiredRole,
    `${expectedRoute} must retain its source-declared least-privilege role.`
  );

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
  assert.match(story.id, /^ADMIN\.STORY\.[A-Z][A-Z-]+$/);
  assert.equal(storyIds.has(story.id), false, `${story.id} must be unique.`);
  storyIds.add(story.id);
  assert.ok(story.actor.trim().length >= 20, `${story.id} needs a specific actor.`);
  assert.ok(
    story.outcome.trim().length >= 90,
    `${story.id} needs a meaningful route-specific outcome.`
  );
  assert.match(
    story.actor,
    expectedRole === "admin" ? /administrator/i : /moderator/i,
    `${story.id} actor must name its registered role.`
  );
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
    path: "src/components/screen-contracts/admin-user-stories.test.ts",
    testId: "ADMIN-STORY-CONTRACT",
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
    `${story.id} needs at least three route-specific source assertions.`
  );
  for (const assertion of story.evidence.source.renderAssertions) {
    assert.equal(
      source.includes(assertion),
      true,
      `${story.id} source assertion is absent: ${assertion}`
    );
  }

  const auditRows = routeAudit.results.filter(
    (row) => row.route === expectedRoute
  );
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
  `admin baseline story contract passed (${storyIds.size} tested render stories; canonical audit source current; runtime authorization denial remains unverified)`
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
