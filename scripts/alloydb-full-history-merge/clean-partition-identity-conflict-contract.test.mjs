import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(
  join(root, "sql/stage-clean-partition-identity-conflicts.sql"),
  "utf8",
);

test("identity conflicts are excluded with exact FK cascades", () => {
  for (const token of [
    "giq_production_candidate_20260716_r1",
    "clean_partition_identity_conflict_exclusion",
    "clean_partition_identity_conflict_control",
    "target-id-identity-conflict",
    "parent-identity-conflict",
    "release_meeting",
    "release_race",
    "release_runner",
    "release_result",
    "release_form_entry",
    "release_race_video",
    "release_photo_finish",
    "release_rows < 17800000",
    "release views contain an FK gap",
    "release still contains a target-ID mismatch",
    "reject_clean_partition_evidence_mutation",
  ]) {
    assert.ok(sql.includes(token), `missing identity-conflict invariant ${token}`);
  }
  assert.match(sql, /ON CONFLICT \(entity_type, source_target_id\) DO NOTHING/);
  assert.match(sql, /WITH entity_counts AS/);
  assert.match(sql, /GROUP BY entity_type/);
  assert.match(sql, /FROM totals/);
  assert.match(sql, /BEFORE UPDATE OR DELETE/);
  assert.doesNotMatch(sql, /(?:UPDATE|DELETE FROM|TRUNCATE)\s+public\./iu);
  assert.equal((sql.match(/^COMMIT;$/gmu) ?? []).length, 1);
});
