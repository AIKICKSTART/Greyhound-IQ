import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (relative) => readFileSync(join(root, relative), "utf8");

const mergeShell = read("merge.sh");
const initialize = read("sql/initialize-candidate.sql");
const cloneControl = read("sql/initialize-physical-clone-control.sql");
const automationInventory = read("sql/inventory-database-automation.sql");
const sessionInventory = read("sql/inventory-database-sessions.sql");
const sessionTermination = read("sql/terminate-physical-clone-sessions.sql");
const template0Catalog = read("sql/template0-catalog-manifest.sql");
const canonical = read("sql/merge-canonical.sql");
const plan = read("sql/plan-canonical-merge.sql");
const verify = read("sql/verify-candidate.sql");
const pedigreeFinalizer = read("sql/finalize-authoritative-pedigree-saturation.sql");
const nonpedigreeStage = read("sql/stage-nonpedigree-saturation.sql");
const duplicateProofStage = read("sql/stage-duplicate-quarantine-proof-resolution.sql");
const candidatePathSql = [
  "sql/initialize-physical-clone-control.sql",
  "sql/inventory-database-automation.sql",
  "sql/inventory-database-sessions.sql",
  "sql/terminate-physical-clone-sessions.sql",
  "sql/template0-catalog-manifest.sql",
  "sql/initialize-candidate.sql",
  "sql/preflight-candidate-migration.sql",
  "sql/record-candidate-migration.sql",
  "sql/stage-r2.sql",
  "sql/initialize-export-stage.sql",
  "sql/finalize-export-stage.sql",
  "sql/initialize-galtd-stage.sql",
  "sql/finalize-galtd-stage.sql",
  "sql/stage-replay-evidence.sql",
  "sql/normalize-stage.sql",
  "sql/stage-authoritative-pedigree-resolution.sql",
  "sql/finalize-authoritative-pedigree-saturation.sql",
  "sql/stage-nonpedigree-saturation.sql",
  "sql/stage-duplicate-quarantine-proof-resolution.sql",
  "sql/plan-canonical-merge.sql",
  "sql/merge-canonical.sql",
];

assert.match(
  mergeShell,
  /delta\|verify\) die "\$mode is source-blocked|delta\|verify\) die "\$MODE is source-blocked/,
  "delta and verify must remain visibly blocked",
);
assert.match(mergeShell, /EXPECTED_RUNTIME_UID="999"/);
assert.match(mergeShell, /NORMALIZED_ROOT=.*thedogs-normalized-v1-99279ed8105e70ff/);
assert.match(mergeShell, /NORMALIZED_TRANSFORM_VERSION="thedogs-normalized-harvest\/v2"/);
assert.match(mergeShell, /identityPolicy\.profileArchivesExactProviderIdentity/);
assert.match(mergeShell, /normalized export v2 rebuild is required/);
assert.match(mergeShell, /configured root is the legacy v1 export/);
assert.match(mergeShell, /pin the rebuilt root, manifest SHA-256, dataset counts, bytes, and digests/);
assert.match(mergeShell, /\.source\.sourceCutoff/);
assert.match(mergeShell, /pin the rebuilt v2 cutoff before rerun/);
assert.match(mergeShell, /\.scope\.fullCorpus/);
assert.match(mergeShell, /\[\.partitions\[\]\.outputs\[\]\.bytes\] \| add \/\/ 0/);
assert.match(mergeShell, /\[\.partitions\[\]\.outputs\[\]\.rowCount\] \| add \/\/ 0/);
assert.doesNotMatch(mergeShell, /bytes=15680836549 rows=21635022/);
assert.match(mergeShell, /\*\[!A-Za-z0-9_\.\/\-\]\*/);
assert.match(mergeShell, /unsafe for the psql file boundary/);
assert.match(mergeShell, /select\(length==2\)/);
assert.doesNotMatch(mergeShell, /select\(length=2\)/);
const databaseExistsStart = mergeShell.indexOf("database_exists() {");
const databaseExistsEnd = mergeShell.indexOf("\n}\n\nassert_database()", databaseExistsStart);
assert.ok(databaseExistsStart >= 0 && databaseExistsEnd > databaseExistsStart);
const databaseExists = mergeShell.slice(databaseExistsStart, databaseExistsEnd);
assert.match(databaseExists, /if ! database_count=/);
assert.match(databaseExists, /1\) return 0/);
assert.match(databaseExists, /0\) return 1/);
assert.match(databaseExists, /invalid count/);
const drainStart = mergeShell.indexOf("wait_for_database_connections_to_drain() {");
const drainEnd = mergeShell.indexOf("\n}\n\nlarge_object_inventory()", drainStart);
assert.ok(drainStart >= 0 && drainEnd > drainStart);
const connectionDrain = mergeShell.slice(drainStart, drainEnd);
assert.match(connectionDrain, /drain_attempts.*-lt 30/);
assert.match(connectionDrain, /connection inventory failed/);
assert.match(connectionDrain, /invalid count/);
assert.match(connectionDrain, /bounded drain wait/);

