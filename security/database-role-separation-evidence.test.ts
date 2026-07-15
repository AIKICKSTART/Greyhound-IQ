import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { collectDatabaseCompatibilityInventory } from "../scripts/check-database-compatibility-inventory";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import {
  DATABASE_ROLE_SEPARATION_BOUNDARY,
  DATABASE_ROLE_SEPARATION_MASTER_EVIDENCE,
  DATABASE_RUNTIME_ROLE_VERIFIED_REQUIREMENT_IDS,
  DATABASE_SPECIALIST_ROLE_OPEN_REQUIREMENT_IDS,
} from "./database-role-separation-evidence";

const report = JSON.parse(
  readFileSync("security/row-level-security-runtime-evidence.json", "utf8"),
) as Record<string, unknown>;
const compatibility = collectDatabaseCompatibilityInventory();
const sourceBinding = report.sourceBinding as Record<string, unknown>;
const roleSeparation = report.roleSeparation as Record<string, unknown>;
const directGrants = roleSeparation.directGrants as Record<string, unknown>;
const cases = report.cases as Record<string, Record<string, number>>;

assert.equal(report.schemaVersion, 1);
assert.equal(report.auditKind, "rls-access-matrix");
assert.equal(report.verdict, "verified");
assert.deepEqual(report.sourceDefinedApplicationRoles, ["greyhoundiq_runtime"]);
assert.deepEqual(report.runtimeIdentity, {
  currentRole: "greyhoundiq_runtime",
  sessionRole: "greyhoundiq_runtime",
  superuser: false,
  bypassRls: false,
  createRole: false,
  createDatabase: false,
  replication: false,
  inherit: true,
  canLogin: true,
  connectionLimit: 40,
});
assert.deepEqual(roleSeparation.effectivePrivileges, {
  databaseConnect: true,
  databaseCreate: false,
  databaseTemporary: false,
  publicSchemaUsage: true,
  publicSchemaCreate: false,
  schemaCreateCount: 0,
});
assert.deepEqual(roleSeparation.ownership, {
  databaseCount: 0,
  relationCount: 0,
  routineCount: 0,
  schemaCount: 0,
});
assert.deepEqual(roleSeparation.memberships, {
  membershipCount: 0,
  adminOptionCount: 0,
});
assert.equal(directGrants.applicationDmlTableCount, compatibility.counts.models);
assert.equal(directGrants.projectionReadCount, 6);
assert.equal(directGrants.sequenceUsageCount, 1);
assert.equal(directGrants.routineCount, 44);
assert.equal(directGrants.securityDefinerRoutineCount, 27);
assert.equal(directGrants.grantableCount, 0);
assert.deepEqual(roleSeparation.systemCatalog, {
  directGrantCount: 0,
  sensitiveAuthCatalogSelect: false,
});
assert.deepEqual(roleSeparation.negativeControls, {
  functionCreateDenied: true,
  policyDisableDenied: true,
  roleAlterDenied: true,
  roleCreateDenied: true,
  schemaCreateDenied: true,
  sensitiveAuthCatalogReadDenied: true,
});
assert.deepEqual(cases.ownerA, {
  membershipA: 1,
  membershipB: 0,
  organizationA: 1,
  organizationB: 0,
  signupOutbox: 0,
});
assert.deepEqual(cases.ownerB, {
  membershipA: 0,
  membershipB: 1,
  organizationA: 0,
  organizationB: 1,
  signupOutbox: 0,
});
assert.equal(sourceBinding.prismaSchemaSha256, compatibility.schemaSha256);
assert.equal(sourceBinding.migrationsSha256, compatibility.migrationsSha256);
assert.equal(
  sourceBinding.verifierSha256,
  sha256(readFileSync("scripts/check-rls-access-matrix-postgres.ts")),
);

const sectionRequirements = MASTER_AUDIT_REQUIREMENTS.filter((requirement) =>
  requirement.id.startsWith("security.database-role-separation."),
);
assert.equal(sectionRequirements.length, 15);
assert.deepEqual(
  new Set([
    ...DATABASE_RUNTIME_ROLE_VERIFIED_REQUIREMENT_IDS,
    ...DATABASE_SPECIALIST_ROLE_OPEN_REQUIREMENT_IDS,
  ]),
  new Set(sectionRequirements.map((requirement) => requirement.id)),
);
assert.equal(
  Object.keys(DATABASE_ROLE_SEPARATION_MASTER_EVIDENCE).length,
  DATABASE_RUNTIME_ROLE_VERIFIED_REQUIREMENT_IDS.length,
);
for (const id of DATABASE_RUNTIME_ROLE_VERIFIED_REQUIREMENT_IDS) {
  const requirement = requirementById(id);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[id],
    DATABASE_ROLE_SEPARATION_MASTER_EVIDENCE[id],
  );
  assert.equal(isMasterRequirementComplete(requirement), true, id);
}
for (const id of DATABASE_SPECIALIST_ROLE_OPEN_REQUIREMENT_IDS) {
  assert.equal(isMasterRequirementComplete(requirementById(id)), false, id);
  assert.equal(DATABASE_ROLE_SEPARATION_MASTER_EVIDENCE[id], undefined, id);
}

assert.match(DATABASE_ROLE_SEPARATION_BOUNDARY.deployedScope, /No staging or production/u);
assert.match(DATABASE_ROLE_SEPARATION_BOUNDARY.systemCatalog, /default PUBLIC metadata/u);
assert.match(DATABASE_ROLE_SEPARATION_BOUNDARY.tenantBoundary, /workers-role requirement remains open/u);
assert.match(DATABASE_ROLE_SEPARATION_BOUNDARY.specialistRoleGap, /remain open/u);

console.log(
  `Database role separation passed: ${DATABASE_RUNTIME_ROLE_VERIFIED_REQUIREMENT_IDS.length}/15 controls verified; ${DATABASE_SPECIALIST_ROLE_OPEN_REQUIREMENT_IDS.length} specialist-role controls remain open`,
);

function requirementById(id: string) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.prompt === "security" && candidate.id === id,
  );
  assert.ok(requirement, `${id}: missing immutable requirement`);
  return requirement;
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}
