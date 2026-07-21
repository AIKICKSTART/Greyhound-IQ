import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(root, "sql/audit-whole-source-reconciliation.sql"), "utf8");

assert.match(sql, /BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ WRITE/);
assert.match(sql, /current_database\(\)<>'giq_production_candidate_20260716_r1'/);
assert.match(sql, /whole_source_reconciliation/);
assert.match(sql, /source_rows<>imported_rows\+merged_rows\+quarantined_rows/);
assert.match(sql, /countSource','recomputed-from-staged-and-canonical-data'/);

for (const relation of [
  "r2_Track", "r2_Trainer", "r2_Dog", "r2_Meeting", "r2_Race", "r2_Runner",
  "r2_Result", "r2_FormEntry", "r2_DogProfileForm", "r2_RaceVideo",
  "r2_DogProfileArchive", "r2_RaceDayArchive",
  "export_profiles", "export_pedigree_edges", "export_profile_forms", "export_meetings",
  "export_races", "export_runners", "export_results", "export_archives",
  "export_race_media", "export_duplicates", "export_orphans", "export_quarantine",
  "export_issue_outcome", "galtd_observation", "galtd_assertion",
  "replay_standalone_only_provider_id", "snapshot_core_key",
]) {
  assert.ok(sql.includes(relation), `missing source relation ${relation}`);
}

for (const contract of [
  "whole_r2_manifest", "whole_export_manifest", "whole_protected_manifest",
  "source_snapshot_manifest_binding", "stable_natural_key_mapping",
  "canonical_provider_duplicates", "canonical_natural_key_duplicates",
  "provider_identity_shape", "canonical_foreign_key_orphans", "canonical_placeholders",
  "canonical_self_parent", "canonical_pedigree_cycles", "pending_authoritative_pedigree",
  "canonical_duplicate_parents",
  "provider_stub_integrity", "synthetic_identifier_cleanup",
  "snapshot_core_key_coverage", "provider_key_mapping", "galtd_provider_key_duplicates",
  "media_provider_key_mapping", "production_update_audit_integrity",
  "canonical_target_identity", "pedigree_import_run_provenance",
  "thedogs_identity_provenance", "pedigree_occurrence_resolution_accounting",
  "pedigree_final_disposition_closure", "pedigree_disjoint_conservation",
  "pedigree_apply_winner_persistence", "pedigree_no_change_authority",
  "pedigree_terminal_proof_persistence", "pedigree_orphan_terminal_proof",
  "pedigree_resolution_consistency", "verified_assertion_without_winner",
  "pedigree_append_only_persistence", "live_feed_quarantine_controls",
  "live_feed_quarantine_evidence",
  "source_payload_mismatches", "source_provenance_mismatches",
  "source_verification_mismatches", "source_unaccounted_rows",
]) {
  assert.ok(sql.includes(contract), `missing reconciliation contract ${contract}`);
}

assert.match(sql, /md5\(COALESCE\(string_agg\(md5\(to_jsonb\(row_value\)::text\)/);
assert.match(sql, /expected_sha256 !~ '\^\[0-9a-f\]\{64\}\$'/);
assert.match(sql, /proof\.row_sha256=encode\(digest\(to_jsonb\(video\)::text,'sha256'\),'hex'\)/);
assert.match(sql, /CREATE TEMP TABLE whole_pedigree_v2_resolution AS/);
assert.match(sql, /occurrence\.source_file,occurrence\.source_line/);
assert.match(sql, /pedigree\.source_file=source\.source_file/);
assert.match(sql, /pedigree\.source_line=source\.line_number/);
assert.match(sql, /pedigree\.evidence_sha256=encode\(digest\(source\.payload::text,'sha256'\),'hex'\)/);
assert.match(sql, /history_id\('pedledger-v2',occurrence\.occurrence_id\)/);
assert.match(sql, /ledger\."assertionId"=occurrence\.occurrence_id/);
assert.match(sql, /ledger\."winningAssertionId"=occurrence\.occurrence_id/);
assert.match(sql, /resolution\.canonical_contribution_count=0/);
assert.match(sql, /NOT resolution\.canonical_write_eligible AS terminal_proof_ok/);
assert.match(sql, /source_rows<>imported_rows\+merged_rows\+quarantined_rows/);
assert.match(sql, /giq_live_feed_quarantine_append_only/);
assert.match(sql, /giq_live_feed_quarantine_admin_read/);
assert.match(sql, /giq_live_feed_quarantine_system_insert/);
assert.match(
  sql,
  /\('public\."PedigreeMergeLedger"'::regclass,\s*'giq_pedigree_merge_ledger_evidence_guard'\)/,
);
assert.match(sql, /canonical\."dogId" IS NOT DISTINCT FROM identity\.dog_id/);
assert.match(sql, /canonical\."importRunId"=identity\.import_run_id/);
assert.match(sql, /canonical\.imported=identity\.crosswalk_eligible/);
assert.match(sql, /canonical\."observedWhelpDate" IS NOT DISTINCT FROM/);
assert.match(sql, /child_namespace\.nspname='public'/);
assert.match(sql, /CASE fk\.match_type\s+WHEN 'f' THEN/);
assert.match(sql, /count\(\*\) FILTER\(WHERE NOT constraint_valid\)/);
assert.match(sql, /'algorithm','indexed-root-pruning'/);
assert.match(sql, /DELETE FROM whole_pedigree_edge/);
assert.match(sql, /NOT :'whole_source_blocked'::boolean/);
assert.match(sql, /\\quit 3/);
assert.equal((sql.match(/\$\$/g) ?? []).length % 2, 0, "unbalanced dollar quotes");
assert.equal((sql.match(/BEGIN TRANSACTION/g) ?? []).length, 1);
assert.equal((sql.match(/^COMMIT;$/gm) ?? []).length, 1);

for (const pinnedCount of [
  "170780", "328069", "6218839", "76620", "838526", "6434145", "5660837",
  "538849", "105374", "210734", "1190302",
]) {
  assert.ok(!sql.includes(pinnedCount), `audit must recompute count ${pinnedCount}`);
}

assert.doesNotMatch(sql, /(?:gcloud|gsutil|CREATE SERVER|IMPORT FOREIGN SCHEMA|postgres_fdw)/i);
assert.doesNotMatch(sql, /(?:DROP|TRUNCATE|DELETE FROM|UPDATE)\s+public\./i);
assert.doesNotMatch(sql, /CREATE\s+(?!TEMP\s)TABLE\s+(?:_giq_history|public)\./i);

console.log("whole-source reconciliation static contract passed");