const cloneStart = mergeShell.indexOf("clone_candidate() {");
const cloneEnd = mergeShell.indexOf("\n}\n\nlogical_schema_manifest()", cloneStart);
assert.ok(cloneStart >= 0 && cloneEnd > cloneStart, "clone_candidate function is absent");
const clone = mergeShell.slice(cloneStart, cloneEnd);
assert.match(
  mergeShell,
  /PHYSICAL_CLONE_CONFIRMATION="I_CONFIRM_CONNECTION_FENCE_AND_PHYSICAL_TEMPLATE_CLONE_GIQ_REHEARSAL_RESTORE_V8_TO_GIQ_PRODUCTION_CANDIDATE_20260716_R1"/,
);
assert.match(clone, /PHYSICAL_TEMPLATE_CLONE_CONFIRMATION/);
assert.doesNotMatch(clone, /\bpg_dump\b|\bpg_restore\b|SNAPSHOT_PATH|DUMP_BYPASS_ROLE/);
assert.doesNotMatch(clone, /\bSTRATEGY\b/i);
assert.match(
  clone,
  /CREATE DATABASE \\"\$CANDIDATE_DATABASE\\" WITH TEMPLATE \\"\$PRODUCTION_DATABASE\\" OWNER \\"\$EXPECTED_USER\\" ALLOW_CONNECTIONS false/,
);

const claimInsert = mergeShell.indexOf("insert_physical_clone_claim \"$operation_id\"");
const claimArmed = mergeShell.indexOf(
  "transition_physical_clone_claim \"$operation_id\" prepared source_fence_armed",
  claimInsert,
);
const sourceFence = mergeShell.indexOf(
  'ALTER DATABASE \\"$PRODUCTION_DATABASE\\" WITH ALLOW_CONNECTIONS false',
  claimArmed,
);
const sourceDrained = mergeShell.indexOf(
  "transition_physical_clone_claim \"$operation_id\" source_fenced source_drained",
  sourceFence,
);
const createArmed = mergeShell.indexOf(
  "transition_physical_clone_claim \"$operation_id\" source_drained candidate_create_armed",
  sourceDrained,
);
const finalZeroSessions = mergeShell.indexOf('final_source_sessions="', createArmed);
const physicalCreate = mergeShell.indexOf('CREATE DATABASE \\"$CANDIDATE_DATABASE\\" WITH TEMPLATE', finalZeroSessions);
const sourceRestore = mergeShell.indexOf("restore_physical_clone_source_fence", physicalCreate);
const sourceRestoredClaim = mergeShell.indexOf(
  "transition_physical_clone_claim \"$operation_id\" candidate_created source_restored",
  sourceRestore,
);
const candidateInitialize = mergeShell.indexOf("initialize_physical_clone_candidate", sourceRestoredClaim);
assert.ok(
  claimInsert >= 0 &&
    claimInsert < claimArmed &&
    claimArmed < sourceFence &&
    sourceFence < sourceDrained &&
    sourceDrained < createArmed &&
    createArmed < finalZeroSessions &&
    finalZeroSessions < physicalCreate &&
    physicalCreate < sourceRestore &&
    sourceRestore < sourceRestoredClaim &&
    sourceRestoredClaim < candidateInitialize,
  "durable claim, source fence/drain, physical clone, source restore, and candidate initialization are misordered",
);
assert.match(mergeShell, /recover_stranded_physical_clone_claim/);
const preflight = mergeShell.match(/preflight\(\) \{[\s\S]*?\n\}/)?.[0] ?? "";
assert.ok(
  preflight.indexOf("recover_stranded_physical_clone_claim") <
    preflight.indexOf('assert_database "$PRODUCTION_DATABASE"'),
  "stranded source-fence recovery must run before source database connection preflight",
);
assert.match(mergeShell, /a stranded physical clone source fence was recovered; rerun explicitly/);
assert.match(mergeShell, /candidateIsolation/);
assert.match(mergeShell, /publicPrivilegesRevoked:true/);
assert.match(mergeShell, /databaseAclIntentionallyDiverged:true/);
assert.match(mergeShell, /databaseSettingsNotCopied:true/);

