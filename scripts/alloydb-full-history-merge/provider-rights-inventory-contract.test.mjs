import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(
  join(here, "sql", "export-provider-rights-inventory.sql"),
  "utf8",
);
const executableSql = sql
  .replace(/--[^\r\n]*/gu, "")
  .replace(/\/\*[\s\S]*?\*\//gu, "");

assert.match(
  executableSql,
  /BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;/u,
);
assert.match(executableSql, /ROLLBACK;/u);
assert.doesNotMatch(
  executableSql,
  /\b(?:INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|TRUNCATE|COPY|GRANT|REVOKE)\b/iu,
  "provider rights inventory export must remain read-only",
);
assert.doesNotMatch(executableSql, /\\copy/iu);

for (const table of [
  "Dog",
  "DogProfileObservation",
  "DogProfileMergeLedger",
  "DogProfileForm",
  "DogProfileArchive",
  "RaceDayArchive",
  "Meeting",
  "Race",
  "Runner",
  "Result",
  "RaceVideo",
  "PedigreeImportRun",
  "DogSourceIdentity",
  "PedigreeAssertion",
  "PedigreeMergeLedger",
  "LiveFeedQuarantine",
]) {
  assert.ok(sql.includes(`public."${table}"`), `missing aggregate source ${table}`);
}

for (const scope of [
  "dog_profiles",
  "dog_profile_evidence",
  "historical_form",
  "raw_dog_profiles",
  "raw_race_archives",
  "race_cards",
  "runners",
  "race_results",
  "replay_media",
  "pedigree",
  "quarantine_evidence",
]) {
  assert.ok(sql.includes(`'${scope}'`), `missing provider data scope ${scope}`);
}

for (const permission of [
  "ingestion",
  "storage",
  "normalization",
  "display",
  "analytics",
  "replayRedistribution",
]) {
  assert.ok(sql.includes(`'${permission}'`), `missing permission ${permission}`);
}

for (const jurisdiction of ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA", "AUS"]) {
  assert.ok(sql.includes(`'${jurisdiction}'`), `missing jurisdiction ${jurisdiction}`);
}

for (const required of [
  "giq-provider-rights-inventory/v1",
  "normalized_manifest_sha256",
  "sourceManifestSha256",
  "providerKey",
  "dataScope",
  "jurisdiction",
  "requiredPermissions",
  "rowCount",
  "jsonb_agg",
  "ORDER BY aggregated.provider_key,aggregated.data_scope,aggregated.jurisdiction",
]) {
  assert.ok(sql.includes(required), `missing inventory contract ${required}`);
}

for (const forbiddenRawField of [
  "rawJson",
  "sourceRawJson",
  "evidenceJson",
  "profileHtml",
  "fullFormHtml",
  "streamUrl",
  "pageUrl",
  "sourceId",
  "naturalIdentity",
  "requestUrl",
  "artifactUri",
]) {
  assert.equal(
    sql.includes(forbiddenRawField),
    false,
    `inventory must not export raw field ${forbiddenRawField}`,
  );
}

const replayBranch = sql.match(
  /'replay_media'[\s\S]*?FROM public\."RaceVideo"/u,
)?.[0];
assert.ok(replayBranch, "replay aggregate branch is missing");
assert.match(replayBranch, /'replayRedistribution'/u);
assert.match(sql, /'unattributed'/u, "missing provider lineage must fail closed");
assert.match(sql, /ELSE 'UNATTRIBUTED' END/u, "unknown jurisdictions must fail closed");

console.log("provider rights aggregate inventory SQL contract passed");
