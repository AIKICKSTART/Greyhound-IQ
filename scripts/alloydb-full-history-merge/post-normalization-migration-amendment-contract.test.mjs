import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(
  join(root, "sql/record-post-normalization-migration-amendment.sql"),
  "utf8",
);

test("post-normalization migration amendment is exact and append-only", () => {
  for (const token of [
    "giq_production_candidate_20260716_r1",
    "I_CONFIRM_RECORD_EXACT_POST_NORMALIZATION_MIGRATION_LEDGER_ADDITIONS",
    "post_normalization_migration_amendment",
    "protected_table_manifest",
    "ledger.started_at <= marker.normalized_at",
    "started_at > marker.normalized_at",
    "expected.checksum IS DISTINCT FROM actual.checksum",
    "actual.finished_at IS NULL",
    "actual.rolled_back_at IS NOT NULL",
    "actual.applied_steps_count IS DISTINCT FROM expected.applied_steps_count",
    "observed_current_rows <> observed_baseline_rows + manifest_rows",
    "reject_clean_partition_evidence_mutation",
  ]) {
    assert.ok(sql.includes(token), `missing migration amendment invariant ${token}`);
  }
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /BEFORE UPDATE OR DELETE/);
  assert.doesNotMatch(sql, /(?:INSERT INTO|UPDATE|DELETE FROM|TRUNCATE)\s+public\./iu);
  assert.equal((sql.match(/^COMMIT;$/gmu) ?? []).length, 1);
});