for (const relative of candidatePathSql) {
  const sql = read(relative);
  assert.doesNotMatch(sql, /\bUNLOGGED\b/i, `${relative} must use durable staging tables`);
  for (const block of sql.matchAll(/DO\s+\$\$([\s\S]*?)\$\$;/g)) {
    assert.doesNotMatch(
      block[1],
      /:'[A-Za-z_][A-Za-z0-9_]*'/,
      `${relative} contains a psql variable inside a dollar-quoted DO block`,
    );
  }
}

assert.match(initialize, /CREATE TABLE _giq_history_merge\.snapshot_core_key/);
assert.match(initialize, /jsonb_build_array\(/);
assert.match(initialize, /primary_key_column_count <> 1 OR primary_key_single_name <> 'id'/);
assert.match(initialize, /CREATE TABLE _giq_history_merge\.source_snapshot_manifest/);
assert.match(initialize, /CREATE TABLE _giq_history_merge\.physical_clone_proof/);
assert.match(initialize, /NO FORCE ROW LEVEL SECURITY/);
assert.match(initialize, /FORCE ROW LEVEL SECURITY/);
assert.match(initialize, /SET LOCAL row_security=off/);
assert.match(initialize, /physical candidate full-row manifest is not internally exact/);
assert.match(initialize, /candidate row-security flags were not restored exactly/);
assert.match(initialize, /allTablesHashed/);
assert.doesNotMatch(initialize, /alloydbsuperuser|rolbypassrls|BYPASSRLS/i);
assert.ok(
  initialize.indexOf("BEGIN;") < initialize.indexOf("NO FORCE ROW LEVEL SECURITY") &&
    initialize.indexOf("NO FORCE ROW LEVEL SECURITY") < initialize.indexOf("FORCE ROW LEVEL SECURITY") &&
    initialize.indexOf("FORCE ROW LEVEL SECURITY") < initialize.indexOf("COMMIT;"),
  "candidate-only FORCE-RLS relaxation and exact restoration must share one transaction",
);

assert.match(cloneControl, /source_fence_armed/);
assert.match(cloneControl, /candidate_create_armed/);
assert.match(cloneControl, /REVOKE ALL ON SCHEMA _giq_clone_control FROM PUBLIC/);
assert.match(cloneControl, /REVOKE ALL ON TABLE _giq_clone_control\.physical_clone_claim FROM PUBLIC/);
assert.match(automationInventory, /enabledSubscriptions/);
assert.match(automationInventory, /activeCronJobs/);
assert.match(automationInventory, /activePgAgentJobs/);
assert.match(automationInventory, /preparedTransactions/);
assert.match(sessionInventory, /idleInTransaction/);
assert.match(sessionTermination, /observed_state IS DISTINCT FROM 'idle'/);
assert.match(sessionTermination, /refused_identity_or_state_changed/);
assert.match(sessionTermination, /termination_failed/);
assert.match(sessionTermination, /expected.*terminated.*alreadyGone.*refused/s);

const cleanupStart = mergeShell.indexOf("cleanup_partial_clone() {");
const cleanupEnd = mergeShell.indexOf("\n}\n\nstage_r2()", cleanupStart);
assert.ok(cleanupStart >= 0 && cleanupEnd > cleanupStart, "partial clone cleanup is absent");
const cleanup = mergeShell.slice(cleanupStart, cleanupEnd);
const controlCleanupStart = mergeShell.indexOf("cleanup_partial_clone_control() {");
const controlCleanupEnd = mergeShell.indexOf("\n}\n\ncleanup_partial_clone()", controlCleanupStart);
assert.ok(
  controlCleanupStart >= 0 && controlCleanupEnd > controlCleanupStart,
  "template0 control cleanup is absent",
);
const controlCleanup = mergeShell.slice(controlCleanupStart, controlCleanupEnd);
const fenceCleanupStart = mergeShell.indexOf("release_partial_clone_candidate_fence() {");
const fenceCleanupEnd = mergeShell.indexOf("\n}\n\ncleanup_partial_clone()", fenceCleanupStart);
assert.ok(
  fenceCleanupStart >= 0 && fenceCleanupEnd > fenceCleanupStart,
  "candidate connection-fence recovery is absent",
);
const fenceCleanup = mergeShell.slice(fenceCleanupStart, fenceCleanupEnd);
assert.match(cleanup, /PARTIAL_CLONE_CLEANUP_CONFIRMATION/);
assert.match(cleanup, /PARTIAL_CLONE_EXPECTED_GCS_GENERATION/);
assert.match(cleanup, /PARTIAL_CLONE_EXPECTED_BYTES/);
assert.match(cleanup, /PARTIAL_CLONE_EXPECTED_SHA256/);
assert.match(cleanup, /to_regclass\('_giq_history_merge\.run'\) IS NOT NULL/);
assert.match(cleanup, /to_regnamespace\('_giq_history_merge'\) IS NOT NULL/);
assert.match(cleanup, /PARTIAL_CLONE_CONTROL_DATABASE/);
assert.match(cleanup, /createdb --template=template0 "\$PARTIAL_CLONE_CONTROL_DATABASE"/);
assert.match(cleanup, /exact disposable template0 control database already exists/);
assert.match(cleanup, /PARTIAL_CLONE_CONTROL_OID/);
assert.match(cleanup, /template0 control database owner mismatch/);
assert.match(cleanup, /candidate_data_relations/);
assert.match(cleanup, /control_data_relations/);
assert.match(cleanup, /candidate_schema_manifest/);
assert.match(cleanup, /control_schema_manifest/);
assert.match(cleanup, /candidate_catalog_manifest/);
assert.match(cleanup, /control_catalog_manifest/);
assert.match(cleanup, /cleanup_partial_clone_control/);
assert.match(controlCleanup, /PGDATABASE=postgres dropdb "\$PARTIAL_CLONE_CONTROL_DATABASE"/);
assert.match(controlCleanup, /PARTIAL_CLONE_CONTROL_OID/);
assert.match(controlCleanup, /wait_for_database_connections_to_drain/);
assert.doesNotMatch(controlCleanup, /\brm\b/);
assert.match(fenceCleanup, /PARTIAL_CLONE_CANDIDATE_OID/);
assert.match(fenceCleanup, /ALLOW_CONNECTIONS true/);
assert.doesNotMatch(fenceCleanup, /\bdropdb\b/);
assert.match(cleanup, /\[ ! -L "\$SNAPSHOT_PATH" \]/);
assert.match(cleanup, /\[ ! -e "\$SNAPSHOT_PATH" \]/);
assert.match(cleanup, /PGDATABASE=postgres dropdb "\$CANDIDATE_DATABASE"/);
assert.doesNotMatch(cleanup, /\brm\b/);
for (const protectedDatabase of ["$PRODUCTION_DATABASE", "$HISTORY_DATABASE", "postgres", "template0", "template1"]) {
  assert.ok(cleanup.includes(`!= "${protectedDatabase}"`));
}
for (const protectedDatabase of ["$CANDIDATE_DATABASE", "$PRODUCTION_DATABASE", "$HISTORY_DATABASE", "postgres", "template0", "template1"]) {
  assert.ok(cleanup.includes(`$PARTIAL_CLONE_CONTROL_DATABASE" != "${protectedDatabase}`));
}
assert.ok(
  cleanup.indexOf("cleanup_partial_clone_control || die") <
    cleanup.indexOf('dropdb "$CANDIDATE_DATABASE"'),
  "the disposable template0 control must be removed before the candidate",
);
const controlRemoved = cleanup.indexOf("cleanup_partial_clone_control || die");
const candidateDropped = cleanup.indexOf('dropdb "$CANDIDATE_DATABASE"');
for (const finalRecheck of [
  "partial candidate marker relation appeared before final cleanup",
  "partial candidate marker schema appeared before final cleanup",
  "partial candidate gained a data-bearing relation before final cleanup",
  "partial candidate logical schema changed before final cleanup",
  "partial candidate catalog changed before final cleanup",
  "partial candidate gained large-object metadata or chunks before final cleanup",
]) {
  const recheckPosition = cleanup.indexOf(finalRecheck);
  assert.ok(
    recheckPosition > controlRemoved && recheckPosition < candidateDropped,
    `final candidate recheck must run after control cleanup and before drop: ${finalRecheck}`,
  );
}
assert.match(mergeShell, /pg_catalog\.pg_largeobject_metadata/);
assert.match(mergeShell, /pg_catalog\.pg_largeobject/);
const connectionFence = cleanup.indexOf('ALLOW_CONNECTIONS false');
const postDropAbsence = cleanup.indexOf("partial candidate database remains after final cleanup");
const fenceArm = cleanup.indexOf('PARTIAL_CLONE_CANDIDATE_FENCE_ARMED="1"');
const fenceTrap = cleanup.indexOf("release_partial_clone_candidate_fence || printf");
const fenceDisarm = cleanup.lastIndexOf('PARTIAL_CLONE_CANDIDATE_FENCE_ARMED="0"');
const finalSnapshotSymlinkCheck = cleanup.indexOf(
  "failed snapshot path became a symbolic link before final cleanup",
);
const finalSnapshotAbsenceCheck = cleanup.indexOf(
  "failed snapshot artifact appeared before final cleanup",
);
assert.ok(connectionFence > controlRemoved && connectionFence < candidateDropped);
assert.ok(postDropAbsence > candidateDropped);
assert.ok(fenceArm > controlRemoved && fenceArm < connectionFence);
assert.ok(fenceTrap > fenceArm && fenceTrap < connectionFence);
assert.ok(fenceDisarm > postDropAbsence);
assert.ok(finalSnapshotSymlinkCheck > controlRemoved && finalSnapshotSymlinkCheck < fenceArm);
assert.ok(finalSnapshotAbsenceCheck > controlRemoved && finalSnapshotAbsenceCheck < fenceArm);
assert.match(mergeShell, /cleanup-partial-clone\) cleanup_partial_clone/);

