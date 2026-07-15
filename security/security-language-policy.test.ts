import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { VERIFICATION_STATUSES } from "./shared";
import { SECURITY_LANGUAGE_POLICY_MASTER_EVIDENCE } from "./security-language-policy-evidence";
import {
  SECURITY_LANGUAGE_POLICY_IDS,
  findUnsupportedSecurityAssuranceClaims,
  hasCompleteVerificationStatusVocabulary,
} from "./security-language-policy";

assert.equal(SECURITY_LANGUAGE_POLICY_IDS.length, 15);
assert.equal(hasCompleteVerificationStatusVocabulary(), true);
assert.deepEqual(VERIFICATION_STATUSES, [
  "Verified",
  "Partially verified",
  "Not verified",
  "Control missing",
  "Implementation vulnerable",
  "Test coverage missing",
  "Blocked from release",
  "Risk accepted temporarily",
  "Not applicable with justification",
]);

assert.deepEqual(
  findUnsupportedSecurityAssuranceClaims(
    "The system is perfectly secure.\nThe hidden route is secure because it is hidden.",
  ),
  ["1:perfectly-secure", "2:hidden-route-security"],
);
assert.deepEqual(
  findUnsupportedSecurityAssuranceClaims(
    "Do not claim the system is perfectly secure.\nThe system is not fully protected.",
  ),
  [],
);

const maintainedReports = [
  ...walkMarkdown("docs/security"),
  ...walkMarkdown("docs/architecture"),
];
assert.ok(maintainedReports.length > 0);
for (const report of maintainedReports) {
  assert.deepEqual(
    findUnsupportedSecurityAssuranceClaims(readFileSync(report, "utf8")),
    [],
    `${report}: unsupported security assurance claim`,
  );
}

for (const id of SECURITY_LANGUAGE_POLICY_IDS) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.prompt === "security" && candidate.id === id,
  );
  assert.ok(requirement, `${id}: missing immutable requirement`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[id],
    SECURITY_LANGUAGE_POLICY_MASTER_EVIDENCE[id],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
  for (const evidencePath of SECURITY_MASTER_EVIDENCE[id].evidence) {
    assert.ok(existsSync(evidencePath), `${id}: missing ${evidencePath}`);
  }
}

console.log("security language policy evidence passed: 15 exact requirements");

function walkMarkdown(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const target = path.join(directory, entry);
    return statSync(target).isDirectory()
      ? walkMarkdown(target)
      : target.endsWith(".md")
        ? [target]
        : [];
  });
}
