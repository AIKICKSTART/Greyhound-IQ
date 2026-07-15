import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { collectDatabaseCompatibilityInventory } from "../scripts/check-database-compatibility-inventory";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import {
  DATABASE_SEQUENCE_INVENTORY_EVIDENCE_PATHS,
  DATABASE_SEQUENCE_INVENTORY_REQUIREMENT_ID,
  EXPECTED_DATABASE_SEQUENCES,
  findDatabaseSequenceInventoryIssues,
} from "./database-sequence-inventory-evidence";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const baselinePath =
  "prisma/migrations/20260630093000_baseline/migration.sql";
const baselineBuffer = readFileSync(baselinePath);
const baseline = baselineBuffer.toString("utf8");
const migrationSource = readdirSync("prisma/migrations", {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) =>
    readFileSync(join("prisma/migrations", entry.name, "migration.sql"), "utf8"),
  )
  .join("\n");
const inventory = collectDatabaseCompatibilityInventory();
const sourceBinding = {
  prismaSchemaSha256: inventory.schemaSha256,
  migrationsSha256: inventory.migrationsSha256,
  migrationCount: inventory.counts.migrations,
  baselineMigrationSha256: sha256(baselineBuffer),
};

assert.match(
  schema,
  /model AuditLog \{[\s\S]*?id\s+BigInt\s+@id @default\(autoincrement\(\)\)/,
);
assert.match(
  baseline,
  /CREATE TABLE "AuditLog" \([\s\S]*?"id" BIGSERIAL NOT NULL/,
);
assert.equal((migrationSource.match(/\bBIGSERIAL\b/g) ?? []).length, 1);
assert.doesNotMatch(migrationSource, /\bCREATE\s+SEQUENCE\b/i);

const replay = JSON.parse(
  readFileSync("output/database-audit/migration-replay.json", "utf8"),
) as Record<string, Record<string, unknown>>;
assert.equal(replay.sourceBinding.prismaSchemaSha256, inventory.schemaSha256);
assert.equal(replay.sourceBinding.migrationsSha256, inventory.migrationsSha256);
assert.equal(replay.sourceBinding.migrationCount, inventory.counts.migrations);
assert.equal(replay.replay.status, "verified");

const evidence = JSON.parse(
  readFileSync("security/database-sequence-inventory-evidence.json", "utf8"),
) as Record<string, unknown>;
assert.deepEqual(findDatabaseSequenceInventoryIssues(evidence, sourceBinding), []);
assert.deepEqual(evidence.sequences, EXPECTED_DATABASE_SEQUENCES);

for (const mutation of [
  (copy: Record<string, unknown>) => {
    copy.sequences = [];
  },
  (copy: Record<string, unknown>) => {
    (copy.sequences as unknown[]).push({ name: "unexpected_seq" });
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
  assert.ok(findDatabaseSequenceInventoryIssues(forged, sourceBinding).length > 0);
}

const requirement = MASTER_AUDIT_REQUIREMENTS.find(
  (candidate) =>
    candidate.prompt === "security" &&
    candidate.id === DATABASE_SEQUENCE_INVENTORY_REQUIREMENT_ID,
);
assert.ok(requirement);
assert.equal(isMasterRequirementComplete(requirement), true);
for (const evidencePath of DATABASE_SEQUENCE_INVENTORY_EVIDENCE_PATHS) {
  assert.ok(existsSync(evidencePath), evidencePath);
  assert.ok(
    SECURITY_MASTER_EVIDENCE[
      DATABASE_SEQUENCE_INVENTORY_REQUIREMENT_ID
    ].evidence.includes(evidencePath),
    evidencePath,
  );
}

console.log(
  "database sequence inventory evidence passed: public.AuditLog_id_seq is the exact source-bound and runtime-observed sequence set",
);

function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}
