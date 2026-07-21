#!/bin/sh
set -eu

umask 077

readonly WORKFLOW_VERSION="giq-full-history-merge/v3"
readonly SQL_ROOT="/usr/local/share/giq-full-history-merge/sql"
readonly EXPECTED_HOST="10.240.116.2"
readonly EXPECTED_PORT="5432"
readonly EXPECTED_USER="postgres"
readonly EXPECTED_RUNTIME_UID="999"
readonly EXPECTED_RUNTIME_GID="999"
readonly MAX_PHYSICAL_CLONE_SIZE_DELTA_BYTES="67108864"
readonly PRODUCTION_DATABASE="giq_rehearsal_restore_v8"
readonly HISTORY_DATABASE="giq_full_history_rehearsal_20260716_r2"
readonly CANDIDATE_DATABASE="giq_production_candidate_20260716_r1"
readonly HISTORY_ARCHIVE_SHA256="e0ac35834d111fba43f6ab24ac9723fa3097efcb9a443790b673aa353dcc3443"
readonly HISTORY_MAX_RACE_EPOCH_MS="1783854845281"
readonly HISTORY_SOURCE_CUTOFF="2026-07-16T16:12:26.544Z"
readonly HISTORY_MOUNT_ROOT="${HISTORY_MOUNT_ROOT:-/mnt/history}"
readonly NORMALIZED_ROOT="${NORMALIZED_ROOT:-$HISTORY_MOUNT_ROOT/normalized/thedogs-normalized-v2-a43d10e4aaa5ef82}"
readonly NORMALIZED_MANIFEST_SHA256="13bc8d83c048633b57c5299ec1e778179276fee855182b9c932f8a28a77fbf1c"
readonly NORMALIZED_TRANSFORM_VERSION="thedogs-normalized-harvest/v2"
readonly LEGACY_NORMALIZED_MANIFEST_SHA256="b84eab94d931b4e038766db7393b141b190548ba4a4e6bdb906b5692cb7b1116"
readonly LEGACY_HISTORY_SOURCE_CUTOFF="2026-07-01T02:49:36.504Z"
readonly NORMALIZED_INPUT_REBIND_CONFIRMATION_TOKEN="I_CONFIRM_REBIND_UNSTAGED_CANDIDATE_INPUT_FROM_LEGACY_V1_TO_VERIFIED_V2"
readonly GALTD_ROOT="${GALTD_ROOT:-$HISTORY_MOUNT_ROOT/pedigree/galtd-studbooks-v66-v73}"
readonly GALTD_REPORT_SHA256="cc7654cdd0e2704601b322c5a903044f03ccab216fd238a700f8545148ea0253"
readonly GALTD_PARSER_VERSION="galtd-studbook-audit-v1"
readonly GALTD_EXPORTER="$SQL_ROOT/../galtd-stage-export.ts"
readonly PRISMA_SCHEMA="$SQL_ROOT/../prisma/schema.prisma"
readonly MIGRATION_MANIFEST="$SQL_ROOT/../migration-manifest.tsv"
readonly REPLAY_EVIDENCE_CONTRACT="$SQL_ROOT/../replay-evidence-contract.json"
readonly REPLAY_EVIDENCE_CONTRACT_SHA256="aa6e63533daf5dd8c8e0aa2d5654b91f49140aeb2338904664430551600aae16"
readonly AUTHORITATIVE_PEDIGREE_FINALIZER_SQL="$SQL_ROOT/finalize-authoritative-pedigree-saturation.sql"
readonly AUTHORITATIVE_PEDIGREE_V1_ARCHIVE_SQL="$SQL_ROOT/archive-authoritative-pedigree-saturation-v1.sql"
readonly NORMALIZE_CHECKPOINTED_RUNNER="/usr/local/bin/giq-normalize-checkpointed"
readonly DUPLICATE_QUARANTINE_SOURCE_EVIDENCE_ROOT=".backfill/evidence/thedogs-duplicate-quarantine-evidence-20260718T190916AEST"
readonly SNAPSHOT_ROOT="${SNAPSHOT_ROOT:-$HISTORY_MOUNT_ROOT/snapshots}"
readonly SNAPSHOT_PATH="$SNAPSHOT_ROOT/$CANDIDATE_DATABASE-from-$PRODUCTION_DATABASE.dump"
readonly PHYSICAL_CLONE_CONFIRMATION="I_CONFIRM_CONNECTION_FENCE_AND_PHYSICAL_TEMPLATE_CLONE_GIQ_REHEARSAL_RESTORE_V8_TO_GIQ_PRODUCTION_CANDIDATE_20260716_R1"
readonly PHYSICAL_CLONE_CONTROL_SQL="$SQL_ROOT/initialize-physical-clone-control.sql"
readonly PHYSICAL_CLONE_AUTOMATION_SQL="$SQL_ROOT/inventory-database-automation.sql"
readonly PHYSICAL_CLONE_SESSIONS_SQL="$SQL_ROOT/inventory-database-sessions.sql"
readonly PHYSICAL_CLONE_TERMINATE_SQL="$SQL_ROOT/terminate-physical-clone-sessions.sql"
readonly TEMPLATE0_CATALOG_MANIFEST_SQL="$SQL_ROOT/template0-catalog-manifest.sql"
readonly PARTIAL_CLONE_CONTROL_DATABASE="giq_partial_clone_template0_control_20260716_r1"
readonly PARTIAL_CLONE_GCS_GENERATION="1784200173056681"
readonly PARTIAL_CLONE_BYTES="575903"
readonly PARTIAL_CLONE_SHA256="767039eb7e89353284e7525d2f02cb7bcbca50881aad88f2a2a5bd2262affcd5"
readonly PARTIAL_CLONE_CONFIRMATION="I_CONFIRM_DROP_EXACT_UNMARKED_EMPTY_GIQ_CANDIDATE_FOR_FAILED_SNAPSHOT_1784200173056681"
readonly MODE="${MERGE_MODE:-status}"

PHYSICAL_CLONE_OPERATION_ID=""
PHYSICAL_CLONE_SOURCE_OID=""
PHYSICAL_CLONE_SOURCE_FENCE_ARMED="0"
PARTIAL_CLONE_CONTROL_CLAIMED="0"
PARTIAL_CLONE_CONTROL_OID=""
PARTIAL_CLONE_CANDIDATE_FENCE_ARMED="0"
PARTIAL_CLONE_CANDIDATE_OID=""

die() {
  printf 'OPERATOR_ATTENTION: %s\n' "$*" >&2
  exit 1
}

