import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { collectDatabaseCompatibilityInventory } from "../scripts/check-database-compatibility-inventory";
import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import { BILLING_LIFECYCLE_UNRESOLVED_CONTROL_IDS } from "./billing-lifecycle-evidence";
import {
  BILLING_INVOICE_OWNERSHIP_BOUNDARY,
  BILLING_INVOICE_OWNERSHIP_MASTER_EVIDENCE,
} from "./billing-invoice-ownership-evidence";

const requirementId = "security.billing-control.invoice-ownership";
const evidence = BILLING_INVOICE_OWNERSHIP_MASTER_EVIDENCE[requirementId];
const requirement = SECURITY_MASTER_REQUIREMENTS.find(
  (candidate) => candidate.id === requirementId,
);
assert.ok(requirement, `${requirementId}: missing immutable requirement`);
assert.equal(requirement.section, "billing-control");
assert.equal(evidence.status, "verified");
assert.deepEqual(Object.keys(BILLING_INVOICE_OWNERSHIP_MASTER_EVIDENCE), [
  requirementId,
]);
for (const evidencePath of evidence.evidence) {
  assert.ok(existsSync(evidencePath), `${requirementId}: missing ${evidencePath}`);
}
for (const openControlId of BILLING_LIFECYCLE_UNRESOLVED_CONTROL_IDS) {
  assert.equal(
    Object.hasOwn(BILLING_INVOICE_OWNERSHIP_MASTER_EVIDENCE, openControlId),
    false,
    `${openControlId}: invoice proof must not promote another billing control`,
  );
}

const report = JSON.parse(
  readFileSync("security/row-level-security-runtime-evidence.json", "utf8"),
) as RuntimeReport;
const compatibility = collectDatabaseCompatibilityInventory();
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
assert.equal(report.runtimeIdentity.currentRole, "greyhoundiq_runtime");
assert.equal(report.runtimeIdentity.sessionRole, "greyhoundiq_runtime");
assert.equal(report.runtimeIdentity.superuser, false);
assert.equal(report.runtimeIdentity.bypassRls, false);
assert.equal(report.sourceBinding.prismaSchemaSha256, compatibility.schemaSha256);
assert.equal(report.sourceBinding.migrationsSha256, compatibility.migrationsSha256);
assert.equal(
  report.sourceBinding.verifierSha256,
  sha256(readFileSync("scripts/check-rls-access-matrix-postgres.ts")),
);
assert.equal(
  report.sourceBinding.billingPageSha256,
  sha256(readFileSync("src/app/account/billing/page.tsx")),
);
assert.equal(
  report.sourceBinding.invoicePolicyMigrationSha256,
  sha256(
    readFileSync(
      "prisma/migrations/20260706223000_add_rls_entitlement_policies/migration.sql",
    ),
  ),
);
const evidenceAgeMs = Date.now() - Date.parse(report.generatedAt);
assert.ok(evidenceAgeMs >= 0 && evidenceAgeMs <= 24 * 60 * 60 * 1_000);

assert.deepEqual(report.invoiceOwnership, {
  policy: { command: "SELECT", policyName: "giq_invoice_read" },
  cases: {
    anonymous: { invoiceA: 0, invoiceB: 0 },
    ownerA: { invoiceA: 1, invoiceB: 0 },
    ownerB: { invoiceA: 0, invoiceB: 1 },
    privilegedModerator: { invoiceA: 1, invoiceB: 1 },
    systemWorker: { invoiceA: 1, invoiceB: 1 },
  },
  rollback: { invoiceA: 0, invoiceB: 0, verified: true },
});

const billingPage = readFileSync("src/app/account/billing/page.tsx", "utf8");
assert.match(
  billingPage,
  /const invoiceWhere: Prisma\.InvoiceRecordWhereInput = billingCustomer[\s\S]*\{ OR: \[\{ userId \}, \{ billingCustomerId: billingCustomer\.id \}\] \}[\s\S]*: \{ userId \}/,
);
assert.match(
  billingPage,
  /tx\.invoiceRecord\.findMany\(\{[\s\S]*where: invoiceWhere[\s\S]*take: 5/,
);

const invoicePolicyMigration = readFileSync(
  "prisma/migrations/20260706223000_add_rls_entitlement_policies/migration.sql",
  "utf8",
);
assert.match(
  invoicePolicyMigration,
  /CREATE POLICY giq_invoice_read ON "InvoiceRecord" FOR SELECT USING \("userId" = public\.giq_current_user_id\(\) OR public\.giq_is_system\(\) OR public\.giq_is_moderator\(\)\);/,
);
const schema = readFileSync("prisma/schema.prisma", "utf8");
assert.match(
  schema,
  /model InvoiceRecord \{[\s\S]*userId\s+String\?[\s\S]*@@index\(\[userId, status\]\)/,
);

assert.match(BILLING_INVOICE_OWNERSHIP_BOUNDARY.verifiedScope, /only their own/);
assert.match(BILLING_INVOICE_OWNERSHIP_BOUNDARY.deployedScope, /No staging or production/);

console.log(
  "billing invoice ownership evidence passed: owner-positive and cross-user/anonymous-negative RLS behavior verified on disposable PostgreSQL",
);

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

type InvoiceCounts = { invoiceA: number; invoiceB: number };

type RuntimeReport = {
  schemaVersion: number;
  auditKind: string;
  generatedAt: string;
  safety: {
    scope: string;
    target: { database: string; host: string; port: number };
    productionContacted: boolean;
    mutation: string;
    persistedSensitiveValues: boolean;
  };
  sourceBinding: {
    billingPageSha256: string;
    invoicePolicyMigrationSha256: string;
    migrationsSha256: string;
    prismaSchemaSha256: string;
    verifierSha256: string;
  };
  runtimeIdentity: {
    bypassRls: boolean;
    currentRole: string;
    sessionRole: string;
    superuser: boolean;
  };
  invoiceOwnership: {
    policy: { command: string; policyName: string };
    cases: {
      anonymous: InvoiceCounts;
      ownerA: InvoiceCounts;
      ownerB: InvoiceCounts;
      privilegedModerator: InvoiceCounts;
      systemWorker: InvoiceCounts;
    };
    rollback: InvoiceCounts & { verified: boolean };
  };
  verdict: string;
};
