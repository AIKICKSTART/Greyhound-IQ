#!/bin/bash
set -euo pipefail

umask 077

readonly EXPECTED_HOST="127.0.0.1"
readonly EXPECTED_PORT="5432"
readonly LOCAL_APP_DATABASE="greyhoundiq"
readonly DISPOSABLE_DATABASE="greyhoundiq_normalized_restore_verify"
readonly WORK_DIR="/tmp/giq-normalized-local-copy"
readonly RESTORE_DIR="$WORK_DIR/restore"
readonly SCRIPT_DIR="/usr/local/share/giq-normalized-local-copy"
readonly MODE="${LOCAL_COPY_MODE:-verify}"
readonly ARCHIVE_PATH="${ARCHIVE_PATH:-/input/greyhoundiq-normalized-public-data-v1.tar.gz}"
readonly REPORT_DIR="${REPORT_DIR:-/output}"
readonly SENSITIVE_PATTERN='([?&](x-goog-signature|x-goog-credential|x-goog-security-token|signature|token|access_token|key)=|postgres(ql)?://|password["= :]+|authorization["= :]+bearer|://[^/@[:space:]]+:[^/@[:space:]]+@)'

created_disposable=0

cleanup() {
  if [[ "$created_disposable" == 1 ]]; then
    PGHOST="$EXPECTED_HOST" PGPORT="$EXPECTED_PORT" PGDATABASE=postgres \
      PGUSER="${LOCAL_DATABASE_USER:-postgres}" PGPASSWORD="${LOCAL_DATABASE_PASSWORD:-}" \
      dropdb --if-exists "$DISPOSABLE_DATABASE" >/dev/null 2>&1 || true
  fi
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT HUP INT TERM

die() {
  printf 'OPERATOR_ATTENTION: %s\n' "$*" >&2
  exit 1
}

scan_compressed_file() {
  local file="$1"
  # A draining matcher is required under pipefail; grep -q can make gzip exit
  # with SIGPIPE and hide a positive match.
  if gzip -dc "$file" | grep -Ei "$SENSITIVE_PATTERN" >/dev/null; then
    die "credential or signed-URL pattern detected in $(basename "$file")"
  fi
}

scan_plain_file() {
  local file="$1"
  if grep -Ei "$SENSITIVE_PATTERN" "$file" >/dev/null; then
    die "credential or signed-URL pattern detected in $(basename "$file")"
  fi
}

case "$MODE" in
  verify|apply) ;;
  *) die "LOCAL_COPY_MODE must be verify or apply" ;;
esac

