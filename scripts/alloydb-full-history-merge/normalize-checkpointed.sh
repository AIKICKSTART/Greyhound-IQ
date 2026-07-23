#!/bin/sh
set -eu

umask 077

readonly CANDIDATE_DATABASE="${CANDIDATE_DATABASE:-giq_production_candidate_20260716_r1}"
readonly SQL_ROOT="${NORMALIZE_SQL_ROOT:-/usr/local/share/giq-full-history-merge/sql}"
readonly NORMALIZE_SQL="$SQL_ROOT/normalize-stage.sql"
readonly PSQL_BIN="${PSQL_BIN:-psql}"
readonly DATA_PATH="${NORMALIZE_DATA_PATH:-}"
readonly MIN_FREE_GB="${NORMALIZE_MIN_FREE_GB:-100}"
readonly STAGES="
1-core-identities
2-meetings
3-races
4-runners
5-results
6-profile-resolution
7-profile-materialization
8-form-entries
9-media
10-pedigree
11-archives-and-accounting
"

die() {
  printf 'OPERATOR_ATTENTION: %s\n' "$*" >&2
  exit 1
}

psql_candidate() {
  PGDATABASE="$CANDIDATE_DATABASE" "$PSQL_BIN" --no-psqlrc --set=ON_ERROR_STOP=1 "$@"
}

scalar() {
  psql_candidate --tuples-only --no-align --quiet --command="$1" | tr -d '\r\n'
}

assert_disk_floor() {
  [ -n "$DATA_PATH" ] || return 0
  [ -d "$DATA_PATH" ] || die "normalization data path is absent: $DATA_PATH"
  case "$MIN_FREE_GB" in ''|*[!0-9]*) die "NORMALIZE_MIN_FREE_GB must be an integer" ;; esac
  available_kb="$(df -Pk "$DATA_PATH" | awk 'NR==2 {print $4}')"
  [ -n "$available_kb" ] || die "could not measure free space for $DATA_PATH"
  minimum_kb=$((MIN_FREE_GB * 1024 * 1024))
  [ "$available_kb" -ge "$minimum_kb" ] || \
    die "free space fell below the ${MIN_FREE_GB}GB normalization safety floor"
}

[ -r "$NORMALIZE_SQL" ] || die "normalization SQL is absent: $NORMALIZE_SQL"
[ "$(scalar 'SELECT current_database();')" = "$CANDIDATE_DATABASE" ] || \
  die "normalization database identity mismatch"

phase="$(scalar 'SELECT phase FROM _giq_history_merge.run WHERE id=1;')"
case "$phase" in
  normalized)
    printf 'NORMALIZATION_ALREADY_VERIFIED database=%s\n' "$CANDIDATE_DATABASE"
    exit 0
    ;;
  galtd_staged) ;;
  *) die "normalization requires galtd_staged, observed $phase" ;;
esac

psql_candidate --quiet <<'SQL'
CREATE TABLE IF NOT EXISTS _giq_history_merge.normalization_checkpoint (
  stage_ordinal integer PRIMARY KEY,
  stage_name text NOT NULL UNIQUE,
  sql_sha256 text NOT NULL CHECK (sql_sha256 ~ '^[0-9a-f]{64}$'),
  completed_at timestamptz NOT NULL,
  metrics jsonb NOT NULL
);
ALTER TABLE _giq_history_merge.normalization_checkpoint
  DROP CONSTRAINT IF EXISTS normalization_checkpoint_stage_ordinal_check;
ALTER TABLE _giq_history_merge.normalization_checkpoint
  ADD CONSTRAINT normalization_checkpoint_stage_ordinal_check
  CHECK (stage_ordinal BETWEEN 1 AND 11);
REVOKE ALL ON _giq_history_merge.normalization_checkpoint FROM PUBLIC;
SQL

stage_dir="$(mktemp -d)"
trap 'rm -rf "$stage_dir"' 0 HUP INT TERM

awk -v dir="$stage_dir" '
  /^-- checkpoint-stage: / {
    stage=$3
    sub(/\r$/, "", stage)
    output=dir "/" stage ".sql"
    next
  }
  output != "" { print > output }
' "$NORMALIZE_SQL"

for stage_spec in $STAGES; do
  stage_ordinal="${stage_spec%%-*}"
  stage_name="${stage_spec#*-}"
  stage_file="$stage_dir/$stage_spec.sql"
  [ -s "$stage_file" ] || die "normalization stage is missing or empty: $stage_spec"
  stage_sha256="$(sha256sum "$stage_file" | awk '{print $1}')"
  checkpoint="$(scalar "SELECT stage_name || '|' || sql_sha256 FROM _giq_history_merge.normalization_checkpoint WHERE stage_ordinal=$stage_ordinal;")"
  if [ -n "$checkpoint" ]; then
    [ "$checkpoint" = "$stage_name|$stage_sha256" ] || \
      die "checkpoint hash mismatch for stage $stage_spec; use a fresh candidate"
    printf 'NORMALIZATION_STAGE_SKIPPED stage=%s reason=verified-checkpoint sha256=%s\n' \
      "$stage_spec" "$stage_sha256"
    continue
  fi

  expected_completed=$((stage_ordinal - 1))
  completed="$(scalar 'SELECT count(*) FROM _giq_history_merge.normalization_checkpoint;')"
  [ "$completed" -eq "$expected_completed" ] || \
    die "normalization checkpoint sequence is incomplete before stage $stage_spec"
  assert_disk_floor

  run_file="$stage_dir/run-$stage_spec.sql"
  stage_file_psql="$stage_file"
  if command -v cygpath >/dev/null 2>&1; then
    stage_file_psql="$(cygpath -m "$stage_file")"
  fi
  cat >"$run_file" <<SQL
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL synchronous_commit = on;
SET LOCAL statement_timeout = 0;
SELECT pg_advisory_xact_lock(hashtext('giq-normalization-checkpoint'));
\i '$stage_file_psql'
INSERT INTO _giq_history_merge.normalization_checkpoint
  (stage_ordinal,stage_name,sql_sha256,completed_at,metrics)
VALUES
  (:'checkpoint_stage_ordinal'::integer,:'checkpoint_stage_name',:'checkpoint_stage_sha256',
   clock_timestamp(),jsonb_build_object('databaseBytes',pg_database_size(current_database())));
COMMIT;
SQL

  printf 'NORMALIZATION_STAGE_START stage=%s sha256=%s\n' "$stage_spec" "$stage_sha256"
  psql_candidate \
    --set=checkpointed_runner=1 \
    --set=checkpoint_stage_ordinal="$stage_ordinal" \
    --set=checkpoint_stage_name="$stage_name" \
    --set=checkpoint_stage_sha256="$stage_sha256" \
    --file="$run_file"
  printf 'NORMALIZATION_STAGE_COMPLETE stage=%s sha256=%s\n' "$stage_spec" "$stage_sha256"
done

[ "$(scalar 'SELECT phase FROM _giq_history_merge.run WHERE id=1;')" = normalized ] || \
  die "all normalization checkpoints completed without the normalized phase"

psql_candidate --tuples-only --no-align --quiet --command="
SELECT jsonb_build_object(
  'event','CANDIDATE_NORMALIZATION_CHECKPOINTS_VERIFIED',
  'database',current_database(),
  'completedStages',count(*),
  'lastCompletedAt',max(completed_at)
)
FROM _giq_history_merge.normalization_checkpoint;"
