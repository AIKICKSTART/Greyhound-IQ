import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const archive = readFileSync(
  join(root, "sql/archive-authoritative-pedigree-saturation-v1.sql"),
  "utf8",
);
const runner = readFileSync(join(root, "merge.sh"), "utf8");

assert.match(archive, /BEGIN ISOLATION LEVEL SERIALIZABLE;/);
assert.match(archive, /pg_advisory_xact_lock/);
assert.match(archive, /current_database\(\)<>'giq_production_candidate_20260716_r1'/);
assert.match(archive, /observed_phase<>'normalized'/);
assert.match(archive, /IN ACCESS EXCLUSIVE MODE;/);
assert.match(archive, /schema_version='giq-authoritative-pedigree-saturation\/v1'/);
assert.match(archive, /status='blocked'/);

const tables = [
  "authoritative_provider_policy",
  "authoritative_identity_evidence",
  "authoritative_pedigree_evidence",
  "authoritative_consolidation_proof",
  "current_pedigree_quarantine",
];
const views = [
  "authoritative_identity_candidate_search",
  "authoritative_identity_resolution",
  "authoritative_pedigree_resolution",
  "authoritative_pedigree_conflict_ledger",
  "authoritative_pedigree_retrieval_queue",
];
for (const relation of [...tables, ...views]) {
  assert.ok(archive.includes(`'${relation}'`), `archive is missing ${relation}`);
}
for (const table of tables) {
  assert.match(
    archive,
    new RegExp(
      `ALTER TABLE _giq_history_stage\\.${table}\\s+SET SCHEMA _giq_history_pedigree_v1_archive;`,
    ),
  );
}
for (const view of views) {
  assert.match(
    archive,
    new RegExp(
      `ALTER VIEW _giq_history_stage\\.${view}\\s+SET SCHEMA _giq_history_pedigree_v1_archive;`,
    ),
  );
}

for (const [relation, rows] of [
  ["authoritative_provider_policy", "6"],
  ["authoritative_identity_evidence", "0"],
  ["authoritative_pedigree_evidence", "0"],
  ["authoritative_consolidation_proof", "0"],
  ["current_pedigree_quarantine", "107004"],
  ["authoritative_pedigree_retrieval_queue", "106988"],
]) {
  assert.match(
    archive,
    new RegExp(`source_rows->>'${relation}' IS DISTINCT FROM '${rows}'`),
    `archive is missing the reviewed ${relation} row count`,
  );
}

assert.match(archive, /giq-pedigree-v1-catalog\/v1/);
assert.match(archive, /source_manifest jsonb NOT NULL/);
assert.match(archive, /source_manifest_sha256/);
assert.match(archive, /source_catalog_sha256/);
assert.match(archive, /archived_catalog_sha256/);
assert.match(archive, /CHECK\(source_catalog_sha256=archived_catalog_sha256\)/);
assert.match(archive, /CHECK\(source_row_counts=archived_row_counts\)/);
assert.match(archive, /source_catalog IS DISTINCT FROM archived_catalog/);
assert.match(archive, /source_row_counts IS DISTINCT FROM archived_row_counts/);
assert.match(archive, /authoritative_pedigree_v1_archive_manifest_append_only/);
assert.equal(
  (archive.match(/CREATE TRIGGER pedigree_v1_archive_reject_writes/g) ?? []).length,
  5,
);
assert.equal(
  (archive.match(/BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE/g) ?? []).length,
  5,
);
assert.match(archive, /REVOKE ALL ON SCHEMA _giq_history_pedigree_v1_archive FROM PUBLIC/);
assert.match(archive, /REVOKE ALL ON ALL TABLES IN SCHEMA _giq_history_pedigree_v1_archive FROM PUBLIC/);
assert.match(archive, /REVOKE ALL ON _giq_history_merge\.authoritative_pedigree_saturation_archive_manifest FROM PUBLIC/);

assert.match(runner, /AUTHORITATIVE_PEDIGREE_V1_ARCHIVE_SQL/);
assert.match(runner, /0:0:0:0:0\)[\s\S]*stage-authoritative-pedigree-resolution\.sql/);
assert.match(
  runner,
  /10:0:0:0:1\)[\s\S]*archive_authoritative_pedigree_v1[\s\S]*authoritative_pedigree_stage_relation_count[\s\S]*stage-authoritative-pedigree-resolution\.sql/,
);
assert.match(runner, /0:10:1:1:1\)[\s\S]*archive_authoritative_pedigree_v1[\s\S]*stage-authoritative-pedigree-resolution\.sql/);
assert.match(runner, /15:0:0:0:0\|15:0:0:0:1\)[\s\S]*AUTHORITATIVE_PEDIGREE_RESOLUTION_ALREADY_STAGED/);
assert.match(runner, /15:10:1:1:1\)[\s\S]*archive_authoritative_pedigree_v1[\s\S]*AUTHORITATIVE_PEDIGREE_RESOLUTION_ALREADY_STAGED/);
assert.match(runner, /state is partial or mixed/);

assert.doesNotMatch(archive, /\bDROP\b/i);
assert.doesNotMatch(archive, /\bDELETE\s+FROM\b/i);
assert.doesNotMatch(archive, /\bCASCADE\b/i);
assert.doesNotMatch(archive, /(?:INSERT INTO|UPDATE|DELETE FROM|TRUNCATE)\s+public\./i);
assert.equal((archive.match(/\$\$/g) ?? []).length % 2, 0, "unbalanced dollar quotes");

console.log(
  "authoritative pedigree v1 archive contract passed: exact blocked-v1 state is locked, fingerprinted, immutable, and wired to v2 without destructive or public writes.",
);
