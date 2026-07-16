import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SECURITY_ALERT_EVENT_REQUIREMENT_IDS } from "../security/security-alert-event-evidence";
import { validateSecurityAlertPolicy } from "./check-security-alert-policy";

const policy = JSON.parse(
  readFileSync(join(process.cwd(), "config", "security-alert-policy.json"), "utf8"),
);

assert.deepEqual(validateSecurityAlertPolicy(policy), []);
assert.equal(policy.alerts.length, 19);
assert.deepEqual(
  new Set(policy.alerts.map((alert: { requirementId: string }) => alert.requirementId)),
  new Set(SECURITY_ALERT_EVENT_REQUIREMENT_IDS),
);
assert.equal(policy.status, "source-definition-only");
assert.deepEqual(policy.evidence, {
  kind: "repository-source-definition",
  deployed: false,
  metricBindingsVerified: false,
  notificationDeliveryTested: false,
  drillsExecuted: false,
  lastDrillAt: null,
});

for (const alert of policy.alerts) {
  assert.ok(alert.detection.query.length >= 40);
  assert.ok(alert.detection.signal.trim());
  assert.ok(alert.threshold.value > 0);
  assert.ok(alert.threshold.windowMinutes > 0);
  assert.ok(alert.ownerRole.trim());
  assert.ok(alert.runbook.investigationSteps.length >= 2);
  assert.ok(alert.runbook.containmentSteps.length >= 2);
  assert.ok(alert.response.automatic.length >= 1);
  assert.ok(alert.response.manual.length >= 1);
  assert.ok(alert.falsePositiveReview.steps.length >= 2);
  assert.ok(alert.testMethod.procedure.trim());
  assert.equal(alert.deploymentStatus, "not-deployed");
  assert.equal(alert.metricBindingStatus, "unverified");
  assert.equal(alert.notificationDeliveryStatus, "unverified");
  assert.equal(alert.drillStatus, "unverified");
}

const falseDeploymentClaim = structuredClone(policy);
falseDeploymentClaim.evidence.deployed = true;
assert.ok(
  validateSecurityAlertPolicy(falseDeploymentClaim).includes(
    "evidence.deployed: must remain false",
  ),
);

const falseRuntimeClaims = structuredClone(policy);
falseRuntimeClaims.evidence.metricBindingsVerified = true;
falseRuntimeClaims.evidence.notificationDeliveryTested = true;
falseRuntimeClaims.evidence.drillsExecuted = true;
falseRuntimeClaims.evidence.lastDrillAt = "2026-07-14T00:00:00.000Z";
const runtimeFindings = validateSecurityAlertPolicy(falseRuntimeClaims);
for (const expected of [
  "evidence.metricBindingsVerified: must remain false",
  "evidence.notificationDeliveryTested: must remain false",
  "evidence.drillsExecuted: must remain false",
  "evidence.lastDrillAt: must remain null until a recorded drill exists",
]) {
  assert.ok(runtimeFindings.includes(expected), expected);
}

const missingAlert = structuredClone(policy);
const removed = missingAlert.alerts.pop();
assert.ok(
  validateSecurityAlertPolicy(missingAlert).includes(
    `alerts: missing requirement ${removed.requirementId}`,
  ),
);
assert.ok(
  validateSecurityAlertPolicy(missingAlert).includes(
    "alerts: must contain exactly 19 definitions",
  ),
);

const duplicateRequirement = structuredClone(policy);
duplicateRequirement.alerts[1].requirementId = duplicateRequirement.alerts[0].requirementId;
assert.ok(
  validateSecurityAlertPolicy(duplicateRequirement).some((finding) =>
    finding.includes("requirementId: duplicate"),
  ),
);

const duplicateAlertId = structuredClone(policy);
duplicateAlertId.alerts[1].id = duplicateAlertId.alerts[0].id;
assert.ok(
  validateSecurityAlertPolicy(duplicateAlertId).includes(
    "alerts[1].id: duplicate SEC-AUTH-ATTACK-PATTERNS",
  ),
);

const unownedAlert = structuredClone(policy);
unownedAlert.alerts[0].ownerRole = "missing-owner";
assert.ok(
  validateSecurityAlertPolicy(unownedAlert).includes(
    "alerts[0].ownerRole: unknown reference",
  ),
);

