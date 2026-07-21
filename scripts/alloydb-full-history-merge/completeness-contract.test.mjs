import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (relative) => readFileSync(join(root, relative), "utf8");

const normalize = read("sql/normalize-stage.sql");
const canonical = read("sql/merge-canonical.sql");
const verify = read("sql/verify-candidate.sql");

assert.match(normalize, /export graph conservation failed/);
assert.match(normalize, /export graph anti-join conservation failed/);
assert.match(
  normalize,
  /FUNCTION _giq_history_merge\.try_jsonb\(value text\)[\s\S]*?LANGUAGE plpgsql[\s\S]*?PARALLEL UNSAFE/,
);
assert.match(normalize, /CREATE TABLE _giq_history_stage\.trainer_identity_resolution AS/);
assert.match(normalize, /SELECT DISTINCT ON \(resolution\.target_id\)/);
assert.match(normalize, /JOIN _giq_history_stage\.normalized_trainer n ON n\.target_id=resolution\.target_id/);
assert.match(normalize, /lower\(btrim\(name\)\) = 'appin' THEN 'NSW'/);
assert.match(
  normalize,
  /UNION ALL\s*\(\s*SELECT DISTINCT ON \(e\.payload->>'trackNaturalKey'\)/,
  "the export track DISTINCT branch must retain its own ORDER BY scope",
);
for (const expected of ["200211", "76620", "838486", "6434094", "5660837"]) {
  assert.match(normalize, new RegExp(`${expected}::bigint`));
}
assert.match(normalize, /thedogs_identities <> 212739/);
assert.match(normalize, /exact_provider_candidates AS MATERIALIZED/);
assert.match(
  normalize,
  /p\.payload->>'raceProviderKey'='thedogs:race:' \|\| s\.provider_source_id/,
  "profile forms must resolve their exact provider race identity",
);
assert.match(normalize, /s\.source_name='export'/);
assert.match(normalize, /count\(DISTINCT n\.target_id\)::integer AS candidate_count/);
assert.match(normalize, /profile-form provider identity resolution produced % ambiguities/);
assert.match(normalize, /5692109::bigint,468495::bigint/);
assert.doesNotMatch(normalize, /canonical_candidates AS MATERIALIZED|race_lookup_exact_idx/);
for (const map of ["dog_map", "meeting_map", "race_map", "runner_map", "result_map"]) {
  assert.match(
    normalize,
    new RegExp(`LEFT JOIN _giq_history_stage\\.${map} mapped`),
    `${map} must have a source anti-join conservation check`,
  );
}
assert.match(normalize, /count\(\*\) FILTER\(WHERE duplicate_rank>1\)/);
assert.match(normalize, /duplicate_rows<>0/);

assert.match(canonical, /TheDogs pedigree provenance conservation failed/);
assert.match(canonical, /GALTD pedigree provenance conservation failed/);
assert.match(canonical, /105374::bigint/);
assert.doesNotMatch(
  canonical,
  /staged_assertions<>210734::bigint|staged_assertions<>canonical_assertions[\s\S]{0,200}210734::bigint/,
  "all raw GALTD observations must not be required to contribute canonical assertions",
);
assert.match(canonical, /galtd_pedigree_assertion_expected/);
assert.match(canonical, /resolution_disposition IN \('applied_verified','verified_no_change'\)/);
assert.match(canonical, /GALTD descriptive composite evidence cannot mutate canonical Dog parent relationships/);
for (const dynamicTheDogsProof of [
  "marker.normalized_manifest_sha256",
  "marker.normalized_transform_version",
  "sum(expected_bytes)",
  "normalized_identities<>staged_identities",
  "staged_identities<>canonical_identities",
  "staged_assertions<>canonical_assertions",
]) {
  assert.ok(
    canonical.includes(dynamicTheDogsProof),
    `TheDogs conservation must be run-bound through ${dynamicTheDogsProof}`,
  );
}
assert.doesNotMatch(
  canonical,
  /b84eab94d931b4e038766db7393b141b190548ba4a4e6bdb906b5692cb7b1116|thedogs-normalized-harvest\/v1|212391::bigint|328069::bigint/,
);
assert.match(canonical, /missing_identities,missing_assertions/);

const targetProofStart = verify.indexOf("missing_normalized_targets bigint");
const targetProofEnd = verify.indexOf("SELECT count(*) INTO self_links", targetProofStart);
assert.ok(targetProofStart >= 0 && targetProofEnd > targetProofStart);
const targetProof = verify.slice(targetProofStart, targetProofEnd);
for (const table of [
  "Track",
  "Trainer",
  "Dog",
  "Meeting",
  "Race",
  "Runner",
  "Result",
  "FormEntry",
  "DogProfileForm",
  "RaceVideo",
  "DogProfileArchive",
  "RaceDayArchive",
]) {
  assert.match(
    targetProof,
    new RegExp(`LEFT JOIN public\\."${table}" canonical`),
    `${table} must have a final target-id anti-join`,
  );
}
assert.match(targetProof, /normalized_photo_finish staged/);
assert.match(targetProof, /canonical\."photoFinishUrl" IS NULL/);

assert.match(verify, /final pedigree v2 conservation failed/);
assert.match(verify, /105374::bigint/);
assert.match(verify, /giq-authoritative-pedigree-saturation\/v2/);
assert.match(verify, /authoritative_pedigree_assertion_occurrence/);
assert.match(verify, /authoritative_pedigree_resolution/);
assert.match(verify, /authoritative_pedigree_terminal_proof_leaf/);
assert.match(verify, /history_id\('pedledger-v2',resolution\.occurrence_id\)/);
assert.match(verify, /pedigree_blockers<>0/);

assert.match(verify, /\(blocker_count>0\) AS pedigree_pending/);
assert.match(verify, /\\if :pedigree_pending/);
assert.doesNotMatch(verify, /\\if :pending_pedigree/);
assert.match(
  verify,
  /phase=CASE WHEN :'pending_pedigree'::bigint=0 THEN 'verified' ELSE phase END/,
  "the unified pedigree v2 gate must remain a hard verification blocker",
);

console.log("alloydb full-history completeness source contract: PASS");