for (const mode of [
  "stage-authoritative-pedigree-resolution",
  "finalize-authoritative-pedigree-saturation",
  "stage-nonpedigree-saturation",
  "stage-duplicate-quarantine-proof-resolution",
]) {
  assert.match(mergeShell, new RegExp(`${mode.replaceAll("-", "\\-")}\\)`));
}
assert.match(mergeShell, /stage_authoritative_pedigree_resolution\(\)/);
assert.match(mergeShell, /finalize_authoritative_pedigree_saturation\(\)/);
assert.match(mergeShell, /stage_nonpedigree_saturation\(\)/);
assert.match(mergeShell, /stage_duplicate_quarantine_proof_resolution\(\)/);
assert.match(mergeShell, /stage-authoritative-pedigree-resolution\.sql/);
assert.match(mergeShell, /stage-nonpedigree-saturation\.sql/);
assert.match(mergeShell, /stage-duplicate-quarantine-proof-resolution\.sql/);
assert.match(mergeShell, /finalize-authoritative-pedigree-saturation\.sql/);
assert.match(mergeShell, /authoritativePedigreeSaturation/);
assert.match(mergeShell, /nonpedigreeSaturation/);
assert.match(mergeShell, /duplicateQuarantineProof/);
assert.match(mergeShell, /'storedStatus',manifest\.status/);
assert.match(mergeShell, /blocker_contract_valid/);
assert.match(mergeShell, /THEN manifest\.status ELSE 'invalid' END/);