assert_absolute_nonsymlink_path() {
  path="$1"
  label="$2"
  case "$path" in
    /*) ;;
    *) die "$label must be an absolute path" ;;
  esac
  case "$path" in *'*'*|*'?'*|*'['*) die "$label contains a glob metacharacter" ;; esac
  case "$path" in
    *[!A-Za-z0-9_./-]*) die "$label contains a character unsafe for the psql file boundary" ;;
  esac
  case "$path/" in
    *'/../'*|*'/./'*|*'//'*) die "$label contains a non-canonical path segment" ;;
  esac
  [ -d "$path" ] || die "$label directory is absent: $path"
  current=""
  old_ifs="$IFS"
  IFS='/'
  for component in $path; do
    [ -n "$component" ] || continue
    current="$current/$component"
    [ ! -L "$current" ] || die "$label traverses a symbolic link: $current"
  done
  IFS="$old_ifs"
}

assert_mount_paths() {
  assert_absolute_nonsymlink_path "$HISTORY_MOUNT_ROOT" HISTORY_MOUNT_ROOT
  assert_absolute_nonsymlink_path "$NORMALIZED_ROOT" NORMALIZED_ROOT
  assert_absolute_nonsymlink_path "$GALTD_ROOT" GALTD_ROOT
  assert_absolute_nonsymlink_path "$SNAPSHOT_ROOT" SNAPSHOT_ROOT
  case "$NORMALIZED_ROOT" in "$HISTORY_MOUNT_ROOT"/*) ;; *) die "NORMALIZED_ROOT escapes HISTORY_MOUNT_ROOT" ;; esac
  case "$GALTD_ROOT" in "$HISTORY_MOUNT_ROOT"/*) ;; *) die "GALTD_ROOT escapes HISTORY_MOUNT_ROOT" ;; esac
  case "$SNAPSHOT_ROOT" in "$HISTORY_MOUNT_ROOT"/*) ;; *) die "SNAPSHOT_ROOT escapes HISTORY_MOUNT_ROOT" ;; esac
}

assert_runtime_identity() {
  observed_uid="$(id -u)"
  observed_gid="$(id -g)"
  [ "$observed_uid" = "$EXPECTED_RUNTIME_UID" ] || \
    die "merge image must run as postgres uid $EXPECTED_RUNTIME_UID, observed $observed_uid"
  [ "$observed_gid" = "$EXPECTED_RUNTIME_GID" ] || \
    die "merge image must run as postgres gid $EXPECTED_RUNTIME_GID, observed $observed_gid"
}

case "$MODE" in
  delta|verify) die "$MODE is source-blocked until the write-fence and fresh-source proof pass review" ;;
  preflight|clone|diagnose-clone|cleanup-partial-clone|migrate|stage-r2|rebind-normalized-input|stage-export|finalize-export|stage-galtd|normalize|stage-authoritative-pedigree-resolution|finalize-authoritative-pedigree-saturation|stage-nonpedigree-saturation|stage-duplicate-quarantine-source-evidence|stage-duplicate-quarantine-proof-resolution|plan|merge|grant-runtime|status) ;;
  *) die "unsupported MERGE_MODE: $MODE" ;;
esac

[ -n "${ADMIN_DATABASE_PASSWORD:-}" ] || die "ADMIN_DATABASE_PASSWORD is required"

export PGHOST="$EXPECTED_HOST"
export PGPORT="$EXPECTED_PORT"
export PGUSER="$EXPECTED_USER"
export PGPASSWORD="$ADMIN_DATABASE_PASSWORD"
export PGSSLMODE="require"
export PGCONNECT_TIMEOUT="30"

psql_db() {
  database="$1"
  shift
  PGDATABASE="$database" psql --no-psqlrc --set=ON_ERROR_STOP=1 "$@"
}

scalar() {
  database="$1"
  sql="$2"
  psql_db "$database" --tuples-only --no-align --command="$sql"
}

assert_physical_clone_size_compatible() {
  source_bytes="$1"
  candidate_bytes="$2"
  label="$3"
  case "$source_bytes:$candidate_bytes" in
    *[!0-9:]*|:*|*:|0:*) die "$label byte counts are invalid" ;;
  esac
  [ "$candidate_bytes" -gt 0 ] && [ "$candidate_bytes" -le "$source_bytes" ] || \
    die "$label candidate byte count exceeds or empties the fenced source"
  size_delta=$((source_bytes - candidate_bytes))
  allowed_delta=$((source_bytes / 100))
  [ "$allowed_delta" -gt 0 ] || allowed_delta=1
  if [ "$allowed_delta" -gt "$MAX_PHYSICAL_CLONE_SIZE_DELTA_BYTES" ]; then
    allowed_delta="$MAX_PHYSICAL_CLONE_SIZE_DELTA_BYTES"
  fi
  [ "$size_delta" -le "$allowed_delta" ] || \
    die "$label candidate byte delta exceeds the bounded physical-clone allowance"
  printf 'PHYSICAL_CLONE_SIZE_COMPATIBLE label=%s source_bytes=%s candidate_bytes=%s delta_bytes=%s allowed_delta_bytes=%s\n' \
    "$label" "$source_bytes" "$candidate_bytes" "$size_delta" "$allowed_delta"
}

assert_candidate_allocation_observation_compatible() {
  candidate_creation_bytes="$1"
  candidate_observed_bytes="$2"
  label="$3"
  case "$candidate_creation_bytes:$candidate_observed_bytes" in
    *[!0-9:]*|:*|*:|0:*|*:0) die "$label candidate allocation observations are invalid" ;;
  esac
  if [ "$candidate_creation_bytes" -ge "$candidate_observed_bytes" ]; then
    candidate_allocation_delta=$((candidate_creation_bytes - candidate_observed_bytes))
  else
    candidate_allocation_delta=$((candidate_observed_bytes - candidate_creation_bytes))
  fi
  candidate_allocation_allowed=$((candidate_creation_bytes / 100))
  [ "$candidate_allocation_allowed" -gt 0 ] || candidate_allocation_allowed=1
  if [ "$candidate_allocation_allowed" -gt "$MAX_PHYSICAL_CLONE_SIZE_DELTA_BYTES" ]; then
    candidate_allocation_allowed="$MAX_PHYSICAL_CLONE_SIZE_DELTA_BYTES"
  fi
  [ "$candidate_allocation_delta" -le "$candidate_allocation_allowed" ] || \
    die "$label candidate allocation drift exceeds the bounded observation allowance"
  printf 'CANDIDATE_ALLOCATION_OBSERVATION_COMPATIBLE label=%s creation_bytes=%s observed_bytes=%s absolute_delta_bytes=%s allowed_delta_bytes=%s\n' \
    "$label" "$candidate_creation_bytes" "$candidate_observed_bytes" \
    "$candidate_allocation_delta" "$candidate_allocation_allowed"
}

database_exists() {
  database_name="$1"
  if ! database_count="$(scalar postgres \
    "SELECT COUNT(*) FROM pg_database WHERE datname = '$database_name';")"; then
    die "database existence check failed for $database_name"
  fi
  case "$database_count" in
    1) return 0 ;;
    0) return 1 ;;
    *) die "database existence check returned an invalid count for $database_name" ;;
  esac
}

assert_database() {
  database="$1"
  database_exists "$database" || die "required database $database does not exist"
  observed="$(scalar "$database" 'SELECT current_database();')"
  [ "$observed" = "$database" ] || die "database identity mismatch for $database"
}

database_metadata() {
  metadata_database="$1"
  scalar postgres "
    SELECT coalesce((
    SELECT jsonb_build_object(
      'database',d.datname,
      'oid',d.oid,
      'owner',pg_get_userbyid(d.datdba),
      'bytes',pg_database_size(d.oid),
      'allowConnections',d.datallowconn,
      'isTemplate',d.datistemplate,
      'connectionLimit',d.datconnlimit,
      'encoding',pg_encoding_to_char(d.encoding),
      'collate',d.datcollate,
      'ctype',d.datctype,
      'acl',coalesce(to_jsonb(d.datacl),'null'::jsonb),
      'nonOwnerAclGrants',(
        SELECT count(*)
        FROM aclexplode(coalesce(d.datacl,acldefault('d',d.datdba))) privilege
        WHERE privilege.grantee<>d.datdba
      ),
      'ownerAclPrivileges',coalesce((
        SELECT jsonb_agg(privilege.privilege_type ORDER BY privilege.privilege_type)
        FROM aclexplode(coalesce(d.datacl,acldefault('d',d.datdba))) privilege
        WHERE privilege.grantee=d.datdba
      ),'[]'::jsonb),
      'publicConnect',has_database_privilege('public',d.oid,'CONNECT'),
      'publicCreate',has_database_privilege('public',d.oid,'CREATE'),
      'publicTemporary',has_database_privilege('public',d.oid,'TEMP'),
      'roleSettings',coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'role',CASE WHEN setting.setrole=0 THEN 'all' ELSE pg_get_userbyid(setting.setrole) END,
          'settings',setting.setconfig
        ) ORDER BY setting.setrole)
        FROM pg_db_role_setting setting
        WHERE setting.setdatabase=d.oid
      ),'[]'::jsonb)
    )
    FROM pg_database d
    WHERE d.datname='$metadata_database'
    ),'null'::jsonb);"
}

physical_clone_control_exists() {
  [ "$(scalar postgres "SELECT to_regclass('_giq_clone_control.physical_clone_claim') IS NOT NULL;")" = "t" ]
}

active_physical_clone_claim() {
  if ! physical_clone_control_exists; then
    printf 'null'
    return
  fi
  scalar postgres "
    SELECT coalesce((
      SELECT to_jsonb(claim)
      FROM _giq_clone_control.physical_clone_claim claim
      WHERE candidate_database='$CANDIDATE_DATABASE'
        AND completed_at IS NULL
    ),'null'::jsonb);"
}

transition_physical_clone_claim() {
  operation_id="$1"
  expected_phase="$2"
  next_phase="$3"
  evidence_patch="$4"
  psql_db postgres --quiet \
    --set=operation_id="$operation_id" \
    --set=expected_phase="$expected_phase" \
    --set=next_phase="$next_phase" \
    --set=evidence_patch="$evidence_patch" <<'SQL'
UPDATE _giq_clone_control.physical_clone_claim
SET phase=:'next_phase',
    source_bytes=coalesce((:'evidence_patch'::jsonb->>'sourceBytes')::bigint,source_bytes),
    candidate_oid=coalesce((:'evidence_patch'::jsonb->>'candidateOid')::oid,candidate_oid),
    candidate_owner=coalesce(:'evidence_patch'::jsonb->>'candidateOwner',candidate_owner),
    candidate_bytes=coalesce((:'evidence_patch'::jsonb->>'candidateBytes')::bigint,candidate_bytes),
    evidence=evidence ||
      (:'evidence_patch'::jsonb - ARRAY['sourceBytes','candidateOid','candidateOwner','candidateBytes']) ||
      CASE WHEN :'evidence_patch'::jsonb ? 'sourceFence' THEN
        jsonb_build_object(
          'sourceFence',coalesce(evidence->'sourceFence','{}'::jsonb) ||
            (:'evidence_patch'::jsonb->'sourceFence')
        ) ELSE '{}'::jsonb END ||
      CASE WHEN :'evidence_patch'::jsonb ? 'candidateCreate' THEN
        jsonb_build_object(
          'candidateCreate',coalesce(evidence->'candidateCreate','{}'::jsonb) ||
            (:'evidence_patch'::jsonb->'candidateCreate')
        ) ELSE '{}'::jsonb END,
    updated_at=clock_timestamp(),
    completed_at=CASE WHEN :'next_phase' IN ('complete','recovered') THEN clock_timestamp() ELSE completed_at END
WHERE operation_id=:'operation_id'::uuid
  AND candidate_database='giq_production_candidate_20260716_r1'
  AND phase=:'expected_phase'
  AND completed_at IS NULL;
\if :ROW_COUNT
\else
  \warn 'physical clone claim transition did not update exactly one row'
  \quit 3
\endif
SQL
}

close_recovered_physical_clone_claim() {
  operation_id="$1"
  expected_phase="$2"
  recovery_reason="$3"
  recovered_at="$(scalar postgres 'SELECT clock_timestamp();')"
  recovery_patch="$(jq -cn \
    --arg recoveredAt "$recovered_at" \
    --arg reason "$recovery_reason" \
    '{recovery:{closed:true,recoveredAt:$recoveredAt,reason:$reason}}')"
  transition_physical_clone_claim "$operation_id" "$expected_phase" recovered "$recovery_patch"
}

restore_physical_clone_source_fence() {
  [ "$PHYSICAL_CLONE_SOURCE_FENCE_ARMED" = "1" ] || return 0
  [ -n "$PHYSICAL_CLONE_SOURCE_OID" ] || return 1

  if ! observed_source_metadata="$(database_metadata "$PRODUCTION_DATABASE")"; then
    printf 'OPERATOR_ATTENTION: physical clone source identity could not be inspected during recovery\n' >&2
    return 1
  fi
  observed_source_oid="$(printf '%s' "$observed_source_metadata" | jq -r '.oid')"
  observed_source_owner="$(printf '%s' "$observed_source_metadata" | jq -r '.owner')"
  observed_source_allow="$(printf '%s' "$observed_source_metadata" | jq -r '.allowConnections')"
  if [ "$observed_source_oid" != "$PHYSICAL_CLONE_SOURCE_OID" ] || \
     [ "$observed_source_owner" != "$EXPECTED_USER" ]; then
    printf 'OPERATOR_ATTENTION: physical clone source identity changed; ALLOW_CONNECTIONS recovery refused\n' >&2
    return 1
  fi
  if [ "$observed_source_allow" = "false" ]; then
    psql_db postgres --command="ALTER DATABASE \"$PRODUCTION_DATABASE\" WITH ALLOW_CONNECTIONS true;" || return 1
  elif [ "$observed_source_allow" != "true" ]; then
    printf 'OPERATOR_ATTENTION: physical clone source ALLOW_CONNECTIONS state is invalid\n' >&2
    return 1
  fi

  restored_source_metadata="$(database_metadata "$PRODUCTION_DATABASE")" || return 1
  [ "$(printf '%s' "$restored_source_metadata" | jq -r '.oid')" = "$PHYSICAL_CLONE_SOURCE_OID" ] && \
    [ "$(printf '%s' "$restored_source_metadata" | jq -r '.owner')" = "$EXPECTED_USER" ] && \
    [ "$(printf '%s' "$restored_source_metadata" | jq -r '.allowConnections')" = "true" ] || return 1
  PHYSICAL_CLONE_SOURCE_FENCE_ARMED="0"
}

recover_stranded_physical_clone_claim() {
  claim="$(active_physical_clone_claim)"
  [ "$claim" != "null" ] || return 0

  operation_id="$(printf '%s' "$claim" | jq -r '.operation_id')"
  phase="$(printf '%s' "$claim" | jq -r '.phase')"
  claim_source="$(printf '%s' "$claim" | jq -r '.source_database')"
  claim_candidate="$(printf '%s' "$claim" | jq -r '.candidate_database')"
  claim_source_oid="$(printf '%s' "$claim" | jq -r '.source_oid')"
  claim_source_owner="$(printf '%s' "$claim" | jq -r '.source_owner')"

  [ "$claim_source" = "$PRODUCTION_DATABASE" ] && \
    [ "$claim_candidate" = "$CANDIDATE_DATABASE" ] && \
    [ "$claim_source_owner" = "$EXPECTED_USER" ] || \
    die "stranded physical clone claim identity is outside the reviewed contract"
  case "$claim_source_oid" in ''|*[!0-9]*) die "stranded physical clone source OID is unsafe" ;; esac

  if [ "$phase" = "source_restored" ]; then
    return 0
  fi
  if [ "$phase" = "prepared" ]; then
    prepared_source="$(database_metadata "$PRODUCTION_DATABASE")"
    [ "$(printf '%s' "$prepared_source" | jq -r '.oid')" = "$claim_source_oid" ] && \
      [ "$(printf '%s' "$prepared_source" | jq -r '.owner')" = "$EXPECTED_USER" ] && \
      [ "$(printf '%s' "$prepared_source" | jq -r '.allowConnections')" = "true" ] || \
      die "prepared physical clone claim source identity is not safely recoverable"
    database_exists "$CANDIDATE_DATABASE" && \
      die "prepared physical clone claim unexpectedly has a candidate database"
    close_recovered_physical_clone_claim "$operation_id" prepared prepared_claim_cleared
    die "a stranded prepared physical clone claim was cleared; rerun explicitly"
  fi
  case "$phase" in
    source_fence_armed|source_fenced|source_drained|candidate_create_armed|candidate_created) ;;
    *) die "stranded physical clone claim has an unsupported phase: $phase" ;;
  esac

  PHYSICAL_CLONE_OPERATION_ID="$operation_id"
  PHYSICAL_CLONE_SOURCE_OID="$claim_source_oid"
  PHYSICAL_CLONE_SOURCE_FENCE_ARMED="1"
  restore_physical_clone_source_fence || \
    die "stranded physical clone source fence requires exact manual recovery"

  restored_source_metadata="$(database_metadata "$PRODUCTION_DATABASE")"
  if database_exists "$CANDIDATE_DATABASE"; then
    case "$phase" in
      candidate_create_armed|candidate_created) ;;
      *) die "stranded physical clone candidate appeared before durable candidate creation was armed" ;;
    esac
    candidate_metadata="$(database_metadata "$CANDIDATE_DATABASE")"
    candidate_oid="$(printf '%s' "$candidate_metadata" | jq -r '.oid')"
    candidate_owner="$(printf '%s' "$candidate_metadata" | jq -r '.owner')"
    candidate_bytes="$(printf '%s' "$candidate_metadata" | jq -r '.bytes')"
    candidate_allow="$(printf '%s' "$candidate_metadata" | jq -r '.allowConnections')"
    claim_source_bytes="$(printf '%s' "$claim" | jq -r '.source_bytes')"
    claim_candidate_oid="$(printf '%s' "$claim" | jq -r '.candidate_oid // empty')"
    claim_candidate_owner="$(printf '%s' "$claim" | jq -r '.candidate_owner // empty')"
    claim_candidate_bytes="$(printf '%s' "$claim" | jq -r '.candidate_bytes // empty')"
    claim_drained_source="$(printf '%s' "$claim" | jq -c '.evidence.sourceDatabaseMetadataDrained // null')"
    printf '%s' "$claim" | jq -e \
      '.evidence.candidateCreate.armed==true and
       .evidence.terminationProof.refused==0 and
       .evidence.drainedSessions.total==0 and
       .evidence.sourceDatabaseMetadataDrained.allowConnections==false' >/dev/null || \
      die "stranded physical clone candidate lacks the durable pre-create drain proof"
    case "$candidate_oid" in ''|*[!0-9]*) die "recovered physical clone candidate OID is unsafe" ;; esac
    [ "$candidate_oid" != "$claim_source_oid" ] || \
      die "recovered physical clone candidate reused the source OID"
    [ "$candidate_owner" = "$EXPECTED_USER" ] || \
      die "recovered physical clone candidate owner mismatch"
    assert_physical_clone_size_compatible \
      "$claim_source_bytes" "$candidate_bytes" "recovered-candidate"
    [ "$(printf '%s' "$candidate_metadata" | jq -r '.isTemplate')" = "false" ] && \
      [ "$(printf '%s' "$candidate_metadata" | jq -r '.encoding')" = "$(printf '%s' "$claim_drained_source" | jq -r '.encoding')" ] && \
      [ "$(printf '%s' "$candidate_metadata" | jq -r '.collate')" = "$(printf '%s' "$claim_drained_source" | jq -r '.collate')" ] && \
      [ "$(printf '%s' "$candidate_metadata" | jq -r '.ctype')" = "$(printf '%s' "$claim_drained_source" | jq -r '.ctype')" ] || \
      die "recovered physical clone candidate locale identity differs from the fenced source"
    case "$candidate_allow" in
      false) ;;
      true)
        psql_db postgres --command="ALTER DATABASE \"$CANDIDATE_DATABASE\" WITH ALLOW_CONNECTIONS false;"
        candidate_allow="false"
        ;;
      *) die "recovered physical clone candidate ALLOW_CONNECTIONS state is invalid" ;;
    esac
    if [ -n "$claim_candidate_oid" ] && [ "$claim_candidate_oid" != "$candidate_oid" ]; then
      die "recovered physical clone candidate OID does not match the durable claim"
    fi
    if [ "$phase" = "candidate_created" ]; then
      [ "$claim_candidate_owner" = "$candidate_owner" ] && \
        [ "$claim_candidate_bytes" = "$candidate_bytes" ] && \
        [ "$(printf '%s' "$claim" | jq -r '.evidence.candidateCreate.created')" = "true" ] || \
        die "recovered physical clone candidate does not match its completed creation claim"
    fi
    recovery_candidate_sessions="$(inventory_clone_sessions "$CANDIDATE_DATABASE")"
    printf '%s' "$recovery_candidate_sessions" | jq -e \
      --arg database "$CANDIDATE_DATABASE" \
      '.database==$database and .total==0 and (.sessions|length)==0' >/dev/null || \
      die "recovered physical clone candidate has an unexpected session"
    psql_db postgres --command="REVOKE ALL ON DATABASE \"$CANDIDATE_DATABASE\" FROM PUBLIC;"
    closed_candidate_metadata="$(database_metadata "$CANDIDATE_DATABASE")"
    [ "$(printf '%s' "$closed_candidate_metadata" | jq -r '.oid')" = "$candidate_oid" ] && \
      [ "$(printf '%s' "$closed_candidate_metadata" | jq -r '.owner')" = "$EXPECTED_USER" ] && \
      [ "$(printf '%s' "$closed_candidate_metadata" | jq -r '.allowConnections')" = "$candidate_allow" ] && \
      [ "$(printf '%s' "$closed_candidate_metadata" | jq -r '.publicConnect')" = "false" ] && \
      [ "$(printf '%s' "$closed_candidate_metadata" | jq -r '.publicCreate')" = "false" ] && \
      [ "$(printf '%s' "$closed_candidate_metadata" | jq -r '.publicTemporary')" = "false" ] && \
      [ "$(printf '%s' "$closed_candidate_metadata" | jq -r '.nonOwnerAclGrants')" = "0" ] && \
      [ "$(printf '%s' "$closed_candidate_metadata" | jq -c '.ownerAclPrivileges')" = '["CONNECT","CREATE","TEMPORARY"]' ] && \
      [ "$(printf '%s' "$closed_candidate_metadata" | jq -r '.roleSettings | length')" = "0" ] || \
      die "recovered physical clone candidate ACL is unsafe while closed"
    psql_db postgres --command="ALTER DATABASE \"$CANDIDATE_DATABASE\" WITH ALLOW_CONNECTIONS true;"
    isolated_candidate_metadata="$(database_metadata "$CANDIDATE_DATABASE")"
    [ "$(printf '%s' "$isolated_candidate_metadata" | jq -r '.oid')" = "$candidate_oid" ] && \
      [ "$(printf '%s' "$isolated_candidate_metadata" | jq -r '.owner')" = "$EXPECTED_USER" ] && \
      [ "$(printf '%s' "$isolated_candidate_metadata" | jq -r '.allowConnections')" = "true" ] && \
      [ "$(printf '%s' "$isolated_candidate_metadata" | jq -r '.publicConnect')" = "false" ] && \
      [ "$(printf '%s' "$isolated_candidate_metadata" | jq -r '.publicCreate')" = "false" ] && \
      [ "$(printf '%s' "$isolated_candidate_metadata" | jq -r '.publicTemporary')" = "false" ] && \
      [ "$(printf '%s' "$isolated_candidate_metadata" | jq -r '.nonOwnerAclGrants')" = "0" ] && \
      [ "$(printf '%s' "$isolated_candidate_metadata" | jq -c '.ownerAclPrivileges')" = '["CONNECT","CREATE","TEMPORARY"]' ] && \
      [ "$(printf '%s' "$isolated_candidate_metadata" | jq -r '.roleSettings | length')" = "0" ] || \
      die "recovered physical clone candidate isolation verification failed"
    recovered_at="$(scalar postgres 'SELECT clock_timestamp();')"
    recovery_patch="$(jq -cn \
      --argjson candidateOid "$candidate_oid" \
      --arg candidateOwner "$candidate_owner" \
      --argjson candidateBytes "$candidate_bytes" \
      --argjson sourceBytes "$claim_source_bytes" \
      --argjson sizeDeltaBytes "$size_delta" \
      --argjson allowedDeltaBytes "$allowed_delta" \
      --arg restoredAt "$recovered_at" \
      --argjson sourceMetadata "$restored_source_metadata" \
      --argjson candidateMetadata "$isolated_candidate_metadata" \
      '{candidateOid:$candidateOid,candidateOwner:$candidateOwner,candidateBytes:$candidateBytes,
        sourceFence:{restored:true,recovered:true,restoredAt:$restoredAt,sourceMetadata:$sourceMetadata},
        candidateDatabaseMetadata:$candidateMetadata,
        physicalCloneSizeCompatibility:{verified:true,sizeIsAllocationSanityOnly:true,
          sourceBytes:$sourceBytes,candidateBytes:$candidateBytes,
          deltaBytes:$sizeDeltaBytes,allowedDeltaBytes:$allowedDeltaBytes},
        candidateIsolation:{publicPrivilegesRevoked:true,databaseSettingsNotCopied:true,
          candidateMetadata:$candidateMetadata,sourceMetadata:$sourceMetadata},
        recoveryOnly:true}')"
    transition_physical_clone_claim "$operation_id" "$phase" source_restored "$recovery_patch"
  else
    recovered_at="$(scalar postgres 'SELECT clock_timestamp();')"
    recovery_patch="$(jq -cn \
      --arg recoveredAt "$recovered_at" \
      --argjson sourceMetadata "$restored_source_metadata" \
      '{sourceFence:{restored:true,recovered:true,restoredAt:$recoveredAt,
        sourceMetadata:$sourceMetadata},
        recovery:{closed:true,recoveredAt:$recoveredAt,reason:"source_restored_without_candidate"}}')"
    transition_physical_clone_claim "$operation_id" "$phase" recovered "$recovery_patch"
  fi
  die "a stranded physical clone source fence was recovered; rerun explicitly"
}

assert_count() {
  database="$1"
  table_name="$2"
  expected="$3"
  observed="$(scalar "$database" "SELECT COUNT(*) FROM public.\"$table_name\";")"
  [ "$observed" = "$expected" ] || \
    die "$database.$table_name expected $expected rows, observed $observed"
}

assert_history_catalog() {
  assert_database "$HISTORY_DATABASE"

  assert_count "$HISTORY_DATABASE" RaceDayArchive 5883
  assert_count "$HISTORY_DATABASE" DogProfileArchive 60273
  assert_count "$HISTORY_DATABASE" Meeting 76668
  assert_count "$HISTORY_DATABASE" Race 838672
  assert_count "$HISTORY_DATABASE" Runner 6435322
  assert_count "$HISTORY_DATABASE" Result 5627298
  assert_count "$HISTORY_DATABASE" FormEntry 5627293
  assert_count "$HISTORY_DATABASE" Dog 198947
  assert_count "$HISTORY_DATABASE" DogProfileForm 0
  assert_count "$HISTORY_DATABASE" Trainer 10682
  assert_count "$HISTORY_DATABASE" Track 75
  assert_count "$HISTORY_DATABASE" RaceVideo 0

  history_max_ms="$(scalar "$HISTORY_DATABASE" \
    'SELECT round(extract(epoch FROM max("raceTime")) * 1000)::bigint FROM public."Race";')"
  [ "$history_max_ms" = "$HISTORY_MAX_RACE_EPOCH_MS" ] || \
    die "r2 Race maximum changed: expected epoch-ms $HISTORY_MAX_RACE_EPOCH_MS, observed $history_max_ms"

  completed_migrations="$(scalar "$HISTORY_DATABASE" \
    'SELECT COUNT(*) FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;')"
  unfinished_migrations="$(scalar "$HISTORY_DATABASE" \
    'SELECT COUNT(*) FROM public."_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL;')"
  base_tables="$(scalar "$HISTORY_DATABASE" \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")"
  invalid_foreign_keys="$(scalar "$HISTORY_DATABASE" \
    "SELECT COUNT(*) FROM pg_constraint WHERE contype='f' AND NOT convalidated;")"
  invalid_constraints="$(scalar "$HISTORY_DATABASE" \
    "SELECT string_agg(conname, ',' ORDER BY conname) FROM pg_constraint WHERE NOT convalidated;")"
  disabled_triggers="$(scalar "$HISTORY_DATABASE" \
    "SELECT COUNT(*) FROM pg_trigger WHERE tgenabled='D';")"

  [ "$completed_migrations" = "98" ] || die "r2 completed migration count is $completed_migrations, expected 98"
  [ "$unfinished_migrations" = "0" ] || die "r2 has $unfinished_migrations unfinished migrations"
  [ "$base_tables" = "108" ] || die "r2 base-table count is $base_tables, expected 108"
  [ "$invalid_foreign_keys" = "0" ] || die "r2 has $invalid_foreign_keys unvalidated foreign keys"
  [ "$invalid_constraints" = "giq_feed_post_visibility_check,giq_feed_reaction_target_xor_check,giq_feed_reaction_type_check" ] || \
    die "r2 unvalidated constraint set changed"
  [ "$disabled_triggers" = "0" ] || die "r2 has $disabled_triggers disabled triggers"

  synthetic_dogs="$(scalar "$HISTORY_DATABASE" \
    "SELECT COUNT(*) FROM public.\"Dog\" WHERE \"earBrand\" ~ '^thedogs:[0-9]+$';")"
  provider_dogs="$(scalar "$HISTORY_DATABASE" \
    'SELECT COUNT(*) FROM public."Dog" WHERE "sourceProvider" IS NOT NULL AND "sourceId" IS NOT NULL;')"
  [ "$synthetic_dogs" = "198887" ] || die "r2 synthetic TheDogs identity count changed"
  [ "$provider_dogs" = "16" ] || die "r2 explicit dog provider identity count changed"

  printf 'R2_SOURCE_VERIFIED database=%s archive_sha256=%s max_race_epoch_ms=%s synthetic_dogs=%s explicit_provider_dogs=%s\n' \
    "$HISTORY_DATABASE" "$HISTORY_ARCHIVE_SHA256" "$history_max_ms" "$synthetic_dogs" "$provider_dogs"
}

manifest_path() {
  printf '%s/manifest.json' "$NORMALIZED_ROOT"
}

assert_manifest_header() {
  path="$(manifest_path)"
  case "$NORMALIZED_ROOT" in
    */thedogs-normalized-v1-*)
      die "normalized export v2 rebuild is required: the configured root is the legacy v1 export; pin the rebuilt root, manifest SHA-256, dataset counts, bytes, and digests before rerun"
      ;;
  esac
  [ -r "$path" ] || die "normalized manifest is not readable at $path"
  actual_sha="$(sha256sum "$path" | awk '{print $1}')"
  [ "$actual_sha" = "$NORMALIZED_MANIFEST_SHA256" ] || die "normalized manifest SHA-256 mismatch"
  [ "$(jq -r '.schemaVersion' "$path")" = "1" ] || die "normalized manifest schemaVersion mismatch"
  observed_transform_version="$(jq -r '.transformVersion' "$path")"
  [ "$observed_transform_version" = "$NORMALIZED_TRANSFORM_VERSION" ] || \
    die "normalized export v2 rebuild is required: expected $NORMALIZED_TRANSFORM_VERSION, observed $observed_transform_version; pin the rebuilt root, manifest SHA-256, dataset counts, bytes, and digests before rerun"
  [ "$(jq -r '.identityPolicy.profileArchivesExactProviderIdentity' "$path")" = "true" ] || \
    die "normalized export identity policy does not prove exact provider identity for every profile archive"
  [ "$(jq -r '.source.provider' "$path")" = "thedogs" ] || \
    die "normalized export provider identity mismatch"
  source_run_instance_id="$(jq -r '.source.runInstanceId // empty' "$path")"
  case "$source_run_instance_id" in
    ''|*[!A-Za-z0-9._:-]*)
      die "normalized v2 producer contract is incomplete: manifest source.runInstanceId must be a real immutable exporter-run identifier; add it in the exporter and rebuild rather than deriving it from the artifact SHA"
      ;;
  esac
  [ "${#source_run_instance_id}" -ge 16 ] && [ "${#source_run_instance_id}" -le 128 ] || \
    die "normalized v2 manifest source.runInstanceId length is outside the approved 16-128 character contract"
  source_generated_at="$(jq -r '.generatedAt // empty' "$path")"
  printf '%s' "$source_generated_at" | jq -eR \
    'test("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]{1,6})?Z$")' \
    >/dev/null || die "normalized v2 manifest generatedAt is absent or not an exact UTC producer timestamp"
  [ "$(jq -r '.source.sourceCutoff' "$path")" = "$HISTORY_SOURCE_CUTOFF" ] || \
    die "normalized export source cutoff mismatch; pin the rebuilt v2 cutoff before rerun"
  [ "$(jq -r '.scope.fullCorpus' "$path")" = "true" ] || \
    die "normalized export must cover the full source corpus"
  [ "$(jq -r '.status' "$path")" = "blocked" ] || die "normalized source status changed"
  [ "$(jq -r '.identityPolicy.targetIdsGenerated' "$path")" = "false" ] || \
    die "normalized source unexpectedly contains target IDs"
  [ "$(jq -r '.identityPolicy.targetIdAssignments' "$path")" = "0" ] || \
    die "normalized source target-ID count changed"
}

