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
for (const expected of ["170780", "76620", "838526", "6434145", "5660837"]) {
  assert.match(normalize, new RegExp(`${expected}::bigint`));
}
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
for (const expected of ["105374", "210734"]) {
  assert.match(canonical, new RegExp(`${expected}::bigint`));
}
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

assert.match(verify, /final pedigree provenance conservation failed/);
for (const expected of ["212391", "328069", "105374", "210734"]) {
  assert.match(verify, new RegExp(`${expected}::bigint`));
}

assert.match(verify, /\(count\(\*\)>0\) AS pedigree_pending/);
assert.match(verify, /\\if :pedigree_pending/);
assert.doesNotMatch(verify, /\\if :pending_pedigree/);
assert.match(
  verify,
  /phase=CASE WHEN :'pending_pedigree'::bigint=0 THEN 'verified' ELSE phase END/,
  "parsed-only pedigree must remain a hard verification blocker",
);

console.log("alloydb full-history completeness source contract: PASS");