const pedigreeStageFunction =
  mergeShell.match(/stage_authoritative_pedigree_resolution\(\) \{[\s\S]*?\n\}/)?.[0] ?? "";
const pedigreeFinalizerFunction =
  mergeShell.match(/finalize_authoritative_pedigree_saturation\(\) \{[\s\S]*?\n\}/)?.[0] ?? "";
const nonpedigreeStageFunction =
  mergeShell.match(/stage_nonpedigree_saturation\(\) \{[\s\S]*?\n\}/)?.[0] ?? "";
const duplicateProofStageFunction =
  mergeShell.match(/stage_duplicate_quarantine_proof_resolution\(\) \{[\s\S]*?\n\}/)?.[0] ?? "";
for (const [label, source] of [
  ["authoritative pedigree stage", pedigreeStageFunction],
  ["authoritative pedigree finalizer", pedigreeFinalizerFunction],
  ["non-pedigree stage", nonpedigreeStageFunction],
  ["duplicate/quarantine proof stage", duplicateProofStageFunction],
]) {
  assert.match(source, /assert_candidate_marker/, `${label} must bind the physical candidate`);
  assert.match(source, /assert_normalized_saturation_phase/, `${label} must run only after normalization`);
}
assert.ok(
  pedigreeStageFunction.indexOf("stage-authoritative-pedigree-resolution.sql") <
    pedigreeStageFunction.indexOf("finalize_authoritative_pedigree_saturation"),
  "pedigree resolution must stage before its saturation manifest is finalized",
);

const canonicalMergeFunction = mergeShell.match(/merge_canonical\(\) \{[\s\S]*?\n\}/)?.[0] ?? "";
assert.ok(canonicalMergeFunction, "merge_canonical function is absent");
assert.match(
  canonicalMergeFunction,
  /if phase_at_least canonical_merged; then[\s\S]*plan_merge[\s\S]*return[\s\S]*--file="\$SQL_ROOT\/plan-canonical-merge\.sql"[\s\S]*--file="\$SQL_ROOT\/merge-canonical\.sql"/,
  "idempotent merge must still plan, while a write must plan and merge in one psql backend",
);

