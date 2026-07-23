import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { collectDatabaseCompatibilityInventory } from "../scripts/check-database-compatibility-inventory";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import {
  DATABASE_SCHEMA_INVENTORY_EVIDENCE_PATHS,
  DATABASE_SCHEMA_INVENTORY_REQUIREMENT_ID,
  EXPECTED_APPLICATION_OWNED_SCHEMAS,
  EXPECTED_CONDITIONAL_EXTERNAL_SCHEMAS,
  EXPECTED_EXCLUDED_PLATFORM_SCHEMA_CLASSES,
  findDatabaseSchemaInventoryIssues,
} from "./database-schema-inventory-evidence";

const migrationSource = readdirSync("prisma/migrations", {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) =>
    readFileSync(join("prisma/migrations", entry.name, "migration.sql"), "utf8"),
  )
  .join("\n");
const storageMigration = readFileSync(
  "prisma/migrations/20260630170000_supabase_storage/migration.sql",
  "utf8",
);
const inventory = collectDatabaseCompatibilityInventory();
const sourceBinding = {
  prismaSchemaSha256: inventory.schemaSha256,
  migrationsSha256: inventory.migrationsSha256,
  migrationCount: inventory.counts.migrations,
};

assert.equal(
  (migrationSource.match(/\bCREATE\s+SCHEMA\b/gi) ?? []).length,
  1,
);
assert.match(
  migrationSource,
  /CREATE SCHEMA IF NOT EXISTS "public";/,
);
assert.match(storageMigration, /to_regclass\('storage\.buckets'\)/);
assert.match(storageMigration, /to_regclass\('storage\.objects'\)/);
assert.match(storageMigration, /to_regprocedure\('auth\.jwt\(\)'\)/);
assert.match(storageMigration, /to_regprocedure\('storage\.foldername\(text\)'\)/);
assert.match(
  storageMigration,
  /IF to_regclass\('storage\.buckets'\)[\s\S]*?THEN[\s\S]*?RETURN;/,
);

const replay = JSON.parse(
  readFileSync("output/database-audit/migration-replay.json", "utf8"),
) as Record<string, Record<string, unknown>>;
assert.equal(replay.sourceBinding.prismaSchemaSha256, inventory.schemaSha256);
assert.equal(replay.sourceBinding.migrationsSha256, inventory.migrationsSha256);
assert.equal(replay.sourceBinding.migrationCount, inventory.counts.migrations);
assert.equal(replay.replay.status, "verified");

const evidence = JSON.parse(
  readFileSync("security/database-schema-inventory-evidence.json", "utf8"),
) as Record<string, unknown>;
assert.deepEqual(findDatabaseSchemaInventoryIssues(evidence, sourceBinding), []);
assert.deepEqual(
  evidence.applicationOwnedSchemas,
  EXPECTED_APPLICATION_OWNED_SCHEMAS,
);
assert.deepEqual(
  evidence.conditionalExternalSchemas,
  EXPECTED_CONDITIONAL_EXTERNAL_SCHEMAS,
);
assert.deepEqual(
  evidence.excludedPlatformManagedSchemaClasses,
  EXPECTED_EXCLUDED_PLATFORM_SCHEMA_CLASSES,
);

for (const mutation of [
  (copy: Record<string, unknown>) => {
    copy.applicationOwnedSchemas = [];
  },
  (copy: Record<string, unknown>) => {
    (copy.applicationOwnedSchemas as unknown[]).push({ name: "unexpected" });
  },
  (copy: Record<string, unknown>) => {
    copy.conditionalExternalSchemas = [];
  },
  (copy: Record<string, unknown>) => {
    (copy.runtimeIdentity as Record<string, unknown>).role = "postgres";
  },
  (copy: Record<string, unknown>) => {
    (copy.safety as Record<string, unknown>).readOnlySession = false;
  },
]) {
  const forged = structuredClone(evidence);
  mutation(forged);
  assert.ok(findDatabaseSchemaInventoryIssues(forged, sourceBinding).length > 0);
}

const requirement = MASTER_AUDIT_REQUIREMENTS.find(
  (candidate) =>
    candidate.prompt === "security" &&
    candidate.id === DATABASE_SCHEMA_INVENTORY_REQUIREMENT_ID,
);
assert.ok(requirement);
assert.equal(isMasterRequirementComplete(requirement), true);
for (const evidencePath of DATABASE_SCHEMA_INVENTORY_EVIDENCE_PATHS) {
  assert.ok(existsSync(evidencePath), evidencePath);
  assert.ok(
    SECURITY_MASTER_EVIDENCE[
      DATABASE_SCHEMA_INVENTORY_REQUIREMENT_ID
    ].evidence.includes(evidencePath),
    evidencePath,
  );
}

console.log(
  "database schema inventory evidence passed: public is the sole owned schema; auth/storage are guarded external dependencies",
);
