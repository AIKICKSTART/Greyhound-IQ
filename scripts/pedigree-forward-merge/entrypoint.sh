#!/bin/sh
set -eu

umask 077

readonly EXPECTED_PRODUCTION_HOST="10.240.116.2"
readonly EXPECTED_PRODUCTION_DATABASE="giq_production_stage11_20260718_r2"
readonly EXPECTED_PRODUCTION_USER="postgres"
readonly APPLY_CONFIRMATION="APPLY-PEDIGREE-TARGET-BRIDGE-STAGE11-R2-20260721"
readonly INPUT_MANIFEST="/app/input-manifest.json"
readonly DATA_DIR="/app/data"

die() {
  printf 'OPERATOR_ATTENTION: %s\n' "$*" >&2
  exit 1
}

require_file() {
  [ -f "$1" ] || die "required immutable input is missing: $1"
}

verify_file() {
  file="$1"
  expected_bytes="$2"
  expected_sha="$3"
  require_file "$file"
  actual_bytes="$(wc -c < "$file" | tr -d ' ')"
  [ "$actual_bytes" = "$expected_bytes" ] || \
    die "input byte mismatch for $(basename "$file"): expected $expected_bytes, observed $actual_bytes"
  actual_sha="$(sha256sum "$file" | awk '{print $1}')"
  [ "$actual_sha" = "$expected_sha" ] || \
    die "input SHA-256 mismatch for $(basename "$file")"
}

mode="${PEDIGREE_MERGE_MODE:-verify}"
case "$mode" in
  verify)
    apply_mode=false
    ;;
  apply)
    [ "${PEDIGREE_MERGE_CONFIRM:-}" = "$APPLY_CONFIRMATION" ] || \
      die "apply requires the exact PEDIGREE_MERGE_CONFIRM value"
    apply_mode=true
    ;;
  *)
    die "PEDIGREE_MERGE_MODE must be verify or apply"
    ;;
esac

[ -n "${DEST_DATABASE_PASSWORD:-}" ] || die "DEST_DATABASE_PASSWORD is required"

if [ "${PEDIGREE_ALLOW_LOCALHOST:-0}" = "1" ]; then
  case "${PGHOST:-}" in
    127.0.0.1|localhost|host.docker.internal) ;;
    *) die "PEDIGREE_ALLOW_LOCALHOST permits only a literal loopback database host" ;;
  esac
  [ "$mode" = "verify" ] || die "local override is verification-only"
  [ -n "${PGDATABASE:-}" ] || die "PGDATABASE is required for local verification"
  [ -n "${PGUSER:-}" ] || die "PGUSER is required for local verification"
else
  export PGHOST="$EXPECTED_PRODUCTION_HOST"
  export PGPORT="5432"
  export PGDATABASE="$EXPECTED_PRODUCTION_DATABASE"
  export PGUSER="$EXPECTED_PRODUCTION_USER"
  export PGSSLMODE="require"
fi

export PGPASSWORD="$DEST_DATABASE_PASSWORD"
export PGCONNECT_TIMEOUT="30"

require_file "$INPUT_MANIFEST"

verify_file \
  "$DATA_DIR/$(jq -r '.galtd.report.file' "$INPUT_MANIFEST")" \
  "$(jq -r '.galtd.report.bytes' "$INPUT_MANIFEST")" \
  "$(jq -r '.galtd.report.sha256' "$INPUT_MANIFEST")"
verify_file \
  "$DATA_DIR/$(jq -r '.galtd.observations.file' "$INPUT_MANIFEST")" \
  "$(jq -r '.galtd.observations.bytes' "$INPUT_MANIFEST")" \
  "$(jq -r '.galtd.observations.sha256' "$INPUT_MANIFEST")"
verify_file \
  "$DATA_DIR/$(jq -r '.galtd.assertions.file' "$INPUT_MANIFEST")" \
  "$(jq -r '.galtd.assertions.bytes' "$INPUT_MANIFEST")" \
  "$(jq -r '.galtd.assertions.sha256' "$INPUT_MANIFEST")"
verify_file \
  "$DATA_DIR/$(jq -r '.thedogs.manifest.file' "$INPUT_MANIFEST")" \
  "$(jq -r '.thedogs.manifest.bytes' "$INPUT_MANIFEST")" \
  "$(jq -r '.thedogs.manifest.sha256' "$INPUT_MANIFEST")"

edge_inventory="$(mktemp)"
trap 'rm -f "$edge_inventory"' EXIT INT TERM
jq -r '.partitions[].outputs[] | select(.dataset == "pedigree_edges") | [.file, (.bytes|tostring), (.rowCount|tostring), .sha256] | @tsv' \
  "$DATA_DIR/thedogs-manifest.json" | sort > "$edge_inventory"

expected_shards="$(jq -r '.thedogs.pedigreeEdges.shards' "$INPUT_MANIFEST")"
observed_shards="$(wc -l < "$edge_inventory" | tr -d ' ')"
[ "$observed_shards" = "$expected_shards" ] || \
  die "TheDogs pedigree shard count mismatch: expected $expected_shards, observed $observed_shards"

observed_edge_bytes=0
observed_edge_rows=0
while IFS="$(printf '\t')" read -r filename expected_bytes expected_rows expected_sha; do
  verify_file "$DATA_DIR/thedogs-edges/$filename" "$expected_bytes" "$expected_sha"
  actual_rows="$(wc -l < "$DATA_DIR/thedogs-edges/$filename" | tr -d ' ')"
  [ "$actual_rows" = "$expected_rows" ] || \
    die "TheDogs row mismatch for $filename: expected $expected_rows, observed $actual_rows"
  observed_edge_bytes=$((observed_edge_bytes + expected_bytes))
  observed_edge_rows=$((observed_edge_rows + expected_rows))
done < "$edge_inventory"

[ "$observed_edge_bytes" = "$(jq -r '.thedogs.pedigreeEdges.bytes' "$INPUT_MANIFEST")" ] || \
  die "TheDogs pedigree byte total mismatch"
[ "$observed_edge_rows" = "$(jq -r '.thedogs.pedigreeEdges.rows' "$INPUT_MANIFEST")" ] || \
  die "TheDogs pedigree row total mismatch"

database_identity="$(psql --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align \
  --command='SELECT current_database();')"
[ "$database_identity" = "$PGDATABASE" ] || \
  die "database identity mismatch: expected $PGDATABASE, observed $database_identity"

printf 'PEDIGREE_FORWARD_MERGE mode=%s database=%s input=%s\n' \
  "$mode" "$PGDATABASE" "$(jq -r '.artifactSetId' "$INPUT_MANIFEST")"

psql --no-psqlrc --set=ON_ERROR_STOP=1 \
  --set=apply_mode="$apply_mode" \
  --file=/app/merge.sql

if [ "$apply_mode" = true ]; then
  printf 'PEDIGREE_FORWARD_MERGE_APPLIED database=%s\n' "$PGDATABASE"
else
  printf 'PEDIGREE_FORWARD_MERGE_VERIFIED_ROLLED_BACK database=%s\n' "$PGDATABASE"
fi
