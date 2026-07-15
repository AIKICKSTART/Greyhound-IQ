import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  auditDatabaseConstraintInventory,
  DATABASE_CONSTRAINT_INVENTORY_MASTER_EVIDENCE,
  DATABASE_CONSTRAINT_INVENTORY_REQUIREMENT_ID,
  type ConstraintSource,
} from "./database-constraint-inventory-evidence";

const migrationSources = readdirSync("prisma/migrations", {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const path = join("prisma/migrations", entry.name, "migration.sql").replaceAll(
      "\\",
      "/",
    );
    return { path, source: readFileSync(path, "utf8") };
  });

const audit = auditDatabaseConstraintInventory(migrationSources);
assert.ok(migrationSources.length > 0);
assert.deepEqual(audit.issues, []);
assert.ok(audit.records.length > 0);
for (const kind of ["check", "foreign-key", "primary-key"] as const) {
  assert.ok(
    audit.records.some((record) => record.kind === kind),
    `${kind}: inventory must be non-vacuous`,
  );
}
assert.equal(
  new Set(audit.records.map(({ table, name }) => `${table}.${name}`)).size,
  audit.records.length,
);

const requirement = SECURITY_MASTER_REQUIREMENTS.find(
  ({ id }) => id === DATABASE_CONSTRAINT_INVENTORY_REQUIREMENT_ID,
);
assert.ok(requirement, "immutable constraint-inventory requirement missing");
const evidence =
  DATABASE_CONSTRAINT_INVENTORY_MASTER_EVIDENCE[
    DATABASE_CONSTRAINT_INVENTORY_REQUIREMENT_ID
  ];
assert.equal(evidence.status, "verified");
for (const path of evidence.evidence) {
  assert.ok(existsSync(path), `missing evidence: ${path}`);
}

assertIssue(
  [{ path: "unnamed.sql", source: 'CREATE TABLE "Unsafe" ("id" text PRIMARY KEY);' }],
  "CONSTRAINT_INVENTORY_VACUOUS",
);
assertIssue(
  [{
    path: "inline-reference.sql",
    source: 'CREATE TABLE "Unsafe" ("ownerId" text REFERENCES "Owner"("id"));',
  }],
  "CONSTRAINT_DECLARATION_UNPARSED:inline-reference.sql:1",
);
assertIssue(
  [{
    path: "unparsed.sql",
    source: 'ALTER TABLE "Unsafe" ADD CONSTRAINT "Unsafe_check" DEFERRABLE;',
  }],
  "CONSTRAINT_DECLARATION_UNPARSED:unparsed.sql:1",
);
assertIssue(
  [{
    path: "missing-table.sql",
    source: 'CONSTRAINT "Unsafe_check" CHECK (true);',
  }],
  "CONSTRAINT_TABLE_MISSING:missing-table.sql:1",
);
assertIssue(
  [
    constraintSource("a.sql"),
    constraintSource("b.sql"),
  ],
  "CONSTRAINT_DUPLICATE:Unsafe.Unsafe_check:b.sql:1",
);

console.log(
  `Database constraint inventory passed: ${audit.records.length} current named constraints across ${migrationSources.length} migrations.`,
);

function assertIssue(sources: ConstraintSource[], expected: string) {
  assert.ok(
    auditDatabaseConstraintInventory(sources).issues.includes(expected),
    `${expected}: negative fixture must fail closed`,
  );
}

function constraintSource(path: string): ConstraintSource {
  return {
    path,
    source:
      'ALTER TABLE "Unsafe" ADD CONSTRAINT "Unsafe_check" CHECK (true);',
  };
}