assert.match(plan, /requires all three saturation and duplicate\/quarantine proof manifests/);
assert.match(plan, /authoritative_pedigree_saturation_manifest/);
assert.match(plan, /nonpedigree_saturation_manifest/);
assert.match(plan, /duplicate_quarantine_proof_manifest/);
assert.match(plan, /duplicate_quarantine_proof_resolution/);
assert.match(plan, /pedigree\.status='ready' AND nonpedigree\.status='ready'/);
assert.match(plan, /pedigree\.normalized_manifest_sha256=nonpedigree\.normalized_manifest_sha256/);
assert.match(plan, /pedigree\.source_history_cutoff=nonpedigree\.source_history_cutoff/);
assert.match(plan, /jsonb_each\(manifest\.blockers\)/);
assert.match(plan, /jsonb_typeof\(value\) IS DISTINCT FROM 'number'/);
assert.match(plan, /value::text !~ '\^\(0\|\[1-9\]\[0-9\]\*\)\$'/);
assert.match(plan, /value <> '0'::jsonb/);
assert.doesNotMatch(plan, /jsonb_each_text\([^)]*blockers|value::bigint|sum\(value::bigint\)/);
assert.match(plan, /jsonb_object_length\(pedigree\.blockers\)=22/);
assert.match(plan, /jsonb_object_length\(nonpedigree\.blockers\)=11/);
assert.match(plan, /jsonb_object_length\(duplicate_proof\.blockers\)=19/);
assert.match(plan, /duplicate_proof\.source_datasets=\(/);
assert.match(plan, /unvalidatedInboundForeignKeyProofGaps/);
assert.match(plan, /unvalidated_reference_constraints_proven IS NOT TRUE/);
assert.match(plan, /SELECT normalized_manifest_sha256 FROM _giq_history_merge\.run WHERE id=1/);
assert.doesNotMatch(plan, /b84eab94d931b4e038766db7393b141b190548ba4a4e6bdb906b5692cb7b1116/);
assert.match(plan, /authoritative_pedigree_retrieval_queue/);
assert.match(plan, /nonpedigree_authoritative_fetch_queue/);
assert.match(plan, /review-only removals/);
assert.match(plan, /candidate_count IS DISTINCT FROM 1 OR canonical_entity_id IS NULL/);
assert.match(plan, /canonical_write_eligible IS NOT TRUE/);
assert.match(plan, /release_eligible IS NOT TRUE/);
assert.match(plan, /relationship_repair_allowed IS NOT TRUE/);
assert.match(plan, /CREATE TEMP TABLE giq_canonical_merge_plan_attestation/);
assert.match(plan, /ON COMMIT PRESERVE ROWS/);
assert.match(plan, /pg_backend_pid\(\)/);
assert.match(plan, /clone_operation_id/);
assert.match(plan, /pedigree_blockers_sha256/);
assert.match(plan, /nonpedigree_blockers_sha256/);
assert.match(plan, /duplicate_proof_blockers_sha256/);
assert.match(plan, /gen_random_uuid\(\)/);
assert.match(plan, /attestation_sha256/);

for (const attestationGuard of [
  "same-session read-only plan attestation",
  "pg_my_temp_schema()",
  "relpersistence='t'",
  "attestation_expected_columns<>28",
  "attestation_actual_columns<>28",
  "attestation_backend_pid IS DISTINCT FROM pg_backend_pid()",
  "attestation_database_oid IS DISTINCT FROM current_database_oid",
  "attestation_clone_operation_id IS DISTINCT FROM run_clone_operation_id",
  "attestation_manifest_sha256 IS DISTINCT FROM run_manifest_sha256",
  "attestation_pedigree_blockers_sha256 IS DISTINCT FROM current_pedigree_blockers_sha256",
  "attestation_nonpedigree_blockers_sha256 IS DISTINCT FROM current_nonpedigree_blockers_sha256",
  "attestation_duplicate_proof_manifest_sha256 IS DISTINCT FROM duplicate_proof_manifest_sha256",
  "attestation_duplicate_proof_blockers_sha256 IS DISTINCT FROM current_duplicate_proof_blockers_sha256",
  "attestation_planned_at < clock_timestamp()-interval '10 minutes'",
  "attestation_sha256 IS DISTINCT FROM expected_attestation_sha256",
  "DELETE FROM pg_temp.giq_canonical_merge_plan_attestation WHERE id=1",
]) {
  assert.ok(canonical.includes(attestationGuard), `canonical merge is missing ${attestationGuard}`);
}
assert.ok(
  canonical.indexOf("DELETE FROM pg_temp.giq_canonical_merge_plan_attestation") <
    canonical.indexOf("CREATE TABLE _giq_history_merge.track_alias_map"),
  "the same-session plan attestation must be consumed before canonical DML",
);

assert.match(pedigreeFinalizer, /current_database\(\)<>'giq_production_candidate_20260716_r1'/);
assert.match(
  pedigreeFinalizer,
  /normalized_transform_version IS DISTINCT FROM 'thedogs-normalized-harvest\/v2'/,
);
assert.match(pedigreeFinalizer, /authoritative_pedigree_saturation_manifest/);
assert.match(pedigreeFinalizer, /source_lineage jsonb NOT NULL/);
assert.match(pedigreeFinalizer, /status text NOT NULL CHECK\(status IN \('ready','blocked'\)\)/);
assert.match(pedigreeFinalizer, /retrievalRequired/);
assert.match(pedigreeFinalizer, /conflictOrRejectedIdentityEvidence/);
assert.match(pedigreeFinalizer, /conflictOrRejectedPedigreeEvidence/);
assert.match(pedigreeFinalizer, /galtdCompositeRowsPendingAuthoritativeResolution/);
assert.match(pedigreeFinalizer, /reviewOnlyRemovals/);
assert.match(pedigreeFinalizer, /canonicalWriteProofGaps/);
assert.match(pedigreeFinalizer, /NOT canonical_write_eligible AND verification_status='verified'/);
assert.match(pedigreeFinalizer, /quarantineReleaseProofGaps/);
assert.match(pedigreeFinalizer, /unaccountedQuarantineRows/);
assert.match(pedigreeFinalizer, /sourceLineageGaps/);
const pedigreeBlockerSection = pedigreeFinalizer.slice(
  pedigreeFinalizer.indexOf("blockers AS ("),
  pedigreeFinalizer.indexOf(")\nINSERT INTO _giq_history_merge.authoritative_pedigree_saturation_manifest"),
);
const pedigreeBlockerKeys = [...pedigreeBlockerSection.matchAll(/^\s{4}'([^']+)',/gm)].map(
  (match) => match[1],
);
assert.equal(pedigreeBlockerKeys.length, 22);
assert.equal(new Set(pedigreeBlockerKeys).size, 22);
assert.match(pedigreeFinalizer, /REVOKE ALL ON _giq_history_merge\.authoritative_pedigree_saturation_manifest FROM PUBLIC/);
assert.match(pedigreeFinalizer, /\\quit 3/);
assert.doesNotMatch(pedigreeFinalizer, /jsonb_each_text\([^)]*blockers|item\.value::bigint/);
assert.doesNotMatch(pedigreeFinalizer, /(?:INSERT INTO|UPDATE|DELETE FROM|TRUNCATE)\s+public\./i);