assert_normalized_files() {
  assert_absolute_nonsymlink_path "$NORMALIZED_ROOT" NORMALIZED_ROOT
  assert_manifest_header
  path="$(manifest_path)"

  jq -r '.partitions[] | [.directory,.manifestSha256] | @tsv' "$path" |
  while IFS="$(printf '\t')" read -r directory expected_sha; do
    case "$directory" in partition-[0-9][0-9][0-9][0-9]-of-0064) ;; *) die "unsafe partition path in manifest" ;; esac
    partition_manifest="$NORMALIZED_ROOT/$directory/partition-manifest.json"
    [ -r "$partition_manifest" ] || die "missing $directory/partition-manifest.json"
    observed_sha="$(sha256sum "$partition_manifest" | awk '{print $1}')"
    [ "$observed_sha" = "$expected_sha" ] || die "$directory manifest SHA-256 mismatch"
  done

  jq -r '.partitions[] as $p | $p.outputs[] | [$p.directory,.dataset,.file,.sha256,(.bytes|tostring),(.rowCount|tostring)] | @tsv' "$path" |
  while IFS="$(printf '\t')" read -r directory dataset file expected_sha expected_bytes expected_rows; do
    case "$dataset" in profiles|pedigree_edges|profile_forms|meetings|races|runners|results|archives|race_media|duplicates|orphans|quarantine) ;;
      *) die "unexpected dataset in normalized manifest: $dataset" ;;
    esac
    case "$file" in "$dataset"-[0-9][0-9][0-9][0-9]-of-0064.jsonl) ;; *) die "unsafe normalized shard filename" ;; esac
    shard="$NORMALIZED_ROOT/$directory/$file"
    [ -r "$shard" ] || die "missing normalized shard $directory/$file"
    observed_bytes="$(wc -c < "$shard" | tr -d '[:space:]')"
    [ "$observed_bytes" = "$expected_bytes" ] || die "$directory/$file byte-count mismatch"
    observed_sha="$(sha256sum "$shard" | awk '{print $1}')"
    [ "$observed_sha" = "$expected_sha" ] || die "$directory/$file SHA-256 mismatch"
    observed_rows="$(awk 'END { print NR + 0 }' "$shard")"
    [ "$observed_rows" = "$expected_rows" ] || die "$directory/$file row-count mismatch"
  done

  partition_count="$(jq -r '.partitions | length' "$path")"
  shard_count="$(jq -r '[.partitions[].outputs[]] | length' "$path")"
  dataset_count="$(jq -r '[.partitions[].outputs[].dataset] | unique | length' "$path")"
  manifest_bytes="$(jq -r '[.partitions[].outputs[].bytes] | add // 0' "$path")"
  manifest_rows="$(jq -r '[.partitions[].outputs[].rowCount] | add // 0' "$path")"
  for aggregate in "$partition_count" "$shard_count" "$dataset_count" "$manifest_bytes" "$manifest_rows"; do
    case "$aggregate" in ''|*[!0-9]*) die "normalized manifest aggregate is not a non-negative integer" ;; esac
  done
  [ "$partition_count" = "64" ] || die "normalized manifest partition count is $partition_count, expected 64"
  [ "$shard_count" = "768" ] || die "normalized manifest shard count is $shard_count, expected 768"
  [ "$dataset_count" = "12" ] || die "normalized manifest dataset count is $dataset_count, expected 12"
  printf 'NORMALIZED_EXPORT_FILES_VERIFIED manifest_sha256=%s shards=%s bytes=%s rows=%s\n' \
    "$NORMALIZED_MANIFEST_SHA256" "$shard_count" "$manifest_bytes" "$manifest_rows"
}

assert_file_contract() {
  relative="$1"
  expected_bytes="$2"
  expected_sha="$3"
  path="$GALTD_ROOT/$relative"
  [ -r "$path" ] || die "GALTD artifact is not readable: $relative"
  observed_bytes="$(wc -c < "$path" | tr -d '[:space:]')"
  [ "$observed_bytes" = "$expected_bytes" ] || die "GALTD artifact byte-count mismatch: $relative"
  observed_sha="$(sha256sum "$path" | awk '{print $1}')"
  [ "$observed_sha" = "$expected_sha" ] || die "GALTD artifact SHA-256 mismatch: $relative"
}

assert_galtd_files() {
  assert_absolute_nonsymlink_path "$GALTD_ROOT" GALTD_ROOT
  assert_file_contract "GALTD-Vol-66-2018_Final.pdf" 10784376 f3ba08182da43d02f70885fd66543eb9f23996d91d3abd372525d359f2874d98
  assert_file_contract "Stud-Book-67-V3.pdf" 23915117 330b03eece009235f403a6992ced704101c73eae52256c56f29ce08fdfd7e637
  assert_file_contract "Stud-Book-68.pdf" 4798033 14d1e0631d4de3329a1c91c633ccdc53bd906afbe63b418c9e12dc96ca143881
  assert_file_contract "Stud-Book-69.pdf" 5651176 b9ead392c92663e4b21fa66acb8b2c238dc838326bd826fce8d32d49f6012e3b
  assert_file_contract "Stud-Book-70.pdf" 6098201 f89938242cf8ffee1d7589e48b9880c35a5f52a73bbd940c5de86ca072cf544e
  assert_file_contract "Stud-Book-71.pdf" 7458311 6ac948de8761023914e5618313faa6f2e4507a1a3de1f3fbe244f244e431a8ad
  assert_file_contract "Stud-Book-72.pdf" 6829310 df5733bf4c2173f26981eab56300fbe668a711134d3f6bb45a2966ebe66a767c
  assert_file_contract "Stud-Book-73-v.pdf" 3859795 21ccb79600e949e8adfa20b4263e9cb9232a9c2ec2917a389c5f41b74d815cd5
  assert_file_contract "text-layout/GALTD-Vol-66-2018_Final.txt" 1449798 e4cc34b7ee47293280ead6416677d9bb7c2e4515b80f0cc16192b401afc31793
  assert_file_contract "text-layout/Stud-Book-67-V3.txt" 1570278 45ff5845f79479ed7352622096a38923979e1d023a5601c82b0b8ed220033cf9
  assert_file_contract "text-layout/Stud-Book-68.txt" 1543200 24f77c4e3f119e19a4fae25c57661343b120a554f452d40bccdbb547504f4dc2
  assert_file_contract "text-layout/Stud-Book-69.txt" 1601401 1e5c07829dd8c835be5268fa3f8327c2bfda7b12f1506e4f396feced76bf64a3
  assert_file_contract "text-layout/Stud-Book-70.txt" 1658821 f6c8a267d24ac14cda8726fa654c4a8272dfd974933a61f53c4da987c3d93188
  assert_file_contract "text-layout/Stud-Book-71.txt" 1652473 8d0a8ff125cd690a063b493bc340cd7e33f9fddc162d5a57771ff0f7aa7faa01
  assert_file_contract "text-layout/Stud-Book-72.txt" 1475859 871f423594b74aa25853ca2c1e2c362aca2e5a3f51c11193081ab356db680b47
  assert_file_contract "text-layout/Stud-Book-73-v.txt" 1323193 be8a0fc099811cd8c454bc800b1f6e210a787d9db451c38272465d90870e967f
  assert_file_contract "strict-audit-report.json" 7166 "$GALTD_REPORT_SHA256"

  [ "$(jq -r '.parserVersion' "$GALTD_ROOT/strict-audit-report.json")" = "$GALTD_PARSER_VERSION" ] || die "GALTD parser version changed"
  galtd_run_instance_id="$(jq -r '.runInstanceId // empty' "$GALTD_ROOT/strict-audit-report.json")"
  case "$galtd_run_instance_id" in
    ''|*[!A-Za-z0-9._:-]*)
      die "GALTD producer contract is incomplete: strict-audit-report.json runInstanceId must identify the real parser invocation; add it at report production time rather than deriving it from an artifact SHA"
      ;;
  esac
  [ "${#galtd_run_instance_id}" -ge 16 ] && [ "${#galtd_run_instance_id}" -le 128 ] || \
    die "GALTD strict report runInstanceId length is outside the approved 16-128 character contract"
  [ "$(jq -r '.status' "$GALTD_ROOT/strict-audit-report.json")" = "failed" ] || die "GALTD strict report status changed"
  [ "$(jq -r '.totals.observations' "$GALTD_ROOT/strict-audit-report.json")" = "105374" ] || die "GALTD observation total changed"
  [ "$(jq -r '.totals.assertions' "$GALTD_ROOT/strict-audit-report.json")" = "210734" ] || die "GALTD assertion total changed"
  [ "$(jq -r '.totals.issues' "$GALTD_ROOT/strict-audit-report.json")" = "5" ] || die "GALTD conflict total changed"
  printf 'GALTD_FILES_VERIFIED report_sha256=%s observations=105374 assertions=210734 conflicts=5\n' "$GALTD_REPORT_SHA256"
}

candidate_marker_exists() {
  database_exists "$CANDIDATE_DATABASE" || return 1
  [ "$(scalar "$CANDIDATE_DATABASE" \
    "SELECT to_regclass('_giq_history_merge.run') IS NOT NULL;")" = "t" ] || return 1
  [ "$(scalar "$CANDIDATE_DATABASE" \
    'SELECT COUNT(*) FROM _giq_history_merge.run WHERE id=1;')" = "1" ]
}

assert_candidate_marker_payload() {
  expected_operation_id="$1"
  printf '%s' "$expected_operation_id" | \
    jq -eR 'test("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")' \
      >/dev/null || die "candidate physical clone operation UUID is invalid"
  assert_database "$CANDIDATE_DATABASE"
  marker="$(scalar "$CANDIDATE_DATABASE" "
    SELECT COUNT(*)
    FROM _giq_history_merge.run run
    JOIN _giq_history_merge.physical_clone_proof proof
      ON proof.id=1
     AND proof.operation_id=run.clone_operation_id
    WHERE run.id=1
      AND run.workflow_version='$WORKFLOW_VERSION'
      AND run.source_production_database='$PRODUCTION_DATABASE'
      AND run.source_history_database='$HISTORY_DATABASE'
      AND run.source_history_archive_sha256='$HISTORY_ARCHIVE_SHA256'
      AND run.source_history_cutoff='$HISTORY_SOURCE_CUTOFF'::timestamptz
      AND run.normalized_manifest_sha256='$NORMALIZED_MANIFEST_SHA256'
      AND run.clone_operation_id='$expected_operation_id'::uuid
      AND run.clone_method='physical_template'
      AND run.source_production_oid=proof.source_oid
      AND run.candidate_database_oid=proof.candidate_oid
      AND run.candidate_database_oid=(
        SELECT oid FROM pg_database WHERE datname=current_database()
      )
      AND proof.source_database='$PRODUCTION_DATABASE'
      AND proof.source_owner='$EXPECTED_USER'
      AND proof.source_bytes > 0
      AND proof.candidate_database='$CANDIDATE_DATABASE'
      AND proof.candidate_owner='$EXPECTED_USER'
      AND proof.candidate_bytes>0
      AND proof.candidate_bytes<=proof.source_bytes
      AND proof.source_bytes-proof.candidate_bytes<=
          GREATEST(1::bigint,
            LEAST($MAX_PHYSICAL_CLONE_SIZE_DELTA_BYTES::bigint,proof.source_bytes/100))
      AND proof.sessions_observed=proof.sessions_terminated+proof.sessions_already_gone
      AND proof.source_connection_restored
      AND proof.database_metadata_intentionally_isolated
      AND proof.force_rls_table_count > 0
      AND proof.all_tables_hashed
      AND proof.force_rls_restored
      AND (SELECT COUNT(*) FROM _giq_history_merge.source_snapshot_manifest) > 0
      AND (SELECT COUNT(*) FROM _giq_history_merge.source_snapshot_manifest)=
          (SELECT COUNT(*) FROM _giq_history_merge.snapshot_table_manifest)
      AND NOT EXISTS(
        SELECT 1 FROM _giq_history_merge.source_snapshot_manifest manifest
        WHERE manifest.row_count < 0 OR manifest.row_digest !~ '^[0-9a-f]{64}$'
      )
      AND coalesce((proof.evidence->'terminationProof'->>'refused')::bigint,-1)=0
      AND coalesce((proof.evidence->'candidateIsolation'->>'publicPrivilegesRevoked')::boolean,false)
      AND coalesce((proof.evidence->'candidateIsolation'->>'databaseSettingsNotCopied')::boolean,false)
      AND coalesce((proof.evidence->'physicalCloneSizeCompatibility'->>'verified')::boolean,false)
      AND coalesce((proof.evidence->'physicalCloneSizeCompatibility'->>'sizeIsAllocationSanityOnly')::boolean,false)
      AND coalesce((proof.evidence->'physicalCloneSizeCompatibility'->>'sourceBytes')::bigint,-1)=proof.source_bytes
      AND coalesce((proof.evidence->'physicalCloneSizeCompatibility'->>'candidateBytes')::bigint,-1)=proof.candidate_bytes
      AND coalesce((proof.evidence->'physicalCloneSizeCompatibility'->>'deltaBytes')::bigint,-1)=
          proof.source_bytes-proof.candidate_bytes
      AND coalesce((proof.evidence->'physicalCloneSizeCompatibility'->>'allowedDeltaBytes')::bigint,-1)=
          GREATEST(1::bigint,
            LEAST($MAX_PHYSICAL_CLONE_SIZE_DELTA_BYTES::bigint,proof.source_bytes/100))
      AND coalesce((proof.evidence->'candidateAllocationObservation'->>'verified')::boolean,false)
      AND coalesce((proof.evidence->'candidateAllocationObservation'->>'sizeIsAllocationSanityOnly')::boolean,false)
      AND coalesce((proof.evidence->'candidateAllocationObservation'->>'creationBytes')::bigint,-1)=proof.candidate_bytes
      AND coalesce((proof.evidence->'candidateAllocationObservation'->>'observedBytes')::bigint,-1)=
          coalesce((proof.evidence->'candidateIsolation'->'candidateMetadata'->>'bytes')::bigint,-2)
      AND coalesce((proof.evidence->'candidateAllocationObservation'->>'absoluteDeltaBytes')::bigint,-1)=
          abs(proof.candidate_bytes-
            coalesce((proof.evidence->'candidateAllocationObservation'->>'observedBytes')::bigint,-2))
      AND coalesce((proof.evidence->'candidateAllocationObservation'->>'allowedDeltaBytes')::bigint,-1)=
          GREATEST(1::bigint,
            LEAST($MAX_PHYSICAL_CLONE_SIZE_DELTA_BYTES::bigint,proof.candidate_bytes/100))
      AND coalesce((proof.evidence->'candidateAllocationObservation'->>'absoluteDeltaBytes')::bigint,-1)<=
          coalesce((proof.evidence->'candidateAllocationObservation'->>'allowedDeltaBytes')::bigint,-2)
      AND coalesce((run.clone_proof->>'allTablesHashed')::boolean,false)
      AND coalesce((run.clone_proof->>'forceRlsRestored')::boolean,false)
      AND coalesce((run.clone_proof->>'databaseMetadataIntentionallyIsolated')::boolean,false);")"
  [ "$marker" = "1" ] || die "candidate physical template marker is absent, partial, or stale"
}

assert_candidate_marker() {
  candidate_marker_exists || die "candidate physical template marker is absent"
  marker_operation_id="$(scalar "$CANDIDATE_DATABASE" \
    'SELECT clone_operation_id FROM _giq_history_merge.run WHERE id=1;')"
  assert_candidate_marker_payload "$marker_operation_id"
  marker_source_oid="$(scalar "$CANDIDATE_DATABASE" \
    'SELECT source_production_oid FROM _giq_history_merge.run WHERE id=1;')"
  marker_candidate_oid="$(scalar "$CANDIDATE_DATABASE" \
    'SELECT candidate_database_oid FROM _giq_history_merge.run WHERE id=1;')"
  marker_source_bytes="$(scalar "$CANDIDATE_DATABASE" \
    'SELECT source_bytes FROM _giq_history_merge.physical_clone_proof WHERE id=1;')"

  physical_clone_control_exists || die "durable physical clone control relation is absent"
  completed_claim="$(scalar postgres "
    SELECT COUNT(*)
    FROM _giq_clone_control.physical_clone_claim
    WHERE operation_id='$marker_operation_id'::uuid
      AND workflow_version='$WORKFLOW_VERSION'
      AND phase='complete'
      AND source_database='$PRODUCTION_DATABASE'
      AND source_oid='$marker_source_oid'::oid
      AND source_owner='$EXPECTED_USER'
      AND source_bytes='$marker_source_bytes'::bigint
      AND source_original_allow_connections
      AND candidate_database='$CANDIDATE_DATABASE'
      AND candidate_oid='$marker_candidate_oid'::oid
      AND candidate_owner='$EXPECTED_USER'
      AND candidate_bytes>0
      AND candidate_bytes<=source_bytes
      AND source_bytes-candidate_bytes<=
          GREATEST(1::bigint,
            LEAST($MAX_PHYSICAL_CLONE_SIZE_DELTA_BYTES::bigint,source_bytes/100))
      AND coalesce((evidence->'sourceFence'->>'restored')::boolean,false)
      AND coalesce((evidence->'terminationProof'->>'refused')::bigint,-1)=0
      AND coalesce((evidence->'candidateIsolation'->>'publicPrivilegesRevoked')::boolean,false)
      AND coalesce((evidence->'candidateIsolation'->>'databaseSettingsNotCopied')::boolean,false)
      AND coalesce((evidence->'physicalCloneSizeCompatibility'->>'verified')::boolean,false)
      AND coalesce((evidence->'physicalCloneSizeCompatibility'->>'sizeIsAllocationSanityOnly')::boolean,false)
      AND coalesce((evidence->'physicalCloneSizeCompatibility'->>'sourceBytes')::bigint,-1)=source_bytes
      AND coalesce((evidence->'physicalCloneSizeCompatibility'->>'candidateBytes')::bigint,-1)=candidate_bytes
      AND coalesce((evidence->'physicalCloneSizeCompatibility'->>'deltaBytes')::bigint,-1)=
          source_bytes-candidate_bytes
      AND coalesce((evidence->'physicalCloneSizeCompatibility'->>'allowedDeltaBytes')::bigint,-1)=
          GREATEST(1::bigint,
            LEAST($MAX_PHYSICAL_CLONE_SIZE_DELTA_BYTES::bigint,source_bytes/100))
      AND coalesce((evidence->'candidateAllocationObservation'->>'verified')::boolean,false)
      AND coalesce((evidence->'candidateAllocationObservation'->>'sizeIsAllocationSanityOnly')::boolean,false)
      AND coalesce((evidence->'candidateAllocationObservation'->>'creationBytes')::bigint,-1)=candidate_bytes
      AND coalesce((evidence->'candidateAllocationObservation'->>'observedBytes')::bigint,-1)=
          coalesce((evidence->'candidateIsolation'->'candidateMetadata'->>'bytes')::bigint,-2)
      AND coalesce((evidence->'candidateAllocationObservation'->>'absoluteDeltaBytes')::bigint,-1)=
          abs(candidate_bytes-
            coalesce((evidence->'candidateAllocationObservation'->>'observedBytes')::bigint,-2))
      AND coalesce((evidence->'candidateAllocationObservation'->>'allowedDeltaBytes')::bigint,-1)=
          GREATEST(1::bigint,
            LEAST($MAX_PHYSICAL_CLONE_SIZE_DELTA_BYTES::bigint,candidate_bytes/100))
      AND coalesce((evidence->'candidateAllocationObservation'->>'absoluteDeltaBytes')::bigint,-1)<=
          coalesce((evidence->'candidateAllocationObservation'->>'allowedDeltaBytes')::bigint,-2)
      AND completed_at IS NOT NULL;")"
  [ "$completed_claim" = "1" ] || die "durable physical clone completion claim is absent or inconsistent"

  current_candidate_metadata="$(database_metadata "$CANDIDATE_DATABASE")"
  [ "$(printf '%s' "$current_candidate_metadata" | jq -r '.oid')" = "$marker_candidate_oid" ] && \
    [ "$(printf '%s' "$current_candidate_metadata" | jq -r '.owner')" = "$EXPECTED_USER" ] && \
    [ "$(printf '%s' "$current_candidate_metadata" | jq -r '.allowConnections')" = "true" ] && \
    [ "$(printf '%s' "$current_candidate_metadata" | jq -r '.publicConnect')" = "false" ] && \
    [ "$(printf '%s' "$current_candidate_metadata" | jq -r '.publicCreate')" = "false" ] && \
    [ "$(printf '%s' "$current_candidate_metadata" | jq -r '.publicTemporary')" = "false" ] && \
    [ "$(printf '%s' "$current_candidate_metadata" | jq -r '.nonOwnerAclGrants')" = "0" ] && \
    [ "$(printf '%s' "$current_candidate_metadata" | jq -c '.ownerAclPrivileges')" = '["CONNECT","CREATE","TEMPORARY"]' ] && \
    [ "$(printf '%s' "$current_candidate_metadata" | jq -r '.roleSettings | length')" = "0" ] || \
    die "physical clone candidate database identity or isolation changed"

  current_source_metadata="$(database_metadata "$PRODUCTION_DATABASE")"
  [ "$(printf '%s' "$current_source_metadata" | jq -r '.oid')" = "$marker_source_oid" ] && \
    [ "$(printf '%s' "$current_source_metadata" | jq -r '.owner')" = "$EXPECTED_USER" ] && \
    [ "$(printf '%s' "$current_source_metadata" | jq -r '.allowConnections')" = "true" ] || \
    die "physical clone source database identity or connection state changed"
}

