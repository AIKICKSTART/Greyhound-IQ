#!/bin/bash
set -euo pipefail

umask 077
export TZ=UTC
export LC_ALL=C

readonly EXPECTED_HOST="10.240.116.2"
readonly EXPECTED_PORT="5432"
readonly EXPECTED_USER="postgres"
readonly EXPECTED_DATABASE="giq_production_candidate_20260716_r1"
readonly EXPECTED_HISTORY_DATABASE="giq_full_history_rehearsal_20260716_r2"
readonly WORK_DIR="/tmp/giq-normalized-local-copy"
readonly OUTPUT_DIR="${OUTPUT_DIR:-/output}"
readonly ARCHIVE_BASENAME="greyhoundiq-normalized-public-data-v1.tar.gz"
readonly SCRIPT_DIR="/usr/local/share/giq-normalized-local-copy"
readonly REQUIRED_PROOFS="trainer_source_identity thedogs_pedigree_partition race_media_partition jurisdiction_partition profile_form_partition protected_production_baseline galtd_conflict_resolution canonical_merge_partition"
readonly SENSITIVE_PATTERN='([?&](x-goog-signature|x-goog-credential|x-goog-security-token|signature|token|access_token|key)=|postgres(ql)?://|password["= :]+|authorization["= :]+bearer|://[^/@[:space:]]+:[^/@[:space:]]+@)'

die() {
  printf 'OPERATOR_ATTENTION: %s\n' "$*" >&2
  exit 1
}

[[ -n "${ADMIN_DATABASE_PASSWORD:-}" ]] || die "ADMIN_DATABASE_PASSWORD is required"
[[ -d "$OUTPUT_DIR" && -w "$OUTPUT_DIR" ]] || die "OUTPUT_DIR must be a mounted writable directory"

export PGHOST="$EXPECTED_HOST"
export PGPORT="$EXPECTED_PORT"
export PGUSER="$EXPECTED_USER"
export PGDATABASE="$EXPECTED_DATABASE"
export PGPASSWORD="$ADMIN_DATABASE_PASSWORD"
export PGSSLMODE="require"
export PGCONNECT_TIMEOUT="30"
export PGOPTIONS="-c default_transaction_read_only=on"

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT HUP INT TERM
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR/data"

psql_scalar() {
  psql --no-psqlrc --set=ON_ERROR_STOP=1 --quiet --tuples-only --no-align --command="$1"
}

