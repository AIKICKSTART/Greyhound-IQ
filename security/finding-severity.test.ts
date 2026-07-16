import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  FINDING_SEVERITY_EVIDENCE_PATHS,
  FINDING_SEVERITY_EVIDENCE_SCOPE,
  FINDING_SEVERITY_MASTER_EVIDENCE,
  FINDING_SEVERITY_REQUIREMENT_FACTOR,
  FINDING_SEVERITY_REQUIREMENT_IDS,
} from "./finding-severity-evidence";
import {
  FINDING_SEVERITY_FACTORS,
  buildFindingSeverityAssessments,
  validateFindingSeverityAssessments,
  type FindingSeverityAssessment,
} from "./finding-severity";
import { loadSecurityFindings } from "./security-findings";

const findings = loadSecurityFindings();
const assessments = buildFindingSeverityAssessments(findings);

assert.equal(findings.length, 12);
assert.equal(assessments.length, findings.length);
assert.deepEqual(validateFindingSeverityAssessments(findings, assessments), []);
assert.equal(FINDING_SEVERITY_FACTORS.length, 12);
assert.equal(FINDING_SEVERITY_REQUIREMENT_IDS.length, 12);
assert.deepEqual(
  Object.values(FINDING_SEVERITY_REQUIREMENT_FACTOR).toSorted(),
  [...FINDING_SEVERITY_FACTORS].toSorted(),
);
assert.match(FINDING_SEVERITY_EVIDENCE_SCOPE, /does not prove/i);

const requirements = MASTER_AUDIT_REQUIREMENTS.filter(
  (requirement) =>
    requirement.prompt === "security" &&
    requirement.section === "finding-severity",
);
assert.deepEqual(
  requirements.map((requirement) => requirement.id).toSorted(),
  [...FINDING_SEVERITY_REQUIREMENT_IDS].toSorted(),
);
for (const requirementId of FINDING_SEVERITY_REQUIREMENT_IDS) {
  const requirement = requirements.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: immutable requirement missing`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    FINDING_SEVERITY_MASTER_EVIDENCE[requirementId],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
  for (const evidencePath of FINDING_SEVERITY_EVIDENCE_PATHS) {
    assert.ok(existsSync(evidencePath), `${requirementId}: missing ${evidencePath}`);
  }
}

for (const assessment of assessments) {
  assert.match(assessment.assessmentId, /^severity:SEC-H-\d{3}$/);
  assert.match(assessment.obscurityRule, /never lowers/i);
  assert.ok(assessment.exploitability.includes("Attack preconditions:"));
  assert.ok(assessment.scale.includes("Affected environments:"));
  assert.ok(assessment.recoverability.includes("Containment:"));
}

const missingFactor = {
  ...assessments[0],
  exploitability: "",
} satisfies FindingSeverityAssessment;
assert.ok(
  validateFindingSeverityAssessments(findings, [
    missingFactor,
    ...assessments.slice(1),
  ]).includes(`MISSING_FACTOR:${assessments[0].assessmentId}:exploitability`),
);
assert.ok(
  validateFindingSeverityAssessments(findings, assessments.slice(1)).includes(
    `MISSING_ASSESSMENT:${assessments[0].assessmentId}`,
  ),
);
const obscurityDowngrade = {
  ...assessments[0],
  obscurityRule: "undocumented routes are lower severity",
};
assert.ok(
  validateFindingSeverityAssessments(
    findings,
    assessments.map((assessment) =>
      assessment.assessmentId === obscurityDowngrade.assessmentId
        ? obscurityDowngrade
        : assessment,
    ),
  ).includes(`OBSCURITY_DOWNGRADE:${assessments[0].assessmentId}`),
);

console.log(
  `finding severity evidence passed: ${assessments.length} findings x ${FINDING_SEVERITY_FACTORS.length} explicit factors, ${FINDING_SEVERITY_REQUIREMENT_IDS.length} exact gates`,
);
