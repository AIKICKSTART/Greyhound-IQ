import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const sqlPath = join(here, 'sql', 'stage-duplicate-quarantine-proof-resolution.sql');
const exportRoot = join(
  root,
  '.backfill',
  'exports',
  'thedogs-normalized-v1-99279ed8105e70ff',
);
const manifestPath = join(exportRoot, 'manifest.json');
const sql = readFileSync(sqlPath, 'utf8');
const manifestBytes = readFileSync(manifestPath);
const manifest = JSON.parse(manifestBytes);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function readDataset(dataset) {
  const rows = [];
  for (const partition of manifest.partitions) {
    const output = partition.outputs.find((candidate) => candidate.dataset === dataset);
    assert.ok(output, `${partition.directory} is missing ${dataset}`);
    const path = join(exportRoot, partition.directory, output.file);
    const bytes = readFileSync(path);
    assert.equal(sha256(bytes), output.sha256, `${output.file} SHA-256 drifted`);
    const text = bytes.toString('utf8').trim();
    if (text) rows.push(...text.split(/\r?\n/u).map((line) => JSON.parse(line)));
  }
  return rows;
}

const duplicates = readDataset('duplicates');
const quarantine = readDataset('quarantine');

test('v2 derived views replace v1 columns transactionally and bind full source paths', () => {
  const dropResolution = sql.indexOf(
    'DROP VIEW IF EXISTS _giq_history_stage.duplicate_quarantine_proof_resolution;',
  );
  const dropCanonical = sql.indexOf(
    'DROP VIEW IF EXISTS _giq_history_stage.duplicate_quarantine_canonical_entity;',
  );
  const dropCatalog = sql.indexOf(
    'DROP VIEW IF EXISTS _giq_history_stage.duplicate_quarantine_inbound_reference_catalog;',
  );
  const createCatalog = sql.indexOf(
    'CREATE VIEW _giq_history_stage.duplicate_quarantine_inbound_reference_catalog AS',
  );
  assert.ok(
    dropResolution >= 0 &&
      dropResolution < dropCanonical &&
      dropCanonical < dropCatalog &&
      dropCatalog < createCatalog,
  );
  assert.doesNotMatch(sql, /DROP VIEW[^;]*CASCADE/iu);
  assert.match(
    sql,
    /evidence\.partition_dir \|\| '\/' \|\| evidence\.shard_file=issue\.source_file/u,
  );
  assert.doesNotMatch(sql, /AND evidence\.shard_file=issue\.source_file/u);
});

const requiredProofFlags = [
  'identityAuditedV2Source',
  'sourceBindingProven',
  'wholeDatabaseSearchProven',
  'exactAuthoritativeIdentityProven',
  'duplicateSourceRowsSameIdentityProven',
  'canonicalTargetExists',
  'verifiedFieldInventoryProven',
  'existingVerifiedDataPreserved',
  'sourceHistoryPreserved',
  'identifiersPreserved',
  'relationshipsPreserved',
  'exhaustiveReferenceInventoryProven',
  'unvalidatedReferenceConstraintsProven',
  'referenceConservationProven',
  'relationshipIntegrityVerified',
  'noDataLossVerified',
  'auditLedgerRecorded',
];

function resolutionAllowed(proof) {
  return (
    requiredProofFlags.every((flag) => proof[flag] === true) &&
    proof.similarityOnlyEvidence === false &&
    (proof.resolutionKind !== 'duplicate-entity-merge' || proof.duplicateTargetExists === true)
  );
}

test('the immutable v1 inventory is exact and remains fully blocked', () => {
  assert.equal(sha256(manifestBytes), readFileSync(`${manifestPath.slice(0, -5)}.sha256`, 'utf8').trim());
  assert.equal(manifest.status, 'blocked');
  assert.equal(manifest.transformVersion, 'thedogs-normalized-harvest/v1');
  assert.equal(manifest.datasets.duplicates.rowCount, 1_940);
  assert.equal(manifest.datasets.quarantine.rowCount, 82);
  assert.equal(duplicates.length, 1_940);
  assert.equal(quarantine.length, 82);
  assert.equal(new Set(duplicates.map((row) => row.naturalKey)).size, 1_939);

  assert.ok(
    duplicates.every(
      (row) =>
        row.issueType === 'runner-natural-key' &&
        row.selection === 'completeness_then_latest_ordinal' &&
        row.selectedDogProviderId === undefined &&
        row.droppedDogProviderId === undefined &&
        row.selectedDogName === undefined &&
        row.droppedDogName === undefined,
    ),
  );
  assert.deepEqual(
    Object.fromEntries(
      [...new Set(quarantine.map((row) => `${row.issueType}:${row.reason}`))]
        .sort()
        .map((key) => [key, quarantine.filter((row) => `${row.issueType}:${row.reason}` === key).length]),
    ),
    {
      'race-row:missing_race_distance': 40,
      'runner-row:missing_dog_provider_identity': 42,
    },
  );

  const proofFields = new Set([
    'authoritativeIdentityProven',
    'wholeDatabaseSearchManifest',
    'verifiedFieldInventory',
    'referenceInventory',
    'auditEventSha256',
  ]);
  assert.ok(
    [...duplicates, ...quarantine].every(
      (row) => !Object.keys(row).some((key) => proofFields.has(key)),
    ),
  );
  assert.equal([...duplicates, ...quarantine].filter(resolutionAllowed).length, 0);
  assert.equal(duplicates.length + quarantine.length, 2_022);
});

