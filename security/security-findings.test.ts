import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import {
  SECURITY_FINDING_FIELD_BINDINGS,
  SECURITY_FINDING_MASTER_EVIDENCE,
} from "./security-finding-evidence";
import {
  SECURITY_FINDING_FIELD_LABELS,
  loadSecurityFindings,
  validateSecurityFindings,
} from "./security-findings";

const bindings = Object.entries(SECURITY_FINDING_FIELD_BINDINGS);
const findings = loadSecurityFindings();
assert.equal(bindings.length, 28);
assert.deepEqual(
  bindings.map(([, field]) => field).toSorted(),
  Object.keys(SECURITY_FINDING_FIELD_LABELS).toSorted(),
);
assert.equal(findings.length, 12);
assert.deepEqual(validateSecurityFindings(findings), []);
assert.equal(
  new Set(findings.map((finding) => finding.findingId)).size,
  findings.length,
);

for (const [id] of bindings) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.prompt === "security" && candidate.id === id,
  );
  assert.ok(requirement, `${id}: missing immutable requirement`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[id],
    SECURITY_FINDING_MASTER_EVIDENCE[id],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
  for (const evidencePath of SECURITY_FINDING_MASTER_EVIDENCE[id].evidence) {
    assert.ok(existsSync(evidencePath), `${id}: missing ${evidencePath}`);
  }
}

const forged = findings.map((finding) => ({ ...finding }));
forged[0].owner = "";
assert.deepEqual(validateSecurityFindings(forged), ["SEC-H-001:owner"]);

console.log(
  "security finding evidence passed: 28 fields across 12 maintained findings",
);
