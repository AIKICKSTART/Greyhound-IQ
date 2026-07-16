import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const base = "scripts/alloydb-normalized-local-copy";
const contract = JSON.parse(readFileSync(`${base}/contract.json`, "utf8")) as {
  tables: Array<{ name: string }>;
  privateTablesNeverExported: string[];
  requiredStates: string[];
  rawPayloadColumnsOmitted: string[];
  unresolvedQuarantine: {
    expectedProfileFormPartition: Record<string, unknown>;
  };
  supplementalFiles: Array<{
    name: string;
    identityKinds: string[];
    containsNames: boolean;
    nameOnlyMatchingAllowed: boolean;
    missingIdentityHandling: string;
    localNoMatchHandling: string;
  }>;
  pedigreeExport: {
    providerUniverse: string[];
    statusHandling: string;
    absentProvidersCountedAsZero: boolean;
  };
  sourceResolutionBaselines: Record<string, unknown>;
  snapshotContract: {
    forcedLateRollbackProofRequired: boolean;
    archiveMetadataPrivacyScanRequired: boolean;
  };
};
const exportSql = readFileSync(`${base}/export-safe-jsonl.sql`, "utf8");
const reconcileSql = readFileSync(`${base}/reconcile-read-only.sql`, "utf8");
const applySql = readFileSync(`${base}/apply-local.sql`, "utf8");
const exportScript = readFileSync(`${base}/export.sh`, "utf8");
const snapshotSql = readFileSync(`${base}/export-snapshot.sql`, "utf8");
const restoreScript = readFileSync(`${base}/restore-local.sh`, "utf8");
const verifyLocalSql = readFileSync(`${base}/verify-local-read-only.sql`, "utf8");
const stageSql = readFileSync(`${base}/portable-stage.sql`, "utf8");
const loadSql = readFileSync(`${base}/load-stage.sql`, "utf8");
const prismaSchema = readFileSync("prisma/schema.prisma", "utf8");

const allowedTables = [
  "Track",
  "Trainer",
  "Dog",
  "Meeting",
  "Race",
  "RaceVideo",
  "Runner",
  "Result",
  "FormEntry",
  "DogProfileForm",
  "DogProfileArchive",
  "RaceDayArchive",
  "PedigreeImportRun",
  "DogSourceIdentity",
  "PedigreeAssertion",
  "PedigreeMergeLedger",
];
assert.deepEqual(
  contract.tables.map(({ name }) => name),
  allowedTables,
  "portable data must have one exact 16-table public allowlist",
);
assert.deepEqual(contract.requiredStates, [
  "ACT",
  "NSW",
  "NT",
  "QLD",
  "SA",
  "TAS",
  "VIC",
  "WA",
]);

for (const privateTable of [
  "User",
  "Profile",
  "SignupOutbox",
  "BillingCustomer",
  "EntitlementSnapshot",
  "DogOwnership",
  "Post",
  "FeedPost",
  "Message",
  "Conversation",
  "MediaAsset",
  "AuditLog",
  "_prisma_migrations",
]) {
  assert.ok(
    contract.privateTablesNeverExported.includes(privateTable),
    `${privateTable} must be explicitly denied`,
  );
  assert.doesNotMatch(
    exportSql,
    new RegExp(`public\\."${privateTable}"`),
    `${privateTable} must never be read by the data export`,
  );
}
assert.equal(
  allowedTables.some((table) => contract.privateTablesNeverExported.includes(table)),
  false,
  "public allowlist and private denylist must not overlap",
);
const prismaModels = [...prismaSchema.matchAll(/^model\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/gm)].map(
  (match) => match[1],
);
for (const model of prismaModels.filter((model) => !allowedTables.includes(model))) {
  assert.ok(
    contract.privateTablesNeverExported.includes(model),
    `every non-allowlisted Prisma model must be explicitly denied: ${model}`,
  );
}