scan_compressed_file() {
  local file="$1"
  # Do not use grep -q here: with pipefail, its early exit can SIGPIPE gzip and
  # turn a detected secret into a false-negative pipeline status.
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

[[ "$(psql_scalar 'SELECT current_database();')" == "$EXPECTED_DATABASE" ]] || die "candidate database identity mismatch"
[[ "$(psql_scalar 'SHOW default_transaction_read_only;')" == "on" ]] || die "candidate session is not read-only"

for table in $(jq -r '.tables[].name' "$SCRIPT_DIR/contract.json"); do
  [[ "$(psql_scalar "SELECT to_regclass('public.\"${table}\"') IS NOT NULL;")" == "t" ]] || \
    die "required candidate table is missing: $table"
done

[[ "$(psql_scalar "SELECT to_regclass('_giq_history_merge.run') IS NOT NULL;")" == "t" ]] || \
  die "candidate merge run marker is missing"
[[ "$(psql_scalar "SELECT to_regclass('_giq_history_merge.verification_check') IS NOT NULL;")" == "t" ]] || \
  die "candidate aggregate verification markers are missing"

psql --no-psqlrc --set=ON_ERROR_STOP=1 --quiet \
  --file="$SCRIPT_DIR/export-snapshot.sql"

jq -e '
  .database == "giq_production_candidate_20260716_r1"
  and .transactionIsolation == "repeatable read"
  and .transactionReadOnly == true
  and .timeZone == "UTC"
  and .dateStyle == "ISO, YMD"
  and .intervalStyle == "iso_8601"
  and .extraFloatDigits == 3
  and (.snapshot | type == "string" and length > 0)
  and (.candidateSnapshotSha256 | type == "string" and length == 64)
  and .candidateVerifiedAt != null
  and (.tableRows | keys | length) == 16
' "$WORK_DIR/snapshot-proof.json" >/dev/null || die "export outputs are not bound to one deterministic repeatable-read snapshot"

jq -e \
  --arg source "$EXPECTED_HISTORY_DATABASE" \
  '.run.phase == "verified"
   and .run.verified_at != null
   and .run.canonical_merged_at != null
   and .run.live_delta_applied_at != null
   and .run.source_history_database == $source' \
  "$WORK_DIR/candidate-proof.json" >/dev/null || die "candidate is not in the exact verified phase"

for proof in $REQUIRED_PROOFS; do
  jq -e --arg proof "$proof" '.checks[$proof].verifiedAt != null' \
    "$WORK_DIR/candidate-proof.json" >/dev/null || die "candidate proof is missing: $proof"
done

jq -e '
  .checks.trainer_source_identity.sourceDuplicateGroups == 82
  and .checks.trainer_source_identity.sourceDuplicateRows == 164
  and .checks.trainer_source_identity.canonicalProviderDuplicateGroups == 0
  and .checks.trainer_source_identity.ambiguousProviderRows == 0
  and .checks.thedogs_pedigree_partition.staged == 328069
  and .checks.thedogs_pedigree_partition.rejectedSelf == 16
  and .checks.thedogs_pedigree_partition.canonicalEligible
      + .checks.thedogs_pedigree_partition.quarantined == 328069
  and .checks.race_media_partition.staged == 538849
  and .checks.race_media_partition.replayStaged == 290771
  and .checks.race_media_partition.photoFinishStaged == 248078
  and .checks.race_media_partition.raceReplayStaged == 289718
  and .checks.race_media_partition.raceReplayUniqueProviderIds == 289707
  and .checks.race_media_partition.providerConflictRows == 22
  and .checks.race_media_partition.meetingPreviewRows == 900
  and .checks.race_media_partition.meetingPreviewUniqueIds == 304
  and .checks.race_media_partition.liveMeetingRows == 117
  and .checks.race_media_partition.liveMeetingUniqueIds == 11
  and .checks.race_media_partition.racePreviewRows == 36
  and .checks.race_media_partition.racePreviewUniqueIds == 36
  and .checks.race_media_partition.snapshotRaceVideos > 0
  and .checks.race_media_partition.snapshotRaceVideosPreserved == true
  and .checks.jurisdiction_partition.auStates == ["ACT","NSW","NT","QLD","SA","TAS","VIC","WA"]
  and .checks.jurisdiction_partition.nzTracks == 14
  and .checks.jurisdiction_partition.nzMeetings == 3968
  and .checks.jurisdiction_partition.nzRaces == 42339
  and .checks.jurisdiction_partition.actMeetings == 536
  and .checks.jurisdiction_partition.actRaces == 5681
  and .checks.jurisdiction_partition.demoMeetingsExcluded == 46
  and .checks.jurisdiction_partition.demoRacesExcluded == 136
  and .checks.jurisdiction_partition.demoRunnersExcluded == 1080
  and .checks.jurisdiction_partition.demoResultsExcluded == 0
  and .checks.profile_form_partition.staged == 6218839
  and .checks.profile_form_partition.canonicalUrlRows == 5904337
  and .checks.profile_form_partition.dogUrlRows == 314502
  and .checks.profile_form_partition.temoraSluglessRows == 8
  and .checks.profile_form_partition.canonicalDogUrlsWritten == 0
  and .checks.galtd_conflict_resolution.observations == 105374
  and .checks.galtd_conflict_resolution.assertions == 210734
  and .checks.galtd_conflict_resolution.conflictGroups == 5
  and .checks.galtd_conflict_resolution.conflictObservations == 18
  and .checks.galtd_conflict_resolution.arbitraryNameOnlyLinks == 0
  and .checks.galtd_conflict_resolution.allAssertionsPreserved == true
  and .checks.protected_production_baseline.snapshotRaceVideos
      == .checks.race_media_partition.snapshotRaceVideos
  and .checks.protected_production_baseline.nonNullOverwriteGuardInstalled == true
  and .checks.protected_production_baseline.protectedTablesUnchanged == true
  and .checks.canonical_merge_partition.candidateOnlyWrites == true
  and .checks.canonical_merge_partition.sourceAccessModeDeclared == "read-only inputs"
  and .checks.canonical_merge_partition.productionNonNullOverwrites == 0
  and .checks.canonical_merge_partition.snapshotRaceVideosChanged == 0
  and .checks.canonical_merge_partition.galtdAssertionsPreserved == 210734
' "$WORK_DIR/candidate-proof.json" >/dev/null || die "candidate aggregate proof metrics do not match the reviewed source baselines"

jq -e '.auditKind == "normalized-public-racing-read-only-reconciliation" and .blockerCount == 0' \
  "$WORK_DIR/reconciliation.json" >/dev/null || die "candidate reconciliation has blockers"

jq -e '
  .profileFormPartition.total >= 5904337
  and .profileFormPartition.canonicalRows == .profileFormPartition.total
  and .profileFormPartition.forbiddenDogOrProfileRows == 0
  and .profileFormPartition.otherShape == 0
  and .profileFormSourceCoverage.canonicalSourceRows == 5904337
  and .profileFormSourceCoverage.canonicalUnresolvedRaceRows == 444857
  and .profileFormSourceCoverage.excludedDogUrlRows == 314502
  and .profileFormSourceCoverage.canonicalDogUnresolvedRows == 0
  and .profileFormSourceCoverage.canonicalDuplicateIdentityRows == 0
  and .profileFormSourceCoverage.canonicalMissingFromPublic == 0
  and .profileFormSourceCoverage.canonicalUnresolvedMissingFromPublic == 0
  and .thedogsPedigreePartition.partitionSum == .thedogsPedigreePartition.staged
  and .trainerIdentityCoverage.unresolvedTrainers == 0
  and .trainerIdentityCoverage.candidateTrainers == .trainerIdentityCoverage.trainersWithExactIdentity
  and .trainerIdentityCoverage.nameOnlyMatchingAllowed == false
  and .thedogsLocalIdentityCrosswalk.localSyntheticIdentities == 198887
  and .thedogsLocalIdentityCrosswalk.distinctLocalDogIds == 198887
  and .thedogsLocalIdentityCrosswalk.distinctProviderSourceIds == 198887
  and .thedogsLocalIdentityCrosswalk.distinctCandidateDogIds == 198887
  and .thedogsLocalIdentityCrosswalk.exactCandidateMatches == 198887
  and .thedogsLocalIdentityCrosswalk.candidateSyntheticEarBrands == 0
  and ([.sourceNaturalKeyCoverage[].missingNaturalKeys] | all(. == 0))
  and .galtdConflictEvidence.conflictGroups == 5
  and .galtdConflictEvidence.conflictObservations == 18
  and ([.pedigreeProviderStatus[].provider]
      | contains(["galtd", "greyhound-recorder", "fasttrack", "thedogs"]))
  and ([.pedigreeProviderStatus[]
      | select(.provider == "greyhound-recorder" or .provider == "fasttrack")
      | .importRuns + .identities + .assertions + .ledgerRows]
      | all(. == 0))
' "$WORK_DIR/reconciliation.json" >/dev/null || die "historical partitions do not match the reviewed source inventory"

cp "$SCRIPT_DIR/contract.json" "$WORK_DIR/contract.json"

expected_trainer_crosswalk="$(jq -r '.trainerIdentityCoverage.crosswalkRows' "$WORK_DIR/reconciliation.json")"
observed_trainer_crosswalk="$(gzip -dc "$WORK_DIR/data/TrainerIdentityCrosswalk.copy.gz" | wc -l | tr -d '[:space:]')"
[[ "$observed_trainer_crosswalk" == "$expected_trainer_crosswalk" ]] || \
  die "Trainer identity crosswalk count does not match the reviewed exact-identity inventory"

expected_quarantine="$(jq -r '.checks.profile_form_partition.dogUrlRows' "$WORK_DIR/candidate-proof.json")"
observed_quarantine="$(gzip -dc "$WORK_DIR/data/unresolved-identities.copy.gz" | wc -l | tr -d '[:space:]')"
[[ "$observed_quarantine" == "$expected_quarantine" ]] || \
  die "unresolved identity quarantine count does not match the reviewed partition"

printf '[]\n' > "$WORK_DIR/files.json"
for table in $(jq -r '.tables[].name' "$WORK_DIR/contract.json"); do
  file="$WORK_DIR/data/${table}.copy.gz"
  [[ -f "$file" ]] || die "export did not create $table"
  gzip -t "$file"
  rows="$(gzip -dc "$file" | wc -l | tr -d '[:space:]')"
  minimum="$(jq -r --arg table "$table" '.minimumRows[$table] // 0' "$WORK_DIR/contract.json")"
  (( rows >= minimum )) || die "$table has $rows rows; reviewed minimum is $minimum"
  bytes="$(wc -c < "$file" | tr -d '[:space:]')"
  sha256="$(sha256sum "$file" | awk '{print $1}')"
  range="$(jq -c --arg table "$table" '[.dateRanges[] | select(.entity == $table)][0] // {entity: $table, min: null, max: null}' "$WORK_DIR/reconciliation.json")"
  providers="$(jq -c --arg table "$table" '[.providerCoverage[] | select(.entity == $table)]' "$WORK_DIR/reconciliation.json")"
  jq \
    --arg name "$table" \
    --arg path "data/${table}.copy.gz" \
    --arg sha256 "$sha256" \
    --argjson rows "$rows" \
    --argjson bytes "$bytes" \
    --argjson range "$range" \
    --argjson providers "$providers" \
    '. + [{name: $name, path: $path, rows: $rows, bytes: $bytes, sha256: $sha256, range: $range, providers: $providers}]' \
    "$WORK_DIR/files.json" > "$WORK_DIR/files.next.json"
  mv "$WORK_DIR/files.next.json" "$WORK_DIR/files.json"
done

quarantine_sha256="$(sha256sum "$WORK_DIR/data/unresolved-identities.copy.gz" | awk '{print $1}')"
quarantine_bytes="$(wc -c < "$WORK_DIR/data/unresolved-identities.copy.gz" | tr -d '[:space:]')"
trainer_crosswalk_sha256="$(sha256sum "$WORK_DIR/data/TrainerIdentityCrosswalk.copy.gz" | awk '{print $1}')"
trainer_crosswalk_bytes="$(wc -c < "$WORK_DIR/data/TrainerIdentityCrosswalk.copy.gz" | tr -d '[:space:]')"
contract_sha256="$(sha256sum "$WORK_DIR/contract.json" | awk '{print $1}')"
reconciliation_sha256="$(sha256sum "$WORK_DIR/reconciliation.json" | awk '{print $1}')"
snapshot_proof_sha256="$(sha256sum "$WORK_DIR/snapshot-proof.json" | awk '{print $1}')"

for file in "$WORK_DIR"/data/*.copy.gz; do
  scan_compressed_file "$file"
done

jq -n \
  --slurpfile contract "$WORK_DIR/contract.json" \
  --slurpfile proof "$WORK_DIR/candidate-proof.json" \
  --slurpfile reconciliation "$WORK_DIR/reconciliation.json" \
  --slurpfile snapshotProof "$WORK_DIR/snapshot-proof.json" \
  --slurpfile files "$WORK_DIR/files.json" \
  --arg contractSha256 "$contract_sha256" \
  --arg reconciliationSha256 "$reconciliation_sha256" \
  --arg snapshotProofSha256 "$snapshot_proof_sha256" \
  --arg quarantineSha256 "$quarantine_sha256" \
  --arg trainerCrosswalkSha256 "$trainer_crosswalk_sha256" \
  --argjson quarantineRows "$observed_quarantine" \
  --argjson quarantineBytes "$quarantine_bytes" \
  --argjson trainerCrosswalkRows "$observed_trainer_crosswalk" \
  --argjson trainerCrosswalkBytes "$trainer_crosswalk_bytes" \
  '{
    schemaVersion: 1,
    artifactKind: "greyhoundiq-normalized-public-data",
    status: "verified",
    source: {
      database: $proof[0].run.source_production_database,
      historyDatabase: $proof[0].run.source_history_database,
      candidateDatabase: "giq_production_candidate_20260716_r1",
      candidateVerifiedAt: $proof[0].run.verified_at,
      snapshotSha256: $proof[0].run.snapshot_sha256
    },
    contract: {path: "contract.json", sha256: $contractSha256},
    candidateProof: $proof[0],
    immutableSnapshot: {
      path: "snapshot-proof.json",
      sha256: $snapshotProofSha256,
      proof: $snapshotProof[0]
    },
    reconciliation: {
      path: "reconciliation.json",
      sha256: $reconciliationSha256,
      blockerCount: $reconciliation[0].blockerCount,
      stateCoverage: $reconciliation[0].stateCoverage,
      trainerIdentityCoverage: $reconciliation[0].trainerIdentityCoverage,
      thedogsLocalIdentityCrosswalk: $reconciliation[0].thedogsLocalIdentityCrosswalk,
      profileFormPartition: $reconciliation[0].profileFormPartition,
      profileFormSourceCoverage: $reconciliation[0].profileFormSourceCoverage,
      dogVerificationClasses: $reconciliation[0].dogVerificationClasses,
      thedogsPedigreePartition: $reconciliation[0].thedogsPedigreePartition,
      pedigreeProviderStatus: $reconciliation[0].pedigreeProviderStatus,
      galtdConflictEvidence: $reconciliation[0].galtdConflictEvidence,
      sourceNaturalKeyCoverage: $reconciliation[0].sourceNaturalKeyCoverage,
      raceVideoPartition: $reconciliation[0].raceVideoPartition,
      photoFinishPartition: $reconciliation[0].photoFinishPartition
    },
    privacy: {
      publicRacingDataOnly: true,
      privateTablesExported: false,
      credentialsExported: false,
      signedUrlsExported: false,
      rawProviderPayloadsExported: false,
      rawPedigreeArtifactsExported: false
    },
    tables: $files[0],
    supplementalFiles: [{
      name: "TrainerIdentityCrosswalk",
      path: "data/TrainerIdentityCrosswalk.copy.gz",
      rows: $trainerCrosswalkRows,
      bytes: $trainerCrosswalkBytes,
      sha256: $trainerCrosswalkSha256,
      identityKinds: ["r2-source-trainer-id", "thedogs-provider-id"],
      containsNames: false,
      nameOnlyMatchingAllowed: false
    }],
    unresolvedQuarantine: {
      path: "data/unresolved-identities.copy.gz",
      rows: $quarantineRows,
      bytes: $quarantineBytes,
      sha256: $quarantineSha256,
      importedIntoCanonicalTables: false
    }
  }' > "$WORK_DIR/manifest.json"

while IFS= read -r -d '' metadata; do
  scan_plain_file "$metadata"
done < <(find "$WORK_DIR" -maxdepth 1 -type f -name '*.json' -print0)

manifest_sha256="$(sha256sum "$WORK_DIR/manifest.json" | awk '{print $1}')"
printf '%s  manifest.json\n' "$manifest_sha256" > "$WORK_DIR/manifest.sha256"

archive_path="$OUTPUT_DIR/$ARCHIVE_BASENAME"
tar --sort=name --mtime='@0' --owner=0 --group=0 --numeric-owner \
  -C "$WORK_DIR" \
  --exclude='files.json' \
  -cf - . | gzip -n > "$archive_path"

archive_sha256="$(sha256sum "$archive_path" | awk '{print $1}')"
printf '%s  %s\n' "$archive_sha256" "$ARCHIVE_BASENAME" > "$archive_path.sha256"
cp "$WORK_DIR/manifest.json" "$archive_path.manifest.json"
printf '%s  %s.manifest.json\n' "$manifest_sha256" "$ARCHIVE_BASENAME" > "$archive_path.manifest.sha256"

printf 'NORMALIZED_PUBLIC_DATA_ARCHIVE_VERIFIED archive=%s sha256=%s manifest_sha256=%s\n' \
  "$ARCHIVE_BASENAME" "$archive_sha256" "$manifest_sha256"