candidate_phase() {
  scalar "$CANDIDATE_DATABASE" 'SELECT phase FROM _giq_history_merge.run WHERE id=1;'
}

phase_rank() {
  case "$1" in
    cloned) printf 10 ;;
    schema_migrated) printf 20 ;;
    r2_staged) printf 30 ;;
    export_staged) printf 40 ;;
    galtd_staged) printf 50 ;;
    normalized) printf 60 ;;
    canonical_merged) printf 70 ;;
    delta_applied) printf 80 ;;
    verified) printf 90 ;;
    *) die "unknown candidate phase: $1" ;;
  esac
}

phase_at_least() {
  observed="$(candidate_phase)"
  [ "$(phase_rank "$observed")" -ge "$(phase_rank "$1")" ]
}

preflight() {
  assert_runtime_identity
  recover_stranded_physical_clone_claim
  assert_mount_paths
  assert_database "$PRODUCTION_DATABASE"
  assert_history_catalog

  extension_available="$(scalar "$PRODUCTION_DATABASE" \
    "SELECT COUNT(*) FROM pg_available_extensions WHERE name IN ('postgres_fdw','pgcrypto');")"
  [ "$extension_available" = "2" ] || die "postgres_fdw and pgcrypto must both be available on the AlloyDB instance"

  production_users="$(scalar "$PRODUCTION_DATABASE" 'SELECT COUNT(*) FROM public."User";')"
  production_videos="$(scalar "$PRODUCTION_DATABASE" 'SELECT COUNT(*) FROM public."RaceVideo";')"
  production_latest_race="$(scalar "$PRODUCTION_DATABASE" 'SELECT max("raceTime") FROM public."Race";')"

  printf 'PREFLIGHT_VERIFIED host=%s production=%s history=%s candidate=%s users=%s race_videos=%s latest_race=%s\n' \
    "$EXPECTED_HOST" "$PRODUCTION_DATABASE" "$HISTORY_DATABASE" "$CANDIDATE_DATABASE" \
    "$production_users" "$production_videos" "$production_latest_race"
}

migrate_candidate() {
  assert_candidate_marker
  if phase_at_least schema_migrated; then
    printf 'CANDIDATE_SCHEMA_ALREADY_MIGRATED database=%s phase=%s\n' \
      "$CANDIDATE_DATABASE" "$(candidate_phase)"
    return
  fi
  [ "$(candidate_phase)" = "cloned" ] || die "candidate migration requires phase cloned"
  [ -r "$PRISMA_SCHEMA" ] || die "pinned Prisma schema is absent"
  [ -r "$MIGRATION_MANIFEST" ] || die "pinned migration manifest is absent"

  migration_manifest_json="$(jq -Rn \
    '[inputs | split("\t") | select(length==2) | {name:.[0],sha256:.[1]}]' \
    < "$MIGRATION_MANIFEST")"
  migration_rows="$(printf '%s' "$migration_manifest_json" | jq 'length')"
  [ "$migration_rows" -gt 0 ] || die "pinned migration manifest is empty"
  migration_source_sha256="$(sha256sum "$MIGRATION_MANIFEST" | awk '{print $1}')"

  psql_db "$CANDIDATE_DATABASE" \
    --set=migration_manifest="$migration_manifest_json" \
    --file="$SQL_ROOT/preflight-candidate-migration.sql"

  password_urlencoded="$(node -e 'process.stdout.write(encodeURIComponent(process.env.ADMIN_DATABASE_PASSWORD))')"
  DATABASE_URL="postgresql://$EXPECTED_USER:$password_urlencoded@$EXPECTED_HOST:$EXPECTED_PORT/$CANDIDATE_DATABASE?sslmode=require" \
    prisma migrate deploy --schema="$PRISMA_SCHEMA"

  psql_db "$CANDIDATE_DATABASE" \
    --set=migration_source_sha256="$migration_source_sha256" \
    --set=migration_manifest="$migration_manifest_json" \
    --file="$SQL_ROOT/record-candidate-migration.sql"
}

inventory_clone_sessions() {
  inventory_database="$1"
  psql_db postgres --tuples-only --no-align --quiet \
    --set=source_database="$inventory_database" \
    --file="$PHYSICAL_CLONE_SESSIONS_SQL"
}

assert_only_idle_clone_sessions() {
  session_inventory="$1"
  inventory_label="$2"
  printf '%s' "$session_inventory" | jq -e \
    --arg database "$PRODUCTION_DATABASE" \
    '.database==$database and
     (.total|type)=="number" and .total>=0 and
     .active==0 and .idleInTransaction==0 and .other==0 and
     .idle==.total and (.sessions|length)==.total and
     all(.sessions[]; .state=="idle")' >/dev/null || \
    die "$inventory_label contains an active, transactional, unknown, or unaccounted source session"
}

terminate_clone_sessions() {
  session_inventory="$1"
  psql_db postgres --tuples-only --no-align --quiet \
    --set=source_database="$PRODUCTION_DATABASE" \
    --set=session_inventory="$session_inventory" \
    --file="$PHYSICAL_CLONE_TERMINATE_SQL"
}

insert_physical_clone_claim() {
  operation_id="$1"
  source_oid="$2"
  source_bytes="$3"
  evidence="$4"
  psql_db postgres --quiet \
    --set=operation_id="$operation_id" \
    --set=workflow_version="$WORKFLOW_VERSION" \
    --set=source_database="$PRODUCTION_DATABASE" \
    --set=source_oid="$source_oid" \
    --set=source_owner="$EXPECTED_USER" \
    --set=source_bytes="$source_bytes" \
    --set=candidate_database="$CANDIDATE_DATABASE" \
    --set=evidence="$evidence" <<'SQL'
INSERT INTO _giq_clone_control.physical_clone_claim (
  operation_id,workflow_version,phase,
  source_database,source_oid,source_owner,source_bytes,
  source_original_allow_connections,candidate_database,evidence
) VALUES (
  :'operation_id'::uuid,:'workflow_version','prepared',
  :'source_database',:'source_oid'::oid,:'source_owner',:'source_bytes'::bigint,
  true,:'candidate_database',:'evidence'::jsonb
);
\if :ROW_COUNT
\else
  \warn 'physical clone claim insert did not insert exactly one row'
  \quit 3
\endif
SQL
}

isolate_physical_clone_candidate() {
  claim="$1"
  operation_id="$(printf '%s' "$claim" | jq -r '.operation_id')"
  candidate_oid="$(printf '%s' "$claim" | jq -r '.candidate_oid // empty')"
  candidate_bytes="$(printf '%s' "$claim" | jq -r '.candidate_bytes // empty')"
  source_oid="$(printf '%s' "$claim" | jq -r '.source_oid')"
  source_bytes="$(printf '%s' "$claim" | jq -r '.source_bytes')"

  [ "$(printf '%s' "$claim" | jq -r '.phase')" = "source_restored" ] || \
    die "candidate isolation requires a source-restored durable claim"
  case "$candidate_oid" in ''|*[!0-9]*) die "physical clone candidate OID is unsafe" ;; esac
  assert_physical_clone_size_compatible \
    "$source_bytes" "$candidate_bytes" "source-restored-claim"

  candidate_metadata="$(database_metadata "$CANDIDATE_DATABASE")"
  [ "$(printf '%s' "$candidate_metadata" | jq -r '.oid')" = "$candidate_oid" ] && \
    [ "$(printf '%s' "$candidate_metadata" | jq -r '.owner')" = "$EXPECTED_USER" ] || \
    die "uninitialized physical clone candidate identity changed"
  candidate_observed_bytes="$(printf '%s' "$candidate_metadata" | jq -r '.bytes')"
  assert_candidate_allocation_observation_compatible \
    "$candidate_bytes" "$candidate_observed_bytes" "uninitialized-candidate"
  candidate_allow="$(printf '%s' "$candidate_metadata" | jq -r '.allowConnections')"
  case "$candidate_allow" in
    false) ;;
    true)
      psql_db postgres --command="ALTER DATABASE \"$CANDIDATE_DATABASE\" WITH ALLOW_CONNECTIONS false;"
      candidate_allow="false"
      ;;
    *) die "physical clone candidate ALLOW_CONNECTIONS state is invalid" ;;
  esac

  candidate_sessions="$(inventory_clone_sessions "$CANDIDATE_DATABASE")"
  printf '%s' "$candidate_sessions" | jq -e \
    --arg database "$CANDIDATE_DATABASE" \
    '.database==$database and .total==0 and (.sessions|length)==0' >/dev/null || \
    die "uninitialized physical clone candidate has an unexpected session"

  psql_db postgres --command="REVOKE ALL ON DATABASE \"$CANDIDATE_DATABASE\" FROM PUBLIC;"
  closed_candidate_metadata="$(database_metadata "$CANDIDATE_DATABASE")"
  [ "$(printf '%s' "$closed_candidate_metadata" | jq -r '.oid')" = "$candidate_oid" ] && \
    [ "$(printf '%s' "$closed_candidate_metadata" | jq -r '.owner')" = "$EXPECTED_USER" ] && \
    [ "$(printf '%s' "$closed_candidate_metadata" | jq -r '.allowConnections')" = "$candidate_allow" ] && \
    [ "$(printf '%s' "$closed_candidate_metadata" | jq -r '.publicConnect')" = "false" ] && \
    [ "$(printf '%s' "$closed_candidate_metadata" | jq -r '.publicCreate')" = "false" ] && \
    [ "$(printf '%s' "$closed_candidate_metadata" | jq -r '.publicTemporary')" = "false" ] && \
    [ "$(printf '%s' "$closed_candidate_metadata" | jq -r '.nonOwnerAclGrants')" = "0" ] && \
    [ "$(printf '%s' "$closed_candidate_metadata" | jq -c '.ownerAclPrivileges')" = '["CONNECT","CREATE","TEMPORARY"]' ] && \
    [ "$(printf '%s' "$closed_candidate_metadata" | jq -r '.roleSettings | length')" = "0" ] || \
    die "physical clone candidate ACL is unsafe before opening"
  if [ "$candidate_allow" = "false" ]; then
    psql_db postgres --command="ALTER DATABASE \"$CANDIDATE_DATABASE\" WITH ALLOW_CONNECTIONS true;"
  fi

  isolated_candidate_metadata="$(database_metadata "$CANDIDATE_DATABASE")"
  [ "$(printf '%s' "$isolated_candidate_metadata" | jq -r '.oid')" = "$candidate_oid" ] && \
    [ "$(printf '%s' "$isolated_candidate_metadata" | jq -r '.owner')" = "$EXPECTED_USER" ] && \
    [ "$(printf '%s' "$isolated_candidate_metadata" | jq -r '.allowConnections')" = "true" ] && \
    [ "$(printf '%s' "$isolated_candidate_metadata" | jq -r '.publicConnect')" = "false" ] && \
    [ "$(printf '%s' "$isolated_candidate_metadata" | jq -r '.publicCreate')" = "false" ] && \
    [ "$(printf '%s' "$isolated_candidate_metadata" | jq -r '.publicTemporary')" = "false" ] && \
    [ "$(printf '%s' "$isolated_candidate_metadata" | jq -r '.nonOwnerAclGrants')" = "0" ] && \
    [ "$(printf '%s' "$isolated_candidate_metadata" | jq -c '.ownerAclPrivileges')" = '["CONNECT","CREATE","TEMPORARY"]' ] && \
    [ "$(printf '%s' "$isolated_candidate_metadata" | jq -r '.roleSettings | length')" = "0" ] || \
    die "physical clone candidate database isolation is incomplete"
  isolated_candidate_observed_bytes="$(printf '%s' "$isolated_candidate_metadata" | jq -r '.bytes')"
  assert_candidate_allocation_observation_compatible \
    "$candidate_bytes" "$isolated_candidate_observed_bytes" "isolated-candidate"

  restored_source_metadata="$(database_metadata "$PRODUCTION_DATABASE")"
  [ "$(printf '%s' "$restored_source_metadata" | jq -r '.oid')" = "$source_oid" ] && \
    [ "$(printf '%s' "$restored_source_metadata" | jq -r '.owner')" = "$EXPECTED_USER" ] && \
    [ "$(printf '%s' "$restored_source_metadata" | jq -r '.allowConnections')" = "true" ] || \
    die "source identity was not preserved before candidate initialization"
  isolated_at="$(scalar postgres 'SELECT clock_timestamp();')"
  isolation_patch="$(jq -cn \
    --arg isolatedAt "$isolated_at" \
    --argjson candidateCreationBytes "$candidate_bytes" \
    --argjson candidateObservedBytes "$isolated_candidate_observed_bytes" \
    --argjson candidateAllocationDeltaBytes "$candidate_allocation_delta" \
    --argjson candidateAllocationAllowedBytes "$candidate_allocation_allowed" \
    --argjson sourceMetadata "$restored_source_metadata" \
    --argjson candidateMetadata "$isolated_candidate_metadata" \
    '{candidateDatabaseMetadata:$candidateMetadata,
      candidateIsolation:{
        isolatedAt:$isolatedAt,
        publicPrivilegesRevoked:true,
        databaseAclIntentionallyDiverged:true,
        databaseSettingsNotCopied:true,
        sourceMetadata:$sourceMetadata,
        candidateMetadata:$candidateMetadata
      },
      candidateAllocationObservation:{verified:true,sizeIsAllocationSanityOnly:true,
        creationBytes:$candidateCreationBytes,observedBytes:$candidateObservedBytes,
        absoluteDeltaBytes:$candidateAllocationDeltaBytes,
        allowedDeltaBytes:$candidateAllocationAllowedBytes}}')"
  transition_physical_clone_claim "$operation_id" source_restored source_restored "$isolation_patch"
}

initialize_physical_clone_candidate() {
  claim="$(active_physical_clone_claim)"
  [ "$claim" != "null" ] || die "active source-restored physical clone claim is absent"
  operation_id="$(printf '%s' "$claim" | jq -r '.operation_id')"
  [ "$(printf '%s' "$claim" | jq -r '.phase')" = "source_restored" ] || \
    die "physical clone candidate initialization requires phase source_restored"

  if candidate_marker_exists; then
    marker_operation_id="$(scalar "$CANDIDATE_DATABASE" \
      'SELECT clone_operation_id FROM _giq_history_merge.run WHERE id=1;')"
    [ "$marker_operation_id" = "$operation_id" ] || \
      die "candidate marker operation does not match the active durable clone claim"
    assert_candidate_marker_payload "$operation_id"
  else
    isolate_physical_clone_candidate "$claim"
    claim="$(active_physical_clone_claim)"
    clone_claim="$(printf '%s' "$claim" | jq -c '{
      operationId:.operation_id,
      workflowVersion:.workflow_version,
      phase:.phase,
      source:{database:.source_database,oid:.source_oid,owner:.source_owner,bytes:.source_bytes},
      candidate:{database:.candidate_database,oid:.candidate_oid,owner:.candidate_owner,bytes:.candidate_bytes},
      evidence:.evidence,
      createdAt:.created_at,
      updatedAt:.updated_at
    }')"
    printf '%s' "$clone_claim" | jq -e \
      --arg operationId "$operation_id" \
      --arg source "$PRODUCTION_DATABASE" \
      --arg candidate "$CANDIDATE_DATABASE" \
      '(.evidence.candidateAllocationObservation) as $allocation |
       .operationId==$operationId and .phase=="source_restored" and
       .source.database==$source and .candidate.database==$candidate and
       .source.bytes>=.candidate.bytes and .candidate.bytes>0 and
       (.source.bytes-.candidate.bytes)<=
         ([67108864,([1,(.source.bytes/100|floor)]|max)]|min) and
       .evidence.physicalCloneSizeCompatibility.verified==true and
       .evidence.physicalCloneSizeCompatibility.sizeIsAllocationSanityOnly==true and
       .evidence.physicalCloneSizeCompatibility.sourceBytes==.source.bytes and
       .evidence.physicalCloneSizeCompatibility.candidateBytes==.candidate.bytes and
       .evidence.physicalCloneSizeCompatibility.deltaBytes==(.source.bytes-.candidate.bytes) and
       .evidence.physicalCloneSizeCompatibility.allowedDeltaBytes==
         ([67108864,([1,(.source.bytes/100|floor)]|max)]|min) and
       $allocation.verified==true and
       $allocation.sizeIsAllocationSanityOnly==true and
       $allocation.creationBytes==.candidate.bytes and
       $allocation.observedBytes==.evidence.candidateIsolation.candidateMetadata.bytes and
       $allocation.absoluteDeltaBytes==
         (if $allocation.creationBytes >= $allocation.observedBytes
          then $allocation.creationBytes-$allocation.observedBytes
          else $allocation.observedBytes-$allocation.creationBytes end) and
       $allocation.allowedDeltaBytes==
         ([67108864,([1,(.candidate.bytes/100|floor)]|max)]|min) and
       $allocation.absoluteDeltaBytes<=$allocation.allowedDeltaBytes and
       .evidence.sourceFence.restored==true and
       .evidence.terminationProof.refused==0 and
       .evidence.candidateIsolation.publicPrivilegesRevoked==true and
       .evidence.candidateIsolation.databaseSettingsNotCopied==true' >/dev/null || \
      die "physical clone initialization claim is incomplete"

    psql_db "$CANDIDATE_DATABASE" \
      --set=workflow_version="$WORKFLOW_VERSION" \
      --set=production_database="$PRODUCTION_DATABASE" \
      --set=history_database="$HISTORY_DATABASE" \
      --set=history_archive_sha256="$HISTORY_ARCHIVE_SHA256" \
      --set=history_max_race_epoch_ms="$HISTORY_MAX_RACE_EPOCH_MS" \
      --set=history_source_cutoff="$HISTORY_SOURCE_CUTOFF" \
      --set=normalized_manifest_sha256="$NORMALIZED_MANIFEST_SHA256" \
      --set=normalized_transform_version="$NORMALIZED_TRANSFORM_VERSION" \
      --set=clone_claim="$clone_claim" \
      --file="$SQL_ROOT/initialize-candidate.sql"
    assert_candidate_marker_payload "$operation_id"
  fi

  completion_source_oid="$(printf '%s' "$claim" | jq -r '.source_oid')"
  completion_candidate_oid="$(printf '%s' "$claim" | jq -r '.candidate_oid')"
  completion_source_metadata="$(database_metadata "$PRODUCTION_DATABASE")"
  [ "$(printf '%s' "$completion_source_metadata" | jq -r '.oid')" = "$completion_source_oid" ] && \
    [ "$(printf '%s' "$completion_source_metadata" | jq -r '.owner')" = "$EXPECTED_USER" ] && \
    [ "$(printf '%s' "$completion_source_metadata" | jq -r '.allowConnections')" = "true" ] || \
    die "physical clone source identity changed before durable completion"
  completion_candidate_metadata="$(database_metadata "$CANDIDATE_DATABASE")"
  [ "$(printf '%s' "$completion_candidate_metadata" | jq -r '.oid')" = "$completion_candidate_oid" ] && \
    [ "$(printf '%s' "$completion_candidate_metadata" | jq -r '.owner')" = "$EXPECTED_USER" ] && \
    [ "$(printf '%s' "$completion_candidate_metadata" | jq -r '.allowConnections')" = "true" ] && \
    [ "$(printf '%s' "$completion_candidate_metadata" | jq -r '.publicConnect')" = "false" ] && \
    [ "$(printf '%s' "$completion_candidate_metadata" | jq -r '.publicCreate')" = "false" ] && \
    [ "$(printf '%s' "$completion_candidate_metadata" | jq -r '.publicTemporary')" = "false" ] && \
    [ "$(printf '%s' "$completion_candidate_metadata" | jq -r '.nonOwnerAclGrants')" = "0" ] && \
    [ "$(printf '%s' "$completion_candidate_metadata" | jq -c '.ownerAclPrivileges')" = '["CONNECT","CREATE","TEMPORARY"]' ] && \
    [ "$(printf '%s' "$completion_candidate_metadata" | jq -r '.roleSettings | length')" = "0" ] || \
    die "physical clone candidate identity or isolation changed before durable completion"

  initialized_at="$(scalar postgres 'SELECT clock_timestamp();')"
  completion_patch="$(jq -cn --arg initializedAt "$initialized_at" \
    '{candidateInitialization:{committed:true,initializedAt:$initializedAt}}')"
  transition_physical_clone_claim "$operation_id" source_restored complete "$completion_patch"
  assert_candidate_marker
}