const placeholderQuery = structuredClone(policy);
placeholderQuery.alerts[0].detection.query =
  'resource.type="cloud_run_revision" AND jsonPayload.event="TODO"';
assert.ok(
  validateSecurityAlertPolicy(placeholderQuery).includes(
    "alerts[0].detection.query: must not contain placeholders",
  ),
);

const mutatingSql = structuredClone(policy);
mutatingSql.alerts[3].detection.query = 'DELETE FROM "AuditLog"';
assert.ok(
  validateSecurityAlertPolicy(mutatingSql).includes(
    "alerts[3].detection.query: PostgreSQL detection must be a SELECT query with FROM",
  ),
);

const unboundCloudQuery = structuredClone(policy);
unboundCloudQuery.alerts[0].detection.query =
  'jsonPayload.event="auth.callback_failed" AND severity>=ERROR';
assert.ok(
  validateSecurityAlertPolicy(unboundCloudQuery).includes(
    "alerts[0].detection.query: Cloud Logging query must bind resource.type",
  ),
);

const nonConcreteGitHubQuery = structuredClone(policy);
nonConcreteGitHubQuery.alerts[14].detection.query = "GET /repos/example/example/secret-scanning/alerts";
assert.ok(
  validateSecurityAlertPolicy(nonConcreteGitHubQuery).includes(
    "alerts[14].detection.query: GitHub query must be a concrete open-alert repository GET",
  ),
);

const invalidThreshold = structuredClone(policy);
invalidThreshold.alerts[0].threshold.value = 0;
invalidThreshold.alerts[0].threshold.windowMinutes = 0;
const thresholdFindings = validateSecurityAlertPolicy(invalidThreshold);
assert.ok(thresholdFindings.includes("alerts[0].threshold.value: must be a positive number"));
assert.ok(
  thresholdFindings.includes("alerts[0].threshold.windowMinutes: must be a positive integer"),
);

const incompleteRunbook = structuredClone(policy);
incompleteRunbook.alerts[0].runbook.investigationSteps = ["Only one step"];
assert.ok(
  validateSecurityAlertPolicy(incompleteRunbook).includes(
    "alerts[0].runbook.investigationSteps: must contain at least two steps",
  ),
);

const missingResponses = structuredClone(policy);
missingResponses.alerts[0].response.automatic = [];
missingResponses.alerts[0].response.manual = [];
const responseFindings = validateSecurityAlertPolicy(missingResponses);
assert.ok(
  responseFindings.includes("alerts[0].response.automatic: must define an automatic response"),
);
assert.ok(responseFindings.includes("alerts[0].response.manual: must define a manual response"));

const missingFalsePositiveReview = structuredClone(policy);
missingFalsePositiveReview.alerts[0].falsePositiveReview.steps = [];
assert.ok(
  validateSecurityAlertPolicy(missingFalsePositiveReview).includes(
    "alerts[0].falsePositiveReview.steps: must contain at least two steps",
  ),
);

const placeholderTest = structuredClone(policy);
placeholderTest.alerts[0].testMethod.procedure = "TODO replace me with a real test procedure";
assert.ok(
  validateSecurityAlertPolicy(placeholderTest).includes(
    "alerts[0].testMethod.procedure: must not contain placeholders",
  ),
);

const falseAlertStatus = structuredClone(policy);
falseAlertStatus.alerts[0].deploymentStatus = "deployed";
falseAlertStatus.alerts[0].metricBindingStatus = "verified";
falseAlertStatus.alerts[0].notificationDeliveryStatus = "verified";
falseAlertStatus.alerts[0].drillStatus = "verified";
const statusFindings = validateSecurityAlertPolicy(falseAlertStatus);
for (const expected of [
  "alerts[0].deploymentStatus: must be not-deployed",
  "alerts[0].metricBindingStatus: must be unverified",
  "alerts[0].notificationDeliveryStatus: must be unverified",
  "alerts[0].drillStatus: must be unverified",
]) {
  assert.ok(statusFindings.includes(expected), expected);
}

console.log(
  "security alert source catalog tests passed: 19 definitions; deployment, bindings, delivery and drills remain unverified",
);
