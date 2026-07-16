import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import {
  AUDIT_INTEGRITY_MASTER_EVIDENCE,
  AUDIT_INTEGRITY_REQUIREMENT_ID,
} from "./audit-integrity-evidence";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const baseRls = readFileSync(
  "prisma/migrations/20260706223000_add_rls_entitlement_policies/migration.sql",
  "utf8",
);
const forceRls = readFileSync(
  "prisma/migrations/20260708170000_force_row_level_security/migration.sql",
  "utf8",
);
const restrictedAudit = readFileSync(
  "prisma/migrations/20260708192000_restrict_audit_ratelimit_rls/migration.sql",
  "utf8",
);

assert.match(
  schema,
  /model AuditLog \{[\s\S]*createdAt\s+DateTime @default\(now\(\)\)[\s\S]*\n\}/,
);
assert.doesNotMatch(
  schema.match(/model AuditLog \{[\s\S]*?\n\}/)?.[0] ?? "",
  /updatedAt|deletedAt/,
);

assert.match(baseRls, /CREATE ROLE greyhoundiq_runtime NOLOGIN NOBYPASSRLS/);
assert.match(baseRls, /ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY/);
assert.match(
  baseRls,
  /CREATE POLICY giq_audit_log_select ON "AuditLog" FOR SELECT/,
);
assert.match(
  restrictedAudit,
  /CREATE POLICY giq_audit_log_insert ON "AuditLog"\s+FOR INSERT WITH CHECK/,
);

const auditPolicies = `${baseRls}\n${restrictedAudit}`
  .split(";")
  .filter((statement) => /POLICY\s+giq_audit_log_/i.test(statement))
  .join(";\n");
assert.doesNotMatch(auditPolicies, /FOR\s+(?:UPDATE|DELETE|ALL)\b/i);

assert.match(forceRls, /AND c\.relrowsecurity/);
assert.match(forceRls, /AND NOT c\.relforcerowsecurity/);
assert.match(
  forceRls,
  /ALTER TABLE %s FORCE ROW LEVEL SECURITY/,
  "the post-RLS migration must force every already protected table, including AuditLog",
);

const requirement = MASTER_AUDIT_REQUIREMENTS.find(
  (candidate) => candidate.id === AUDIT_INTEGRITY_REQUIREMENT_ID,
);
assert.ok(requirement, "the immutable audit-integrity requirement must exist");
assert.deepEqual(
  SECURITY_MASTER_EVIDENCE[AUDIT_INTEGRITY_REQUIREMENT_ID],
  AUDIT_INTEGRITY_MASTER_EVIDENCE[AUDIT_INTEGRITY_REQUIREMENT_ID],
);
assert.equal(isMasterRequirementComplete(requirement), true);

console.log(
  "audit integrity passed: forced RLS permits ordinary application SELECT/INSERT but no UPDATE/DELETE policy",
);
