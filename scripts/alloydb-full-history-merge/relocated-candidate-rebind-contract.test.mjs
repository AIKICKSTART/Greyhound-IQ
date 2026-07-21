import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(root, "sql/rebind-relocated-candidate.sql"), "utf8");

test("relocated candidate rebind is exact, append-only, and lineage-bound", () => {
  for (const token of [
    "giq_production_candidate_20260716_r1",
    "I_CONFIRM_REBIND_RELOCATED_NORMALIZED_CANDIDATE_OID_WITH_APPEND_ONLY_EVIDENCE",
    "candidate_oid_rebinding",
    "previous_candidate_oid",
    "next_candidate_oid",
    "source_checkpoint_manifest_sha256",
    "normalization_checkpoint",
    "f9771f6668f5be9ac8362aa6b26df644ac992e2537648545fe8ea69d49f305f2",
    "authoritative_pedigree_saturation_manifest",
    "nonpedigree_saturation_manifest",
    "duplicate_quarantine_proof_manifest",
    "completed_migration_count <> 100",
    "candidate_database_oid = actual_oid",
    "candidate_database_oid = expected_previous_oid",
    "append-only",
  ]) {
    assert.ok(sql.includes(token), `missing rebind invariant ${token}`);
  }
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /BEFORE UPDATE OR DELETE/);
  assert.match(sql, /UPDATE _giq_history_merge\.run\s+SET candidate_database_oid = actual_oid/u);
  assert.match(sql, /WHERE id = 1 AND candidate_database_oid = expected_previous_oid/u);
  assert.doesNotMatch(sql, /(?:INSERT INTO|UPDATE|DELETE FROM|TRUNCATE)\s+public\./iu);
  assert.equal((sql.match(/^COMMIT;$/gmu) ?? []).length, 1);
});
