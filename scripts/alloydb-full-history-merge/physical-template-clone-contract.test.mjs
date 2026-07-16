import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (relative) => readFileSync(join(root, relative), "utf8");

const shell = read("merge.sh");
const initialize = read("sql/initialize-candidate.sql");
const control = read("sql/initialize-physical-clone-control.sql");
const sessions = read("sql/inventory-database-sessions.sql");
const termination = read("sql/terminate-physical-clone-sessions.sql");
const automation = read("sql/inventory-database-automation.sql");
const audit = read("sql/audit-candidate-canonical-integrity.sql");

const functionBody = (name, nextName) => {
  const start = shell.indexOf(`${name}() {`);
  const end = shell.indexOf(`\n}\n\n${nextName}()`, start);
  assert.ok(start >= 0 && end > start, `${name} is absent`);
  return shell.slice(start, end);
};

const recovery = functionBody(
  "recover_stranded_physical_clone_claim",
  "assert_count",
);
const clone = functionBody("clone_candidate", "logical_schema_manifest");
const candidateInitialize = functionBody(
  "initialize_physical_clone_candidate",
  "clone_candidate",
);
const candidateIsolation = functionBody(
  "isolate_physical_clone_candidate",
  "initialize_physical_clone_candidate",
);

for (const phase of [
  "source_fence_armed",
  "source_fenced",
  "source_drained",
  "candidate_create_armed",
  "candidate_created",
]) {
  assert.match(recovery, new RegExp(`\\b${phase}\\b`));
}
assert.match(recovery, /restore_physical_clone_source_fence/);
assert.match(recovery, /assert_physical_clone_size_compatible/);
assert.match(recovery, /--argjson sourceBytes "\$claim_source_bytes"/);
assert.match(
  recovery,
  /sourceBytes:\$sourceBytes,candidateBytes:\$candidateBytes/,
);
assert.doesNotMatch(recovery, /sourceBytes:\$sourceMetadata\.bytes/);
assert.match(shell, /MAX_PHYSICAL_CLONE_SIZE_DELTA_BYTES="67108864"/);
assert.match(shell, /source_bytes \/ 100/);
assert.match(shell, /sizeIsAllocationSanityOnly:true/);
assert.match(shell, /assert_candidate_allocation_observation_compatible\(\)/);
assert.match(shell, /candidate_allocation_delta/);
assert.match(shell, /candidate_allocation_allowed/);
assert.match(recovery, /ALTER DATABASE \\"\$CANDIDATE_DATABASE\\" WITH ALLOW_CONNECTIONS false/);
assert.match(recovery, /candidate OID does not match the durable claim/);
assert.match(recovery, /source_restored_without_candidate/);
assert.match(recovery, /transition_physical_clone_claim[\s\S]*source_restored/);
assert.match(
  recovery,
  /a stranded physical clone source fence was recovered; rerun explicitly/,
);
assert.ok(
  recovery.indexOf("restore_physical_clone_source_fence") <
    recovery.indexOf('REVOKE ALL ON DATABASE \\"$CANDIDATE_DATABASE\\" FROM PUBLIC'),
  "stranded recovery must restore the exact source before touching a candidate",
);
assert.ok(
  recovery.indexOf("closed_candidate_metadata=") <
    recovery.indexOf('ALLOW_CONNECTIONS true'),
  "recovery must prove the closed candidate ACL before opening it",
);
assert.ok(
  recovery.lastIndexOf('WITH ALLOW_CONNECTIONS false') <
    recovery.indexOf("recovery_candidate_sessions="),
  "recovery must re-fence an unexpectedly open candidate before session and ACL checks",
);

