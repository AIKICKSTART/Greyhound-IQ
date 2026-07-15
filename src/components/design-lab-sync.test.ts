import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DEMO_ROUTE_AUDIT_EXPECTED_ROWS } from "./demo-experience-registry";
import {
  DESIGN_LAB_DELIVERY_PROGRESS,
} from "./design-lab-delivery-progress";
import { DesignLabDeliveryProgressPanel } from "./design-lab-delivery-progress-panel";
import { DESIGN_LAB_AREAS } from "./design-lab-workspace";
import { DESIGN_LAB_USER_STORY_MANIFESTS } from "./screen-contracts/design-lab-user-stories";
import {
  DESIGN_LAB_SYNC_SECTIONS,
  DESIGN_LAB_SYNC_SNAPSHOT,
  findDesignLabRegistrySyncIssues,
  findDesignLabRouteAuditSyncIssues,
} from "./design-lab-sync";

type AuditFixture = {
  expected: number;
  passed: number;
  failed: number;
  results: Array<{
    route: string;
    samplePath: string;
    finalUrl: string;
    status: number | null;
    demoHeader: string | null;
    hasMain: boolean;
    hasH1: boolean;
    hasReactStreamError: boolean;
    errorMarkers: string[];
    passed: boolean;
    error: string | null;
  }>;
};

assert.deepEqual(findDesignLabRegistrySyncIssues(), []);
assert.equal(DESIGN_LAB_SYNC_SNAPSHOT.schemaVersion, 4);
assert.equal(DESIGN_LAB_SYNC_SNAPSHOT.deploymentTarget.window, "Tonight");
assert.equal(DESIGN_LAB_SYNC_SNAPSHOT.deploymentTarget.teamSeats, 4);
assert.deepEqual(
  Object.keys(DESIGN_LAB_SYNC_SNAPSHOT.missionControl),
  DESIGN_LAB_AREAS.map((area) => area.id),
);
assert.equal(
  DESIGN_LAB_SYNC_SNAPSHOT.backlog.release.pending,
  DESIGN_LAB_SYNC_SNAPSHOT.release.openChecks,
);
assert.equal(
  DESIGN_LAB_SYNC_SNAPSHOT.release.openChecks,
  DESIGN_LAB_SYNC_SNAPSHOT.release.awaitingVerificationChecks +
    DESIGN_LAB_SYNC_SNAPSHOT.release.implementationOpenChecks,
);
assert.ok(
  DESIGN_LAB_SYNC_SNAPSHOT.release.awaitingVerificationChecks > 0,
  "captured implementation evidence must remain visible while final verification is pending",
);
assert.equal(
  DESIGN_LAB_SYNC_SNAPSHOT.backlog.pending,
  DESIGN_LAB_SYNC_SNAPSHOT.backlog.release.pending +
    DESIGN_LAB_SYNC_SNAPSHOT.backlog.deferred.pending,
);
assert.match(
  DESIGN_LAB_SYNC_SNAPSHOT.missionControl.advertising.detail,
  /design lab proposal/,
);
assert.equal(
  DESIGN_LAB_SYNC_SECTIONS.find(
    (item) => item.id === "preproduction:advertising",
  )?.total,
  1,
);
assert.equal(
  DESIGN_LAB_SYNC_SECTIONS.reduce((total, item) => total + item.completed, 0),
  DESIGN_LAB_SYNC_SNAPSHOT.release.completedChecks
);
assert.equal(
  DESIGN_LAB_SYNC_SECTIONS.reduce((total, item) => total + item.total, 0),
  DESIGN_LAB_SYNC_SNAPSHOT.release.totalChecks
);

const latestAudit = JSON.parse(
  readFileSync(resolve("output/demo-route-audit/latest.json"), "utf8")
) as AuditFixture;
assert.deepEqual(findDesignLabRouteAuditSyncIssues(latestAudit), []);

