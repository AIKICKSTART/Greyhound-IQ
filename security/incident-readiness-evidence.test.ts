import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  INCIDENT_READINESS_EVIDENCE_PATHS,
  INCIDENT_READINESS_EVIDENCE_SCOPE,
  INCIDENT_READINESS_MASTER_EVIDENCE,
  isIncidentReadinessRequirementId,
} from "./incident-readiness-evidence";
import {
  INCIDENT_READINESS_REQUIREMENT_IDS,
  INCIDENT_SCENARIO_PROCEDURES,
  NDB_RESPONSIBILITIES,
  parseIncidentReadinessDocument,
  validateIncidentReadinessDocument,
} from "./incident-readiness";

const incidentDocumentPath = "docs/security/incident-response.md";
const incidentDocument = readFileSync(incidentDocumentPath, "utf8");
const immutableRequirements = SECURITY_MASTER_REQUIREMENTS.filter(
  (requirement) => requirement.section === "incident-readiness",
);

assert.equal(INCIDENT_SCENARIO_PROCEDURES.length, 14);
assert.equal(NDB_RESPONSIBILITIES.length, 5);
assert.equal(INCIDENT_READINESS_REQUIREMENT_IDS.length, 19);
assert.equal(new Set(INCIDENT_READINESS_REQUIREMENT_IDS).size, 19);
assert.equal(INCIDENT_READINESS_EVIDENCE_SCOPE, "documented-procedure-existence-only");
assert.deepEqual(
  [...INCIDENT_READINESS_REQUIREMENT_IDS].toSorted(),
  immutableRequirements.map((requirement) => requirement.id).toSorted(),
  "the evidence map must cover exactly the 19 immutable incident-readiness requirements",
);
assert.deepEqual(
  Object.keys(INCIDENT_READINESS_MASTER_EVIDENCE).toSorted(),
  [...INCIDENT_READINESS_REQUIREMENT_IDS].toSorted(),
);

for (const requirementId of INCIDENT_READINESS_REQUIREMENT_IDS) {
  assert.equal(isIncidentReadinessRequirementId(requirementId), true);
  assert.equal(
    INCIDENT_READINESS_MASTER_EVIDENCE[requirementId].status,
    "verified",
  );
  assert.deepEqual(
    INCIDENT_READINESS_MASTER_EVIDENCE[requirementId].evidence,
    INCIDENT_READINESS_EVIDENCE_PATHS,
  );
}
assert.equal(isIncidentReadinessRequirementId("security.incident-readiness.unknown"), false);
for (const evidencePath of INCIDENT_READINESS_EVIDENCE_PATHS) {
  assert.ok(existsSync(evidencePath), `missing evidence source ${evidencePath}`);
}

const parsed = parseIncidentReadinessDocument(incidentDocument);
assert.deepEqual(parsed.findings, []);
assert.equal(parsed.scenarioRows.length, 14);
assert.deepEqual(validateIncidentReadinessDocument(incidentDocument), []);

const accountRow = lineStartingWith(incidentDocument, "| Account compromise |");
const withoutAccount = incidentDocument.replace(`${accountRow}\n`, "");
assert.ok(
  validateIncidentReadinessDocument(withoutAccount).includes(
    "SCENARIO_MISSING:security.incident-readiness.account-compromise",
  ),
  "removing one scenario row must fail closed",
);

const duplicateAccount = incidentDocument.replace(
  accountRow,
  `${accountRow}\n${accountRow}`,
);
assert.ok(
  validateIncidentReadinessDocument(duplicateAccount).includes(
    "SCENARIO_DUPLICATE:security.incident-readiness.account-compromise",
  ),
  "duplicating one scenario row must fail closed",
);

const malwareRow = lineStartingWith(incidentDocument, "| Malware upload |");
const blankContainment = incidentDocument.replace(
  malwareRow,
  malwareRow.replace(
    /^\| Malware upload \| [^|]+ \|/,
    "| Malware upload |  |",
  ),
);
assert.ok(
  validateIncidentReadinessDocument(blankContainment).includes(
    "SCENARIO_PROCEDURE_INCOMPLETE:security.incident-readiness.malware-upload:immediate-containment",
  ),
  "a scenario label without its containment procedure must fail closed",
);

const withoutScenarioSection = removeLevelTwoSection(
  incidentDocument,
  "Scenario playbooks",
);
const missingScenarioSectionFindings = validateIncidentReadinessDocument(
  withoutScenarioSection,
);
assert.ok(
  missingScenarioSectionFindings.includes("SECTION_MISSING:Scenario playbooks"),
);
assert.ok(
  missingScenarioSectionFindings.includes(
    "SCENARIO_MISSING:security.incident-readiness.accidental-deletion",
  ),
  "removing the scenario section must report the missing procedures",
);

const weakenedAssessment = incidentDocument.replace(
  "likely serious harm",
  "impact severity",
);
assert.ok(
  validateIncidentReadinessDocument(weakenedAssessment).includes(
    "NDB_RESPONSIBILITY_INCOMPLETE:security.incident-readiness.ndb-assessment:2. Assess and investigate",
  ),
  "removing an NDB assessment duty must fail closed",
);

const withoutEvidenceSection = removeLevelTwoSection(
  incidentDocument,
  "Evidence handling",
);
assert.ok(
  validateIncidentReadinessDocument(withoutEvidenceSection).includes(
    "NDB_SECTION_MISSING:security.incident-readiness.ndb-evidence:Evidence handling",
  ),
  "removing the evidence-preservation section must fail closed",
);

const withoutCommunicationsOwner = incidentDocument.replace(
  /^\| Communications owner \|.*\r?\n/m,
  "",
);
assert.ok(
  validateIncidentReadinessDocument(withoutCommunicationsOwner).includes(
    "NDB_RESPONSIBILITY_INCOMPLETE:security.incident-readiness.ndb-communications:Activation and authority",
  ),
  "removing the NDB communications responsibility must fail closed",
);

const falseDrillClaim = incidentDocument.replace(
  "Operational baseline — drill not verified",
  "Operational baseline — drill verified",
);
assert.ok(
  validateIncidentReadinessDocument(falseDrillClaim).includes(
    "EVIDENCE_BOUNDARY_MISSING:drill-not-verified",
  ),
  "the evidence cannot be promoted into a drill claim",
);

console.log(
  "incident readiness evidence passed: 14 scenario procedures and 5 NDB responsibilities documented; drills remain unverified",
);

function lineStartingWith(source: string, prefix: string) {
  const line = source.split(/\r?\n/).find((candidate) =>
    candidate.startsWith(prefix),
  );
  assert.ok(line, `missing fixture row ${prefix}`);
  return line;
}

function removeLevelTwoSection(source: string, heading: string) {
  const marker = `## ${heading}`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `missing fixture section ${heading}`);
  const next = source.indexOf("\n## ", start + marker.length);
  const end = next >= 0 ? next + 1 : source.length;
  return `${source.slice(0, start)}${source.slice(end)}`;
}