clone_candidate() {
  preflight

  [ -r "$PHYSICAL_CLONE_CONTROL_SQL" ] || die "physical clone control SQL is absent"
  [ -r "$PHYSICAL_CLONE_AUTOMATION_SQL" ] || die "physical clone automation inventory SQL is absent"
  [ -r "$PHYSICAL_CLONE_SESSIONS_SQL" ] || die "physical clone session inventory SQL is absent"
  [ -r "$PHYSICAL_CLONE_TERMINATE_SQL" ] || die "physical clone termination SQL is absent"

  if database_exists "$CANDIDATE_DATABASE"; then
    if candidate_marker_exists; then
      active_claim="$(active_physical_clone_claim)"
      if [ "$active_claim" != "null" ]; then
        initialize_physical_clone_candidate
      else
        assert_candidate_marker
      fi
      printf 'CANDIDATE_PHYSICAL_CLONE_ALREADY_VERIFIED database=%s phase=%s\n' \
        "$CANDIDATE_DATABASE" "$(candidate_phase)"
      return
    fi
    active_claim="$(active_physical_clone_claim)"
    [ "$active_claim" != "null" ] && \
      [ "$(printf '%s' "$active_claim" | jq -r '.phase')" = "source_restored" ] || \
      die "unmarked candidate is not owned by a resumable source-restored physical clone claim"
    initialize_physical_clone_candidate
    printf 'CANDIDATE_PHYSICAL_CLONE_RESUMED database=%s phase=%s\n' \
      "$CANDIDATE_DATABASE" "$(candidate_phase)"
    return
  fi

  [ "$(active_physical_clone_claim)" = "null" ] || \
    die "active physical clone claim exists without its candidate; manual reconciliation is required"
  [ "${PHYSICAL_TEMPLATE_CLONE_CONFIRMATION:-}" = "$PHYSICAL_CLONE_CONFIRMATION" ] || \
    die "PHYSICAL_TEMPLATE_CLONE_CONFIRMATION must exactly approve the reviewed source connection fence"

  psql_db postgres --file="$PHYSICAL_CLONE_CONTROL_SQL"
  [ "$(active_physical_clone_claim)" = "null" ] || \
    die "another active physical clone claim appeared during control initialization"

  source_metadata_before_fence="$(database_metadata "$PRODUCTION_DATABASE")"
  source_oid="$(printf '%s' "$source_metadata_before_fence" | jq -r '.oid')"
  source_bytes="$(printf '%s' "$source_metadata_before_fence" | jq -r '.bytes')"
  case "$source_oid" in ''|*[!0-9]*) die "physical clone source OID is unsafe" ;; esac
  case "$source_bytes" in ''|*[!0-9]*) die "physical clone source byte count is unsafe" ;; esac
  [ "$source_bytes" -gt 0 ] && \
    [ "$(printf '%s' "$source_metadata_before_fence" | jq -r '.database')" = "$PRODUCTION_DATABASE" ] && \
    [ "$(printf '%s' "$source_metadata_before_fence" | jq -r '.owner')" = "$EXPECTED_USER" ] && \
    [ "$(printf '%s' "$source_metadata_before_fence" | jq -r '.allowConnections')" = "true" ] && \
    [ "$(printf '%s' "$source_metadata_before_fence" | jq -r '.isTemplate')" = "false" ] || \
    die "physical clone source metadata is outside the reviewed identity contract"
  clone_role_capability="$(scalar postgres \
    "SELECT count(*) FROM pg_roles WHERE rolname='$EXPECTED_USER' AND (rolcreatedb OR rolsuper);")"
  [ "$clone_role_capability" = "1" ] || \
    die "physical clone database owner lacks CREATEDB capability"

  automation_inventory="$(psql_db "$PRODUCTION_DATABASE" --tuples-only --no-align --quiet \
    --file="$PHYSICAL_CLONE_AUTOMATION_SQL")"
  printf '%s' "$automation_inventory" | jq -e \
    --arg database "$PRODUCTION_DATABASE" \
    '.database==$database and .enabledSubscriptions==0 and
     .activeCronJobs==0 and .activePgAgentJobs==0 and .preparedTransactions==0 and
     .enabledEventTriggers==0' >/dev/null || \
    die "physical clone source has enabled database automation or prepared transactions"

  pre_fence_sessions="$(inventory_clone_sessions "$PRODUCTION_DATABASE")"
  assert_only_idle_clone_sessions "$pre_fence_sessions" "pre-fence session inventory"
  operation_id="$(node -e 'process.stdout.write(require("node:crypto").randomUUID())')"
  confirmation_sha256="$(printf '%s' "$PHYSICAL_CLONE_CONFIRMATION" | sha256sum | awk '{print $1}')"
  claim_created_at="$(scalar postgres 'SELECT clock_timestamp();')"
  initial_evidence="$(jq -cn \
    --arg claimCreatedAt "$claim_created_at" \
    --arg confirmationSha256 "$confirmation_sha256" \
    --argjson sourceMetadata "$source_metadata_before_fence" \
    --argjson automationInventory "$automation_inventory" \
    --argjson preFenceSessions "$pre_fence_sessions" \
    '{claimCreatedAt:$claimCreatedAt,
      confirmation:{verified:true,sha256:$confirmationSha256},
      sourceDatabaseMetadataBeforeFence:$sourceMetadata,
      automationInventory:$automationInventory,
      preFenceSessions:$preFenceSessions}')"
  insert_physical_clone_claim "$operation_id" "$source_oid" "$source_bytes" "$initial_evidence"

  PHYSICAL_CLONE_OPERATION_ID="$operation_id"
  PHYSICAL_CLONE_SOURCE_OID="$source_oid"
  PHYSICAL_CLONE_SOURCE_FENCE_ARMED="1"
  fence_armed_at="$(scalar postgres 'SELECT clock_timestamp();')"
  fence_armed_patch="$(jq -cn --arg armedAt "$fence_armed_at" \
    '{sourceFence:{armed:true,armedAt:$armedAt}}')"
  transition_physical_clone_claim "$operation_id" prepared source_fence_armed "$fence_armed_patch"
  trap 'restore_physical_clone_source_fence || printf "OPERATOR_ATTENTION: exact physical clone source fence requires manual recovery\n" >&2' 0
  trap 'exit 1' 1 2 15

  psql_db postgres --command="ALTER DATABASE \"$PRODUCTION_DATABASE\" WITH ALLOW_CONNECTIONS false;"
  fenced_source_metadata="$(database_metadata "$PRODUCTION_DATABASE")"
  [ "$(printf '%s' "$fenced_source_metadata" | jq -r '.oid')" = "$source_oid" ] && \
    [ "$(printf '%s' "$fenced_source_metadata" | jq -r '.owner')" = "$EXPECTED_USER" ] && \
    [ "$(printf '%s' "$fenced_source_metadata" | jq -r '.allowConnections')" = "false" ] || \
    die "physical clone source connection fence identity verification failed"
  fenced_source_bytes="$(printf '%s' "$fenced_source_metadata" | jq -r '.bytes')"
  source_fenced_at="$(scalar postgres 'SELECT clock_timestamp();')"
  source_fenced_patch="$(jq -cn \
    --argjson sourceBytes "$fenced_source_bytes" \
    --arg fencedAt "$source_fenced_at" \
    --argjson sourceMetadata "$fenced_source_metadata" \
    '{sourceBytes:$sourceBytes,
      sourceFence:{armed:true,fenced:true,fencedAt:$fencedAt},
      sourceDatabaseMetadataFenced:$sourceMetadata}')"
  transition_physical_clone_claim "$operation_id" source_fence_armed source_fenced "$source_fenced_patch"

  post_fence_sessions="$(inventory_clone_sessions "$PRODUCTION_DATABASE")"
  assert_only_idle_clone_sessions "$post_fence_sessions" "post-fence session inventory"
  termination_proof="$(terminate_clone_sessions "$post_fence_sessions")"
  printf '%s' "$termination_proof" | jq -e \
    --arg database "$PRODUCTION_DATABASE" \
    --argjson expected "$(printf '%s' "$post_fence_sessions" | jq '.total')" \
    '.database==$database and .expected==$expected and .refused==0 and
     .expected==(.terminated+.alreadyGone) and (.sessions|length)==.expected' >/dev/null || \
    die "physical clone source session termination proof did not reconcile"
  drained_sessions="$(inventory_clone_sessions "$PRODUCTION_DATABASE")"
  printf '%s' "$drained_sessions" | jq -e \
    --arg database "$PRODUCTION_DATABASE" \
    '.database==$database and .total==0 and .idle==0 and .active==0 and
     .idleInTransaction==0 and .other==0 and (.sessions|length)==0' >/dev/null || \
    die "physical clone source did not drain to exactly zero sessions"
  drained_source_metadata="$(database_metadata "$PRODUCTION_DATABASE")"
  [ "$(printf '%s' "$drained_source_metadata" | jq -r '.oid')" = "$source_oid" ] && \
    [ "$(printf '%s' "$drained_source_metadata" | jq -r '.owner')" = "$EXPECTED_USER" ] && \
    [ "$(printf '%s' "$drained_source_metadata" | jq -r '.allowConnections')" = "false" ] && \
    [ "$(printf '%s' "$drained_source_metadata" | jq -r '.bytes')" = "$fenced_source_bytes" ] || \
    die "physical clone source changed after the exact connection drain"
  source_drained_at="$(scalar postgres 'SELECT clock_timestamp();')"
  source_drained_patch="$(jq -cn \
    --argjson sourceBytes "$fenced_source_bytes" \
    --arg drainedAt "$source_drained_at" \
    --argjson postFenceSessions "$post_fence_sessions" \
    --argjson terminationProof "$termination_proof" \
    --argjson drainedSessions "$drained_sessions" \
    --argjson sourceMetadata "$drained_source_metadata" \
    '{sourceBytes:$sourceBytes,sourceDrainedAt:$drainedAt,
      postFenceSessions:$postFenceSessions,
      terminationProof:$terminationProof,
      drainedSessions:$drainedSessions,
      sourceDatabaseMetadataDrained:$sourceMetadata}')"
  transition_physical_clone_claim "$operation_id" source_fenced source_drained "$source_drained_patch"

  create_armed_at="$(scalar postgres 'SELECT clock_timestamp();')"
  create_armed_patch="$(jq -cn --arg armedAt "$create_armed_at" \
    '{candidateCreate:{armed:true,armedAt:$armedAt}}')"
  transition_physical_clone_claim "$operation_id" source_drained candidate_create_armed "$create_armed_patch"
  final_source_sessions="$(inventory_clone_sessions "$PRODUCTION_DATABASE")"
  printf '%s' "$final_source_sessions" | jq -e '.total==0 and (.sessions|length)==0' >/dev/null || \
    die "a source session appeared immediately before physical template creation"

  psql_db postgres --command="CREATE DATABASE \"$CANDIDATE_DATABASE\" WITH TEMPLATE \"$PRODUCTION_DATABASE\" OWNER \"$EXPECTED_USER\" ALLOW_CONNECTIONS false;"
  candidate_metadata_created="$(database_metadata "$CANDIDATE_DATABASE")"
  candidate_oid="$(printf '%s' "$candidate_metadata_created" | jq -r '.oid')"
  candidate_bytes="$(printf '%s' "$candidate_metadata_created" | jq -r '.bytes')"
  case "$candidate_oid" in ''|*[!0-9]*) die "physical clone candidate OID is unsafe" ;; esac
  [ "$candidate_oid" != "$source_oid" ] && \
    [ "$(printf '%s' "$candidate_metadata_created" | jq -r '.owner')" = "$EXPECTED_USER" ] && \
    [ "$(printf '%s' "$candidate_metadata_created" | jq -r '.allowConnections')" = "false" ] && \
    [ "$(printf '%s' "$candidate_metadata_created" | jq -r '.isTemplate')" = "false" ] && \
    [ "$(printf '%s' "$candidate_metadata_created" | jq -r '.encoding')" = "$(printf '%s' "$drained_source_metadata" | jq -r '.encoding')" ] && \
    [ "$(printf '%s' "$candidate_metadata_created" | jq -r '.collate')" = "$(printf '%s' "$drained_source_metadata" | jq -r '.collate')" ] && \
    [ "$(printf '%s' "$candidate_metadata_created" | jq -r '.ctype')" = "$(printf '%s' "$drained_source_metadata" | jq -r '.ctype')" ] && \
    assert_physical_clone_size_compatible \
      "$fenced_source_bytes" "$candidate_bytes" "new-candidate"
  candidate_created_at="$(scalar postgres 'SELECT clock_timestamp();')"
  candidate_created_patch="$(jq -cn \
    --argjson candidateOid "$candidate_oid" \
    --arg candidateOwner "$EXPECTED_USER" \
    --argjson candidateBytes "$candidate_bytes" \
    --argjson sourceBytes "$fenced_source_bytes" \
    --argjson sizeDeltaBytes "$size_delta" \
    --argjson allowedDeltaBytes "$allowed_delta" \
    --arg createdAt "$candidate_created_at" \
    --argjson candidateMetadata "$candidate_metadata_created" \
    '{candidateOid:$candidateOid,candidateOwner:$candidateOwner,candidateBytes:$candidateBytes,
      candidateCreate:{armed:true,created:true,createdAt:$createdAt,method:"physical_template"},
      physicalCloneSizeCompatibility:{verified:true,sizeIsAllocationSanityOnly:true,
        sourceBytes:$sourceBytes,candidateBytes:$candidateBytes,
        deltaBytes:$sizeDeltaBytes,allowedDeltaBytes:$allowedDeltaBytes},
      candidateDatabaseMetadataCreated:$candidateMetadata}')"
  transition_physical_clone_claim "$operation_id" candidate_create_armed candidate_created "$candidate_created_patch"

  restore_physical_clone_source_fence || die "physical clone source connection fence restoration failed"
  restored_source_metadata="$(database_metadata "$PRODUCTION_DATABASE")"
  restored_at="$(scalar postgres 'SELECT clock_timestamp();')"
  source_restored_patch="$(jq -cn \
    --arg restoredAt "$restored_at" \
    --argjson sourceMetadata "$restored_source_metadata" \
    '{sourceFence:{armed:true,fenced:true,restored:true,restoredAt:$restoredAt,
      sourceMetadata:$sourceMetadata}}')"
  transition_physical_clone_claim "$operation_id" candidate_created source_restored "$source_restored_patch"
  trap - 0 1 2 15

  initialize_physical_clone_candidate
  printf 'CANDIDATE_PHYSICAL_CLONE_VERIFIED database=%s operation_id=%s source_oid=%s candidate_oid=%s bytes=%s phase=%s\n' \
    "$CANDIDATE_DATABASE" "$operation_id" "$source_oid" "$candidate_oid" "$candidate_bytes" "$(candidate_phase)"
}

logical_schema_manifest() {
  manifest_database="$1"
  if ! raw_schema_manifest="$(
    PGDATABASE="$manifest_database" \
      PGOPTIONS='-c default_transaction_read_only=on -c TimeZone=UTC -c DateStyle=ISO,MDY -c extra_float_digits=1' \
      pg_dump --schema-only --format=plain --quote-all-identifiers
  )"; then
    die "logical schema inventory failed for $manifest_database"
  fi

  printf '%s\n' "$raw_schema_manifest" | awk '
    /^\\restrict [^[:space:]]+$/ { print "\\restrict <TOKEN>"; next }
    /^\\unrestrict [^[:space:]]+$/ { print "\\unrestrict <TOKEN>"; next }
    { print }
  '
}

template0_catalog_manifest() {
  manifest_database="$1"
  [ -r "$TEMPLATE0_CATALOG_MANIFEST_SQL" ] || die "template0 catalog manifest SQL is absent"
  if ! catalog_manifest="$(
    PGDATABASE="$manifest_database" \
      PGOPTIONS='-c default_transaction_read_only=on -c TimeZone=UTC -c DateStyle=ISO,MDY -c extra_float_digits=1' \
      psql --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align --quiet \
        --file="$TEMPLATE0_CATALOG_MANIFEST_SQL"
  )"; then
    die "catalog inventory failed for $manifest_database"
  fi
  printf '%s' "$catalog_manifest"
}

data_bearing_relation_count() {
  scalar "$1" \
    "SELECT count(*)
     FROM pg_class c
     JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname<>'information_schema'
       AND n.nspname!~'^pg_'
       AND c.relkind IN ('r','p','m','S','f');"
}

wait_for_database_connections_to_drain() {
  drain_database="$1"
  drain_label="$2"
  drain_attempts=0
  while [ "$drain_attempts" -lt 30 ]; do
    if ! drain_count="$(scalar postgres \
      "SELECT count(*) FROM pg_stat_activity WHERE datname='$drain_database';")"; then
      printf 'OPERATOR_ATTENTION: %s connection inventory failed\n' "$drain_label" >&2
      return 1
    fi
    case "$drain_count" in
      0) return 0 ;;
      ''|*[!0-9]*)
        printf 'OPERATOR_ATTENTION: %s connection inventory returned an invalid count\n' "$drain_label" >&2
        return 1
        ;;
    esac
    drain_attempts=$((drain_attempts + 1))
    sleep 1
  done
  printf 'OPERATOR_ATTENTION: %s still has %s active connection(s) after the bounded drain wait\n' \
    "$drain_label" "$drain_count" >&2
  return 1
}

large_object_inventory() {
  scalar "$1" \
    "SELECT concat(
       (SELECT count(*) FROM pg_catalog.pg_largeobject_metadata), ':',
       (SELECT count(*) FROM pg_catalog.pg_largeobject)
     );"
}

cleanup_partial_clone_control() {
  [ "$PARTIAL_CLONE_CONTROL_CLAIMED" = "1" ] || return 0

  if ! database_exists "$PARTIAL_CLONE_CONTROL_DATABASE"; then
    printf 'OPERATOR_ATTENTION: claimed template0 control database disappeared before cleanup\n' >&2
    return 1
  fi
  observed_control_identity="$(scalar postgres \
    "SELECT concat(oid, ':', pg_get_userbyid(datdba))
     FROM pg_database WHERE datname='$PARTIAL_CLONE_CONTROL_DATABASE';")"
  if [ "$observed_control_identity" != "$PARTIAL_CLONE_CONTROL_OID:$EXPECTED_USER" ]; then
    printf 'OPERATOR_ATTENTION: template0 control database identity changed before cleanup\n' >&2
    return 1
  fi
  wait_for_database_connections_to_drain \
    "$PARTIAL_CLONE_CONTROL_DATABASE" "template0 control database" || return 1
  if ! PGDATABASE=postgres dropdb "$PARTIAL_CLONE_CONTROL_DATABASE"; then
    printf 'OPERATOR_ATTENTION: exact template0 control database cleanup failed\n' >&2
    return 1
  fi
  PARTIAL_CLONE_CONTROL_CLAIMED="0"
  PARTIAL_CLONE_CONTROL_OID=""
  if database_exists "$PARTIAL_CLONE_CONTROL_DATABASE"; then
    printf 'OPERATOR_ATTENTION: template0 control database still exists after cleanup\n' >&2
    return 1
  fi
}

