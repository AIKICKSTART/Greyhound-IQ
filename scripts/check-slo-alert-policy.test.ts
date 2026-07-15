import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  validateSloAlertPolicy,
  validateSloAlertRunbookEvidence,
} from "./check-slo-alert-policy";

const policy = JSON.parse(
  readFileSync(join(process.cwd(), "config", "slo-alert-policy.json"), "utf8"),
);
const runbookPath = "docs/architecture/slo-alert-policy.md";
const runbook = readFileSync(join(process.cwd(), runbookPath), "utf8");

assert.deepEqual(validateSloAlertPolicy(policy), []);
assert.deepEqual(validateSloAlertRunbookEvidence(policy, { [runbookPath]: runbook }), []);
assert.equal(policy.status, "provisional-unverified");
assert.equal(policy.evidence.deployed, false);
assert.equal(policy.evidence.notificationDeliveryTested, false);
assert.ok(policy.objectives.some((objective: { class: string }) => objective.class === "critical"));
assert.ok(policy.objectives.some((objective: { class: string }) => objective.class === "noncritical"));

const falseDeploymentClaim = structuredClone(policy);
falseDeploymentClaim.evidence.deployed = true;
assert.ok(
  validateSloAlertPolicy(falseDeploymentClaim).includes("evidence.deployed: must remain false"),
);

const missingFastBurn = structuredClone(policy);
missingFastBurn.alertPolicies = missingFastBurn.alertPolicies.filter(
  (alert: { id: string }) => alert.id !== "ALERT-CRITICAL-AVAILABILITY-FAST",
);
assert.ok(
  validateSloAlertPolicy(missingFastBurn).some((finding) =>
    finding.includes("missing fast multi-window page"),
  ),
);

const unownedAlert = structuredClone(policy);
unownedAlert.alertPolicies[0].ownerRole = "missing-owner";
assert.ok(
  validateSloAlertPolicy(unownedAlert).includes(
    "alertPolicies.ALERT-CRITICAL-AVAILABILITY-FAST.ownerRole: unknown reference",
  ),
);

const detachedAlert = structuredClone(policy);
detachedAlert.alertPolicies[0].sloIds = [];
assert.ok(
  validateSloAlertPolicy(detachedAlert).includes(
    "alertPolicies.ALERT-CRITICAL-AVAILABILITY-FAST.sloIds: must be an array of non-empty strings",
  ),
);

const duplicateObjective = structuredClone(policy);
duplicateObjective.objectives.push(structuredClone(duplicateObjective.objectives[0]));
assert.ok(
  validateSloAlertPolicy(duplicateObjective).includes(
    "objectives: duplicate id SLO-CRITICAL-READ-AVAILABILITY",
  ),
);

assert.ok(
  validateSloAlertRunbookEvidence(policy, {}).some((finding) =>
    finding.includes("missing document"),
  ),
);
assert.ok(
  validateSloAlertRunbookEvidence(policy, { [runbookPath]: "# Wrong document" }).some(
    (finding) => finding.includes("missing heading"),
  ),
);

console.log("SLO and alert policy tests passed");
