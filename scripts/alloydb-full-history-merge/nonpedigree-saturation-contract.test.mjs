import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(root, "sql/stage-nonpedigree-saturation.sql"), "utf8");

assert.match(sql, /current_database\(\)<>'giq_production_candidate_20260716_r1'/);
assert.match(sql, /observed_phase<>'normalized'/);
assert.match(sql, /source manifest is incomplete/);
assert.match(sql, /normalized_manifest_sha256/);
assert.match(sql, /source_history_cutoff/);

for (const source of [
  'public."Dog"',
  'public."DogSourceIdentity"',
  "normalized_dog",
  "profile_form_resolution",
  "export_duplicates",
  "export_orphans",
  "export_quarantine",
]) {
  assert.ok(sql.includes(source), `missing global source search ${source}`);
}

for (const invariant of [
  "Dog.sourceProvider/sourceId",
  "Dog.earBrand",
  "DogSourceIdentity.sourceProvider/sourceId",
  "Dog.name+whelpDate",
  "Dog.name+sex+colour+trainer",
  "Dog.name+sire/dam relationships",
  "nameOnlyAutoMergeAllowed",
  "parentRelationshipSearchPerformed",
  "parentRelationshipCandidateCount",
  "parentRelationshipCandidateEvidenceSha256",
  "parentRelationshipEvidenceManifestSha256",
  "blocked-parent-relationship-candidate-review-required",
  "blocked-authoritative-identity-collision",
  "blocked-canonical-target-relink-required",
  "blocked-nonverified-authoritative-identity-claim",
  "blocked-r2-only-identity-retrieval-required",
]) {
  assert.ok(sql.includes(invariant), `missing identity invariant ${invariant}`);
}

assert.match(sql, /n\.whelp_date IS NOT NULL AND d\."whelpDate" IS NOT NULL/);
assert.match(sql, /n\.trainer_id IS NOT NULL AND n\.trainer_id=d\."trainerId"/);
assert.doesNotMatch(sql, /WHEN\s+lower\(btrim\(d\.name\)\)=lower\(btrim\(n\.name\)\)\s+THEN\s+true/i);
const parentSearchStart = sql.indexOf(
  "CREATE TABLE IF NOT EXISTS _giq_history_stage.nonpedigree_dog_parent_review_candidate",
);
const identityResolutionStart = sql.indexOf(
  "CREATE TABLE IF NOT EXISTS _giq_history_stage.nonpedigree_dog_identity_resolution",
);
assert.ok(parentSearchStart >= 0 && identityResolutionStart > parentSearchStart);
const parentSearch = sql.slice(parentSearchStart, identityResolutionStart);
for (const parentDimension of [
  "normalized_pedigree_edge",
  'existing_child."sireId"',
  'existing_child."damId"',
  "giq_nonpedigree_exact_dog_candidate",
  "existing_parent.name",
  "wholeDatabaseSearchPerformed",
  "autoMergeAllowed',false",
  "normalized_manifest_sha256",
  "source_history_cutoff",
]) {
  assert.ok(parentSearch.includes(parentDimension), `missing parent candidate search ${parentDimension}`);
}
assert.match(sql, /candidate_evidence_sha256/);
assert.match(sql, /string_agg\([\s\S]*candidate\.existing_dog_id/);
assert.match(
  sql,
  /create_new_allowed[\s\S]*parent_relationship_candidate_count<>0[\s\S]*global dog search allowed an unverified or colliding insert/,
);

for (const expected of [
  "1027915",
  "266534",
  "759359",
  "1940",
  "1939",
  "42",
  "40",
  "29516",
  "66051",
  "314502",
  "54944",
  "169",
  "314333",
  "0",
]) {
  assert.match(sql, new RegExp(`${expected}::bigint`), `missing exact partition ${expected}`);
}

assert.match(sql, /review-only-full-row-no-loss-proof-required/);
assert.match(sql, /'authoritative-identity','full-row-no-data-loss','reference-redirection','append-only-audit-ledger'/);
assert.match(sql, /false,false,false,false,false,false,false/);
assert.match(sql, /source_dataset='duplicates' AND removal_allowed/);
assert.match(sql, /CASE WHEN runner\.target_id IS NOT NULL THEN 1 ELSE 0 END/);

assert.match(sql, /authoritative-race-fetch-required-no-partial-race-synthesis/);
assert.match(sql, /dogUrlIsRaceIdentity',false/);
assert.match(sql, /raceCreationAllowed',false/);
assert.match(sql, /pseudo_race_creations<>0/);
assert.match(sql, /pseudo-race reconciliation partition changed/);
assert.match(sql, /automaticPublicWebScrapeAllowed',false/);

assert.match(sql, /request_kind='dog-profile'/);
assert.match(sql, /request_kind='race'/);
assert.match(sql, /provider_key LIKE 'thedogs:race:\/dogs\/%'/);
assert.match(sql, /create_new_allowed\n?\s*\)/);
assert.match(sql, /verification_class<>'full-profile'/);
assert.doesNotMatch(sql, /verification_class IN \('full-profile','r2-preserved'\)/);
assert.match(sql, /n\.verification_class<>'r2-preserved'/);

assert.match(sql, /missing-distance-repaired-from-existing-r2-race/);
assert.match(sql, /missing-dog-identity-runner-relationship-repaired-from-r2/);
assert.match(sql, /authoritative-dog-identity-required-no-name-only-creation/);
assert.match(sql, /identity\.reuse_existing_allowed OR identity\.create_new_allowed/);
assert.match(sql, /normalized_race\.natural_key=q\.payload->>'naturalKey'/);
assert.match(sql, /normalized_runner\.natural_key=q\.payload->>'naturalKey'/);

assert.match(sql, /'giq-nonpedigree-saturation\/v1'/);
assert.match(sql, /status IN \('ready','blocked'\)/);
assert.match(sql, /evidence is bound to a different source manifest/);
assert.match(sql, /'r2OnlyIdentityRetrievalRequired'/);
assert.match(sql, /'unresolvedDogIdentities'/);
assert.match(sql, /\\quit 3/);
assert.equal((sql.match(/\$\$/g) ?? []).length % 2, 0, "unbalanced dollar quotes");
assert.equal((sql.match(/^COMMIT;$/gm) ?? []).length, 1);

assert.doesNotMatch(sql, /(?:gcloud|gsutil|https?:\/\/)/i);
assert.doesNotMatch(sql, /(?:INSERT INTO|UPDATE|DELETE FROM|TRUNCATE)\s+public\./i);
assert.doesNotMatch(sql, /INSERT INTO public\."(?:Dog|Race|Runner)"/i);

console.log("non-pedigree saturation static contract passed");