release_partial_clone_candidate_fence() {
  [ "$PARTIAL_CLONE_CANDIDATE_FENCE_ARMED" = "1" ] || return 0

  if ! observed_candidate_fence="$(scalar postgres \
    "SELECT COALESCE((
       SELECT concat(oid, ':', pg_get_userbyid(datdba), ':',
                     CASE WHEN datallowconn THEN 't' ELSE 'f' END)
       FROM pg_database WHERE datname='$CANDIDATE_DATABASE'
     ), 'absent');")"; then
    printf 'OPERATOR_ATTENTION: could not inspect the exact candidate connection fence during cleanup\n' >&2
    return 1
  fi

  case "$observed_candidate_fence" in
    absent)
      PARTIAL_CLONE_CANDIDATE_FENCE_ARMED="0"
      PARTIAL_CLONE_CANDIDATE_OID=""
      return 0
      ;;
    "$PARTIAL_CLONE_CANDIDATE_OID:$EXPECTED_USER:t")
      PARTIAL_CLONE_CANDIDATE_FENCE_ARMED="0"
      PARTIAL_CLONE_CANDIDATE_OID=""
      return 0
      ;;
    "$PARTIAL_CLONE_CANDIDATE_OID:$EXPECTED_USER:f")
      if ! psql_db postgres \
        --command="ALTER DATABASE \"$CANDIDATE_DATABASE\" WITH ALLOW_CONNECTIONS true;"; then
        printf 'OPERATOR_ATTENTION: exact candidate connection-fence recovery failed\n' >&2
        return 1
      fi
      restored_candidate_fence="$(scalar postgres \
        "SELECT concat(oid, ':', pg_get_userbyid(datdba), ':',
                       CASE WHEN datallowconn THEN 't' ELSE 'f' END)
         FROM pg_database WHERE datname='$CANDIDATE_DATABASE';")"
      if [ "$restored_candidate_fence" != "$PARTIAL_CLONE_CANDIDATE_OID:$EXPECTED_USER:t" ]; then
        printf 'OPERATOR_ATTENTION: exact candidate connection fence was not restored\n' >&2
        return 1
      fi
      PARTIAL_CLONE_CANDIDATE_FENCE_ARMED="0"
      PARTIAL_CLONE_CANDIDATE_OID=""
      return 0
      ;;
    *)
      printf 'OPERATOR_ATTENTION: candidate identity changed; connection-fence recovery refused\n' >&2
      return 1
      ;;
  esac
}

cleanup_partial_clone() {
  assert_runtime_identity
  assert_mount_paths
  [ "$CANDIDATE_DATABASE" != "$PRODUCTION_DATABASE" ] && \
    [ "$CANDIDATE_DATABASE" != "$HISTORY_DATABASE" ] && \
    [ "$CANDIDATE_DATABASE" != "postgres" ] && \
    [ "$CANDIDATE_DATABASE" != "template0" ] && \
    [ "$CANDIDATE_DATABASE" != "template1" ] || \
    die "partial clone cleanup target collides with a protected database"
  [ "$PARTIAL_CLONE_CONTROL_DATABASE" != "$CANDIDATE_DATABASE" ] && \
    [ "$PARTIAL_CLONE_CONTROL_DATABASE" != "$PRODUCTION_DATABASE" ] && \
    [ "$PARTIAL_CLONE_CONTROL_DATABASE" != "$HISTORY_DATABASE" ] && \
    [ "$PARTIAL_CLONE_CONTROL_DATABASE" != "postgres" ] && \
    [ "$PARTIAL_CLONE_CONTROL_DATABASE" != "template0" ] && \
    [ "$PARTIAL_CLONE_CONTROL_DATABASE" != "template1" ] || \
    die "template0 control target collides with a protected database"
  [ "${PARTIAL_CLONE_CLEANUP_CONFIRMATION:-}" = "$PARTIAL_CLONE_CONFIRMATION" ] || \
    die "partial clone cleanup requires the exact confirmation"
  [ "${PARTIAL_CLONE_EXPECTED_GCS_GENERATION:-}" = "$PARTIAL_CLONE_GCS_GENERATION" ] || \
    die "partial clone cleanup generation assertion mismatch"
  [ "${PARTIAL_CLONE_EXPECTED_BYTES:-}" = "$PARTIAL_CLONE_BYTES" ] || \
    die "partial clone cleanup byte-count assertion mismatch"
  [ "${PARTIAL_CLONE_EXPECTED_SHA256:-}" = "$PARTIAL_CLONE_SHA256" ] || \
    die "partial clone cleanup SHA-256 assertion mismatch"

  database_exists "$CANDIDATE_DATABASE" || die "exact partial candidate database is absent"
  candidate_oid="$(scalar postgres \
    "SELECT oid FROM pg_database WHERE datname='$CANDIDATE_DATABASE';")"
  case "$candidate_oid" in ''|*[!0-9]*) die "partial candidate database OID is unsafe" ;; esac
  candidate_owner="$(scalar postgres "SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname='$CANDIDATE_DATABASE';")"
  [ "$candidate_owner" = "$EXPECTED_USER" ] || die "partial candidate database owner mismatch"
  marker_relation="$(scalar "$CANDIDATE_DATABASE" \
    "SELECT to_regclass('_giq_history_merge.run') IS NOT NULL;")"
  [ "$marker_relation" = "f" ] || die "partial clone cleanup refuses any candidate marker relation"
  marker_schema="$(scalar "$CANDIDATE_DATABASE" \
    "SELECT to_regnamespace('_giq_history_merge') IS NOT NULL;")"
  [ "$marker_schema" = "f" ] || die "partial clone cleanup refuses any candidate marker schema"

  [ ! -L "$SNAPSHOT_PATH" ] || die "failed snapshot path is a symbolic link"
  [ ! -e "$SNAPSHOT_PATH" ] || \
    die "failed snapshot artifact still exists; generation-conditional provider cleanup must complete first"

  if database_exists "$PARTIAL_CLONE_CONTROL_DATABASE"; then
    die "exact disposable template0 control database already exists"
  fi
  if ! PGDATABASE=postgres createdb --template=template0 "$PARTIAL_CLONE_CONTROL_DATABASE"; then
    die "disposable template0 control database claim failed"
  fi
  PARTIAL_CLONE_CONTROL_CLAIMED="1"
  PARTIAL_CLONE_CONTROL_OID="$(scalar postgres \
    "SELECT oid FROM pg_database WHERE datname='$PARTIAL_CLONE_CONTROL_DATABASE';")"
  case "$PARTIAL_CLONE_CONTROL_OID" in
    ''|*[!0-9]*) die "template0 control database OID is unsafe" ;;
  esac
  trap 'cleanup_partial_clone_control || printf "OPERATOR_ATTENTION: template0 control database requires exact manual cleanup\\n" >&2' 0
  trap 'exit 1' 1 2 15
  control_owner="$(scalar postgres \
    "SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname='$PARTIAL_CLONE_CONTROL_DATABASE';")"
  [ "$control_owner" = "$EXPECTED_USER" ] || die "template0 control database owner mismatch"
  psql_db postgres --command="REVOKE CONNECT ON DATABASE \"$PARTIAL_CLONE_CONTROL_DATABASE\" FROM PUBLIC;"

  candidate_data_relations="$(data_bearing_relation_count "$CANDIDATE_DATABASE")"
  control_data_relations="$(data_bearing_relation_count "$PARTIAL_CLONE_CONTROL_DATABASE")"
  [ "$candidate_data_relations" = "0" ] || \
    die "partial candidate contains a non-system table, partition, materialized view, sequence, or foreign table"
  [ "$control_data_relations" = "0" ] || \
    die "template0 control unexpectedly contains a data-bearing non-system relation"
  candidate_large_objects="$(large_object_inventory "$CANDIDATE_DATABASE")"
  control_large_objects="$(large_object_inventory "$PARTIAL_CLONE_CONTROL_DATABASE")"
  [ "$candidate_large_objects" = "0:0" ] || \
    die "partial candidate contains large-object metadata or chunks"
  [ "$control_large_objects" = "0:0" ] || \
    die "template0 control unexpectedly contains large-object metadata or chunks"

  candidate_schema_manifest="$(logical_schema_manifest "$CANDIDATE_DATABASE")"
  control_schema_manifest="$(logical_schema_manifest "$PARTIAL_CLONE_CONTROL_DATABASE")"
  [ "$candidate_schema_manifest" = "$control_schema_manifest" ] || \
    die "partial candidate logical schema differs from the fresh template0 control"

  candidate_catalog_manifest="$(template0_catalog_manifest "$CANDIDATE_DATABASE")"
  control_catalog_manifest="$(template0_catalog_manifest "$PARTIAL_CLONE_CONTROL_DATABASE")"
  [ "$candidate_catalog_manifest" = "$control_catalog_manifest" ] || \
    die "partial candidate catalog differs from the fresh template0 control"

  schema_manifest_bytes="$(printf '%s' "$candidate_schema_manifest" | wc -c | tr -d '[:space:]')"
  schema_manifest_sha256="$(printf '%s' "$candidate_schema_manifest" | sha256sum | awk '{print $1}')"
  catalog_manifest_bytes="$(printf '%s' "$candidate_catalog_manifest" | wc -c | tr -d '[:space:]')"
  catalog_manifest_sha256="$(printf '%s' "$candidate_catalog_manifest" | sha256sum | awk '{print $1}')"

  cleanup_partial_clone_control || die "exact template0 control database cleanup failed"
  trap - 0 1 2 15
  if database_exists "$PARTIAL_CLONE_CONTROL_DATABASE"; then
    die "template0 control database remains after verified cleanup"
  fi

  candidate_identity="$(scalar postgres \
    "SELECT concat(oid, ':', pg_get_userbyid(datdba))
     FROM pg_database WHERE datname='$CANDIDATE_DATABASE';")"
  [ "$candidate_identity" = "$candidate_oid:$EXPECTED_USER" ] || \
    die "partial candidate database identity changed before final cleanup"
  marker_relation="$(scalar "$CANDIDATE_DATABASE" \
    "SELECT to_regclass('_giq_history_merge.run') IS NOT NULL;")"
  [ "$marker_relation" = "f" ] || \
    die "partial candidate marker relation appeared before final cleanup"
  marker_schema="$(scalar "$CANDIDATE_DATABASE" \
    "SELECT to_regnamespace('_giq_history_merge') IS NOT NULL;")"
  [ "$marker_schema" = "f" ] || \
    die "partial candidate marker schema appeared before final cleanup"
  [ "$(data_bearing_relation_count "$CANDIDATE_DATABASE")" = "0" ] || \
    die "partial candidate gained a data-bearing relation before final cleanup"
  [ "$(logical_schema_manifest "$CANDIDATE_DATABASE")" = "$candidate_schema_manifest" ] || \
    die "partial candidate logical schema changed before final cleanup"
  [ "$(template0_catalog_manifest "$CANDIDATE_DATABASE")" = "$candidate_catalog_manifest" ] || \
    die "partial candidate catalog changed before final cleanup"
  [ "$(large_object_inventory "$CANDIDATE_DATABASE")" = "0:0" ] || \
    die "partial candidate gained large-object metadata or chunks before final cleanup"
  [ ! -L "$SNAPSHOT_PATH" ] || \
    die "failed snapshot path became a symbolic link before final cleanup"
  [ ! -e "$SNAPSHOT_PATH" ] || \
    die "failed snapshot artifact appeared before final cleanup"
  candidate_connections="$(scalar postgres \
    "SELECT count(*) FROM pg_stat_activity WHERE datname='$CANDIDATE_DATABASE';")"
  [ "$candidate_connections" = "0" ] || \
    die "partial candidate database has an unexpected active connection"

  PARTIAL_CLONE_CANDIDATE_OID="$candidate_oid"
  PARTIAL_CLONE_CANDIDATE_FENCE_ARMED="1"
  trap 'release_partial_clone_candidate_fence || printf "OPERATOR_ATTENTION: exact candidate connection fence requires manual recovery\\n" >&2' 0
  trap 'exit 1' 1 2 15
  psql_db postgres --command="ALTER DATABASE \"$CANDIDATE_DATABASE\" WITH ALLOW_CONNECTIONS false;"
  fenced_candidate_identity="$(scalar postgres \
    "SELECT concat(oid, ':', pg_get_userbyid(datdba), ':',
                   CASE WHEN datallowconn THEN 't' ELSE 'f' END)
     FROM pg_database WHERE datname='$CANDIDATE_DATABASE';")"
  [ "$fenced_candidate_identity" = "$candidate_oid:$EXPECTED_USER:f" ] || \
    die "partial candidate database identity or connection fence changed before drop"
  candidate_connections="$(scalar postgres \
    "SELECT count(*) FROM pg_stat_activity WHERE datname='$CANDIDATE_DATABASE';")"
  [ "$candidate_connections" = "0" ] || \
    die "partial candidate database has an active connection after fencing"

  PGDATABASE=postgres dropdb "$CANDIDATE_DATABASE"
  if database_exists "$CANDIDATE_DATABASE"; then
    die "partial candidate database remains after final cleanup"
  fi
  PARTIAL_CLONE_CANDIDATE_FENCE_ARMED="0"
  PARTIAL_CLONE_CANDIDATE_OID=""
  trap - 0 1 2 15
  printf 'PARTIAL_CLONE_DATABASE_CLAIM_REMOVED database=%s snapshot_absent=%s deleted_generation=%s bytes=%s sha256=%s schema_manifest_bytes=%s schema_manifest_sha256=%s catalog_manifest_bytes=%s catalog_manifest_sha256=%s\n' \
    "$CANDIDATE_DATABASE" "$SNAPSHOT_PATH" "$PARTIAL_CLONE_GCS_GENERATION" \
    "$PARTIAL_CLONE_BYTES" "$PARTIAL_CLONE_SHA256" \
    "$schema_manifest_bytes" "$schema_manifest_sha256" \
    "$catalog_manifest_bytes" "$catalog_manifest_sha256"
}

stage_r2() {
  assert_candidate_marker
  if phase_at_least r2_staged; then
    printf 'R2_STAGE_ALREADY_VERIFIED database=%s phase=%s\n' "$CANDIDATE_DATABASE" "$(candidate_phase)"
    return
  fi
  psql_db "$CANDIDATE_DATABASE" --file="$SQL_ROOT/stage-r2.sql"
}

rebind_normalized_input() {
  assert_runtime_identity
  candidate_marker_exists || die "candidate marker is absent"
  [ "${NORMALIZED_INPUT_REBIND_CONFIRMATION:-}" = "$NORMALIZED_INPUT_REBIND_CONFIRMATION_TOKEN" ] || \
    die "NORMALIZED_INPUT_REBIND_CONFIRMATION must approve rebinding the never-staged legacy input"
  psql_db "$CANDIDATE_DATABASE" \
    --set=expected_legacy_manifest_sha256="$LEGACY_NORMALIZED_MANIFEST_SHA256" \
    --set=expected_legacy_source_cutoff="$LEGACY_HISTORY_SOURCE_CUTOFF" \
    --set=normalized_manifest_sha256="$NORMALIZED_MANIFEST_SHA256" \
    --set=normalized_transform_version="$NORMALIZED_TRANSFORM_VERSION" \
    --set=history_source_cutoff="$HISTORY_SOURCE_CUTOFF" \
    --set=confirmation="$NORMALIZED_INPUT_REBIND_CONFIRMATION_TOKEN" \
    --file="$SQL_ROOT/rebind-normalized-input.sql"
}

initialize_export_stage() {
  psql_db "$CANDIDATE_DATABASE" \
    --set=manifest_sha256="$NORMALIZED_MANIFEST_SHA256" \
    --file="$SQL_ROOT/initialize-export-stage.sql"
}

load_export_file() {
  dataset="$1"
  shard="$2"
  relative="${shard#"$NORMALIZED_ROOT/"}"

  psql_db "$CANDIDATE_DATABASE" --command='TRUNCATE _giq_history_stage.ingest_line RESTART IDENTITY;'
  psql_db "$CANDIDATE_DATABASE" --command="\\copy _giq_history_stage.ingest_line(line) FROM '$shard' WITH (FORMAT csv, DELIMITER E'\\x01', QUOTE E'\\x02', ESCAPE E'\\x02')"
  psql_db "$CANDIDATE_DATABASE" \
    --set=target_table="export_$dataset" \
    --set=source_file="$relative" <<'SQL'
INSERT INTO _giq_history_stage.:"target_table" (source_file, line_number, payload)
SELECT :'source_file', line_number, line::jsonb
FROM _giq_history_stage.ingest_line
ON CONFLICT (source_file, line_number) DO UPDATE
SET payload = EXCLUDED.payload;
SQL
}

stage_export() {
  assert_candidate_marker
  if phase_at_least export_staged; then
    printf 'EXPORT_STAGE_ALREADY_VERIFIED database=%s phase=%s\n' "$CANDIDATE_DATABASE" "$(candidate_phase)"
    return
  fi
  phase="$(candidate_phase)"
  case "$phase" in
    r2_staged|export_staged) ;;
    *) die "stage-export requires phase r2_staged, observed $phase" ;;
  esac

  assert_normalized_files
  initialize_export_stage

  jq -r '.partitions[] as $p | $p.outputs[] | [$p.directory,.dataset,.file] | @tsv' "$(manifest_path)" |
  while IFS="$(printf '\t')" read -r directory dataset file; do
    load_export_file "$dataset" "$NORMALIZED_ROOT/$directory/$file"
  done

  psql_db "$CANDIDATE_DATABASE" \
    --set=manifest_sha256="$NORMALIZED_MANIFEST_SHA256" \
    --set=source_run_instance_id="$(jq -r '.source.runInstanceId' "$(manifest_path)")" \
    --set=source_generated_at="$(jq -r '.generatedAt' "$(manifest_path)")" \
    --file="$SQL_ROOT/finalize-export-stage.sql"
}

finalize_export() {
  assert_candidate_marker
  [ "$(candidate_phase)" = "r2_staged" ] || \
    die "finalize-export requires phase r2_staged"
  psql_db "$CANDIDATE_DATABASE" \
    --set=manifest_sha256="$NORMALIZED_MANIFEST_SHA256" \
    --set=source_run_instance_id="$(jq -r '.source.runInstanceId' "$(manifest_path)")" \
    --set=source_generated_at="$(jq -r '.generatedAt' "$(manifest_path)")" \
    --file="$SQL_ROOT/finalize-export-stage.sql"
}

load_galtd_file() {
  target="$1"
  source_file="$2"
  psql_db "$CANDIDATE_DATABASE" --command='TRUNCATE _giq_history_stage.ingest_line RESTART IDENTITY;'
  psql_db "$CANDIDATE_DATABASE" --command="\\copy _giq_history_stage.ingest_line(line) FROM '$source_file' WITH (FORMAT csv, DELIMITER E'\\x01', QUOTE E'\\x02', ESCAPE E'\\x02')"
  psql_db "$CANDIDATE_DATABASE" --set=target_table="$target" <<'SQL'
INSERT INTO _giq_history_stage.:"target_table" (line_number, payload)
SELECT line_number, line::jsonb
FROM _giq_history_stage.ingest_line
ON CONFLICT (line_number) DO UPDATE SET payload = EXCLUDED.payload;
SQL
}