const exportedPublicTables = new Set(
  [...exportSql.matchAll(/public\."([A-Za-z_][A-Za-z0-9_]*)"/g)].map(
    (match) => match[1],
  ),
);
assert.deepEqual(
  [...exportedPublicTables].sort(),
  [...allowedTables].sort(),
  "export SQL may read data only from the exact allowlist",
);
for (const table of allowedTables) {
  assert.match(exportSql, new RegExp(`data/${table}\\.copy\\.gz`));
  assert.match(stageSql, new RegExp(`giq_portable\\."${table}"`));
}

for (const rawField of [
  "sourceRawJson",
  "profileSourceRawJson",
  "candidateJson",
  "parsedJson",
  "profileHtml",
  "fullFormHtml",
  "streamUrl",
]) {
  assert.ok(contract.rawPayloadColumnsOmitted.includes(rawField));
  assert.match(
    exportSql,
    new RegExp(`- '${rawField}'|jsonb_build_object\\('${rawField}', NULL`),
    `${rawField} must be removed or explicitly nulled`,
  );
}
assert.match(exportSql, /'artifactUri', 'sha256:' \|\| run\."artifactSha256"/);
assert.match(exportSql, /rawPedigreeArtifactsExported|artifactUri|payloadCopied/);
assert.match(exportScript, /credential or signed-URL pattern detected/);
assert.doesNotMatch(exportScript, /gzip -dc "\$file" \| grep -Eiq/);
assert.match(exportScript, /gzip -dc "\$file" \| grep -Ei "\$SENSITIVE_PATTERN" >\/dev\/null/);
assert.match(exportScript, /find "\$WORK_DIR" -maxdepth 1 -type f -name '\*\.json' -print0/);
assert.match(exportScript, /default_transaction_read_only=on/);
assert.match(exportScript, /candidate-proof\.json/);
assert.match(exportScript, /manifest\.sha256/);
assert.match(exportScript, /archive_sha256="\$\(sha256sum/);
assert.match(snapshotSql, /BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY/);
assert.match(snapshotSql, /SET LOCAL TIME ZONE 'UTC'/);
assert.match(snapshotSql, /SET LOCAL DateStyle = 'ISO, YMD'/);
assert.match(snapshotSql, /SET LOCAL extra_float_digits = 3/);
assert.match(snapshotSql, /candidate-proof\.json/);
assert.match(snapshotSql, /reconciliation\.json/);
assert.match(snapshotSql, /snapshot-proof\.json/);
assert.match(snapshotSql, /\\ir reconcile-read-only\.sql/);
assert.match(snapshotSql, /\\ir export-safe-jsonl\.sql/);
assert.equal((snapshotSql.match(/\bCOMMIT;/g) ?? []).length, 1);
assert.doesNotMatch(exportScript, /--file="\$SCRIPT_DIR\/reconcile-read-only\.sql"/);
assert.doesNotMatch(exportScript, /--file="\$SCRIPT_DIR\/export-safe-jsonl\.sql"/);
assert.match(exportScript, /--file="\$SCRIPT_DIR\/export-snapshot\.sql"/);
assert.match(exportScript, /tar --sort=name[\s\S]*-cf - \. \| gzip -n/);

assert.deepEqual(contract.unresolvedQuarantine.expectedProfileFormPartition, {
  total: 6_218_839,
  canonicalShaped: 5_904_337,
  canonicalUnresolvedRace: 444_857,
  dogShaped: 314_502,
  temoraSluglessNormalized: 8,
  requiredOutputs: ["canonical-shaped-in-public", "dog-shaped-in-sanitized-quarantine"],
});
for (const value of ["6218839", "5904337", "444857", "8", "314502"]) {
  assert.match(exportScript, new RegExp(value));
}
assert.match(exportSql, /unresolved-identities\.copy\.gz/);
assert.match(exportSql, /sourceIdentitySha256/);
assert.match(exportSql, /sha256\(convert_to/);
assert.doesNotMatch(exportSql, /rtrim\(form\."(?:sourceId|raceUrl)"/);
assert.match(reconcileSql, /"raceUrl" = '\/racing\/temora\/2008-10-19\/3\/'/);
assert.match(reconcileSql, /"sourceId" = '\/racing\/temora\/2008-10-19\/3\?trial=false'/);
assert.match(exportSql, /"raceUrl" ~ '\^\/racing\/\[\^\?#\]\+\/\?\$'/);
assert.doesNotMatch(exportSql, /\(races\?\|results\?\|form-guides\?\)/);
assert.match(reconcileSql, /temora_slugless_race_identity_normalized_exact/);
assert.match(reconcileSql, /canonical_race_provider_key_not_dog_url/);

assert.deepEqual(contract.supplementalFiles, [
  {
    name: "TrainerIdentityCrosswalk",
    file: "TrainerIdentityCrosswalk.copy.gz",
    identityKinds: ["r2-source-trainer-id", "thedogs-provider-id"],
    containsNames: false,
    nameOnlyMatchingAllowed: false,
    missingIdentityHandling: "block-export-or-apply",
    localNoMatchHandling: "insert-as-new-after-exact-candidate-identity-proof",
  },
]);
assert.match(exportSql, /TrainerIdentityCrosswalk\.copy\.gz/);
assert.match(exportSql, /r2-source-trainer-id/);
assert.match(exportSql, /thedogs-provider-id/);
assert.match(stageSql, /giq_portable\."TrainerIdentityCrosswalk"/);
assert.match(loadSql, /TrainerIdentityCrosswalk\.copy\.gz/);
assert.match(restoreScript, /Trainer identity crosswalk SHA-256 mismatch/);
assert.match(applySql, /giq_local_trainer_provider_identity/);
assert.match(applySql, /local Runner provider evidence maps Trainer identities ambiguously/);
assert.match(applySql, /portable Trainer lacks an exact provider or r2 source identity/);
assert.doesNotMatch(
  applySql,
  /lower\(btrim\(target\.name\)\)\s*=\s*lower\(btrim\(source\.name\)\)/,
  "Trainer identity must never fall back to name matching",
);

for (const expected of [
  "Palmerston - North",
  "Palmerston North",
  "The Meadows",
  "Canberra",
]) {
  assert.ok(
    JSON.stringify(contract).toLowerCase().includes(expected.toLowerCase()),
    `${expected} normalization must be contracted`,
  );
}
assert.match(applySql, /lower\(btrim\(target\.name\)\) = 'canberra' THEN 'ACT'/);
assert.match(applySql, /palmerston - north', 'palmerston north/);
assert.match(applySql, /giq_track_map\(source_id, target_id\)/);
assert.match(applySql, /giq_meadows_track_map/);
assert.match(applySql, /Meadows alias consolidation would collide on Meeting/);
assert.match(applySql, /localAliasesConsolidated/);
assert.match(applySql, /canonicalRowsAfter/);
assert.doesNotMatch(applySql, /SET\s+id\s*=/i, "existing local IDs must never be rewritten");

assert.match(exportSql, /NOT IN \('demo', 'greyhoundiq-demo'\)/);
assert.match(applySql, /giq_excluded_race/);
assert.match(applySql, /DELETE FROM public\."DogProfileForm"/);
assert.match(
  applySql,
  /DELETE FROM public\."Dog" dog\s+USING giq_dog_exact_duplicate duplicate/,
  "Dog deletion is allowed only for the proven exact-identity consolidation set",
);

assert.equal(
  (JSON.stringify(contract).match(/538849/g) ?? []).length > 0,
  true,
);
for (const mediaValue of [
  "290771",
  "290058",
  "248078",
  "289718",
  "289707",
  "900",
  "304",
  "117",
  "11",
  "36",
]) {
  assert.ok(JSON.stringify(contract).includes(mediaValue));
}
assert.match(reconcileSql, /photo_finish_not_stored_as_race_video/);
assert.match(reconcileSql, /race_level_replay_source_id_not_cross_race/);
assert.match(reconcileSql, /thedogs_exported_status_partition_balances/);
assert.doesNotMatch(reconcileSql, /abs\(staged - 328069\)/);
assert.match(exportScript, /thedogs_pedigree_partition\.staged == 328069/);
assert.match(reconcileSql, /galtd_volumes_66_to_73_accounted/);
assert.match(exportSql, /PedigreeMergeLedger" ledger ORDER BY ledger\.id/);

assert.deepEqual(contract.pedigreeExport.providerUniverse, [
  "galtd",
  "greyhound-recorder",
  "fasttrack",
  "thedogs",
]);
assert.equal(contract.pedigreeExport.statusHandling, "preserve-actual-per-row");
assert.equal(contract.pedigreeExport.absentProvidersCountedAsZero, true);
assert.doesNotMatch(JSON.stringify(contract.pedigreeExport), /"verificationStatus":"verified"/);
assert.match(reconcileSql, /pedigreeProviderStatus/);
assert.match(reconcileSql, /galtdConflictEvidence/);
assert.match(exportScript, /greyhound-recorder.*fasttrack/);
assert.match(exportSql, /PedigreeImportRun" run ORDER BY run\.id/);
assert.match(exportSql, /PedigreeAssertion" assertion ORDER BY assertion\.id/);

for (const value of ["76622", "838536", "6434242"]) {
  assert.match(reconcileSql, new RegExp(value));
}
for (const staleRawTotal of ["76668", "838672", "6435322"]) {
  assert.doesNotMatch(reconcileSql, new RegExp(staleRawTotal));
}
assert.match(reconcileSql, /sourceNaturalKeyCoverage/);
assert.match(reconcileSql, /non_demo_source_union_natural_keys_present/);
assert.match(reconcileSql, /profile_form_all_canonical_source_rows_in_public/);
assert.match(reconcileSql, /profile_form_unresolved_race_rows_in_public/);
assert.match(exportSql, /resolution\.url_class = 'dog-url-recovery-only'/);
assert.match(exportScript, /profileFormSourceCoverage\.canonicalUnresolvedRaceRows == 444857/);
assert.doesNotMatch(JSON.stringify(contract), /productionBaselinePreserved/);
assert.doesNotMatch(JSON.stringify(contract), /17707/);
assert.match(exportScript, /snapshotRaceVideos > 0/);
assert.match(exportScript, /snapshotRaceVideosChanged == 0/);
for (const content of [JSON.stringify(contract), reconcileSql, exportScript, applySql]) {
  assert.match(content, /198887/);
}
assert.match(reconcileSql, /thedogs_local_identity_crosswalk/);
assert.match(reconcileSql, /earBrand=thedogs:<id> to candidate sourceProvider=thedogs\/sourceId/);
assert.match(applySql, /giq_thedogs_local_identity_pair/);
assert.match(applySql, /giq_residual_local_dog/);
assert.match(applySql, /race-track-date-number-box/);
assert.match(applySql, /nameOnlyMatchingAllowed', false/);
assert.match(applySql, /historical local residual Dog inventory changed: expected 44/);
assert.match(applySql, /residual local Dogs lack stable candidate ID or exact race observation/);
assert.match(applySql, /giq_dog_private_reference/);
assert.match(applySql, /multiple private-referenced local Dogs/);
assert.deepEqual(
  (contract.sourceResolutionBaselines as {
    dogIdentity: Record<string, unknown>;
  }).dogIdentity,
  {
    localSyntheticEarBrandRows: 198887,
    mapping: "local earBrand=thedogs:<id> to candidate sourceProvider=thedogs/sourceId",
    cardinality: "one-to-one",
    duplicateHandling: "consolidate only exact provider-identity duplicates without dependent collisions",
    privateDependentHandling: "preserve the sole private-referenced local ID or block without mutation",
    localResidualRowsWithoutStableIdentity: 44,
    residualMapping: "candidate primary ID or exact canonical track/date/race/box observation only",
    residualNameMatchingAllowed: false,
  },
);
assert.match(applySql, /giq_dog_exact_duplicate/);
assert.match(applySql, /exact Dog consolidation would duplicate a dependent racing identity/);
assert.match(applySql, /referenced by non-allowlisted/);
assert.match(
  applySql,
  /exact duplicate Dog already has immutable pedigree provenance; consolidation must precede provenance insertion/,
);
const exactDuplicateSet = applySql.indexOf(
  "CREATE TEMP TABLE giq_dog_exact_duplicate",
);
const immutableReferenceGuard = applySql.indexOf(
  "exact duplicate Dog already has immutable pedigree provenance",
);
const duplicateDelete = applySql.indexOf('DELETE FROM public."Dog" dog');
const finalParentResolution = applySql.indexOf(
  "Finish canonical Dog parent resolution before any immutable provenance row",
);
const provenanceImport = applySql.indexOf(
  "CREATE TEMP TABLE giq_pedigree_occurrence_id_inventory",
);
assert.ok(
  exactDuplicateSet < immutableReferenceGuard &&
    immutableReferenceGuard < duplicateDelete &&
    duplicateDelete < finalParentResolution &&
    finalParentResolution < provenanceImport,
  "Dog consolidation and final parent resolution must precede provenance insertion",
);
assert.match(applySql, /portable Dog pedigree references an unmapped canonical parent/);
assert.doesNotMatch(
  applySql.slice(provenanceImport),
  /(?:UPDATE|DELETE FROM) public\."(?:Dog|DogSourceIdentity|PedigreeAssertion|PedigreeMergeLedger)"/,
  "canonical Dogs and immutable provenance must not be rewritten after evidence insertion starts",
);
for (const immutableTable of [
  "DogSourceIdentity",
  "PedigreeAssertion",
  "PedigreeMergeLedger",
]) {
  assert.doesNotMatch(
    applySql,
    new RegExp(`UPDATE public\\."${immutableTable}"`),
    `${immutableTable} must never be repointed or rewritten`,
  );
}
assert.match(applySql, /giq_pedigree_occurrence_id_inventory/);
assert.match(applySql, /portable pedigree evidence has a missing or duplicate occurrence ID/);
assert.match(
  applySql,
  /JOIN public\."PedigreeImportRun" target ON target\.id = source\.id/,
  "import runs must retry only by exact occurrence ID",
);
assert.doesNotMatch(
  applySql,
  /JOIN public\."PedigreeImportRun" target\s+ON target\."sourceProvider"/,
  "provider plus artifact is evidence, not a run identity",
);
assert.doesNotMatch(
  applySql,
  /JOIN public\."DogSourceIdentity" target\s+ON target\."sourceProvider"/,
  "provider source keys must not collapse distinct observations",
);
assert.doesNotMatch(
  applySql,
  /JOIN public\."PedigreeAssertion" target\s+ON target\."subjectIdentityId"/,
  "subject plus relationship must not collapse distinct assertions",
);
for (const expectedRows of [
  "giq_pedigree_identity_expected",
  "giq_pedigree_assertion_expected",
  "giq_pedigree_ledger_expected",
]) {
  assert.match(applySql, new RegExp(`CREATE TEMP TABLE ${expectedRows}`));
}
for (const driftMessage of [
  "portable pedigree import-run occurrence ID collides with different immutable evidence",
  "portable dog-source occurrence ID collides with different immutable evidence",
  "portable pedigree assertion occurrence ID collides with different immutable evidence",
  "portable pedigree ledger occurrence ID collides with different append-only evidence",
]) {
  assert.match(applySql, new RegExp(driftMessage));
}
assert.ok(
  (applySql.match(/to_jsonb\(target\) IS DISTINCT FROM to_jsonb\((?:source|expected)\)/g) ?? [])
    .length >= 8,
  "every immutable provenance retry and final ledger check must compare complete rows",
);
assert.match(
  applySql,
  /portable immutable pedigree evidence drifted after insertion; rolling back all local changes/,
);
assert.doesNotMatch(
  applySql,
  /ON CONFLICT \("assertionId", "dogId", decision\) DO NOTHING/,
  "ledger retries must not suppress a distinct append-only decision occurrence",
);
assert.match(applySql, /Resolve every canonical Dog and final verification status before INSERT/);
assert.match(applySql, /Resolve the subject, parent and final status before immutable insertion/);
assert.match(applySql, /thedogs_synthetic_ear_brand_absent/);
assert.match(applySql, /dog_stable_identity/);

assert.match(
  applySql,
  /target\."raceId" = race_map\.target_id\s+AND target\."boxNumber" = source\."boxNumber"/,
  "Runner identity must be race plus box",
);
assert.match(
  applySql,
  /target\."runnerId" = runner_map\.target_id/,
  "Result identity must be its mapped Runner",
);

assert.match(applySql, /CREATE TEMP TABLE giq_private_before/);
assert.match(applySql, /CREATE TEMP TABLE giq_private_after/);
assert.match(applySql, /content_sha256/);
assert.match(applySql, /sha256-length-prefixed-canonical-json/);
assert.match(applySql, /LOCK TABLE public\.%I IN SHARE MODE/);
assert.match(applySql, /FULL JOIN giq_private_after after_state USING \(table_name\)/);
assert.match(applySql, /before_state\.row_count <> after_state\.row_count/);
assert.match(applySql, /before_state\.content_sha256 <> after_state\.content_sha256/);
assert.match(applySql, /a non-allowlisted local table changed; rolling back all local changes/);
assert.ok(
  applySql.indexOf("a non-allowlisted local table changed") <
    applySql.lastIndexOf("COMMIT;"),
  "private mismatch must raise before commit",
);
assert.match(applySql, /portable row mapping is incomplete; rolling back all local changes/);
assert.match(applySql, /normalized-local-racing-atomic-verification/);
assert.match(applySql, /GIQ_FORCE_LATE_FAILURE/);
assert.match(applySql, /forced late local-copy failure/);
assert.match(restoreScript, /--set=GIQ_FORCE_LATE_FAILURE=1/);
assert.match(restoreScript, /forced late local-copy failure unexpectedly committed/);
assert.match(restoreScript, /forced late failure did not roll back the portable staging-schema drop/);
assert.match(
  restoreScript,
  /forced late failure did not preserve Trainer identity crosswalk staging rows/,
);
assert.match(restoreScript, /forcedLateRollbackProven/);
assert.equal(contract.snapshotContract.forcedLateRollbackProofRequired, true);
assert.equal(contract.snapshotContract.archiveMetadataPrivacyScanRequired, true);
assert.ok(
  applySql.indexOf('UPDATE public."Dog" target\nSET\n  "sireId"') <
    applySql.lastIndexOf("COMMIT;"),
  "pedigree update must occur inside the transaction",
);
assert.ok(
  applySql.indexOf("DROP SCHEMA giq_portable CASCADE;") <
    applySql.indexOf("forced late local-copy failure"),
  "forced late failure must prove the staging drop also rolls back",
);
assert.ok(
  applySql.indexOf("forced late local-copy failure") < applySql.lastIndexOf("COMMIT;"),
  "late failure hook must execute before commit",
);
assert.equal(
  applySql.slice(applySql.lastIndexOf("COMMIT;") + "COMMIT;".length).trim(),
  "",
  "no mutation or verification may occur after commit",
);
assert.doesNotMatch(verifyLocalSql, /giq_portable/);
assert.doesNotMatch(restoreScript, /--file="\$SCRIPT_DIR\/verify-local-read-only\.sql"/);
assert.match(restoreScript, /atomicVerification\.blockerCount == 0/);
assert.doesNotMatch(restoreScript, /gzip -dc "\$file" \| grep -Eiq/);
assert.match(restoreScript, /find "\$RESTORE_DIR" -maxdepth 1 -type f -name '\*\.json' -print0/);

assert.match(restoreScript, /EXPECTED_HOST="127\.0\.0\.1"/);
assert.match(restoreScript, /LOCAL_COPY_MODE:-verify/);
assert.match(restoreScript, /greyhoundiq_normalized_restore_verify/);
assert.match(restoreScript, /ALLOW_LOCAL_DATA_APPLY:-/);
assert.match(restoreScript, /after stopping the local app/);
assert.match(restoreScript, /\.rowsBefore == \.rowsAfter and \.sha256Before == \.sha256After/);
assert.match(restoreScript, /archive contains an unsafe path/);
assert.match(restoreScript, /archive contains a symbolic link/);

console.log("normalized AlloyDB local-copy contract checks passed");