const routeWorkstream = DESIGN_LAB_DELIVERY_PROGRESS.find(
  (item) => item.id === "WORK.ROUTES.EXACT-AUDIT"
);
assert.ok(routeWorkstream);
const incorrectlyVerified = { ...routeWorkstream, status: "verified" as const };
const failingAudit = structuredClone(latestAudit);
const failedRow = failingAudit.results[0];
failedRow.hasH1 = false;
failedRow.passed = false;
failingAudit.passed = failingAudit.expected - 1;
failingAudit.failed = 1;
assert.ok(
  findDesignLabRouteAuditSyncIssues(failingAudit, incorrectlyVerified).some(
    (issue) => issue.includes("verified without an exact full pass")
  )
);

const overstatedRouteSection = {
  ...DESIGN_LAB_SYNC_SECTIONS.find((item) => item.id === "screen:route")!,
  completed: latestAudit.expected,
};
assert.ok(
  findDesignLabRouteAuditSyncIssues(
    failingAudit,
    routeWorkstream,
    overstatedRouteSection
  ).some((issue) => issue.includes("validated audit evidence proves"))
);

const fullPass = structuredClone(latestAudit);
for (const row of fullPass.results) {
  row.finalUrl = new URL(row.samplePath, "http://localhost:3000").href;
  row.status = 200;
  row.demoHeader = "full-access-read-only";
  row.hasMain = true;
  row.hasH1 = true;
  row.hasReactStreamError = false;
  row.errorMarkers = [];
  row.passed = true;
  row.error = null;
}
fullPass.expected = DEMO_ROUTE_AUDIT_EXPECTED_ROWS.length;
fullPass.passed = DEMO_ROUTE_AUDIT_EXPECTED_ROWS.length;
fullPass.failed = 0;
const incorrectlyInProgress = {
  ...routeWorkstream,
  status: "in-progress" as const,
  verificationOutcome: "pending" as const,
  nextStep: "Test fixture",
};
assert.ok(
  findDesignLabRouteAuditSyncIssues(fullPass, incorrectlyInProgress).some((issue) =>
    issue.includes("full pass but its workstream is not verified")
  )
);
const duplicateRows = structuredClone(fullPass);
duplicateRows.results.push(structuredClone(duplicateRows.results[0]));
assert.ok(
  findDesignLabRouteAuditSyncIssues(duplicateRows, incorrectlyVerified).some(
    (issue) => issue.includes("exactly one is required")
  )
);

const progressWithDuplicate = [
  ...DESIGN_LAB_DELIVERY_PROGRESS,
  DESIGN_LAB_DELIVERY_PROGRESS[0],
];
assert.ok(
  findDesignLabRegistrySyncIssues({ progress: progressWithDuplicate }).some(
    (issue) => issue.includes("IDs are not unique")
  )
);
assert.ok(
  findDesignLabRegistrySyncIssues({
    storyManifests: DESIGN_LAB_USER_STORY_MANIFESTS.slice(1),
  }).some((issue) => issue.includes("do not exactly cover"))
);
assert.ok(
  findDesignLabRegistrySyncIssues({
    storyManifests: [
      ...DESIGN_LAB_USER_STORY_MANIFESTS,
      DESIGN_LAB_USER_STORY_MANIFESTS[0],
    ],
  }).some((issue) => issue.includes("do not exactly cover"))
);

const markup = renderToStaticMarkup(
  createElement(DesignLabDeliveryProgressPanel)
);
const gateScore = `${DESIGN_LAB_SYNC_SNAPSHOT.release.completedChecks}/${DESIGN_LAB_SYNC_SNAPSHOT.release.totalChecks}`;
assert.match(markup, new RegExp(gateScore.replace("/", "\\/")));
assert.equal(
  (markup.match(/data-design-lab-sync-section=/g) ?? []).length,
  DESIGN_LAB_SYNC_SECTIONS.length
);
assert.equal(
  (markup.match(/data-delivery-progress-id=/g) ?? []).length,
  DESIGN_LAB_DELIVERY_PROGRESS.length
);

console.log("Design Lab canonical sync tests passed");