test('every proof prerequisite is independently fail-closed', () => {
  const complete = Object.fromEntries(requiredProofFlags.map((flag) => [flag, true]));
  Object.assign(complete, {
    similarityOnlyEvidence: false,
    resolutionKind: 'duplicate-entity-merge',
    duplicateTargetExists: true,
  });
  assert.equal(resolutionAllowed(complete), true);

  for (const flag of requiredProofFlags) {
    assert.equal(resolutionAllowed({ ...complete, [flag]: false }), false, flag);
  }
  assert.equal(resolutionAllowed({ ...complete, similarityOnlyEvidence: true }), false);
  assert.equal(resolutionAllowed({ ...complete, duplicateTargetExists: false }), false);
  assert.equal(
    resolutionAllowed({
      ...complete,
      sourceRowComparisonClass: 'identity-conflict',
      duplicateSourceRowsSameIdentityProven: false,
    }),
    false,
  );
  assert.equal(
    resolutionAllowed({
      ...complete,
      resolutionKind: 'existing-record-repair',
      duplicateTargetExists: false,
    }),
    true,
  );
});

test('SQL records proof only and cannot create, mutate, merge, or delete public data', () => {
  assert.doesNotMatch(sql, /\b(?:insert\s+into|update|delete\s+from)\s+public\./iu);
  assert.doesNotMatch(sql, /\b(?:create|insert)[_ ]entity[_ ]allowed\s+(?:AS\s+)?true\b/iu);
  assert.match(sql, /create_entity_allowed boolean NOT NULL CHECK\(NOT create_entity_allowed\)/u);
  assert.match(sql, /similarity_only_match_allowed boolean NOT NULL CHECK\(NOT similarity_only_match_allowed\)/u);
  assert.match(sql, /blocked-similarity-is-not-identity/u);
  assert.match(sql, /identity_proof_kind<>'none'/u);
  assert.match(sql, /canonical_target_exists/u);
  assert.match(sql, /canonical_entity_type IN \('Race','Runner','SourceArtifact'\)/u);
  assert.match(sql, /duplicate_quarantine_source_evidence_manifest/u);
  assert.match(sql, /'source-artifact:' \|\| \(q\.payload->>'sourceSha256'\)/u);
  assert.match(sql, /\('source-file','unverified_profile_identity'\)/u);
});

test('SQL binds every issue and proof to the exact source manifest and cutoff', () => {
  assert.match(sql, /normalized_manifest_sha256/u);
  assert.match(sql, /source_history_cutoff/u);
  assert.match(sql, /source_payload_sha256/u);
  assert.match(sql, /export_dataset_manifest/u);
  assert.match(sql, /expected_rows/u);
  assert.match(sql, /expected_bytes/u);
  assert.match(sql, /expected_sha256/u);
  assert.match(sql, /FULL JOIN _giq_history_stage\.duplicate_quarantine_issue/u);
  assert.match(sql, /does not exactly reconcile to source rows/u);
  assert.match(sql, /thedogs-normalized-harvest\/v2/u);
  assert.match(sql, /blocked-non-final-identity-audited-source-required/u);

  const blockerStart = sql.indexOf('), blockers AS (');
  const blockerEnd = sql.indexOf(
    ')\nINSERT INTO _giq_history_merge.duplicate_quarantine_proof_manifest',
    blockerStart,
  );
  assert.ok(blockerStart >= 0 && blockerEnd > blockerStart);
  const blockerKeys = [
    ...sql.slice(blockerStart, blockerEnd).matchAll(/^\s{4}'([^']+)',/gmu),
  ].map((match) => match[1]);
  assert.equal(blockerKeys.length, 19);
  assert.equal(new Set(blockerKeys).size, 19);
});

