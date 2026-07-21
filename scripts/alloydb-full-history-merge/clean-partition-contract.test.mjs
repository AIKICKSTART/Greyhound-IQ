import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("./", import.meta.url);
const read = (name) => readFileSync(new URL(name, root), "utf8");

const wrapper = read("clean-partition.sh");
const stage = read("sql/stage-clean-partition.sql");
const apply = read("sql/merge-clean-partition.sql");
const dockerfile = read("Dockerfile");

test("standalone command is candidate-only and confirmation-gated", () => {
  assert.match(wrapper, /CLEAN_PARTITION_MODE:-status/);
  assert.match(wrapper, /stage\|apply\|status/);
  assert.match(wrapper, /giq_production_candidate_20260716_r1/);
  assert.match(wrapper, /thedogs-normalized-harvest\/v2/);
  assert.match(wrapper, /canonical_merged_at IS NULL/);
  assert.match(
    wrapper,
    /I_CONFIRM_INSERT_ONLY_CLEAN_PARTITION_INTO_GIQ_PRODUCTION_CANDIDATE_20260716_R1/,
  );
  assert.doesNotMatch(wrapper, /giq_rehearsal_restore_v8/);
  assert.match(wrapper, /stage-nonpedigree-saturation\.sql/);
  assert.match(wrapper, /stage-clean-partition\.sql/);
  assert.match(wrapper, /merge-clean-partition\.sql/);
  assert.match(wrapper, /to_regclass\('_giq_history_merge\.clean_partition_control'\) IS NOT NULL/);
  assert.doesNotMatch(wrapper, /CASE WHEN to_regclass\('_giq_history_merge\.clean_partition_control'/);
});

test("image exposes the command without replacing the strict merge entrypoint", () => {
  assert.match(
    dockerfile,
    /COPY scripts\/alloydb-full-history-merge\/clean-partition\.sh \/usr\/local\/bin\/giq-clean-partition/,
  );
  assert.match(dockerfile, /chmod 0555[^\n]*giq-clean-partition/);
  assert.match(dockerfile, /ENTRYPOINT \["\/usr\/local\/bin\/giq-full-history-merge"\]/);
});

test("stage uses whole-candidate exact Dog identity and FK-cascaded eligibility", () => {
  assert.match(stage, /current_database\(\) <> 'giq_production_candidate_20260716_r1'/);
  assert.match(stage, /normalized_transform_version <> 'thedogs-normalized-harvest\/v2'/);
  assert.match(stage, /nonpedigree_dog_identity_resolution/);
  assert.match(stage, /decision\.reuse_existing_allowed/);
  assert.match(stage, /decision\.create_new_allowed/);
  assert.match(stage, /decision\.verification_class = 'full-profile'/);
  assert.match(stage, /decision\.exact_canonical_candidate_count = 1/);
  assert.match(stage, /decision\.exact_canonical_candidate_count = 0/);

  for (const relation of [
    "clean_track",
    "clean_trainer",
    "clean_dog",
    "clean_meeting",
    "clean_race",
    "clean_runner",
    "clean_result",
    "clean_form_entry",
    "clean_profile_form",
    "clean_race_video",
    "clean_photo_finish",
    "clean_dog_profile_archive",
    "clean_race_day_archive",
    "clean_pedigree_edge",
  ]) {
    assert.match(stage, new RegExp(`CREATE TABLE _giq_history_stage\\.${relation}\\b`));
  }

  assert.match(stage, /JOIN _giq_history_stage\.clean_track track ON track\.target_id = meeting\.track_id/);
  assert.match(stage, /JOIN _giq_history_stage\.clean_meeting meeting ON meeting\.target_id = race\.meeting_id/);
  assert.match(stage, /JOIN _giq_history_stage\.clean_race race ON race\.target_id = runner\.race_id/);
  assert.match(stage, /JOIN _giq_history_stage\.clean_dog dog ON dog\.target_id = runner\.dog_id/);
  assert.match(stage, /JOIN _giq_history_stage\.clean_runner runner ON runner\.target_id = result\.runner_id/);
  assert.match(stage, /JOIN _giq_history_stage\.clean_race race ON race\.target_id = form\.resolved_race_id/);
});

test("stage accounts for every source row and keeps issue evidence excluded", () => {
  assert.match(stage, /clean_partition_normalized_manifest/);
  assert.match(stage, /clean_partition_raw_manifest/);
  assert.match(stage, /clean_partition_raw_source_map/);
  assert.match(stage, /clean_partition_exclusion/);
  assert.match(stage, /CHECK \(source_rows = eligible_rows \+ excluded_rows\)/);
  assert.match(stage, /CHECK \(overlap_rows = 0\)/);
  assert.match(stage, /CHECK \(unaccounted_rows = 0\)/);
  assert.match(stage, /dataset IN \('duplicates', 'orphans', 'quarantine'\) AND eligible_rows <> 0/);
  assert.match(stage, /export_issue_outcome/);
  assert.match(stage, /normalized-export/);
  assert.match(stage, /inserted_eligible < 17800000/);
  assert.match(stage, /'Pedigree'.*'deferred-authoritative'/s);
  assert.match(stage, /reject_clean_partition_evidence_mutation/);
});

test("apply is insert-only, preserves the baseline, and rolls back on drift", () => {
  assert.match(apply, /current_database\(\) <> 'giq_production_candidate_20260716_r1'/);
  assert.match(apply, /clean_partition_confirmation/);
  assert.match(apply, /pg_stat_activity/);
  assert.match(apply, /LOCK TABLE public\.%I IN SHARE ROW EXCLUSIVE MODE/);
  assert.match(apply, /FROM _giq_history_merge\.protected_table_manifest protected/);
  assert.match(apply, /giq_clean_existing_row/);
  assert.match(apply, /snapshot_core_key/);
  assert.match(apply, /protected_table_manifest/);
  assert.match(apply, /post_normalization_migration_amendment/);
  assert.match(apply, /clean_partition_identity_conflict_control/);
  assert.match(apply, /giq-clean-partition-identity-conflicts\/v1/);
  assert.match(apply, /identity_control\.release_insert_eligible_rows < 17800000/);
  for (const relation of [
    "release_meeting",
    "release_race",
    "release_runner",
    "release_result",
    "release_form_entry",
    "release_race_video",
    "release_photo_finish",
  ]) {
    assert.match(apply, new RegExp(`_giq_history_stage\\.${relation}`));
  }
  assert.match(apply, /table_class\.relname <> '_prisma_migrations'/);
  assert.match(apply, /clean partition changed the amended Prisma migration ledger/);
  assert.match(apply, /SET CONSTRAINTS ALL IMMEDIATE/);
  assert.match(apply, /present_rows <> eligible_rows/);
  assert.match(apply, /identity_mismatch_rows <> 0/);
  assert.match(apply, /existing_rows_preserved/);
  assert.match(apply, /protected_tables_preserved/);
  assert.match(apply, /COMMIT;/);

  const publicInserts = [...apply.matchAll(/INSERT INTO public\."([A-Za-z]+)"/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(publicInserts, [
    "Track",
    "Trainer",
    "Dog",
    "Meeting",
    "Race",
    "Runner",
    "Result",
    "FormEntry",
    "DogProfileForm",
    "DogProfileArchive",
    "RaceDayArchive",
    "RaceVideo",
  ]);
  assert.equal((apply.match(/ON CONFLICT DO NOTHING;/g) ?? []).length, publicInserts.length);
  assert.doesNotMatch(apply, /UPDATE public\./);
  assert.doesNotMatch(apply, /DELETE FROM public\./);
  assert.doesNotMatch(apply, /ALTER TABLE public\./);
  assert.doesNotMatch(apply, /UPDATE _giq_history_merge\.run/);
  assert.doesNotMatch(apply, /\bdigest\s*\(/i);
  assert.match(apply, /pg_catalog\.sha256\(convert_to\(/);
});