stage_galtd() {
  assert_candidate_marker
  if phase_at_least galtd_staged; then
    printf 'GALTD_STAGE_ALREADY_VERIFIED database=%s phase=%s\n' "$CANDIDATE_DATABASE" "$(candidate_phase)"
    return
  fi
  phase="$(candidate_phase)"
  case "$phase" in export_staged|galtd_staged) ;; *) die "stage-galtd requires phase export_staged, observed $phase" ;; esac
  assert_galtd_files

  observations="/tmp/galtd-observations.jsonl"
  assertions="/tmp/galtd-assertions.jsonl"
  export_report="/tmp/galtd-stage-report.json"
  rm -f "$observations" "$assertions" "$export_report"
  node --experimental-strip-types "$GALTD_EXPORTER" \
    --root "$GALTD_ROOT" \
    --observations "$observations" \
    --assertions "$assertions" \
    --report "$export_report"

  observations_sha="$(sha256sum "$observations" | awk '{print $1}')"
  assertions_sha="$(sha256sum "$assertions" | awk '{print $1}')"
  [ "$(jq -r '.observationsSha256' "$export_report")" = "$observations_sha" ] || die "GALTD observation export digest mismatch"
  [ "$(jq -r '.assertionsSha256' "$export_report")" = "$assertions_sha" ] || die "GALTD assertion export digest mismatch"

  psql_db "$CANDIDATE_DATABASE" --file="$SQL_ROOT/initialize-galtd-stage.sql"
  load_galtd_file galtd_observation "$observations"
  load_galtd_file galtd_assertion "$assertions"
  psql_db "$CANDIDATE_DATABASE" \
    --set=report_sha256="$GALTD_REPORT_SHA256" \
    --set=observations_sha256="$observations_sha" \
    --set=assertions_sha256="$assertions_sha" \
    --set=export_report="$(jq -c . "$export_report")" \
    --file="$SQL_ROOT/finalize-galtd-stage.sql"
  rm -f "$observations" "$assertions" "$export_report"
}

normalize_stage() {
  assert_candidate_marker
  if phase_at_least normalized; then
    printf 'NORMALIZATION_ALREADY_VERIFIED database=%s phase=%s\n' "$CANDIDATE_DATABASE" "$(candidate_phase)"
    return
  fi
  [ -r "$REPLAY_EVIDENCE_CONTRACT" ] || die "replay evidence contract is absent"
  replay_contract_sha256="$(sha256sum "$REPLAY_EVIDENCE_CONTRACT" | awk '{print $1}')"
  [ "$replay_contract_sha256" = "$REPLAY_EVIDENCE_CONTRACT_SHA256" ] || \
    die "replay evidence contract SHA-256 changed"
  replay_contract_json="$(jq -c . "$REPLAY_EVIDENCE_CONTRACT")"
  psql_db "$CANDIDATE_DATABASE" \
    --set=contract_sha256="$replay_contract_sha256" \
    --set=replay_contract="$replay_contract_json" \
    --file="$SQL_ROOT/stage-replay-evidence.sql"
  [ -x "$NORMALIZE_CHECKPOINTED_RUNNER" ] || die "checkpointed normalization runner is absent"
  CANDIDATE_DATABASE="$CANDIDATE_DATABASE" NORMALIZE_SQL_ROOT="$SQL_ROOT" \
    "$NORMALIZE_CHECKPOINTED_RUNNER"
}

assert_normalized_saturation_phase() {
  saturation_label="$1"
  observed_phase="$(candidate_phase)"
  [ "$observed_phase" = "normalized" ] || \
    die "$saturation_label requires phase normalized, observed $observed_phase"
}

authoritative_pedigree_stage_relation_count() {
  scalar "$CANDIDATE_DATABASE" "
    SELECT count(*)
    FROM unnest(ARRAY[
      '_giq_history_stage.authoritative_provider_policy',
      '_giq_history_stage.authoritative_pedigree_assertion_occurrence',
      '_giq_history_stage.authoritative_identity_evidence',
      '_giq_history_stage.authoritative_pedigree_evidence',
      '_giq_history_stage.authoritative_consolidation_proof',
      '_giq_history_stage.authoritative_pedigree_terminal_proof',
      '_giq_history_stage.authoritative_identity_candidate_search',
      '_giq_history_stage.authoritative_identity_resolution',
      '_giq_history_stage.verified_production_pedigree_authority',
      '_giq_history_stage.authoritative_pedigree_evidence_leaf',
      '_giq_history_stage.authoritative_pedigree_terminal_proof_leaf',
      '_giq_history_stage.authoritative_pedigree_resolution',
      '_giq_history_stage.authoritative_pedigree_conflict_ledger',
      '_giq_history_stage.authoritative_pedigree_retrieval_queue',
      '_giq_history_stage.current_pedigree_quarantine'
    ]) relation_name
    WHERE to_regclass(relation_name) IS NOT NULL;"
}

authoritative_pedigree_v1_archive_relation_count() {
  scalar "$CANDIDATE_DATABASE" "
    SELECT count(*)
    FROM unnest(ARRAY[
      '_giq_history_pedigree_v1_archive.authoritative_provider_policy',
      '_giq_history_pedigree_v1_archive.authoritative_identity_evidence',
      '_giq_history_pedigree_v1_archive.authoritative_pedigree_evidence',
      '_giq_history_pedigree_v1_archive.authoritative_consolidation_proof',
      '_giq_history_pedigree_v1_archive.authoritative_identity_candidate_search',
      '_giq_history_pedigree_v1_archive.authoritative_identity_resolution',
      '_giq_history_pedigree_v1_archive.authoritative_pedigree_resolution',
      '_giq_history_pedigree_v1_archive.authoritative_pedigree_conflict_ledger',
      '_giq_history_pedigree_v1_archive.authoritative_pedigree_retrieval_queue',
      '_giq_history_pedigree_v1_archive.current_pedigree_quarantine'
    ]) relation_name
    WHERE to_regclass(relation_name) IS NOT NULL;"
}

authoritative_pedigree_v1_archive_manifest_count() {
  scalar "$CANDIDATE_DATABASE" "
    SELECT CASE
      WHEN to_regclass('_giq_history_merge.authoritative_pedigree_saturation_archive_manifest')
           IS NULL THEN 0
      ELSE 1
    END;"
}

authoritative_pedigree_v1_archive_schema_count() {
  scalar "$CANDIDATE_DATABASE" "
    SELECT count(*)
    FROM pg_namespace
    WHERE nspname='_giq_history_pedigree_v1_archive';"
}

authoritative_pedigree_manifest_count() {
  scalar "$CANDIDATE_DATABASE" "
    SELECT CASE
      WHEN to_regclass('_giq_history_merge.authoritative_pedigree_saturation_manifest')
           IS NULL THEN 0
      ELSE 1
    END;"
}

archive_authoritative_pedigree_v1() {
  [ -r "$AUTHORITATIVE_PEDIGREE_V1_ARCHIVE_SQL" ] || \
    die "authoritative pedigree v1 archive SQL is absent"
  psql_db "$CANDIDATE_DATABASE" --file="$AUTHORITATIVE_PEDIGREE_V1_ARCHIVE_SQL"
}

finalize_authoritative_pedigree_saturation() {
  assert_candidate_marker
  assert_normalized_saturation_phase "authoritative pedigree saturation finalization"
  [ -r "$AUTHORITATIVE_PEDIGREE_FINALIZER_SQL" ] || \
    die "authoritative pedigree saturation finalizer SQL is absent"
  [ "$(authoritative_pedigree_stage_relation_count)" = "15" ] || \
    die "authoritative pedigree resolution stage is incomplete"
  psql_db "$CANDIDATE_DATABASE" --file="$AUTHORITATIVE_PEDIGREE_FINALIZER_SQL"
}

stage_authoritative_pedigree_resolution() {
  assert_candidate_marker
  assert_normalized_saturation_phase "authoritative pedigree resolution staging"
  stage_relation_count="$(authoritative_pedigree_stage_relation_count)"
  archive_relation_count="$(authoritative_pedigree_v1_archive_relation_count)"
  archive_manifest_count="$(authoritative_pedigree_v1_archive_manifest_count)"
  archive_schema_count="$(authoritative_pedigree_v1_archive_schema_count)"
  pedigree_manifest_count="$(authoritative_pedigree_manifest_count)"
  case "$stage_relation_count:$archive_relation_count:$archive_manifest_count:$archive_schema_count:$pedigree_manifest_count" in
    0:0:0:0:0)
      psql_db "$CANDIDATE_DATABASE" --file="$SQL_ROOT/stage-authoritative-pedigree-resolution.sql"
      ;;
    10:0:0:0:1)
      archive_authoritative_pedigree_v1
      [ "$(authoritative_pedigree_stage_relation_count)" = "0" ] || \
        die "authoritative pedigree v1 archive left live stage relations"
      [ "$(authoritative_pedigree_v1_archive_relation_count)" = "10" ] || \
        die "authoritative pedigree v1 archive relation parity failed"
      [ "$(authoritative_pedigree_v1_archive_manifest_count)" = "1" ] || \
        die "authoritative pedigree v1 archive manifest is absent"
      psql_db "$CANDIDATE_DATABASE" --file="$SQL_ROOT/stage-authoritative-pedigree-resolution.sql"
      ;;
    0:10:1:1:1)
      archive_authoritative_pedigree_v1
      psql_db "$CANDIDATE_DATABASE" --file="$SQL_ROOT/stage-authoritative-pedigree-resolution.sql"
      ;;
    15:0:0:0:0|15:0:0:0:1)
      printf 'AUTHORITATIVE_PEDIGREE_RESOLUTION_ALREADY_STAGED database=%s\n' "$CANDIDATE_DATABASE"
      ;;
    15:10:1:1:1)
      archive_authoritative_pedigree_v1
      printf 'AUTHORITATIVE_PEDIGREE_RESOLUTION_ALREADY_STAGED database=%s\n' "$CANDIDATE_DATABASE"
      ;;
    *)
      die "authoritative pedigree resolution/archive state is partial or mixed: live=$stage_relation_count archive=$archive_relation_count archive_manifest=$archive_manifest_count archive_schema=$archive_schema_count pedigree_manifest=$pedigree_manifest_count"
      ;;
  esac
  finalize_authoritative_pedigree_saturation
}

nonpedigree_saturation_relation_count() {
  scalar "$CANDIDATE_DATABASE" "
    SELECT count(*)
    FROM unnest(ARRAY[
      '_giq_history_stage.nonpedigree_dog_composite_review_candidate',
      '_giq_history_stage.nonpedigree_dog_identity_resolution',
      '_giq_history_stage.nonpedigree_row_disposition',
      '_giq_history_stage.nonpedigree_authoritative_fetch_queue',
      '_giq_history_merge.nonpedigree_saturation_manifest'
    ]) relation_name
    WHERE to_regclass(relation_name) IS NOT NULL;"
}

stage_nonpedigree_saturation() {
  assert_candidate_marker
  assert_normalized_saturation_phase "non-pedigree saturation staging"
  stage_relation_count="$(nonpedigree_saturation_relation_count)"
  case "$stage_relation_count" in
    0) psql_db "$CANDIDATE_DATABASE" --file="$SQL_ROOT/stage-nonpedigree-saturation.sql" ;;
    5)
      nonpedigree_status="$(scalar "$CANDIDATE_DATABASE" \
        'SELECT status FROM _giq_history_merge.nonpedigree_saturation_manifest WHERE id=1;')"
      [ "$nonpedigree_status" = "ready" ] || \
        die "non-pedigree saturation manifest remains $nonpedigree_status; a reviewed stage update and fresh isolated candidate are required"
      printf 'NONPEDIGREE_SATURATION_ALREADY_READY database=%s\n' "$CANDIDATE_DATABASE"
      ;;
    *) die "non-pedigree saturation stage is partial: observed $stage_relation_count of 5 relations" ;;
  esac
}

duplicate_quarantine_source_evidence_relation_count() {
  scalar "$CANDIDATE_DATABASE" "
    SELECT count(*)
    FROM unnest(ARRAY[
      '_giq_history_merge.duplicate_quarantine_source_evidence_manifest',
      '_giq_history_stage.duplicate_quarantine_issue',
      '_giq_history_stage.duplicate_quarantine_source_evidence',
      '_giq_history_stage.duplicate_quarantine_retrieval_queue'
    ]) relation_name
    WHERE to_regclass(relation_name) IS NOT NULL;"
}

assert_duplicate_quarantine_source_evidence_files() {
  [ -d "$DUPLICATE_QUARANTINE_SOURCE_EVIDENCE_ROOT" ] || \
    die "duplicate/quarantine source-evidence root is absent: $DUPLICATE_QUARANTINE_SOURCE_EVIDENCE_ROOT"
  [ ! -L "$DUPLICATE_QUARANTINE_SOURCE_EVIDENCE_ROOT" ] || \
    die "duplicate/quarantine source-evidence root must not be a symbolic link"
  for artifact in \
    queue.manifest.json \
    queue.manifest.sha256 \
    duplicate-quarantine-evidence.jsonl \
    duplicate-quarantine-race-retrieval-queue.jsonl
  do
    artifact_path="$DUPLICATE_QUARANTINE_SOURCE_EVIDENCE_ROOT/$artifact"
    [ -f "$artifact_path" ] && [ -r "$artifact_path" ] || \
      die "duplicate/quarantine source-evidence artifact is absent or unreadable: $artifact"
    [ ! -L "$artifact_path" ] || \
      die "duplicate/quarantine source-evidence artifact must not be a symbolic link: $artifact"
  done
}

stage_duplicate_quarantine_source_evidence() {
  assert_candidate_marker
  assert_normalized_saturation_phase "duplicate/quarantine source-evidence staging"
  assert_duplicate_quarantine_source_evidence_files
  stage_relation_count="$(duplicate_quarantine_source_evidence_relation_count)"
  case "$stage_relation_count" in
    0|4)
      psql_db "$CANDIDATE_DATABASE" \
        --set=manifest_file="$DUPLICATE_QUARANTINE_SOURCE_EVIDENCE_ROOT/queue.manifest.json" \
        --set=manifest_sha_file="$DUPLICATE_QUARANTINE_SOURCE_EVIDENCE_ROOT/queue.manifest.sha256" \
        --set=source_evidence_file="$DUPLICATE_QUARANTINE_SOURCE_EVIDENCE_ROOT/duplicate-quarantine-evidence.jsonl" \
        --set=retrieval_queue_file="$DUPLICATE_QUARANTINE_SOURCE_EVIDENCE_ROOT/duplicate-quarantine-race-retrieval-queue.jsonl" \
        --file="$SQL_ROOT/stage-duplicate-quarantine-source-evidence.sql"
      ;;
    *) die "duplicate/quarantine source-evidence stage is partial: observed $stage_relation_count of 4 relations" ;;
  esac
  [ "$(duplicate_quarantine_source_evidence_relation_count)" = "4" ] || \
    die "duplicate/quarantine source-evidence stage did not persist its complete immutable partition"
  [ "$(candidate_phase)" = "normalized" ] || \
    die "duplicate/quarantine source-evidence stage advanced the candidate phase unexpectedly"
  printf 'DUPLICATE_QUARANTINE_SOURCE_EVIDENCE_STAGED database=%s root=%s\n' \
    "$CANDIDATE_DATABASE" "$DUPLICATE_QUARANTINE_SOURCE_EVIDENCE_ROOT"
}

duplicate_quarantine_proof_relation_count() {
  scalar "$CANDIDATE_DATABASE" "
    SELECT count(*)
    FROM unnest(ARRAY[
      '_giq_history_stage.duplicate_quarantine_issue',
      '_giq_history_merge.duplicate_quarantine_resolution_audit',
      '_giq_history_merge.duplicate_quarantine_reference_proof',
      '_giq_history_stage.duplicate_quarantine_inbound_reference_catalog',
      '_giq_history_stage.duplicate_quarantine_canonical_entity',
      '_giq_history_stage.duplicate_quarantine_proof_resolution',
      '_giq_history_merge.duplicate_quarantine_proof_manifest'
    ]) relation_name
    WHERE to_regclass(relation_name) IS NOT NULL;"
}

stage_duplicate_quarantine_proof_resolution() {
  assert_candidate_marker
  assert_normalized_saturation_phase "duplicate/quarantine proof staging"
  [ "$(duplicate_quarantine_source_evidence_relation_count)" = "4" ] || \
    die "duplicate/quarantine proof staging requires the complete immutable source-evidence stage first"
  stage_relation_count="$(duplicate_quarantine_proof_relation_count)"
  case "$stage_relation_count" in
    1|7)
      # Re-running a complete stage only refreshes the run-bound proof manifest;
      # the underlying proof and reference ledgers are append-only.
      psql_db "$CANDIDATE_DATABASE" \
        --file="$SQL_ROOT/stage-duplicate-quarantine-proof-resolution.sql"
      ;;
    *) die "duplicate/quarantine proof stage is partial: observed $stage_relation_count of 7 relations" ;;
  esac

  duplicate_proof_status_json="$(duplicate_quarantine_proof_status)"
  duplicate_proof_status="$(printf '%s' "$duplicate_proof_status_json" | jq -r '.status')"
  [ "$duplicate_proof_status" = "ready" ] || \
    die "duplicate/quarantine proof remains $duplicate_proof_status; exact v2 identity, reference-conservation, no-loss, and append-only audit proof are mandatory"
  printf 'DUPLICATE_QUARANTINE_PROOF_READY database=%s\n' "$CANDIDATE_DATABASE"
}

plan_merge() {
  assert_candidate_marker
  psql_db "$CANDIDATE_DATABASE" --file="$SQL_ROOT/plan-canonical-merge.sql"
}

merge_canonical() {
  assert_candidate_marker
  if phase_at_least canonical_merged; then
    plan_merge
    printf 'CANONICAL_MERGE_ALREADY_VERIFIED database=%s phase=%s\n' "$CANDIDATE_DATABASE" "$(candidate_phase)"
    return
  fi
  # Both files must share one backend: the read-only plan leaves a run-bound
  # temporary attestation which the write transaction independently verifies
  # and consumes.
  psql_db "$CANDIDATE_DATABASE" \
    --file="$SQL_ROOT/plan-canonical-merge.sql" \
    --file="$SQL_ROOT/merge-canonical.sql"
}

apply_live_delta() {
  assert_candidate_marker
  if phase_at_least delta_applied; then
    printf 'LIVE_DELTA_ALREADY_VERIFIED database=%s phase=%s\n' "$CANDIDATE_DATABASE" "$(candidate_phase)"
    return
  fi
  [ "${PRODUCTION_WRITES_FROZEN:-}" = "I_ACKNOWLEDGE_PRODUCTION_WRITES_ARE_FROZEN" ] || \
    die "delta requires the exact production-write-freeze acknowledgement"
  source_table_list="$(PGDATABASE="$PRODUCTION_DATABASE" \
    PGOPTIONS='-c default_transaction_read_only=on -c TimeZone=UTC -c DateStyle=ISO,MDY -c extra_float_digits=1' \
    psql --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align --command="
      SELECT string_agg(format('%I',table_name),',' ORDER BY table_name)
      FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE';")"
  [ -n "$source_table_list" ] || die "frozen production base-table inventory is empty"
  psql_db "$CANDIDATE_DATABASE" \
    --set=write_freeze_ack="$PRODUCTION_WRITES_FROZEN" \
    --set=source_table_list="$source_table_list" \
    --file="$SQL_ROOT/apply-live-delta.sql"
}

verify_candidate() {
  assert_candidate_marker
  if phase_at_least verified; then
    printf 'CANDIDATE_VERIFICATION_ALREADY_COMPLETE database=%s phase=%s\n' "$CANDIDATE_DATABASE" "$(candidate_phase)"
    return
  fi
  [ "${PRODUCTION_WRITES_FROZEN:-}" = "I_ACKNOWLEDGE_PRODUCTION_WRITES_ARE_FROZEN" ] || \
    die "verification requires the exact production-write-freeze acknowledgement"
  psql_db "$CANDIDATE_DATABASE" --file="$SQL_ROOT/verify-candidate.sql"
}

