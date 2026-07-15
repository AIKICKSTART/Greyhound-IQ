import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DATABASE_OPERATIONS } from "../security/database-operations";
import {
  SUPPORT_TICKET_EVIDENCE_PATH,
  SUPPORT_TICKET_VERIFY_CONFIRMATION,
  assertSupportTicketVerifierTarget,
  validateSupportTicketEvidence,
} from "./check-support-ticket-create-postgres";

const root = process.cwd();
const runtimeUrl =
  "postgresql://greyhoundiq_runtime@127.0.0.1:55734/greyhoundiq";
assert.equal(
  assertSupportTicketVerifierTarget(
    runtimeUrl,
    SUPPORT_TICKET_VERIFY_CONFIRMATION,
  ).toString(),
  runtimeUrl,
);
for (const invalid of [
  "postgresql://greyhoundiq_runtime@127.0.0.1:55733/greyhoundiq",
  "postgresql://postgres@127.0.0.1:55734/greyhoundiq",
  "postgresql://greyhoundiq_runtime:secret@127.0.0.1:55734/greyhoundiq",
  "postgresql://greyhoundiq_runtime@localhost:55734/greyhoundiq",
  "postgresql://greyhoundiq_runtime@127.0.0.1:55734/postgres",
  "postgresql://greyhoundiq_runtime@127.0.0.1:55734/greyhoundiq?host=db.invalid",
]) {
  assert.throws(() =>
    assertSupportTicketVerifierTarget(
      invalid,
      SUPPORT_TICKET_VERIFY_CONFIRMATION,
    ),
  );
}
assert.throws(() =>
  assertSupportTicketVerifierTarget(runtimeUrl, "wrong-confirmation"),
);

const evidence = JSON.parse(
  readFileSync(resolve(root, SUPPORT_TICKET_EVIDENCE_PATH), "utf8"),
) as Record<string, unknown>;
assert.doesNotThrow(() => validateSupportTicketEvidence(evidence, root));

const operation = DATABASE_OPERATIONS.find(
  (candidate) => candidate.queryId === "DB.SUPPORT.TICKET.CREATE.TRANSACTION",
);
assert.ok(operation);
assert.equal(operation.verificationStatus, "Verified");
assert.equal(operation.sourceFile, "src/app/actions.ts");
assert.equal(operation.sourceSymbol, "createSupportTicket");
assert.equal(operation.databaseRole, "greyhoundiq_runtime");
assert.equal(operation.databaseName, "greyhoundiq");
assert.equal(operation.schemaName, "public");
assert.equal(operation.maximumRowCount, 2);
assert.ok(operation.rowLevelSecurityPolicies.includes("giq_support_ticket_insert"));
assert.ok(operation.rowLevelSecurityPolicies.includes("giq_support_message_insert"));
const statements = (evidence.proof as Record<string, unknown>)
  .statements as Array<Record<string, unknown>>;
assert.deepEqual(
  operation.normalizedSqlVariants?.map((variant) => ({
    variant: variant.variant,
    normalizedSql: variant.normalizedSql,
  })),
  statements.map((statement) => ({
    variant: statement.variant,
    normalizedSql: (statement.observedSql as Record<string, unknown>)
      .normalizedSql,
  })),
);
assert.ok(
  operation.tests.includes(
    "scripts/check-support-ticket-create-postgres.test.ts",
  ),
);
assert.ok(
  operation.evidence.some((entry) =>
    entry.includes(SUPPORT_TICKET_EVIDENCE_PATH),
  ),
);

const migration = readFileSync(
  resolve(
    root,
    "prisma/migrations/20260715060000_harden_support_message_insert_rls/migration.sql",
  ),
  "utf8",
);
assert.match(migration, /DROP POLICY IF EXISTS giq_support_message_insert/);
assert.match(migration, /EXISTS\s*\(/);
assert.match(migration, /FROM "SupportTicket" t/);
assert.match(migration, /t\."userId" = public\.giq_current_user_id\(\)/);

console.log(
  "support ticket database evidence passed: exact transaction, rollback and RLS ownership proof",
);