assert.match(nonpedigreeStage, /nonpedigree_saturation_manifest/);
assert.match(nonpedigreeStage, /status IN \('ready','blocked'\)/);
assert.match(nonpedigreeStage, /\\quit 3/);

assert.match(duplicateProofStage, /giq-duplicate-quarantine-proof\/v1/);
assert.match(duplicateProofStage, /thedogs-normalized-harvest\/v2/);
assert.match(duplicateProofStage, /false AS create_entity_allowed/);
assert.match(duplicateProofStage, /unvalidated_reference_constraints_proven/);
assert.match(duplicateProofStage, /reference_conservation_proven/);
assert.match(duplicateProofStage, /BEFORE UPDATE OR DELETE/);
assert.doesNotMatch(duplicateProofStage, /(?:INSERT INTO|UPDATE|DELETE FROM|TRUNCATE)\s+public\./i);

for (const [label, sql] of [
  ["plan", plan],
  ["canonical merge", canonical],
  ["candidate verification", verify],
]) {
  assert.match(sql, /giq-duplicate-quarantine-proof\/v1/, `${label} must pin the proof schema`);
  assert.match(sql, /thedogs-normalized-harvest\/v2/, `${label} must require identity-audited v2`);
  assert.match(sql, /jsonb_object_length\([^)]*blockers\)(?:<>|=)19/u,
    `${label} must pin the exact proof blocker contract`);
  assert.match(sql, /unvalidatedInboundForeignKeyProofGaps/u,
    `${label} must retain the unvalidated-FK proof gap`);
  assert.match(sql, /unvalidated_reference_constraints_proven IS NOT TRUE/u,
    `${label} must independently reject unproved unvalidated references`);
  assert.match(sql, /create_entity_allowed IS NOT FALSE/u,
    `${label} must forbid proof-stage entity creation`);
  assert.match(sql, /source_datasets/u, `${label} must bind duplicate/quarantine dataset manifests`);
  assert.match(sql, /FULL JOIN _giq_history_stage\.duplicate_quarantine_issue/u,
    `${label} must exactly reconcile the proof inventory to staged source rows`);
  assert.match(sql, /source\.payload IS DISTINCT FROM issue\.source_payload/u,
    `${label} must compare full source payloads, not counts alone`);
  assert.match(sql, /duplicate_quarantine_resolution_audit_append_only/u,
    `${label} must require the append-only resolution trigger`);
  assert.match(sql, /duplicate_quarantine_reference_proof_append_only/u,
    `${label} must require the append-only reference trigger`);
  assert.match(sql, /tgenabled<>'D'/u, `${label} must require enabled audit triggers`);
}
assert.match(canonical, /LOCK TABLE[\s\S]*duplicate_quarantine_resolution_audit[\s\S]*IN SHARE MODE/u);
assert.match(verify, /duplicate_quarantine_proof_partition/u);
assert.match(verify, /appendOnlyAudit/u);
assert.match(verify, /duplicate_quarantine_reference_proof_append_only/u);
assert.match(mergeShell, /append_only_triggers_complete/u);

