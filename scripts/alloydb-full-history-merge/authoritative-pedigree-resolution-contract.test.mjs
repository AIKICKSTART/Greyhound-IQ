import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(root, name), "utf8");
const stage = read("sql/stage-authoritative-pedigree-resolution.sql");
const normalize = read("sql/normalize-stage.sql");
const merge = read("sql/merge-canonical.sql");

assert.match(stage, /current_database\(\) <> 'giq_production_candidate_20260716_r1'/);
assert.match(stage, /observed_phase <> 'normalized'/);
assert.doesNotMatch(
  stage,
  /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE|DROP\s+TABLE|ALTER\s+TABLE)\s+public\./i,
  "authoritative staging must never mutate canonical public tables",
);

for (const [provider, rank] of [
  ["production", 1000],
  ["greyhound_recorder", 900],
  ["fasttrack", 800],
  ["approved_fasttrack_resource", 750],
  ["thedogs", 200],
  ["galtd", 100],
]) {
  assert.match(stage, new RegExp(`\\('${provider}',${rank},`));
}
assert.match(stage, /source_provider <> 'production' AND automated_retrieval_allowed/);
assert.match(stage, /usage_approval_ref/);
assert.match(stage, /authoritative evidence is append-only/);
assert.equal((stage.match(/BEFORE UPDATE OR DELETE/g) ?? []).length, 3);

for (const dimension of [
  "asserted-canonical-dog-id",
  "canonical-provider-source-key",
  "source-identity-provider-key",
  "source-identity-registry-token",
  "ear-brand",
  "normalized-name-and-whelp-date",
  "normalized-name-date-and-parent-names",
]) {
  assert.ok(stage.includes(`'${dimension}'`), `missing candidate-search dimension ${dimension}`);
}
assert.match(stage, /'normalized-name-and-whelp-date',false/);
assert.match(stage, /'normalized-name-date-and-parent-names',false/);
assert.match(stage, /'ear-brand',false/);
assert.match(stage, /strong_candidate_count>1 OR counts\.candidate_count>1/);
assert.match(stage, /false AS canonical_write_eligible/g);
assert.match(stage, /false AS quarantine_release_eligible/g);

for (const requiredProof of [
  "authoritative_duplicate_proof",
  "unique_verified_fields_merged",
  "all_references_redirected",
  "relationship_integrity_verified",
  "no_data_loss_verified",
  "merge_ledger_recorded",
]) {
  assert.ok(stage.includes(requiredProof), `missing consolidation proof ${requiredProof}`);
}
assert.match(stage, /release_eligible boolean GENERATED ALWAYS AS/);
assert.match(stage, /expected_provider_stubs/);
assert.match(stage, /expected_race_observed_parents/);
assert.match(stage, /race-observed-parent-profile-required/);
assert.match(stage, /expected_self_parents/);
assert.match(stage, /expected_galtd_conflicts/);
assert.match(stage, /expected_composite_rows/);
assert.match(
  stage,
  /crosswalk\.galtd_source_id \|\| ':' \|\| crosswalk\.child_natural_key/,
);

const crosswalkStart = normalize.indexOf(
  "CREATE TABLE _giq_history_stage.galtd_exact_crosswalk",
);
const crosswalkEnd = normalize.indexOf(
  "INSERT INTO _giq_history_merge.quarantine",
  crosswalkStart,
);
assert.ok(crosswalkStart >= 0 && crosswalkEnd > crosswalkStart);
const crosswalk = normalize.slice(crosswalkStart, crosswalkEnd);
assert.match(crosswalk, /AS provider_retrieval_candidate/);
assert.match(crosswalk, /false AS canonical_eligible/);
assert.match(crosswalk, /'provider-retrieval-required'/);
assert.doesNotMatch(
  crosswalk,
  /\([^;\n]*thedogs_candidates=1[^;\n]*\)\s+AS canonical_eligible/,
  "descriptive composite must not become canonical eligibility",
);

const dogInsert = merge.indexOf('INSERT INTO public."Dog"(');
const identityGuard = merge.lastIndexOf("DO $$", dogInsert);
assert.ok(identityGuard >= 0 && identityGuard < dogInsert);
const identityGuardSql = merge.slice(identityGuard, dogInsert);
for (const requiredDecisionProof of [
  "nonpedigree_dog_identity_resolution",
  "proposed_target_id IS DISTINCT FROM normalized.target_id",
  "normalized_manifest_sha256 IS DISTINCT FROM marker.normalized_manifest_sha256",
  "source_history_cutoff IS DISTINCT FROM marker.source_history_cutoff",
  "reuse_existing_allowed=decision.create_new_allowed",
  "unlinked_identity_claim_count<>0",
  "nonverified_identity_claim_count<>0",
  "composite_review_candidate_count<>0",
  "parent_relationship_candidate_count<>0",
  "parentRelationshipSearchPerformed",
  "parentRelationshipCandidateCount",
  "parentRelationshipCandidateEvidenceSha256",
  "parentRelationshipEvidenceManifestSha256",
  "Dog.name+sire/dam relationships",
  "reuse-existing-canonical-by-exact-identity",
  "new-record-supported-by-full-provider-profile",
  "DogSourceIdentity.sourceProvider/sourceId",
]) {
  assert.ok(
    identityGuardSql.includes(requiredDecisionProof),
    `canonical Dog guard is missing ${requiredDecisionProof}`,
  );
}
assert.match(identityGuardSql, /canonical Dog insertion is blocked/);