[[ -f "$ARCHIVE_PATH" ]] || die "archive is missing"
resolved_archive="$(readlink -f "$ARCHIVE_PATH")"
[[ "$resolved_archive" == /input/* ]] || die "ARCHIVE_PATH must resolve below /input"
[[ -f "$resolved_archive.sha256" ]] || die "archive SHA-256 sidecar is missing"
[[ -f "$resolved_archive.manifest.json" ]] || die "external manifest is missing"
[[ -f "$resolved_archive.manifest.sha256" ]] || die "external manifest SHA-256 sidecar is missing"
[[ -d "$REPORT_DIR" && -w "$REPORT_DIR" ]] || die "REPORT_DIR must be a mounted writable directory"

expected_archive_sha256="$(awk 'NR == 1 {print $1}' "$resolved_archive.sha256")"
observed_archive_sha256="$(sha256sum "$resolved_archive" | awk '{print $1}')"
[[ "$expected_archive_sha256" =~ ^[0-9a-f]{64}$ && "$observed_archive_sha256" == "$expected_archive_sha256" ]] || \
  die "archive SHA-256 mismatch"

expected_manifest_sha256="$(awk 'NR == 1 {print $1}' "$resolved_archive.manifest.sha256")"
observed_external_manifest_sha256="$(sha256sum "$resolved_archive.manifest.json" | awk '{print $1}')"
[[ "$expected_manifest_sha256" =~ ^[0-9a-f]{64}$ && "$observed_external_manifest_sha256" == "$expected_manifest_sha256" ]] || \
  die "external manifest SHA-256 mismatch"

while IFS= read -r entry; do
  case "$entry" in
    /*|../*|*/../*|*\\*) die "archive contains an unsafe path" ;;
  esac
done < <(tar -tzf "$resolved_archive")

rm -rf "$WORK_DIR"
mkdir -p "$RESTORE_DIR"
tar -xzf "$resolved_archive" -C "$RESTORE_DIR" --no-same-owner --no-same-permissions
if find "$RESTORE_DIR" -type l -print -quit | grep -q .; then
  die "archive contains a symbolic link"
fi

[[ -f "$RESTORE_DIR/manifest.json" && -f "$RESTORE_DIR/manifest.sha256" ]] || die "internal manifest is missing"
observed_internal_manifest_sha256="$(sha256sum "$RESTORE_DIR/manifest.json" | awk '{print $1}')"
[[ "$observed_internal_manifest_sha256" == "$expected_manifest_sha256" ]] || die "internal manifest SHA-256 mismatch"
[[ "$(awk 'NR == 1 {print $1}' "$RESTORE_DIR/manifest.sha256")" == "$expected_manifest_sha256" ]] || die "internal manifest sidecar mismatch"
cmp -s "$RESTORE_DIR/manifest.json" "$resolved_archive.manifest.json" || die "internal and external manifests differ"

jq -e '
  .artifactKind == "greyhoundiq-normalized-public-data"
  and .schemaVersion == 1
  and .status == "verified"
  and .privacy.publicRacingDataOnly == true
  and .privacy.privateTablesExported == false
  and .privacy.credentialsExported == false
  and .privacy.signedUrlsExported == false
  and .privacy.rawProviderPayloadsExported == false
  and .privacy.rawPedigreeArtifactsExported == false
  and .immutableSnapshot.path == "snapshot-proof.json"
  and .immutableSnapshot.proof.transactionIsolation == "repeatable read"
  and .immutableSnapshot.proof.transactionReadOnly == true
  and .immutableSnapshot.proof.timeZone == "UTC"
  and .immutableSnapshot.proof.dateStyle == "ISO, YMD"
  and .immutableSnapshot.proof.intervalStyle == "iso_8601"
  and .immutableSnapshot.proof.extraFloatDigits == 3
  and .candidateProof.checks.profile_form_partition.staged == 6218839
  and .candidateProof.checks.profile_form_partition.canonicalUrlRows == 5904337
  and .candidateProof.checks.profile_form_partition.dogUrlRows == 314502
  and .candidateProof.checks.profile_form_partition.temoraSluglessRows == 8
  and .reconciliation.trainerIdentityCoverage.unresolvedTrainers == 0
  and .reconciliation.trainerIdentityCoverage.nameOnlyMatchingAllowed == false
  and .reconciliation.profileFormSourceCoverage.canonicalSourceRows == 5904337
  and .reconciliation.profileFormSourceCoverage.canonicalUnresolvedRaceRows == 444857
  and .reconciliation.profileFormSourceCoverage.excludedDogUrlRows == 314502
  and .reconciliation.thedogsLocalIdentityCrosswalk.exactCandidateMatches == 198887
  and .reconciliation.thedogsLocalIdentityCrosswalk.candidateSyntheticEarBrands == 0
  and .unresolvedQuarantine.rows == 314502
  and ([.tables[] | select(.name == "DogProfileForm") | .rows][0] == 5904337)
  and (.supplementalFiles | length) == 1
  and .supplementalFiles[0].name == "TrainerIdentityCrosswalk"
  and .supplementalFiles[0].containsNames == false
  and .supplementalFiles[0].nameOnlyMatchingAllowed == false
' "$RESTORE_DIR/manifest.json" >/dev/null || die "manifest privacy/status contract failed"

contract_sha256="$(sha256sum "$RESTORE_DIR/contract.json" | awk '{print $1}')"
[[ "$contract_sha256" == "$(jq -r '.contract.sha256' "$RESTORE_DIR/manifest.json")" ]] || die "contract SHA-256 mismatch"
cmp -s "$RESTORE_DIR/contract.json" "$SCRIPT_DIR/contract.json" || die "archive contract differs from the reviewed runtime contract"
reconciliation_sha256="$(sha256sum "$RESTORE_DIR/reconciliation.json" | awk '{print $1}')"
[[ "$reconciliation_sha256" == "$(jq -r '.reconciliation.sha256' "$RESTORE_DIR/manifest.json")" ]] || die "reconciliation SHA-256 mismatch"
snapshot_proof_path="$RESTORE_DIR/$(jq -r '.immutableSnapshot.path' "$RESTORE_DIR/manifest.json")"
[[ -f "$snapshot_proof_path" ]] || die "immutable snapshot proof is missing"
[[ "$(sha256sum "$snapshot_proof_path" | awk '{print $1}')" == "$(jq -r '.immutableSnapshot.sha256' "$RESTORE_DIR/manifest.json")" ]] || die "immutable snapshot proof SHA-256 mismatch"
jq -e --slurpfile manifest "$RESTORE_DIR/manifest.json" '. == $manifest[0].immutableSnapshot.proof' \
  "$snapshot_proof_path" >/dev/null || die "embedded and file snapshot proofs differ"

mapfile -t contract_tables < <(jq -r '.tables[].name' "$RESTORE_DIR/contract.json" | sort)
mapfile -t manifest_tables < <(jq -r '.tables[].name' "$RESTORE_DIR/manifest.json" | sort)
[[ "${#contract_tables[@]}" -eq 16 && "${contract_tables[*]}" == "${manifest_tables[*]}" ]] || \
  die "manifest table allowlist is not the exact reviewed 16-table set"

for table in "${contract_tables[@]}"; do
  file="$RESTORE_DIR/data/${table}.copy.gz"
  [[ -f "$file" ]] || die "manifest data file is missing: $table"
  gzip -t "$file"
  observed_sha256="$(sha256sum "$file" | awk '{print $1}')"
  expected_sha256="$(jq -r --arg table "$table" '.tables[] | select(.name == $table) | .sha256' "$RESTORE_DIR/manifest.json")"
  [[ "$observed_sha256" == "$expected_sha256" ]] || die "$table SHA-256 mismatch"
  observed_bytes="$(wc -c < "$file" | tr -d '[:space:]')"
  expected_bytes="$(jq -r --arg table "$table" '.tables[] | select(.name == $table) | .bytes' "$RESTORE_DIR/manifest.json")"
  [[ "$observed_bytes" == "$expected_bytes" ]] || die "$table byte count mismatch"
  observed_rows="$(gzip -dc "$file" | wc -l | tr -d '[:space:]')"
  expected_rows="$(jq -r --arg table "$table" '.tables[] | select(.name == $table) | .rows' "$RESTORE_DIR/manifest.json")"
  [[ "$observed_rows" == "$expected_rows" ]] || die "$table row count mismatch"
  snapshot_rows="$(jq -r --arg table "$table" '.immutableSnapshot.proof.tableRows[$table]' "$RESTORE_DIR/manifest.json")"
  [[ "$snapshot_rows" == "$expected_rows" ]] || die "$table snapshot-bound row count mismatch"
done

trainer_crosswalk_path="$RESTORE_DIR/$(jq -r '.supplementalFiles[] | select(.name == "TrainerIdentityCrosswalk") | .path' "$RESTORE_DIR/manifest.json")"
[[ -f "$trainer_crosswalk_path" ]] || die "Trainer identity crosswalk is missing"
[[ "$(sha256sum "$trainer_crosswalk_path" | awk '{print $1}')" == "$(jq -r '.supplementalFiles[] | select(.name == "TrainerIdentityCrosswalk") | .sha256' "$RESTORE_DIR/manifest.json")" ]] || die "Trainer identity crosswalk SHA-256 mismatch"
[[ "$(wc -c < "$trainer_crosswalk_path" | tr -d '[:space:]')" == "$(jq -r '.supplementalFiles[] | select(.name == "TrainerIdentityCrosswalk") | .bytes' "$RESTORE_DIR/manifest.json")" ]] || die "Trainer identity crosswalk byte count mismatch"
[[ "$(gzip -dc "$trainer_crosswalk_path" | wc -l | tr -d '[:space:]')" == "$(jq -r '.supplementalFiles[] | select(.name == "TrainerIdentityCrosswalk") | .rows' "$RESTORE_DIR/manifest.json")" ]] || die "Trainer identity crosswalk row count mismatch"

quarantine_path="$RESTORE_DIR/$(jq -r '.unresolvedQuarantine.path' "$RESTORE_DIR/manifest.json")"
[[ -f "$quarantine_path" ]] || die "unresolved identity quarantine is missing"
[[ "$(sha256sum "$quarantine_path" | awk '{print $1}')" == "$(jq -r '.unresolvedQuarantine.sha256' "$RESTORE_DIR/manifest.json")" ]] || die "quarantine SHA-256 mismatch"
[[ "$(wc -c < "$quarantine_path" | tr -d '[:space:]')" == "$(jq -r '.unresolvedQuarantine.bytes' "$RESTORE_DIR/manifest.json")" ]] || die "quarantine byte count mismatch"
[[ "$(gzip -dc "$quarantine_path" | wc -l | tr -d '[:space:]')" == "$(jq -r '.unresolvedQuarantine.rows' "$RESTORE_DIR/manifest.json")" ]] || die "quarantine row count mismatch"

expected_data_files="$((${#contract_tables[@]} + 2))"
observed_data_files="$(find "$RESTORE_DIR/data" -maxdepth 1 -type f -name '*.copy.gz' | wc -l | tr -d '[:space:]')"
[[ "$observed_data_files" == "$expected_data_files" ]] || die "archive contains an unexpected data file"

for file in "$RESTORE_DIR"/data/*.copy.gz; do
  scan_compressed_file "$file"
done
while IFS= read -r -d '' metadata; do
  scan_plain_file "$metadata"
done < <(find "$RESTORE_DIR" -maxdepth 1 -type f -name '*.json' -print0)

export PGHOST="$EXPECTED_HOST"
export PGPORT="$EXPECTED_PORT"
export PGUSER="${LOCAL_DATABASE_USER:-postgres}"
export PGPASSWORD="${LOCAL_DATABASE_PASSWORD:-}"
export PGCONNECT_TIMEOUT="10"
export PGSSLMODE="disable"

psql_db() {
  local database="$1"
  shift
  PGDATABASE="$database" psql --no-psqlrc --set=ON_ERROR_STOP=1 "$@"
}

scalar() {
  local database="$1"
  local sql="$2"
  psql_db "$database" --quiet --tuples-only --no-align --command="$sql"
}

[[ "$(scalar postgres 'SELECT inet_server_addr()::text;')" == "$EXPECTED_HOST" ]] || die "PostgreSQL server is not literal loopback"
[[ "$(scalar "$LOCAL_APP_DATABASE" 'SELECT current_database();')" == "$LOCAL_APP_DATABASE" ]] || die "local application database identity mismatch"

for table in "${contract_tables[@]}"; do
  [[ "$(scalar "$LOCAL_APP_DATABASE" "SELECT to_regclass('public.\"${table}\"') IS NOT NULL;")" == "t" ]] || \
    die "local schema is missing required table: $table"
done

stage_and_apply() {
  local database="$1"
  local evidence_path="$2"
  local private_evidence="$WORK_DIR/private-preservation.json"
  local forced_failure_log="$WORK_DIR/forced-late-failure.log"
  local before_public_counts
  local after_public_counts
  local forced_late_rollback_proven=false
  PGOPTIONS='-c app.system=true -c app.current_role=system -c app.current_tier=system' \
    psql_db "$database" --quiet --file="$SCRIPT_DIR/portable-stage.sql"
  PGOPTIONS='-c app.system=true -c app.current_role=system -c app.current_tier=system' \
    psql_db "$database" --quiet --file="$SCRIPT_DIR/load-stage.sql"

  for table in "${contract_tables[@]}"; do
    observed_rows="$(scalar "$database" "SELECT count(*) FROM giq_portable.\"${table}\";")"
    expected_rows="$(jq -r --arg table "$table" '.tables[] | select(.name == $table) | .rows' "$RESTORE_DIR/manifest.json")"
    [[ "$observed_rows" == "$expected_rows" ]] || die "$table staging row count mismatch"
  done
  observed_trainer_crosswalk="$(scalar "$database" 'SELECT count(*) FROM giq_portable."TrainerIdentityCrosswalk";')"
  expected_trainer_crosswalk="$(jq -r '.supplementalFiles[] | select(.name == "TrainerIdentityCrosswalk") | .rows' "$RESTORE_DIR/manifest.json")"
  [[ "$observed_trainer_crosswalk" == "$expected_trainer_crosswalk" ]] || die "Trainer identity crosswalk staging row count mismatch"

  before_public_counts="$(for table in "${contract_tables[@]}"; do
    printf '%s=%s\n' "$table" "$(scalar "$database" "SELECT count(*) FROM public.\"${table}\";")"
  done)"
  if PGOPTIONS='-c app.system=true -c app.current_role=system -c app.current_tier=system' \
    psql_db "$database" --quiet --set=GIQ_FORCE_LATE_FAILURE=1 \
      --file="$SCRIPT_DIR/apply-local.sql" >/dev/null 2>"$forced_failure_log"; then
    die "forced late local-copy failure unexpectedly committed"
  fi
  grep -Fq 'forced late local-copy failure; transaction must roll back every mutation' \
    "$forced_failure_log" || die "local-copy apply failed before the forced late rollback hook"
  [[ "$(scalar "$database" "SELECT to_regnamespace('giq_portable') IS NOT NULL;")" == "t" ]] || \
    die "forced late failure did not roll back the portable staging-schema drop"
  for table in "${contract_tables[@]}"; do
    observed_rows="$(scalar "$database" "SELECT count(*) FROM giq_portable.\"${table}\";")"
    expected_rows="$(jq -r --arg table "$table" '.tables[] | select(.name == $table) | .rows' "$RESTORE_DIR/manifest.json")"
    [[ "$observed_rows" == "$expected_rows" ]] || die "forced late failure did not preserve $table staging rows"
  done
  observed_trainer_crosswalk="$(scalar "$database" 'SELECT count(*) FROM giq_portable."TrainerIdentityCrosswalk";')"
  [[ "$observed_trainer_crosswalk" == "$expected_trainer_crosswalk" ]] || \
    die "forced late failure did not preserve Trainer identity crosswalk staging rows"
  after_public_counts="$(for table in "${contract_tables[@]}"; do
    printf '%s=%s\n' "$table" "$(scalar "$database" "SELECT count(*) FROM public.\"${table}\";")"
  done)"
  [[ "$before_public_counts" == "$after_public_counts" ]] || \
    die "forced late failure did not restore the public table counts"
  forced_late_rollback_proven=true

  PGOPTIONS='-c app.system=true -c app.current_role=system -c app.current_tier=system' \
    psql_db "$database" --quiet --tuples-only --no-align --file="$SCRIPT_DIR/apply-local.sql" > "$private_evidence"
  jq -e '.status == "preserved"
    and (.tables | type == "array")
    and any(.tables[]; .table == "User")
    and any(.tables[]; .table == "Profile")
    and all(.tables[]; .rowsBefore == .rowsAfter and .sha256Before == .sha256After)
    and .atomicVerification.auditKind == "normalized-local-racing-atomic-verification"
    and .atomicVerification.blockerCount == 0
    and (.atomicVerification.checks | all(.failures == 0))
    and (.thedogsLocalIdentityMapping.syntheticLocalRowsBefore == 0
      or (.thedogsLocalIdentityMapping.syntheticLocalRowsBefore == 198887
        and .thedogsLocalIdentityMapping.exactPairRows == 198887
        and .thedogsLocalIdentityMapping.distinctCandidateRows == 198887
        and .thedogsLocalIdentityMapping.distinctProviderSourceIds == 198887
        and .thedogsLocalIdentityMapping.distinctSyntheticLocalRows == 198887))
    and (.residualLocalDogResolution.observedBefore == 0
      or (.residualLocalDogResolution.observedBefore == 44
        and .residualLocalDogResolution.resolved == 44
        and .residualLocalDogResolution.nameOnlyMatchingAllowed == false))
    and .trackAliasConsolidation.canonicalRowsAfter == 1' \
    "$private_evidence" >/dev/null || die "non-allowlisted table preservation proof failed"

  jq -n \
    --slurpfile private "$private_evidence" \
    --arg database "$database" \
    --arg mode "$MODE" \
    --argjson forcedLateRollbackProven "$forced_late_rollback_proven" \
    --arg archiveSha256 "$observed_archive_sha256" \
    --arg manifestSha256 "$observed_internal_manifest_sha256" \
    '{
      status: "verified",
      mode: $mode,
      database: $database,
      archiveSha256: $archiveSha256,
      manifestSha256: $manifestSha256,
      forcedLateRollback: {
        proven: $forcedLateRollbackProven,
        failureHookObserved: $forcedLateRollbackProven,
        portableStageRestored: $forcedLateRollbackProven,
        publicCountsRestored: $forcedLateRollbackProven
      },
      nonAllowlistedPreservation: $private[0],
      reconciliation: $private[0].atomicVerification,
      thedogsLocalIdentityMapping: $private[0].thedogsLocalIdentityMapping,
      residualLocalDogResolution: $private[0].residualLocalDogResolution,
      trackAliasConsolidation: $private[0].trackAliasConsolidation
    }' > "$evidence_path.tmp"
  mv "$evidence_path.tmp" "$evidence_path"
}

evidence_basename="$(basename "$resolved_archive").${MODE}-evidence.json"
evidence_path="$REPORT_DIR/$evidence_basename"

if [[ "$MODE" == "verify" ]]; then
  [[ "$(scalar postgres "SELECT count(*) FROM pg_database WHERE datname = '$DISPOSABLE_DATABASE';")" == "0" ]] || \
    die "disposable verification database already exists"
  PGDATABASE=postgres createdb --template=template0 "$DISPOSABLE_DATABASE"
  created_disposable=1
  pg_dump --dbname="$LOCAL_APP_DATABASE" --schema-only --no-owner --no-acl \
    | psql_db "$DISPOSABLE_DATABASE" --quiet
  stage_and_apply "$DISPOSABLE_DATABASE" "$evidence_path"
  printf 'LOCAL_DISPOSABLE_RESTORE_VERIFIED database=%s evidence=%s\n' "$DISPOSABLE_DATABASE" "$evidence_basename"
else
  [[ "${ALLOW_LOCAL_DATA_APPLY:-}" == "greyhoundiq-normalized-public-data" ]] || \
    die "set ALLOW_LOCAL_DATA_APPLY=greyhoundiq-normalized-public-data after stopping the local app"
  stage_and_apply "$LOCAL_APP_DATABASE" "$evidence_path"
  printf 'LOCAL_RACING_DATA_APPLY_VERIFIED database=%s evidence=%s\n' "$LOCAL_APP_DATABASE" "$evidence_basename"
fi
