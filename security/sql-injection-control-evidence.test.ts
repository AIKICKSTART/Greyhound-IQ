import assert from "node:assert/strict";

import { auditProductionSqlSafety } from "../scripts/check-production-sql-safety";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import { SECURITY_CI_MASTER_EVIDENCE } from "./ci-gate-evidence";
import {
  SQL_INJECTION_CONTROL_MASTER_EVIDENCE,
  VERIFIED_SQL_INJECTION_CONTROL_IDS,
} from "./sql-injection-control-evidence";

const audit = auditProductionSqlSafety(process.cwd());
assert.deepEqual(audit.violations, []);
assert.ok(audit.safeRawOperationCount > 0);

for (const requirementId of VERIFIED_SQL_INJECTION_CONTROL_IDS) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    SQL_INJECTION_CONTROL_MASTER_EVIDENCE[requirementId],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
}

const ciRequirementId = "security.ci.12.unsafe-query-interpolation";
const ciRequirement = MASTER_AUDIT_REQUIREMENTS.find(
  (candidate) => candidate.id === ciRequirementId,
);
assert.ok(ciRequirement, `${ciRequirementId}: missing immutable requirement`);
assert.deepEqual(
  SECURITY_MASTER_EVIDENCE[ciRequirementId],
  SECURITY_CI_MASTER_EVIDENCE[ciRequirementId],
);
assert.equal(isMasterRequirementComplete(ciRequirement), true);

console.log(
  "SQL injection controls passed: production raw operations are parameterized, identifiers remain static, Prisma.raw is forbidden, and unsafe interpolation fails CI.",
);