test('SQL requires whole-database search, preservation, reference conservation, and immutable audit', () => {
  for (const token of [
    'searchedTables',
    'searchedExternalIds',
    'searchedNames',
    'searchedDates',
    'searchedParentRelationships',
    'searchedStableNaturalKeys',
    'candidateIds',
    'source_row_comparison_class',
    'source_rows_same_real_entity_proven',
    'all_source_fields_compared',
    'selected_source_row_sha256',
    'dropped_source_row_sha256',
    'selected_dog_provider_id',
    'dropped_dog_provider_id',
    'conflicting_dog_identity',
    'blocked-runner-identity-conflict-authoritative-race-result-retrieval-required',
    'blocked-selected-dropped-raw-row-identity-and-all-field-comparison-required',
    'unique_verified_fields_merged',
    'existing_verified_data_preserved',
    'source_history_preserved',
    'identifiers_preserved',
    'relationships_preserved',
    'exhaustive_inbound_reference_inventory',
    'redirection_target_entity_type',
    'redirection_target_entity_id',
    'orphan_references_after',
    'no_orphan_references_proven',
    'relationship_integrity_verified',
    'no_data_loss_verified',
    'audit_ledger_recorded',
    'duplicate_quarantine_source_evidence',
    'immutable_source_evidence_proven',
    'preliminary_source_identity_candidate',
    'jurisdiction_review_proven',
    'retrieval_path_available',
    'natural_key_target_consistent',
    'natural_key_target',
    'blocked-unknown-or-conflicting-source-identity',
    'blocked-unknown-jurisdiction-review-required',
    'blocked-authoritative-retrieval-path-unavailable',
    'blocked-repeated-natural-key-target-inconsistent',
  ]) {
    assert.match(sql, new RegExp(token, 'u'), token);
  }
  assert.match(
    sql,
    /canonical_references_after=canonical_references_before\+duplicate_references_before/u,
  );
  assert.match(sql, /duplicate_references_after=0/u);
  assert.match(sql, /constraint_row\.convalidated AS constraint_validated/u);
  assert.doesNotMatch(sql, /constraint_row\.contype='f' AND constraint_row\.convalidated/u);
  assert.match(sql, /unvalidated_reference_constraints/u);
  assert.match(sql, /proved_unvalidated_reference_constraints/u);
  assert.match(sql, /conserved_unvalidated_reference_constraints/u);
  assert.match(sql, /unvalidated_reference_constraints_proven/u);
  assert.doesNotMatch(sql, /unvalidated_reference_constraints,0\)=0\s+AS exhaustive_reference_inventory_proven/u);
  assert.match(sql, /blocked-unvalidated-inbound-foreign-key-proof-and-conservation-required/u);
  assert.match(sql, /unvalidatedInboundForeignKeyProofGaps/u);
  assert.match(sql, /BEFORE UPDATE OR DELETE/u);
  assert.match(sql, /append-only/u);
  assert.match(sql, /REVOKE ALL ON _giq_history_merge\.duplicate_quarantine_resolution_audit FROM PUBLIC/u);
  assert.match(sql, /REVOKE ALL ON FUNCTION .* FROM PUBLIC/u);
  assert.match(sql, /count\(DISTINCT proof\.canonical_entity_id\)/u);
  assert.match(sql, /queue\.retrieval_status='unavailable'/u);
  assert.match(sql, /evidence\.classification IN \('potential-exact-same-identity','potential-complementary-same-identity'\)/u);
});

test('current inventory report is explicit about what authoritative evidence is missing', () => {
  console.log(
    JSON.stringify({
      source: {
        transformVersion: manifest.transformVersion,
        manifestSha256: sha256(manifestBytes),
        sourceCutoff: manifest.source.sourceCutoff,
        finalEligible: false,
      },
      current: {
        duplicateRows: duplicates.length,
        duplicateNaturalKeys: new Set(duplicates.map((row) => row.naturalKey)).size,
        duplicateExactProofs: 0,
        duplicateComplementarySameIdentityProofs: 0,
        duplicateIdentityConflictProofs: 0,
        duplicateUnclassifiedRows: duplicates.length,
        quarantineRows: quarantine.length,
        missingDogIdentityRows: quarantine.filter(
          (row) => row.reason === 'missing_dog_provider_identity',
        ).length,
        missingRaceDistanceRows: quarantine.filter(
          (row) => row.reason === 'missing_race_distance',
        ).length,
        resolvableRows: 0,
        blockedRows: duplicates.length + quarantine.length,
      },
      requiredLater: [
        'identity-audited-v2-export',
        'whole-database-search-manifest',
        'authoritative-exact-identity-artifact',
        'selected-and-dropped-raw-runner-dog-identity-and-all-field-comparison',
        'authoritative-race-result-retrieval-for-any-runner-identity-conflict',
        'verified-field-and-provenance-preservation',
        'exhaustive-inbound-reference-redirection-and-conservation',
        'relationship-integrity-and-no-data-loss',
        'append-only-resolution-audit',
      ],
    }),
  );
});
