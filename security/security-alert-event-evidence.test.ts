import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { validateSecurityAlertPolicy } from "../scripts/check-security-alert-policy";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  SECURITY_ALERT_EVENT_EVIDENCE_SCOPE,
  SECURITY_ALERT_EVENT_MASTER_EVIDENCE,
  SECURITY_ALERT_EVENT_REQUIREMENT_IDS,
} from "./security-alert-event-evidence";

const policy = JSON.parse(
  readFileSync("config/security-alert-policy.json", "utf8"),
);

assert.deepEqual(validateSecurityAlertPolicy(policy), []);
assert.equal(SECURITY_ALERT_EVENT_REQUIREMENT_IDS.length, 19);
assert.equal(policy.alerts.length, SECURITY_ALERT_EVENT_REQUIREMENT_IDS.length);

const immutableAlertRequirements = SECURITY_MASTER_REQUIREMENTS.filter(({ id }) =>
  id.startsWith("security.alert-event."),
).map(({ id }) => id);
assert.deepEqual(
  new Set(SECURITY_ALERT_EVENT_REQUIREMENT_IDS),
  new Set(immutableAlertRequirements),
  "source catalog must cover every immutable security alert-event requirement",
);

assert.deepEqual(SECURITY_ALERT_EVENT_EVIDENCE_SCOPE, {
  sourceDefinitionsVerified: true,
  deploymentVerified: false,
  metricBindingsVerified: false,
  notificationDeliveryVerified: false,
  drillsVerified: false,
});
assert.equal(policy.status, "source-definition-only");
assert.equal(policy.evidence.deployed, false);
assert.equal(policy.evidence.metricBindingsVerified, false);
assert.equal(policy.evidence.notificationDeliveryTested, false);
assert.equal(policy.evidence.drillsExecuted, false);
assert.equal(policy.evidence.lastDrillAt, null);

for (const requirementId of SECURITY_ALERT_EVENT_REQUIREMENT_IDS) {
  const immutableRequirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.prompt === "security" && candidate.id === requirementId,
  );
  assert.ok(immutableRequirement, `${requirementId}: missing immutable requirement`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    SECURITY_ALERT_EVENT_MASTER_EVIDENCE[requirementId],
  );
  assert.equal(
    isMasterRequirementComplete(immutableRequirement),
    true,
    `${requirementId}: source definition should be complete`,
  );

  const alert = policy.alerts.find(
    (candidate: { requirementId: string }) => candidate.requirementId === requirementId,
  );
  assert.ok(alert, `${requirementId}: missing alert definition`);
  assert.equal(alert.deploymentStatus, "not-deployed");
  assert.equal(alert.metricBindingStatus, "unverified");
  assert.equal(alert.notificationDeliveryStatus, "unverified");
  assert.equal(alert.drillStatus, "unverified");
}

const evidencePaths = new Set(
  Object.values(SECURITY_ALERT_EVENT_MASTER_EVIDENCE).flatMap(({ evidence }) => evidence),
);
for (const evidencePath of evidencePaths) {
  assert.equal(existsSync(evidencePath), true, `missing evidence path ${evidencePath}`);
}

console.log(
  "security alert event evidence passed: 19 source definitions complete; deployment, metric bindings, notification delivery and drills remain unverified",
);
