#!/bin/sh
set -eu

umask 077

readonly SQL_ROOT="/usr/local/share/giq-full-history-merge/sql"
readonly EXPECTED_HOST="10.240.116.2"
readonly EXPECTED_PORT="5432"
readonly EXPECTED_USER="postgres"
readonly EXPECTED_RUNTIME_UID="999"
readonly EXPECTED_RUNTIME_GID="999"
readonly CANDIDATE_DATABASE="giq_production_candidate_20260716_r1"
readonly CONFIRMATION="I_CONFIRM_INSERT_ONLY_CLEAN_PARTITION_INTO_GIQ_PRODUCTION_CANDIDATE_20260716_R1"
readonly MODE="${CLEAN_PARTITION_MODE:-status}"

die() {
  printf 'OPERATOR_ATTENTION: %s\n' "$*" >&2
  exit 1
}

case "$MODE" in
  stage|apply|status) ;;
  *) die "unsupported CLEAN_PARTITION_MODE: $MODE" ;;
esac

[ "$(id -u)" = "$EXPECTED_RUNTIME_UID" ] || die "clean-partition image must run as postgres uid $EXPECTED_RUNTIME_UID"
[ "$(id -g)" = "$EXPECTED_RUNTIME_GID" ] || die "clean-partition image must run as postgres gid $EXPECTED_RUNTIME_GID"
[ -n "${ADMIN_DATABASE_PASSWORD:-}" ] || die "ADMIN_DATABASE_PASSWORD is required"

export PGHOST="$EXPECTED_HOST"
export PGPORT="$EXPECTED_PORT"
export PGUSER="$EXPECTED_USER"
export PGPASSWORD="$ADMIN_DATABASE_PASSWORD"
export PGSSLMODE=require
export PGCONNECT_TIMEOUT=30

psql_candidate() {
  PGDATABASE="$CANDIDATE_DATABASE" psql --no-psqlrc --set=ON_ERROR_STOP=1 "$@"
}

scalar() {
  psql_candidate --tuples-only --no-align --quiet --command="$1"
}

assert_candidate_identity() {
  identity="$(scalar "
    SELECT CASE WHEN current_database()='$CANDIDATE_DATABASE'
      AND (SELECT oid FROM pg_database WHERE datname=current_database())=
          (SELECT candidate_database_oid FROM _giq_history_merge.run WHERE id=1)
      AND (SELECT phase FROM _giq_history_merge.run WHERE id=1)='normalized'
      AND (SELECT normalized_transform_version FROM _giq_history_merge.run WHERE id=1)=
          'thedogs-normalized-harvest/v2'
      AND (SELECT canonical_merged_at IS NULL FROM _giq_history_merge.run WHERE id=1)
      THEN 'ready' ELSE 'blocked' END;")"
  [ "$identity" = ready ] || die "candidate identity, normalized-v2 lineage, phase, or untouched canonical-merge boundary is not ready"
}

status() {
  database="$(scalar "SELECT current_database();")"
  phase=absent
  stage_status=absent
  apply_status=absent

  if [ "$(scalar "SELECT to_regclass('_giq_history_merge.run') IS NOT NULL;")" = t ]; then
    phase="$(scalar "SELECT COALESCE((SELECT phase FROM _giq_history_merge.run WHERE id=1), 'partial');")"
  fi
  if [ "$(scalar "SELECT to_regclass('_giq_history_merge.clean_partition_control') IS NOT NULL;")" = t ]; then
    stage_status="$(scalar "SELECT COALESCE((SELECT status FROM _giq_history_merge.clean_partition_control WHERE id=1), 'partial');")"
  fi
  if [ "$(scalar "SELECT to_regclass('_giq_history_merge.clean_partition_apply_manifest') IS NOT NULL;")" = t ]; then
    apply_status="$(scalar "SELECT COALESCE((SELECT status FROM _giq_history_merge.clean_partition_apply_manifest WHERE id=1), 'partial');")"
  fi

  jq -cn \
    --arg database "$database" \
    --arg phase "$phase" \
    --arg stage "$stage_status" \
    --arg apply "$apply_status" \
    '{database:$database,phase:$phase,stage:$stage,apply:$apply}'
}

stage() {
  assert_candidate_identity
  if [ "$(scalar "SELECT to_regclass('_giq_history_merge.clean_partition_control') IS NOT NULL;")" = t ]; then
    [ "$(scalar "SELECT status FROM _giq_history_merge.clean_partition_control WHERE id=1;")" = ready ] || \
      die "clean-partition stage is partial; clone a fresh candidate"
    printf 'CLEAN_PARTITION_STAGE_ALREADY_READY database=%s\n' "$CANDIDATE_DATABASE"
    return
  fi

  if [ "$(scalar "SELECT to_regclass('_giq_history_stage.nonpedigree_dog_identity_resolution') IS NOT NULL;")" != t ]; then
    psql_candidate --file="$SQL_ROOT/stage-nonpedigree-saturation.sql"
  fi
  psql_candidate --file="$SQL_ROOT/stage-clean-partition.sql"
  printf 'CLEAN_PARTITION_STAGE_READY database=%s\n' "$CANDIDATE_DATABASE"
}

apply() {
  assert_candidate_identity
  [ "${CLEAN_PARTITION_CONFIRMATION:-}" = "$CONFIRMATION" ] || \
    die "CLEAN_PARTITION_CONFIRMATION must exactly approve the reviewed candidate-only insert"
  [ "$(scalar "SELECT to_regclass('_giq_history_merge.clean_partition_control') IS NOT NULL;")" = t ] || \
    die "clean-partition stage is absent"
  if [ "$(scalar "SELECT to_regclass('_giq_history_merge.clean_partition_apply_manifest') IS NOT NULL;")" = t ]; then
    [ "$(scalar "SELECT status FROM _giq_history_merge.clean_partition_apply_manifest WHERE id=1;")" = applied ] || \
      die "clean-partition apply evidence is partial; do not retry this candidate"
    printf 'CLEAN_PARTITION_ALREADY_APPLIED database=%s\n' "$CANDIDATE_DATABASE"
    return
  fi
  psql_candidate --set=clean_partition_confirmation="$CONFIRMATION" \
    --file="$SQL_ROOT/merge-clean-partition.sql"
  printf 'CLEAN_PARTITION_APPLIED database=%s\n' "$CANDIDATE_DATABASE"
}

case "$MODE" in
  stage) stage ;;
  apply) apply ;;
  status) status ;;
esac
