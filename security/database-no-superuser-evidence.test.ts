import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { DATABASE_OPERATIONS } from "./database-operations";
import {
  DATABASE_NO_SUPERUSER_EVIDENCE,
  DATABASE_NO_SUPERUSER_MASTER_EVIDENCE,
  DATABASE_NO_SUPERUSER_REQUIREMENT_ID,
  findDatabaseNoSuperuserEvidenceIssues,
} from "./database-no-superuser-evidence";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";

const report = JSON.parse(
  readFileSync("security/row-level-security-runtime-evidence.json", "utf8"),
) as unknown;
assert.deepEqual(findDatabaseNoSuperuserEvidenceIssues(report), []);

for (const mutation of [
  (copy: Record<string, unknown>) => {
    (copy.runtimeIdentity as Record<string, unknown>).superuser = true;
  },
  (copy: Record<string, unknown>) => {
    (copy.runtimeIdentity as Record<string, unknown>).bypassRls = true;
  },
  (copy: Record<string, unknown>) => {
    (copy.runtimeIdentity as Record<string, unknown>).currentRole = "postgres";
  },
  (copy: Record<string, unknown>) => {
    const separation = copy.roleSeparation as Record<string, unknown>;
    (separation.ownership as Record<string, unknown>).databaseCount = 1;
  },
]) {
  const forged = structuredClone(report) as Record<string, unknown>;
  mutation(forged);
  assert.ok(findDatabaseNoSuperuserEvidenceIssues(forged).length > 0);
}

const applicationOperations = DATABASE_OPERATIONS.filter(
  (operation) => operation.databaseRole === "greyhoundiq_runtime",
);
assert.equal(applicationOperations.length, 26);
assert.ok(
  applicationOperations.every(
    (operation) => operation.verificationStatus === "Verified",
  ),
);
const externalRoleOperations = DATABASE_OPERATIONS.filter(
  (operation) => operation.databaseRole !== "greyhoundiq_runtime",
);
assert.deepEqual(
  externalRoleOperations.map((operation) => ({
    queryId: operation.queryId,
    role: operation.databaseRole,
    driver: operation.ormOrDriver,
  })),
  [
    {
      queryId: "DB.PULSE.REALTIME_GRANT.REVOKE",
      role: "service_role",
      driver: "Supabase JavaScript client",
    },
  ],
);

const requirement = MASTER_AUDIT_REQUIREMENTS.find(
  (candidate) =>
    candidate.prompt === "security" &&
    candidate.id === DATABASE_NO_SUPERUSER_REQUIREMENT_ID,
);
assert.ok(requirement);
assert.deepEqual(
  SECURITY_MASTER_EVIDENCE[DATABASE_NO_SUPERUSER_REQUIREMENT_ID],
  DATABASE_NO_SUPERUSER_MASTER_EVIDENCE[
    DATABASE_NO_SUPERUSER_REQUIREMENT_ID
  ],
);
assert.equal(isMasterRequirementComplete(requirement), true);
for (const evidencePath of DATABASE_NO_SUPERUSER_EVIDENCE) {
  assert.ok(existsSync(evidencePath), evidencePath);
}

console.log(
  "database no-superuser evidence passed: 26 verified app operations use the restricted greyhoundiq_runtime identity",
);