assert.match(mergeShell, /pg_dump --schema-only --format=plain --quote-all-identifiers/);
assert.match(mergeShell, /\\restrict <TOKEN>/);
assert.match(mergeShell, /\\unrestrict <TOKEN>/);
assert.match(template0Catalog, /BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY/);
assert.match(template0Catalog, /pg_identify_object/);
assert.match(template0Catalog, /extensionMembers/);
assert.match(template0Catalog, /viewDefinitionMd5/);
assert.match(template0Catalog, /pg_db_role_setting/);
assert.doesNotMatch(template0Catalog, /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b/i);

const aliasPosition = canonical.indexOf("CREATE TABLE _giq_history_merge.track_alias_map");
const identityPreflightPosition = canonical.indexOf("alternate_unique_conflicts bigint");
assert.ok(aliasPosition >= 0 && aliasPosition < identityPreflightPosition);
assert.match(canonical, /Meadows alias consolidation is not bound to both snapshot Track identities/);
assert.match(canonical, /meeting-date collision/);
const aliasLedgerEnd = canonical.indexOf("alternate_unique_conflicts bigint", aliasPosition);
const aliasLedger = canonical.slice(aliasPosition, aliasLedgerEnd);
for (const noLossProof of [
  "https://www.grv.org.au/venues/the-meadows/",
  "identity_candidate_inventory",
  "foreign_key_inventory",
  "alias_row_before",
  "canonical_row_before",
  "canonical_row_after",
  "alias_row_sha256",
  "canonical_before_sha256",
  "canonical_after_sha256",
  "whole_database_match_complete",
  "authoritative_duplicate_proof",
  "unique_verified_fields_merged",
  "all_references_enumerated",
  "all_references_redirected",
  "reference_conservation_verified",
  "relationship_integrity_verified",
  "source_history_preserved",
  "no_data_loss_verified",
  "audit_ledger_recorded",
  "release_eligible",
  "track alias consolidation evidence is append-only",
  "generate_subscripts(constraint_definition.conkey,1)",
  "foreign_key_count<>2",
  "meetings_total_after<>meetings_total_before",
  "forms_total_after<>forms_total_before",
  "tracks_after<>tracks_before-1",
  "GET DIAGNOSTICS meetings_updated=ROW_COUNT",
  "GET DIAGNOSTICS forms_updated=ROW_COUNT",
  "GET DIAGNOSTICS tracks_deleted=ROW_COUNT",
]) {
  assert.ok(aliasLedger.includes(noLossProof), `Meadows ledger is missing ${noLossProof}`);
}
assert.match(
  aliasLedger,
  /alias_row_before - ARRAY\['id','name','createdAt'\]::text\[\]\)[\s\S]*IS DISTINCT FROM[\s\S]*canonical_row_before - ARRAY\['id','name','createdAt'\]::text\[\]/,
);
const aliasDelete = aliasLedger.indexOf('DELETE FROM public."Track" WHERE id=alias_id');
const aliasProofCheck = aliasLedger.indexOf("Meadows alias consolidation proof failed", aliasDelete);
const aliasLedgerInsert = aliasLedger.indexOf(
  "INSERT INTO _giq_history_merge.track_alias_map(",
  aliasDelete,
);
assert.ok(aliasDelete >= 0 && aliasProofCheck > aliasDelete && aliasLedgerInsert > aliasProofCheck);
assert.doesNotMatch(aliasLedger, /ON CONFLICT[^;]*DO UPDATE/i);

const galtdDecisionPosition = canonical.indexOf(
  "CREATE TABLE _giq_history_stage.galtd_merge_decision",
);
const postGaltdPosition = canonical.indexOf("Re-adjudicate TheDogs assertions only after exact GALTD");
assert.ok(galtdDecisionPosition >= 0 && postGaltdPosition > galtdDecisionPosition);
assert.match(canonical, /winning_source_provider='galtd'/);
assert.match(canonical, /verified-by-exact-galtd-crosswalk/);
assert.match(canonical, /left a populated canonical parent pending/);
assert.match(canonical, /"verificationStatus"=CASE decision\.decision/);
assert.match(canonical, /decision\.winning_assertion_id/);

console.log("alloydb full-history isolated candidate source contract: PASS");