const dogInsertEnd = merge.indexOf("ON CONFLICT(id) DO UPDATE SET", dogInsert);
assert.ok(dogInsertEnd > dogInsert);
const dogInsertSource = merge.slice(dogInsert, dogInsertEnd);
assert.match(dogInsertSource, /JOIN _giq_history_stage\.nonpedigree_dog_identity_resolution decision/);
assert.match(dogInsertSource, /decision\.proposed_target_id=normalized\.target_id/);
assert.match(dogInsertSource, /decision\.normalized_manifest_sha256=marker\.normalized_manifest_sha256/);
assert.match(dogInsertSource, /decision\.source_history_cutoff=marker\.source_history_cutoff/);
assert.match(dogInsertSource, /WHERE decision\.reuse_existing_allowed OR decision\.create_new_allowed/);

const dogUpsertEnd = merge.indexOf('INSERT INTO public."Meeting"(', dogInsertEnd);
const dogUpsert = merge.slice(dogInsertEnd, dogUpsertEnd);
assert.doesNotMatch(dogUpsert, /"(?:sireId|damId)"\s*=/);
assert.match(
  dogUpsert,
  /public\."Dog"\."earBrand" ~ '\^thedogs:\[0-9\]\+\$'[\s\S]*nullif\(btrim\(EXCLUDED\."earBrand"\),''\) IS NOT NULL[\s\S]*EXCLUDED\."earBrand" !~ '\^thedogs:\[0-9\]\+\$'[\s\S]*THEN EXCLUDED\."earBrand"[\s\S]*ELSE NULL/,
  "a poor synthetic earBrand must be repaired only by a non-empty, non-synthetic reviewed value",
);
assert.match(
  merge,
  /OLD\."earBrand" ~ '\^thedogs:\[0-9\]\+\$'[\s\S]*NEW\."earBrand" IS NULL OR \([\s\S]*NEW\."earBrand" !~ '\^thedogs:\[0-9\]\+\$'[\s\S]*NEW\."sourceId"=substring\(OLD\."earBrand" FROM 9\)/,
  "the production non-null guard must permit only the reviewed synthetic-identifier repair",
);
for (const preservedField of [
  "colour",
  "sex",
  "whelpDate",
  "trainerId",
  "sourceProvider",
  "sourceId",
  "profileUrl",
  "profileSourceRawJson",
]) {
  assert.match(
    dogUpsert,
    new RegExp(
      `"?${preservedField}"?=coalesce\\(public\\."Dog"\\."?${preservedField}"?,EXCLUDED\\."?${preservedField}"?\\)`,
    ),
    `existing non-null Dog.${preservedField} must be preserved`,
  );
}

const canonicalGuardEnd = merge.indexOf('public."Track",public."Trainer"');
const canonicalGuard = merge.slice(0, canonicalGuardEnd);
for (const failClosedToken of [
  "giq-authoritative-pedigree-saturation/v1",
  "giq-nonpedigree-saturation/v1",
  "thedogs-normalized-harvest/v2",
  "jsonb_object_length(authoritative_blockers)<>22",
  "jsonb_object_length(nonpedigree_blockers)<>11",
  "authoritative_pedigree_retrieval_queue",
  "nonpedigree_authoritative_fetch_queue",
  "nonpedigree_dog_composite_review_candidate",
  "nonpedigree_dog_parent_review_candidate",
  "authoritative_consolidation_proof",
  "audit_ledger_recorded",
  "LOCK TABLE _giq_history_merge.quarantine",
  "namespace.nspname='_giq_history_stage'",
  "LOCK TABLE %I.%I IN SHARE MODE",
]) {
  assert.ok(canonicalGuard.includes(failClosedToken), `canonical direct guard is missing ${failClosedToken}`);
}

assert.doesNotMatch(
  merge,
  /b84eab94d931b4e038766db7393b141b190548ba4a4e6bdb906b5692cb7b1116|15680836549|thedogs-normalized-harvest\/v1|212391::bigint|328069::bigint/,
  "canonical provenance must never assert the retired v1 artifact or hard-coded corpus totals",
);
const pedigreeImport = merge.slice(
  merge.indexOf("WITH thedogs_lineage AS MATERIALIZED"),
  merge.indexOf("CREATE TABLE _giq_history_stage.pedigree_merge_decision"),
);
for (const runBoundProvenance of [
  "marker.normalized_manifest_sha256",
  "marker.normalized_transform_version",
  "sum(expected_bytes)",
  "lineage.identity_rows",
  "lineage.assertion_rows",
  "'pedrun','thedogs:' || marker.normalized_manifest_sha256",
  'import_run."artifactSha256"=marker.normalized_manifest_sha256',
  'import_run."parserVersion"=marker.normalized_transform_version',
  'import_run."recordsObserved"=normalized_identities',
  'import_run."assertionsObserved"=staged_assertions',
]) {
  assert.ok(
    pedigreeImport.includes(runBoundProvenance),
    `TheDogs canonical provenance is missing ${runBoundProvenance}`,
  );
}

const galtdStart = merge.indexOf("-- GALTD provenance:");
const galtdEnd = merge.indexOf(
  "-- Re-adjudicate TheDogs assertions",
  galtdStart,
);
assert.ok(galtdStart >= 0 && galtdEnd > galtdStart);
const galtdPromotion = merge.slice(galtdStart, galtdEnd);
assert.doesNotMatch(
  galtdPromotion,
  /UPDATE\s+public\."Dog"/i,
  "GALTD composite evidence must have no canonical parent write",
);
assert.match(
  galtdPromotion,
  /GALTD descriptive composite evidence cannot mutate canonical Dog parent relationships/,
);

console.log(
  "Authoritative pedigree resolution contract passed: full-candidate search, explicit source precedence, append-only evidence, no descriptive canonical link, no public writes, and complete quarantine-release proof are fail closed.",
);
