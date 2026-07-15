import assert from "node:assert/strict";

import { DATABASE_OPERATIONS } from "../../security/database-operations";
import {
  SCREEN_CONTRACT_COVERAGE_AREAS,
  SCREEN_CONTRACTS,
} from "./demo-experience-registry";
import {
  DESIGN_LAB_COMPLETE_AWAITING_VERIFICATION_WORK,
  DESIGN_LAB_PENDING_WORK,
  DESIGN_LAB_PENDING_WORK_SUMMARY,
  DESIGN_LAB_VERIFICATION_REFRESH_WORKFLOW,
  filterDesignLabPendingWork,
  findDesignLabPendingWorkIssues,
  isDesignLabWorkAwaitingVerification,
} from "./design-lab-pending-work";
import {
  DESIGN_LAB_PREPRODUCTION_REQUIREMENTS,
  isDesignLabPreproductionRequirementComplete,
} from "./design-lab-preproduction-requirements";
import { DESIGN_LAB_RELEASE_GATE } from "./design-lab-release-gate";
import { MASTER_AUDIT_REQUIREMENTS } from "./master-audit-requirements";
import { DESIGN_LAB_DATABASE_NORMALIZATION_REQUIREMENTS } from "./design-lab-database-normalization-requirements";

assert.deepEqual(findDesignLabPendingWorkIssues(), []);
assert.equal(
  DESIGN_LAB_PENDING_WORK.filter((item) => item.releaseBlocking).length,
  DESIGN_LAB_RELEASE_GATE.totalChecks,
);
assert.equal(
  DESIGN_LAB_PENDING_WORK.filter(
    (item) => item.releaseBlocking && item.complete,
  ).length,
  DESIGN_LAB_RELEASE_GATE.completedChecks,
);
assert.equal(
  DESIGN_LAB_PENDING_WORK_SUMMARY.pending,
  DESIGN_LAB_PENDING_WORK.filter((item) => !item.complete).length,
);
assert.equal(
  new Set(DESIGN_LAB_PENDING_WORK.map((item) => item.id)).size,
  DESIGN_LAB_PENDING_WORK.length,
);
assert.ok(DESIGN_LAB_COMPLETE_AWAITING_VERIFICATION_WORK.length > 0);
assert.equal(
  DESIGN_LAB_PENDING_WORK_SUMMARY.awaitingVerification,
  DESIGN_LAB_COMPLETE_AWAITING_VERIFICATION_WORK.length,
);
assert.ok(
  DESIGN_LAB_COMPLETE_AWAITING_VERIFICATION_WORK.every(
    isDesignLabWorkAwaitingVerification,
  ),
);
assert.equal(
  new Set(
    DESIGN_LAB_COMPLETE_AWAITING_VERIFICATION_WORK.map((item) => item.id),
  ).size,
  DESIGN_LAB_COMPLETE_AWAITING_VERIFICATION_WORK.length,
);
assert.equal(
  DESIGN_LAB_VERIFICATION_REFRESH_WORKFLOW.queueFilter,
  "workCompletion=awaiting-verification",
);
assert.deepEqual(
  DESIGN_LAB_VERIFICATION_REFRESH_WORKFLOW.commands.slice(-2),
  ["npm run check:design-lab-sync", "npm run check:design-lab-release"],
);

assert.deepEqual(DESIGN_LAB_PENDING_WORK_SUMMARY.sources, {
  screen: SCREEN_CONTRACTS.length * SCREEN_CONTRACT_COVERAGE_AREAS.length,
  master: MASTER_AUDIT_REQUIREMENTS.filter(
    (requirement) => requirement.releaseBlocking,
  ).length,
  preproduction:
    DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.length +
    DESIGN_LAB_DATABASE_NORMALIZATION_REQUIREMENTS.filter(
      (requirement) => !requirement.releaseBlocking,
    ).length,
  database: DATABASE_OPERATIONS.length,
});

for (const requirement of DESIGN_LAB_DATABASE_NORMALIZATION_REQUIREMENTS) {
  const matches = DESIGN_LAB_PENDING_WORK.filter(
    (item) => item.id === `preproduction:${requirement.id}`,
  );
  assert.equal(matches.length, 1, `${requirement.id} must appear exactly once.`);
  assert.equal(matches[0].releaseBlocking, requirement.releaseBlocking);
  assert.equal(
    matches[0].complete,
    isDesignLabPreproductionRequirementComplete(requirement),
  );
}

const pending = filterDesignLabPendingWork({ completion: "pending" });
assert.equal(pending.length, DESIGN_LAB_PENDING_WORK_SUMMARY.pending);
assert.ok(pending.every((item) => !item.complete));
const awaitingVerification = filterDesignLabPendingWork({
  completion: "awaiting-verification",
});
assert.deepEqual(
  awaitingVerification.map((item) => item.id),
  DESIGN_LAB_COMPLETE_AWAITING_VERIFICATION_WORK.map((item) => item.id),
);
assert.ok(
  filterDesignLabPendingWork({
    completion: "all",
    source: "screen",
    screen: "/pricing",
  }).every((item) => item.screen === "/pricing"),
);
assert.ok(
  filterDesignLabPendingWork({
    completion: "all",
    query: "database",
  }).some((item) => item.source === "database"),
);

const screenItem = DESIGN_LAB_PENDING_WORK.find(
  (item) => item.source === "screen" && item.roles.length > 0,
);
assert.ok(screenItem?.screen);
assert.ok(screenItem?.productArea);

const databaseItem = DESIGN_LAB_PENDING_WORK.find(
  (item) => item.source === "database" && item.dependencies.length > 0,
);
assert.ok(databaseItem);
assert.ok(databaseItem.owner);

console.log("Design Lab pending-work tests passed");
