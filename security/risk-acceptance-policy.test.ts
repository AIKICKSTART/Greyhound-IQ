import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
  type MasterAuditRequirement,
} from "../src/components/master-audit-requirements";
import {
  RISK_ACCEPTANCE_POLICY_IDS,
  RISK_ACCEPTANCE_POLICY_MASTER_EVIDENCE,
} from "./risk-acceptance-policy-evidence";

const template = MASTER_AUDIT_REQUIREMENTS.find(
  (requirement) => requirement.id === RISK_ACCEPTANCE_POLICY_IDS[0],
);
assert.ok(template);

const accepted: MasterAuditRequirement = {
  ...template,
  status: "risk-accepted-temporarily",
  evidence: ["test:risk-acceptance"],
  riskAcceptance: {
    owner: "Named security owner",
    reason: "Time-bounded low residual risk.",
    severity: "low",
    compensatingControls: ["Deny and alert on the unsafe branch"],
    expiresOn: "2099-01-01",
    remediationPlan: "Replace the temporary control.",
    retestRequirement: "Repeat the negative test before expiry.",
  },
};

assert.equal(isMasterRequirementComplete(accepted), true);

const rejected: MasterAuditRequirement[] = [
  { ...accepted, riskAcceptance: { ...accepted.riskAcceptance!, owner: "" } },
  { ...accepted, riskAcceptance: { ...accepted.riskAcceptance!, reason: "" } },
  { ...accepted, riskAcceptance: { ...accepted.riskAcceptance!, severity: "high" } },
  { ...accepted, riskAcceptance: { ...accepted.riskAcceptance!, severity: "critical" } },
  { ...accepted, riskAcceptance: { ...accepted.riskAcceptance!, compensatingControls: [] } },
  { ...accepted, riskAcceptance: { ...accepted.riskAcceptance!, expiresOn: "2000-01-01" } },
  { ...accepted, riskAcceptance: { ...accepted.riskAcceptance!, remediationPlan: "" } },
  { ...accepted, riskAcceptance: { ...accepted.riskAcceptance!, retestRequirement: "" } },
];

for (const candidate of rejected) {
  assert.equal(isMasterRequirementComplete(candidate), false);
}

assert.equal(RISK_ACCEPTANCE_POLICY_IDS.length, 8);
for (const id of RISK_ACCEPTANCE_POLICY_IDS) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.prompt === "security" && candidate.id === id,
  );
  assert.ok(requirement, `${id}: missing immutable requirement`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[id],
    RISK_ACCEPTANCE_POLICY_MASTER_EVIDENCE[id],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
  for (const evidencePath of SECURITY_MASTER_EVIDENCE[id].evidence) {
    assert.ok(existsSync(evidencePath), `${id}: missing ${evidencePath}`);
  }
}

console.log("risk acceptance policy evidence passed: 8 fail-closed requirements");
