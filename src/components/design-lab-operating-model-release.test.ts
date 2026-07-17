import assert from "node:assert/strict";

import {
  DESIGN_LAB_OPERATING_MODEL_GATE_IDS,
} from "./design-lab-operating-model";
import {
  DESIGN_LAB_PENDING_WORK,
  DESIGN_LAB_PENDING_WORK_SUMMARY,
  filterDesignLabPendingWork,
  findDesignLabPendingWorkIssues,
} from "./design-lab-pending-work";
import {
  DESIGN_LAB_PREPRODUCTION_REQUIREMENTS,
  isDesignLabPreproductionRequirementComplete,
} from "./design-lab-preproduction-requirements";
import {
  DESIGN_LAB_RELEASE_GATE,
  evaluateDesignLabReleaseGate,
} from "./design-lab-release-gate";

const gateIds = Object.values(DESIGN_LAB_OPERATING_MODEL_GATE_IDS);
const operatingRequirements = DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.filter(
  (requirement) => gateIds.includes(requirement.id as (typeof gateIds)[number]),
);

assert.equal(gateIds.length, 13);
assert.equal(new Set(gateIds).size, 13);
assert.equal(operatingRequirements.length, 13);
assert.deepEqual(
  operatingRequirements.map((item) => item.id).toSorted(),
  [...gateIds].toSorted(),
);
for (const requirement of operatingRequirements) {
  assert.equal(
    DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.filter(
      (item) => item.id === requirement.id,
    ).length,
    1,
  );
  assert.equal(isDesignLabPreproductionRequirementComplete(requirement), false);
  assert.ok((requirement.roles?.length ?? 0) > 0);
  assert.ok((requirement.dependencies?.length ?? 0) > 0);
}

const mobileGateIds = new Set<string>([
  DESIGN_LAB_OPERATING_MODEL_GATE_IDS.mobileBoundary,
  DESIGN_LAB_OPERATING_MODEL_GATE_IDS.mobileIdentity,
  DESIGN_LAB_OPERATING_MODEL_GATE_IDS.mobileRuntime,
  DESIGN_LAB_OPERATING_MODEL_GATE_IDS.mobileRelease,
  DESIGN_LAB_OPERATING_MODEL_GATE_IDS.mobileDeviceEvidence,
]);
const mobileRequirements = operatingRequirements.filter((requirement) =>
  mobileGateIds.has(requirement.id),
);
assert.equal(mobileRequirements.length, 5);
assert.ok(mobileRequirements.every((requirement) => !requirement.releaseBlocking));
assert.ok(
  operatingRequirements
    .filter((requirement) => !mobileGateIds.has(requirement.id))
    .every((requirement) => requirement.releaseBlocking),
);

const gateWithoutOperatingModel = evaluateDesignLabReleaseGate(
  undefined,
  undefined,
  DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.filter(
    (requirement) => !gateIds.includes(requirement.id as (typeof gateIds)[number]),
  ),
);
assert.equal(
  DESIGN_LAB_RELEASE_GATE.totalChecks,
  gateWithoutOperatingModel.totalChecks +
    operatingRequirements.filter((requirement) => requirement.releaseBlocking).length,
);
assert.equal(
  DESIGN_LAB_RELEASE_GATE.completedChecks,
  gateWithoutOperatingModel.completedChecks,
);
assert.equal(
  DESIGN_LAB_PENDING_WORK.filter((item) => item.releaseBlocking).length,
  DESIGN_LAB_RELEASE_GATE.totalChecks,
);
assert.equal(
  DESIGN_LAB_PENDING_WORK_SUMMARY.pending,
  DESIGN_LAB_PENDING_WORK.filter((item) => !item.complete).length,
);
assert.deepEqual(findDesignLabPendingWorkIssues(), []);

const mobileWork = filterDesignLabPendingWork({
  completion: "pending",
  source: "preproduction",
  productArea: "mobile",
});
assert.equal(mobileWork.length, 5);
assert.ok(mobileWork.every((item) => item.roles.length > 0));
assert.ok(mobileWork.every((item) => item.dependencies.length > 0));
assert.ok(mobileWork.every((item) => !item.releaseBlocking));
assert.ok(
  gateIds.every((gateId) =>
    DESIGN_LAB_PENDING_WORK.some(
      (item) => item.id === `preproduction:${gateId}` && !item.complete,
    ),
  ),
);

console.log("Design Lab operating-model release tests passed");
