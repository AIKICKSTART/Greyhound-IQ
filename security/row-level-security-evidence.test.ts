import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { collectDatabaseCompatibilityInventory } from "../scripts/check-database-compatibility-inventory";
import {
  RLS_APPLICATION_AUTHORIZATION_REQUIREMENT_ID,
  RLS_RUNTIME_VERIFIED_REQUIREMENT_IDS,
  ROW_LEVEL_SECURITY_BOUNDARY,
  ROW_LEVEL_SECURITY_MASTER_EVIDENCE,
} from "./row-level-security-evidence";

const masterAuditEvidence = readFileSync(
  "src/components/master-audit-evidence.ts",
  "utf8",
);

const report = JSON.parse(
  readFileSync("security/row-level-security-runtime-evidence.json", "utf8"),
) as Record<string, unknown>;
const compatibility = collectDatabaseCompatibilityInventory();
const sourceBinding = report.sourceBinding as Record<string, unknown>;
const catalog = report.catalog as Record<string, unknown>;
const cases = report.cases as Record<string, unknown>;

assert.equal(report.schemaVersion, 1);
assert.equal(report.auditKind, "rls-access-matrix");
assert.equal(report.verdict, "verified");
assert.deepEqual(report.safety, {
  scope: "literal-loopback-disposable-database",
  target: { database: "greyhoundiq", host: "127.0.0.1", port: 55734 },
  productionContacted: false,
  mutation:
    "negative privilege probes and synthetic rows inside forced-rollback transactions",
  persistedSensitiveValues: false,
});
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
assert.deepEqual(report.sourceDefinedApplicationRoles, ["greyhoundiq_runtime"]);
assert.equal(compatibility.counts.createdRoles, 1);
assert.equal(sourceBinding.prismaSchemaSha256, compatibility.schemaSha256);
assert.equal(sourceBinding.migrationsSha256, compatibility.migrationsSha256);
assert.equal(
  sourceBinding.dbContextSha256,
  sha256(readFileSync("src/lib/db-context.ts")),
);
assert.equal(
  sourceBinding.verifierSha256,
  sha256(readFileSync("scripts/check-rls-access-matrix-postgres.ts")),
);
assert.equal(catalog.applicationModelCount, compatibility.counts.models);
assert.equal(catalog.rlsEnabledCount, compatibility.counts.models);
assert.equal(catalog.forceRlsCount, compatibility.counts.models);
assert.deepEqual(cases.anonymous, zeroCounts());
assert.deepEqual(cases.ownerA, ownerCounts());
assert.deepEqual(cases.ownerB, {
  membershipA: 0,
  membershipB: 1,
  organizationA: 0,
  organizationB: 1,
  signupOutbox: 0,
});
assert.deepEqual(cases.privilegedModerator, {
  membershipA: 1,
  membershipB: 1,
  organizationA: 1,
  organizationB: 1,
  signupOutbox: 0,
});
assert.deepEqual(cases.systemWorker, {
  membershipA: 1,
  membershipB: 1,
  organizationA: 1,
  organizationB: 1,
  signupOutbox: 1,
});
assert.deepEqual(report.rollback, { ...zeroCounts(), verified: true });
assert.equal(report.poolContextReset, true);

const dbContext = readFileSync("src/lib/db-context.ts", "utf8");
assert.match(dbContext, /prisma\.\$transaction\([\s\S]*setDbRequestContext/);
assert.match(dbContext, /prisma\.\$transaction\([\s\S]*setDbSystemContext/);
for (const setting of [
  "current_user_id",
  "current_profile_id",
  "current_actor_id",
  "current_tier",
  "current_role",
  "system",
]) {
  assert.match(
    dbContext,
    new RegExp(`set_config\\('app\\.${setting}',[\\s\\S]*?, true\\)`),
  );
}

assert.equal(ROW_LEVEL_SECURITY_BOUNDARY.exclusions[0].excludedCount, 0);
assert.match(ROW_LEVEL_SECURITY_BOUNDARY.deployedScope, /No staging or production/u);
assert.match(
  ROW_LEVEL_SECURITY_BOUNDARY.applicationAuthorizationGap,
  /remains partially verified/u,
);

for (const id of RLS_RUNTIME_VERIFIED_REQUIREMENT_IDS) {
  assert.equal(ROW_LEVEL_SECURITY_MASTER_EVIDENCE[id]?.status, "verified", id);
}
assert.equal(
  ROW_LEVEL_SECURITY_MASTER_EVIDENCE[
    RLS_APPLICATION_AUTHORIZATION_REQUIREMENT_ID
  ]?.status,
  "partially-verified",
);
assert.match(masterAuditEvidence, /\.\.\.ROW_LEVEL_SECURITY_MASTER_EVIDENCE/);

console.log(
  `RLS evidence passed: ${RLS_RUNTIME_VERIFIED_REQUIREMENT_IDS.length}/10 controls verified on disposable loopback; application authorization remains open`,
);

function zeroCounts() {
  return {
    membershipA: 0,
    membershipB: 0,
    organizationA: 0,
    organizationB: 0,
    signupOutbox: 0,
  };
}

function ownerCounts() {
  return {
    membershipA: 1,
    membershipB: 0,
    organizationA: 1,
    organizationB: 0,
    signupOutbox: 0,
  };
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}