grant_runtime() {
  assert_candidate_marker
  [ "$(candidate_phase)" = "verified" ] || die "runtime grants require a verified candidate"
  [ -n "${RUNTIME_DATABASE_PASSWORD:-}" ] || die "RUNTIME_DATABASE_PASSWORD is required for restricted-login smoke"
  psql_db "$CANDIDATE_DATABASE" --file="$SQL_ROOT/provision-candidate-runtime.sql"

  runtime_identity="$(PGDATABASE="$CANDIDATE_DATABASE" PGUSER=greyhoundiq_runtime \
    PGPASSWORD="$RUNTIME_DATABASE_PASSWORD" psql --no-psqlrc --set=ON_ERROR_STOP=1 \
    --tuples-only --no-align --command='SELECT concat(current_user, chr(58), session_user);')"
  [ "$runtime_identity" = "greyhoundiq_runtime:greyhoundiq_runtime" ] || die "candidate runtime login identity mismatch"
  runtime_probe="$(PGDATABASE="$CANDIDATE_DATABASE" PGUSER=greyhoundiq_runtime \
    PGPASSWORD="$RUNTIME_DATABASE_PASSWORD" psql --no-psqlrc --set=ON_ERROR_STOP=1 \
    --tuples-only --no-align --command='SELECT COUNT(*) FROM public."Race" WHERE "raceTime" >= now() - make_interval(days => 30);')"
  case "$runtime_probe" in ''|*[!0-9]*) die "candidate runtime public-racing probe returned a non-count result" ;; esac

  psql_db "$CANDIDATE_DATABASE" --set=recent_races="$runtime_probe" --command="
    UPDATE _giq_history_merge.run
    SET runtime_grants_manifest=runtime_grants_manifest || jsonb_build_object(
      'restrictedLoginSmoke',true,'recentRaceProbe',:'recent_races'::bigint
    )
    WHERE id=1;"
  printf 'CANDIDATE_RUNTIME_GRANTS_VERIFIED database=%s role=greyhoundiq_runtime recent_races=%s\n' \
    "$CANDIDATE_DATABASE" "$runtime_probe"
}

authoritative_pedigree_saturation_status() {
  if [ "$(scalar "$CANDIDATE_DATABASE" \
    "SELECT to_regclass('_giq_history_merge.authoritative_pedigree_saturation_manifest') IS NOT NULL;")" != "t" ]; then
    printf '{"status":"absent"}'
    return
  fi
  scalar "$CANDIDATE_DATABASE" "
    WITH marker AS (
      SELECT normalized_manifest_sha256,normalized_transform_version,source_history_cutoff
      FROM _giq_history_merge.run WHERE id=1
    ), manifest AS (
      SELECT manifest.*,
        CASE WHEN jsonb_typeof(manifest.blockers)='object' THEN
          jsonb_object_length(manifest.blockers)=7 AND manifest.blockers ?& ARRAY[
            'identityPending','relationshipPending','authorityConflict',
            'canonicalIntegrity','persistence','accounting','coverage'
          ] AND NOT EXISTS(
            SELECT 1 FROM jsonb_each(manifest.blockers) blocker
            WHERE jsonb_typeof(blocker.value) IS DISTINCT FROM 'number'
               OR blocker.value::text !~ '^(0|[1-9][0-9]*)$'
          )
        ELSE false END AS blocker_contract_valid,
        CASE WHEN jsonb_typeof(manifest.counts)='object'
          AND manifest.counts ?& ARRAY[
            'terminalInvalidImpossible','terminalSupersededConflict',
            'terminalUnlinkedConflictCovered','terminalCorroborationOnlyCovered',
            'terminalNonblocking','terminalBlocking'
          ] THEN NOT EXISTS(
            SELECT 1
            FROM jsonb_each(manifest.counts) count_item
            WHERE count_item.key=ANY(ARRAY[
              'terminalInvalidImpossible','terminalSupersededConflict',
              'terminalUnlinkedConflictCovered','terminalCorroborationOnlyCovered',
              'terminalNonblocking','terminalBlocking'
            ]) AND (jsonb_typeof(count_item.value) IS DISTINCT FROM 'number'
              OR count_item.value::text !~ '^(0|[1-9][0-9]*)$')
          ) ELSE false END AS terminal_contract_valid,
        CASE WHEN jsonb_typeof(manifest.blockers)='object' THEN EXISTS(
          SELECT 1 FROM jsonb_each(manifest.blockers) blocker
          WHERE blocker.value <> '0'::jsonb
        ) ELSE true END AS has_blockers
      FROM _giq_history_merge.authoritative_pedigree_saturation_manifest manifest
      WHERE manifest.id=1
    )
    SELECT coalesce((SELECT jsonb_build_object(
        'schemaVersion',manifest.schema_version,
        'storedStatus',manifest.status,
        'status',CASE WHEN manifest.schema_version='giq-authoritative-pedigree-saturation/v2'
          AND marker.normalized_transform_version='thedogs-normalized-harvest/v2'
          AND manifest.normalized_manifest_sha256=marker.normalized_manifest_sha256
          AND manifest.source_history_cutoff=marker.source_history_cutoff
          AND manifest.source_lineage->>'normalizedManifestSha256'=marker.normalized_manifest_sha256
          AND manifest.source_lineage->>'normalizedTransformVersion'=marker.normalized_transform_version
          AND manifest.blocker_contract_valid
          AND manifest.terminal_contract_valid
          AND ((manifest.status='ready' AND NOT manifest.has_blockers)
            OR (manifest.status='blocked' AND manifest.has_blockers))
          THEN manifest.status ELSE 'invalid' END,
        'normalizedManifestSha256',manifest.normalized_manifest_sha256,
        'sourceHistoryCutoff',manifest.source_history_cutoff,
        'counts',manifest.counts,
        'blockers',manifest.blockers,
        'updatedAt',manifest.updated_at
      ) FROM manifest CROSS JOIN marker),'{\"status\":\"invalid\"}'::jsonb);"
}

nonpedigree_saturation_status() {
  if [ "$(scalar "$CANDIDATE_DATABASE" \
    "SELECT to_regclass('_giq_history_merge.nonpedigree_saturation_manifest') IS NOT NULL;")" != "t" ]; then
    printf '{"status":"absent"}'
    return
  fi
  scalar "$CANDIDATE_DATABASE" "
    WITH marker AS (
      SELECT normalized_manifest_sha256,normalized_transform_version,source_history_cutoff
      FROM _giq_history_merge.run WHERE id=1
    ), manifest AS (
      SELECT manifest.*,
        CASE WHEN jsonb_typeof(manifest.blockers)='object' THEN
          jsonb_object_length(manifest.blockers)=11 AND manifest.blockers ?& ARRAY[
            'authoritativeFetchQueue','dogIdentityCollisions','dogTargetRelinks',
            'unlinkedIdentityClaims','nonverifiedIdentityClaims','r2OnlyIdentityRetrievalRequired',
            'unresolvedDogIdentities','compositeDogReviews','duplicateNoLossReviews',
            'unresolvedPseudoRaceRows','unresolvedSourceQuarantine'
          ] AND NOT EXISTS(
            SELECT 1 FROM jsonb_each(manifest.blockers) blocker
            WHERE jsonb_typeof(blocker.value) IS DISTINCT FROM 'number'
               OR blocker.value::text !~ '^(0|[1-9][0-9]*)$'
          )
        ELSE false END AS blocker_contract_valid,
        CASE WHEN jsonb_typeof(manifest.blockers)='object' THEN EXISTS(
          SELECT 1 FROM jsonb_each(manifest.blockers) blocker
          WHERE blocker.value <> '0'::jsonb
        ) ELSE true END AS has_blockers
      FROM _giq_history_merge.nonpedigree_saturation_manifest manifest
      WHERE manifest.id=1
    )
    SELECT coalesce((SELECT jsonb_build_object(
        'schemaVersion',manifest.schema_version,
        'storedStatus',manifest.status,
        'status',CASE WHEN manifest.schema_version='giq-nonpedigree-saturation/v1'
          AND marker.normalized_transform_version='thedogs-normalized-harvest/v2'
          AND manifest.normalized_manifest_sha256=marker.normalized_manifest_sha256
          AND manifest.source_history_cutoff=marker.source_history_cutoff
          AND manifest.blocker_contract_valid
          AND ((manifest.status='ready' AND NOT manifest.has_blockers)
            OR (manifest.status='blocked' AND manifest.has_blockers))
          THEN manifest.status ELSE 'invalid' END,
        'normalizedManifestSha256',manifest.normalized_manifest_sha256,
        'sourceHistoryCutoff',manifest.source_history_cutoff,
        'counts',manifest.counts,
        'blockers',manifest.blockers,
        'createdAt',manifest.created_at
      ) FROM manifest CROSS JOIN marker),'{\"status\":\"invalid\"}'::jsonb);"
}

duplicate_quarantine_proof_status() {
  if [ "$(scalar "$CANDIDATE_DATABASE" \
    "SELECT to_regclass('_giq_history_merge.duplicate_quarantine_proof_manifest') IS NOT NULL;")" != "t" ]; then
    printf '{"status":"absent"}'
    return
  fi
  scalar "$CANDIDATE_DATABASE" "
    WITH marker AS (
      SELECT normalized_manifest_sha256,normalized_transform_version,source_history_cutoff
      FROM _giq_history_merge.run WHERE id=1
    ), source_datasets AS (
      SELECT jsonb_object_agg(dataset,jsonb_build_object(
        'rows',expected_rows,'bytes',expected_bytes,'sha256',expected_sha256
      ) ORDER BY dataset) AS evidence,
      count(*) AS dataset_count,
      bool_and(observed_rows=expected_rows AND staged_at IS NOT NULL) AS datasets_verified
      FROM _giq_history_merge.export_dataset_manifest
      WHERE dataset IN ('duplicates','quarantine')
    ), manifest AS (
      SELECT manifest.*,
        CASE WHEN jsonb_typeof(manifest.blockers)='object' THEN
          jsonb_object_length(manifest.blockers)=19 AND manifest.blockers ?& ARRAY[
            'nonFinalIdentityAuditedSource','sourceRowsWithoutProof','sourceBindingUnproven',
            'wholeDatabaseSearchUnproven','authoritativeIdentityUnproven',
            'duplicateRawRowIdentityOrFieldComparisonUnproven','duplicateIdentityConflicts',
            'existingCanonicalTargetUnproven','similarityOnlyProofs','verifiedFieldMergeUnproven',
            'provenanceOrIdentifierPreservationUnproven','relationshipPreservationUnproven',
            'referenceInventoryUnproven','unvalidatedInboundForeignKeyProofGaps',
            'referenceConservationUnproven','relationshipIntegrityUnproven',
            'noDataLossUnproven','appendOnlyAuditUnrecorded','unresolvedRows'
          ] AND NOT EXISTS(
            SELECT 1 FROM jsonb_each(manifest.blockers) blocker
            WHERE jsonb_typeof(blocker.value) IS DISTINCT FROM 'number'
               OR blocker.value::text !~ '^(0|[1-9][0-9]*)$'
          )
        ELSE false END AS blocker_contract_valid,
        CASE WHEN jsonb_typeof(manifest.blockers)='object' THEN EXISTS(
          SELECT 1 FROM jsonb_each(manifest.blockers) blocker
          WHERE blocker.value <> '0'::jsonb
        ) ELSE true END AS has_blockers
      FROM _giq_history_merge.duplicate_quarantine_proof_manifest manifest
      WHERE manifest.id=1
    ), unsafe_resolution AS (
      SELECT EXISTS(
        SELECT 1 FROM _giq_history_stage.duplicate_quarantine_proof_resolution resolution
        WHERE NOT resolution.resolution_allowed
           OR resolution.create_entity_allowed
           OR (resolution.source_dataset='duplicates' AND NOT resolution.duplicate_removal_allowed)
           OR (resolution.source_dataset='quarantine' AND NOT resolution.quarantine_release_allowed)
           OR NOT resolution.identity_audited_v2_source
           OR NOT resolution.source_binding_proven
           OR NOT resolution.whole_database_search_proven
           OR NOT resolution.exact_authoritative_identity_proven
           OR NOT resolution.duplicate_source_rows_same_identity_proven
           OR NOT resolution.verified_field_inventory_proven
           OR NOT resolution.exhaustive_reference_inventory_proven
           OR NOT resolution.unvalidated_reference_constraints_proven
           OR NOT resolution.reference_conservation_proven
           OR NOT coalesce(resolution.relationship_integrity_verified,false)
           OR NOT coalesce(resolution.no_data_loss_verified,false)
           OR NOT coalesce(resolution.audit_ledger_recorded,false)
      ) AS present
    ), proof_partition AS (
      SELECT
        (SELECT count(*) FROM _giq_history_stage.duplicate_quarantine_proof_resolution)
          =(SELECT sum(expected_rows) FROM _giq_history_merge.export_dataset_manifest
            WHERE dataset IN ('duplicates','quarantine')) AS inventory_complete,
        (SELECT count(*) FROM pg_trigger
          WHERE tgrelid IN (
            '_giq_history_merge.duplicate_quarantine_resolution_audit'::regclass,
            '_giq_history_merge.duplicate_quarantine_reference_proof'::regclass
          )
          AND tgname IN (
            'duplicate_quarantine_resolution_audit_append_only',
            'duplicate_quarantine_reference_proof_append_only'
          ) AND tgenabled<>'D')=2 AS append_only_triggers_complete,
        NOT EXISTS(
          WITH source_row AS (
            SELECT 'duplicates'::text AS source_dataset,source_file,line_number,
              payload->>'issueType' AS issue_type,payload->>'naturalKey' AS source_natural_key,
              payload,encode(digest(payload::text,'sha256'),'hex') AS source_payload_sha256
            FROM _giq_history_stage.export_duplicates
            UNION ALL
            SELECT 'quarantine',source_file,line_number,payload->>'issueType',
              payload->>'naturalKey',payload,encode(digest(payload::text,'sha256'),'hex')
            FROM _giq_history_stage.export_quarantine
          )
          SELECT 1
          FROM source_row source
          FULL JOIN _giq_history_stage.duplicate_quarantine_issue issue
            USING(source_dataset,source_file,line_number)
          WHERE source.source_dataset IS NULL OR issue.source_dataset IS NULL
             OR source.issue_type IS DISTINCT FROM issue.issue_type
             OR source.source_natural_key IS DISTINCT FROM issue.source_natural_key
             OR source.payload IS DISTINCT FROM issue.source_payload
             OR source.source_payload_sha256 IS DISTINCT FROM issue.source_payload_sha256
             OR issue.normalized_manifest_sha256 IS DISTINCT FROM (
               SELECT normalized_manifest_sha256 FROM _giq_history_merge.run WHERE id=1)
             OR issue.source_history_cutoff IS DISTINCT FROM (
               SELECT source_history_cutoff FROM _giq_history_merge.run WHERE id=1)
        ) AS source_inventory_exact
    )
    SELECT coalesce((SELECT jsonb_build_object(
        'schemaVersion',manifest.schema_version,
        'storedStatus',manifest.status,
        'status',CASE WHEN manifest.schema_version='giq-duplicate-quarantine-proof/v1'
          AND marker.normalized_transform_version='thedogs-normalized-harvest/v2'
          AND manifest.normalized_transform_version=marker.normalized_transform_version
          AND manifest.normalized_manifest_sha256=marker.normalized_manifest_sha256
          AND manifest.source_history_cutoff=marker.source_history_cutoff
          AND manifest.source_datasets=source_datasets.evidence
          AND source_datasets.dataset_count=2
          AND source_datasets.datasets_verified
          AND manifest.blocker_contract_valid
          AND proof_partition.inventory_complete
          AND proof_partition.append_only_triggers_complete
          AND proof_partition.source_inventory_exact
          AND ((manifest.status='ready' AND NOT manifest.has_blockers
                AND NOT unsafe_resolution.present)
            OR (manifest.status='blocked' AND manifest.has_blockers))
          THEN manifest.status ELSE 'invalid' END,
        'normalizedManifestSha256',manifest.normalized_manifest_sha256,
        'sourceHistoryCutoff',manifest.source_history_cutoff,
        'sourceDatasets',manifest.source_datasets,
        'counts',manifest.counts,
        'blockers',manifest.blockers,
        'updatedAt',manifest.updated_at
      ) FROM manifest CROSS JOIN marker CROSS JOIN source_datasets
        CROSS JOIN unsafe_resolution CROSS JOIN proof_partition),
      '{\"status\":\"invalid\"}'::jsonb);"
}

status() {
  preflight
  if ! database_exists "$CANDIDATE_DATABASE"; then
    printf 'CANDIDATE_STATUS database=%s phase=absent authoritative_pedigree_saturation=absent nonpedigree_saturation=absent duplicate_quarantine_proof=absent\n' \
      "$CANDIDATE_DATABASE"
    return
  fi
  assert_candidate_marker
  pedigree_saturation="$(authoritative_pedigree_saturation_status)"
  nonpedigree_saturation="$(nonpedigree_saturation_status)"
  duplicate_quarantine_proof="$(duplicate_quarantine_proof_status)"
  base_status="$(scalar "$CANDIDATE_DATABASE" "
    SELECT jsonb_build_object(
      'database', current_database(),
      'phase', phase,
      'schemaMigratedAt', schema_migrated_at,
      'migrationSourceSha256', migration_source_sha256,
      'r2StagedAt', r2_staged_at,
      'exportStagedAt', export_staged_at,
      'galtdStagedAt', galtd_staged_at,
      'normalizedAt', normalized_at,
      'replayNormalizationVerifiedAt', replay_normalization_verified_at,
      'canonicalMergedAt', canonical_merged_at,
      'replayBackfillCompletedAt', replay_backfill_completed_at,
      'liveDeltaAppliedAt', live_delta_applied_at,
      'verifiedAt', verified_at,
      'runtimeGrantsVerifiedAt', runtime_grants_verified_at
    )
    FROM _giq_history_merge.run WHERE id=1;")"
  jq -cn \
    --argjson base "$base_status" \
    --argjson pedigree "$pedigree_saturation" \
    --argjson nonpedigree "$nonpedigree_saturation" \
    --argjson duplicateProof "$duplicate_quarantine_proof" \
    '$base + {
      authoritativePedigreeSaturation: $pedigree,
      nonpedigreeSaturation: $nonpedigree,
      duplicateQuarantineProof: $duplicateProof
    }'
}

diagnose_clone() {
  assert_runtime_identity
  source_metadata="$(database_metadata "$PRODUCTION_DATABASE")"
  if database_exists "$CANDIDATE_DATABASE"; then
    candidate_metadata="$(database_metadata "$CANDIDATE_DATABASE")"
  else
    candidate_metadata='null'
  fi
  if physical_clone_control_exists; then
    claim_metadata="$(scalar postgres "
      SELECT coalesce((
        SELECT jsonb_build_object(
          'operationId',operation_id,
          'phase',phase,
          'sourceBytes',source_bytes,
          'candidateBytes',candidate_bytes,
          'candidateOid',candidate_oid,
          'completedAt',completed_at
        )
        FROM _giq_clone_control.physical_clone_claim
        WHERE candidate_database='$CANDIDATE_DATABASE'
        ORDER BY created_at DESC LIMIT 1
      ),'null'::jsonb);")"
  else
    claim_metadata='null'
  fi
  jq -cn --argjson source "$source_metadata" --argjson candidate "$candidate_metadata" \
    --argjson claim "$claim_metadata" \
    '{event:"PHYSICAL_CLONE_DIAGNOSTIC",source:$source,candidate:$candidate,claim:$claim}'
}

case "$MODE" in
  preflight) preflight ;;
  clone) clone_candidate ;;
  diagnose-clone) diagnose_clone ;;
  cleanup-partial-clone) cleanup_partial_clone ;;
  migrate) migrate_candidate ;;
  stage-r2) stage_r2 ;;
  rebind-normalized-input) rebind_normalized_input ;;
  stage-export) stage_export ;;
  finalize-export) finalize_export ;;
  stage-galtd) stage_galtd ;;
  normalize) normalize_stage ;;
  stage-authoritative-pedigree-resolution) stage_authoritative_pedigree_resolution ;;
  finalize-authoritative-pedigree-saturation) finalize_authoritative_pedigree_saturation ;;
  stage-nonpedigree-saturation) stage_nonpedigree_saturation ;;
  stage-duplicate-quarantine-source-evidence) stage_duplicate_quarantine_source_evidence ;;
  stage-duplicate-quarantine-proof-resolution) stage_duplicate_quarantine_proof_resolution ;;
  plan) plan_merge ;;
  merge) merge_canonical ;;
  delta) apply_live_delta ;;
  verify) verify_candidate ;;
  grant-runtime) grant_runtime ;;
  status) status ;;
esac