assert.match(control, /phase text NOT NULL CHECK \(phase IN/);
assert.match(control, /'prepared'/);
assert.match(control, /'source_fence_armed'/);
assert.match(control, /'candidate_create_armed'/);
assert.match(control, /'source_restored'/);
assert.match(control, /'recovered'/);
assert.match(control, /'complete'/);
assert.match(control, /physical_clone_claim_one_active_candidate/);
assert.match(control, /physical_clone_claim_one_active_operation/);
assert.match(control, /physical_clone_claim\(\(true\)\)/);
assert.match(control, /WHERE completed_at IS NULL/);
assert.match(control, /operation_active_index_valid/);
assert.match(control, /pg_get_indexdef\(definition\.indexrelid,1,true\) IN \('true','\(true\)'\)/);
assert.match(control, /aclexplode/);
assert.match(control, /FORCE ROW LEVEL SECURITY/);
assert.match(control, /physical_clone_claim_postgres_only/);
assert.match(control, /session_user='postgres'/);
assert.match(control, /exclusive privilege invariant failed/);

assert.match(sessions, /idle in transaction/);
assert.match(sessions, /backendStart/);
assert.match(sessions, /backendType/);
assert.match(termination, /observed_backend_start IS DISTINCT FROM "backendStart"/);
assert.match(termination, /observed_user IS DISTINCT FROM "user"/);
assert.match(termination, /observed_state IS DISTINCT FROM 'idle'/);
assert.match(termination, /pg_terminate_backend\(observed_pid, 5000\)/);
assert.match(termination, /already_gone/);
assert.match(termination, /termination_failed/);
assert.match(termination, /'refused'/);
assert.match(automation, /'enabledEventTriggers'/);

assert.doesNotMatch(clone, /\bpg_dump\b|\bpg_restore\b|\bSTRATEGY\b/i);
assert.match(
  clone,
  /CREATE DATABASE \\"\$CANDIDATE_DATABASE\\" WITH TEMPLATE \\"\$PRODUCTION_DATABASE\\" OWNER \\"\$EXPECTED_USER\\" ALLOW_CONNECTIONS false/,
);
assert.match(clone, /final_source_sessions/);
assert.match(clone, /source session appeared immediately before physical template creation/);
assert.match(clone, /rolcreatedb OR rolsuper/);
assert.ok(
  clone.indexOf("rolcreatedb OR rolsuper") <
    clone.indexOf("PHYSICAL_CLONE_SOURCE_FENCE_ARMED=\"1\""),
  "CREATEDB capability must be proven before arming the source fence",
);
assert.match(clone, /\.enabledEventTriggers==0/);
assert.match(clone, /candidate_bytes.*fenced_source_bytes/s);
assert.match(clone, /restore_physical_clone_source_fence/);
assert.match(clone, /candidate_created source_restored/);
assert.match(clone, /initialize_physical_clone_candidate/);
assert.doesNotMatch(clone, /NO FORCE ROW LEVEL SECURITY/i);
const armedState = clone.indexOf('PHYSICAL_CLONE_SOURCE_FENCE_ARMED="1"');
const durableArm = clone.indexOf(
  "transition_physical_clone_claim \"$operation_id\" prepared source_fence_armed",
);
const exitTrap = clone.indexOf("trap 'restore_physical_clone_source_fence");
const signalTrap = clone.indexOf("trap 'exit 1' 1 2 15");
const sourceFence = clone.indexOf(
  'ALTER DATABASE \\"$PRODUCTION_DATABASE\\" WITH ALLOW_CONNECTIONS false',
);
assert.ok(
  armedState >= 0 &&
    armedState < durableArm &&
    durableArm < exitTrap &&
    exitTrap < signalTrap &&
    signalTrap < sourceFence,
  "in-memory state, durable recovery claim, and traps must precede the source fence",
);

assert.match(candidateInitialize, /source_restored/);
assert.match(candidateInitialize, /candidate marker operation does not match/);
assert.match(candidateInitialize, /candidateIsolation\.publicPrivilegesRevoked/);
assert.match(candidateInitialize, /candidateIsolation\.databaseSettingsNotCopied/);
assert.match(candidateIsolation, /candidateAllocationObservation/);
assert.match(candidateIsolation, /creationBytes:\$candidateCreationBytes/);
assert.match(candidateIsolation, /observedBytes:\$candidateObservedBytes/);
assert.doesNotMatch(
  candidateIsolation,
  /\.bytes'\)" = "\$candidate_bytes"/,
);
assert.match(
  candidateInitialize,
  /\.physicalCloneSizeCompatibility\.sourceBytes==\.source\.bytes/,
);
assert.match(
  candidateInitialize,
  /\.physicalCloneSizeCompatibility\.candidateBytes==\.candidate\.bytes/,
);
assert.match(
  candidateInitialize,
  /\.physicalCloneSizeCompatibility\.deltaBytes==\(\.source\.bytes-\.candidate\.bytes\)/,
);
assert.match(
  candidateInitialize,
  /\.physicalCloneSizeCompatibility\.allowedDeltaBytes==/,
);
assert.match(shell, /nonOwnerAclGrants/);
assert.match(shell, /ownerAclPrivileges/);
assert.match(shell, /\["CONNECT","CREATE","TEMPORARY"\]/);
assert.match(candidateInitialize, /source_restored complete/);
assert.ok(
  candidateIsolation.indexOf("closed_candidate_metadata=") <
    candidateIsolation.indexOf('ALLOW_CONNECTIONS true'),
  "candidate isolation must prove the closed ACL before opening it",
);
assert.ok(
  candidateIsolation.indexOf('WITH ALLOW_CONNECTIONS false') <
    candidateIsolation.indexOf("candidate_sessions="),
  "candidate isolation must close the database before proving zero sessions",
);
assert.match(candidateInitialize, /source identity changed before durable completion/);
assert.match(candidateInitialize, /candidate identity or isolation changed before durable completion/);
assert.ok(
  candidateInitialize.indexOf("completion_source_metadata=") <
    candidateInitialize.indexOf("source_restored complete"),
  "current source and candidate identity must be checked before completing the durable claim",
);

assert.equal((initialize.match(/^BEGIN;/gm) ?? []).length, 1);
assert.equal((initialize.match(/^COMMIT;/gm) ?? []).length, 1);
assert.match(initialize, /to_regprocedure\('pg_catalog\.sha256\(bytea\)'\)/);
assert.ok(
  initialize.indexOf("to_regprocedure('pg_catalog.sha256(bytea)')") <
    initialize.indexOf("BEGIN;"),
  "core SHA-256 capability must be proven before initialization writes",
);
assert.ok(
  initialize.indexOf("pg_database_size(oid)") < initialize.indexOf("BEGIN;"),
  "candidate clone allocation observation must be bounded before initialization writes",
);
assert.match(initialize, /abs\(\(:'clone_claim'::jsonb->'candidate'->>'bytes'\)::bigint/);
assert.match(initialize, /candidateAllocationObservation/);
assert.match(initialize, /LOCK TABLE public\.%I IN ACCESS EXCLUSIVE MODE/);
assert.match(initialize, /SET LOCAL TIME ZONE 'UTC'/);
assert.match(initialize, /SET LOCAL IntervalStyle = 'postgres'/);
assert.match(initialize, /SET LOCAL bytea_output = 'hex'/);
assert.match(initialize, /ALTER TABLE ONLY public\.%I NO FORCE ROW LEVEL SECURITY/);
assert.match(initialize, /ALTER TABLE ONLY public\.%I FORCE ROW LEVEL SECURITY/);
assert.match(
  initialize,
  /encode\(pg_catalog\.sha256\(convert_to\(COALESCE\(string_agg\(encode\(pg_catalog\.sha256\(convert_to\(to_jsonb\(t\)::text, ''UTF8''\)\)/,
);
assert.doesNotMatch(initialize, /\bdigest\s*\(/i);
assert.match(initialize, /ORDER BY %s/);
assert.match(initialize, /COLLATE "C"/);
assert.match(initialize, /candidate row-security flags were not restored exactly/);
assert.match(initialize, /enabledEventTriggers/);
assert.match(initialize, /aclexplode/);
assert.match(initialize, /ARRAY\['CONNECT','CREATE','TEMPORARY'\]::text\[\]/);
assert.match(initialize, /FULL JOIN \(/);
assert.match(initialize, /\) observed_catalog USING\(table_name\)/);
assert.doesNotMatch(initialize, /\) current_catalog USING\(table_name\)/);
assert.match(initialize, /physical_clone_proof/);
assert.match(
  initialize,
  /physicalCloneSizeCompatibility'->>'sourceBytes'[\s\S]*<> \(claim->'source'->>'bytes'\)::bigint/,
);
assert.match(
  initialize,
  /physicalCloneSizeCompatibility'->>'candidateBytes'[\s\S]*<> \(claim->'candidate'->>'bytes'\)::bigint/,
);
assert.match(initialize, /physicalCloneSizeCompatibility'->>'deltaBytes'/);
assert.match(initialize, /physicalCloneSizeCompatibility'->>'allowedDeltaBytes'/);
assert.match(initialize, /source_connection_restored/);
assert.match(initialize, /database_metadata_intentionally_isolated/);
assert.match(initialize, /all_tables_hashed/);
assert.match(initialize, /force_rls_restored/);

assert.match(audit, /_giq_history_merge\.physical_clone_proof/);
assert.doesNotMatch(audit, /dump_visibility_proof/);
assert.match(audit, /proof\.candidate_bytes<=proof\.source_bytes/);
assert.match(audit, /proof\.source_bytes-proof\.candidate_bytes/);
assert.match(audit, /physicalCloneSizeCompatibility/);
assert.match(audit, /candidateAllocationObservation/);
assert.match(
  audit,
  /physicalCloneSizeCompatibility'->>'sourceBytes'[\s\S]*=proof\.source_bytes/,
);
assert.match(
  audit,
  /physicalCloneSizeCompatibility'->>'candidateBytes'[\s\S]*=proof\.candidate_bytes/,
);
assert.match(audit, /physicalCloneSizeCompatibility'->>'deltaBytes'/);
assert.match(audit, /physicalCloneSizeCompatibility'->>'allowedDeltaBytes'/);
assert.match(audit, /proof\.sessions_observed=/);
assert.match(audit, /proof\.source_connection_restored/);
assert.match(audit, /proof\.all_tables_hashed/);
assert.match(audit, /proof\.force_rls_restored/);

console.log("alloydb physical template clone contract: PASS");
