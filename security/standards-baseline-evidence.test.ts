import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  SECURITY_STANDARDS_BASELINES,
  SECURITY_STANDARDS_MASTER_EVIDENCE,
} from "./standards-baseline-evidence";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";

const requirements = MASTER_AUDIT_REQUIREMENTS.filter(
  (requirement) =>
    requirement.prompt === "security" &&
    requirement.section === "standards-baseline",
);
const recordsById = new Map(
  SECURITY_STANDARDS_BASELINES.map((baseline) => [
    baseline.requirementId,
    baseline,
  ]),
);

assert.equal(SECURITY_STANDARDS_BASELINES.length, 11);
assert.equal(recordsById.size, SECURITY_STANDARDS_BASELINES.length);
assert.deepEqual(
  [...recordsById.keys()].toSorted(),
  requirements.map((requirement) => requirement.id).toSorted(),
);
assert.equal(
  SECURITY_STANDARDS_BASELINES.filter((baseline) => baseline.status === "verified")
    .length,
  10,
);
assert.equal(Object.keys(SECURITY_STANDARDS_MASTER_EVIDENCE).length, 10);

const baselineDoc = readFileSync(
  "docs/security/standards-baseline.md",
  "utf8",
);
for (const baseline of SECURITY_STANDARDS_BASELINES) {
  assert.match(baseline.officialSource, /^https:\/\//);
  assert.ok(baseline.decision.trim());
  assert.ok(baseline.localControls.length > 0);
  assert.match(baselineDoc, new RegExp(escapeRegExp(baseline.officialSource)));
  for (const localControl of baseline.localControls) {
    assert.ok(existsSync(localControl), `${localControl} must exist`);
  }

  const requirement = requirements.find(
    (candidate) => candidate.id === baseline.requirementId,
  );
  assert.ok(requirement);
  assert.equal(
    isMasterRequirementComplete(requirement),
    baseline.status === "verified",
    `${baseline.requirementId} must follow the reviewed baseline decision`,
  );
  if (baseline.status === "verified") {
    assert.deepEqual(
      SECURITY_MASTER_EVIDENCE[baseline.requirementId],
      SECURITY_STANDARDS_MASTER_EVIDENCE[baseline.requirementId],
    );
  } else {
    assert.ok(baseline.knownGap?.trim());
    assert.equal(SECURITY_MASTER_EVIDENCE[baseline.requirementId], undefined);
  }
}

assert.match(
  readFileSync("docs/security/security-architecture.md", "utf8"),
  /OWASP ASVS 5\.0\.0[\s\S]*OWASP Top 10:2025[\s\S]*NIST SSDF 1\.1/,
);
assert.match(
  readFileSync(".spectral.yaml", "utf8"),
  /@stoplight\/spectral-owasp-ruleset/,
);
assert.match(
  readFileSync("docs/security/privacy-data-lifecycle.md", "utf8"),
  /APP 11[\s\S]*(?:destroy|de-identif)/i,
);
assert.match(
  readFileSync("docs/security/incident-response.md", "utf8"),
  /Notifiable Data Breaches|NDB/i,
);
assert.match(
  baselineDoc,
  /SP 800-218 Rev\. 1 draft[\s\S]*does not replace the final 1\.1 baseline/i,
);

const stripeService = readFileSync(
  "src/lib/billing/stripe-service.ts",
  "utf8",
);
const prismaSchema = readFileSync("prisma/schema.prisma", "utf8");
assert.match(stripeService, /stripe\.checkout\.sessions\.create/);
assert.match(stripeService, /billingPortal\.sessions\.create/);
assert.doesNotMatch(
  prismaSchema,
  /\b(?:cardNumber|primaryAccountNumber|cardCvc|cardCvv)\b/i,
);
assert.match(
  baselineDoc,
  /exact merchant and SAQ scope still needs qualified owner approval/i,
);
assert.match(
  readFileSync("docs/security/release-security-report.md", "utf8"),
  /not a production-readiness approval|not.*perfect security/i,
);

console.log("Security standards baseline passed: 10/11 adoption decisions verified; PCI scope remains open");

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
