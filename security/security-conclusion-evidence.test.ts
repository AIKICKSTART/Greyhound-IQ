import assert from "node:assert/strict";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import {
  ALLOWED_NARROW_SECURITY_VERIFICATION_SCOPES,
  findFrontendOnlyCompletedSecurityConclusionIds,
  isNonFrontendSecurityEvidencePath,
  NO_FRONTEND_ONLY_CONCLUSION_MASTER_EVIDENCE,
  NO_FRONTEND_ONLY_CONCLUSION_REQUIREMENT_ID,
} from "./security-conclusion-evidence";

const completedSecurityConclusions = MASTER_AUDIT_REQUIREMENTS.filter(
  (requirement) =>
    requirement.prompt === "security" &&
    isMasterRequirementComplete(requirement),
).map(({ id, evidence, verificationScope }) => ({
  id,
  evidence,
  verificationScope,
}));

assert.ok(completedSecurityConclusions.length > 0);
assert.deepEqual(
  findFrontendOnlyCompletedSecurityConclusionIds(completedSecurityConclusions),
  [],
  "no completed security conclusion may rely only on frontend behavior",
);

assert.deepEqual(
  SECURITY_MASTER_EVIDENCE[NO_FRONTEND_ONLY_CONCLUSION_REQUIREMENT_ID],
  NO_FRONTEND_ONLY_CONCLUSION_MASTER_EVIDENCE[
    NO_FRONTEND_ONLY_CONCLUSION_REQUIREMENT_ID
  ],
);
const releaseRequirement = MASTER_AUDIT_REQUIREMENTS.find(
  ({ id }) => id === NO_FRONTEND_ONLY_CONCLUSION_REQUIREMENT_ID,
);
assert.ok(releaseRequirement);
assert.equal(isMasterRequirementComplete(releaseRequirement), true);

assert.deepEqual(ALLOWED_NARROW_SECURITY_VERIFICATION_SCOPES, [
  "output-existence-only",
  "final-report-structure-only",
]);
assert.deepEqual(
  findFrontendOnlyCompletedSecurityConclusionIds([
    {
      id: "frontend-only",
      evidence: [
        "src/components/security-badge.tsx",
        "src/app/account/page.tsx",
        "public/security-badge.svg",
      ],
    },
    { id: "missing-evidence", evidence: [] },
  ]),
  ["frontend-only", "missing-evidence"],
);
assert.deepEqual(
  findFrontendOnlyCompletedSecurityConclusionIds([
    {
      id: "server-control",
      evidence: ["src/lib/auth.ts"],
    },
    {
      id: "source-contract-test",
      evidence: ["security/server-boundary.test.ts"],
    },
    {
      id: "narrow-structure",
      evidence: ["src/components/report.tsx"],
      verificationScope: "final-report-structure-only",
    },
  ]),
  [],
);
assert.deepEqual(
  findFrontendOnlyCompletedSecurityConclusionIds([
    {
      id: "unsupported-scope",
      evidence: ["src/components/security-badge.tsx"],
      verificationScope: "runtime-control",
    },
  ]),
  ["unsupported-scope"],
);

assert.equal(isNonFrontendSecurityEvidencePath("security/control.test.ts"), true);
assert.equal(isNonFrontendSecurityEvidencePath("src/app/callback/route.ts"), true);
assert.equal(
  isNonFrontendSecurityEvidencePath(
    "src/components/security-required-input-evidence.test.ts",
  ),
  true,
);
assert.equal(isNonFrontendSecurityEvidencePath("src/components/control.test.ts"), false);
assert.equal(isNonFrontendSecurityEvidencePath("src/components/control.test.tsx"), false);
assert.equal(isNonFrontendSecurityEvidencePath("src/components/control.tsx"), false);
assert.equal(isNonFrontendSecurityEvidencePath("docs/security/assertion.md"), false);
assert.equal(isNonFrontendSecurityEvidencePath("../outside/control.ts"), false);

for (const requirementId of [
  "security.release.21.secrets-outside-source-client",
  "security.release.28.report-accurate-residual-risk",
  "security.release.29.no-fabricated-evidence",
]) {
  assert.equal(
    Object.hasOwn(NO_FRONTEND_ONLY_CONCLUSION_MASTER_EVIDENCE, requirementId),
    false,
  );
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    ({ id }) => id === requirementId,
  );
  assert.ok(requirement);
  assert.equal(isMasterRequirementComplete(requirement), false);
}

console.log(
  `Security conclusion evidence passed: ${completedSecurityConclusions.length} completed conclusions include non-frontend evidence or an allowed narrow scope`,
);
