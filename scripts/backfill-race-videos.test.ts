import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("scripts/backfill-race-videos.ts", "utf8");

function sourceBlock(start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing source block start: ${start}`);
  assert.notEqual(endIndex, -1, `missing source block end: ${end}`);
  return source.slice(startIndex, endIndex);
}

for (const provider of [
  "thedogs",
  "racing-queensland",
  "tasracing",
  "greyhoundswa",
  "sa-race-replay",
]) {
  assert.match(source, new RegExp(`\\b${provider.replace("-", "\\-")}\\b`));
}

const mainBlock = sourceBlock("async function main()", "async function assertCandidateReplayTarget");
assert.ok(
  mainBlock.indexOf("await assertCandidateReplayTarget()") <
    mainBlock.indexOf("await auditRaceVideos(options)"),
  "every mode, including audit-only and dry-run, must prove the candidate target first"
);
assert.ok(
  mainBlock.indexOf("await assertHistoricalReplayTaxonomy()") <
    mainBlock.indexOf("await auditRaceVideos(options)"),
  "historical replay eligibility must fail closed before any audit or write"
);
assert.equal(
  (mainBlock.match(/await assertSnapshotRaceVideosPresent\(\);/g) ?? []).length,
  3,
  "snapshot RaceVideo identities must be checked before work and after either write path"
);
assert.doesNotMatch(
  source,
  /assertHistoryNormalizationSource|history_source_identity_mismatch/,
  "no mode may connect directly to the r2 history source"
);

const targetBlock = sourceBlock(
  "async function assertCandidateReplayTarget()",
  "async function assertHistoricalReplayTaxonomy()"
);
assert.match(targetBlock, /current_database\(\)::text AS "database"/);
assert.match(
  targetBlock,
  /identity\.database !== EXPECTED_CANDIDATE_DATABASE/,
  "the exact isolated candidate database is mandatory"
);
assert.match(targetBlock, /identity\.host !== EXPECTED_ALLOYDB_HOST/);
assert.match(targetBlock, /identity\.ssl/);
assert.match(targetBlock, /_giq_history_merge\.run/);
assert.match(targetBlock, /_giq_history_stage\.media_resolution/);
assert.match(targetBlock, /_giq_history_merge\.snapshot_race_video_proof/);
assert.match(targetBlock, /canonical_merged_at AS "canonicalMergedAt"/);
assert.match(targetBlock, /live_delta_applied_at AS "liveDeltaAppliedAt"/);
assert.match(targetBlock, /verified_at AS "verifiedAt"/);
assert.match(targetBlock, /marker\.liveDeltaAppliedAt !== null/);
assert.match(targetBlock, /marker\.verifiedAt !== null/);
assert.doesNotMatch(
  targetBlock,
  /history_merge_completed_at|live_delta_completed_at|candidate_verified_at/,
  "the guard must use columns that exist in the candidate marker schema"
);

const collisionArray = source.match(
  /const EXPECTED_PROVIDER_COLLISION_IDS = \[([\s\S]*?)\] as const;/
);
assert.ok(collisionArray, "the known provider collision set must be explicit");
const collisionIds = [...collisionArray[1].matchAll(/"(\d+)"/g)].map(
  (match) => match[1]
);
assert.deepEqual(collisionIds, [
  "1049479",
  "1061579",
  "1068695",
  "1069289",
  "1069295",
  "1090391",
  "1090576",
  "1105870",
  "1185271",
  "916604",
  "932547",
]);
assert.equal(new Set(collisionIds).size, 11);
assert.match(source, /const EXPECTED_PROVIDER_COLLISION_ROWS = 22;/);

const taxonomyBlock = sourceBlock(
  "async function assertHistoricalReplayTaxonomy()",
  "async function assertSnapshotRaceVideosPresent()"
);
assert.ok(
  taxonomyBlock.includes("^/videos/watch/races/[0-9]+/replay$"),
  "only the exact provider race-replay path may be eligible"
);
for (const expected of [
  "quarantined-provider-id-race-conflict",
  "quarantined-shared-or-preview-media",
  "quarantined-multiple-race-replays",
  "quarantined-%",
  "meeting-preview",
  "live-meeting",
  "race-preview",
  "normalized-export",
]) {
  assert.ok(taxonomyBlock.includes(expected), `missing taxonomy contract: ${expected}`);
}
assert.match(taxonomyBlock, /taxonomy\.providerCollisionRows !== BigInt\(EXPECTED_PROVIDER_COLLISION_ROWS\)/);
assert.match(taxonomyBlock, /taxonomy\.providerCollisionIds !== BigInt\(EXPECTED_PROVIDER_COLLISION_IDS\.length\)/);
assert.match(taxonomyBlock, /taxonomy\.eligibleRows !== taxonomy\.normalizedRows/);
assert.match(taxonomyBlock, /taxonomy\.invalidEligibleRows !== BigInt\(0\)/);
assert.match(taxonomyBlock, /taxonomy\.unresolvedNotQuarantinedRows !== BigInt\(0\)/);
assert.match(taxonomyBlock, /taxonomy\.missingQuarantineLedgerRows !== BigInt\(0\)/);

const quarantineBlock = sourceBlock(
  "async function writeReplayQuarantines(",
  "async function writeRaceVideo("
);
for (const column of [
  "source_name",
  "entity_type",
  "source_key",
  "reason_code",
  "disposition",
  "blocking",
  "evidence",
]) {
  assert.ok(quarantineBlock.includes(column), `candidate quarantine column missing: ${column}`);
}
assert.doesNotMatch(quarantineBlock, /source_id|source_key_sha256\s*\n\s*\)/);
assert.match(
  quarantineBlock,
  /ON CONFLICT \(source_name, entity_type, source_key, reason_code\) DO NOTHING/
);
assert.match(quarantineBlock, /createHash\("sha256"\)/);

const writeBlock = sourceBlock("async function writeRaceVideo(", "function parseOptions(");
assert.match(
  writeBlock,
  /ON CONFLICT \("raceId", "sourceProvider", "kind"\) \$\{conflictSql\}/,
  "RaceVideo writes must use the stable race/provider/kind identity"
);
assert.match(
  writeBlock,
  /conflictMode === "preserve"[\s\S]*?Prisma\.sql`DO NOTHING`/,
  "legacy normalization must preserve an existing RaceVideo row"
);
for (const protectedColumn of [
  "raceId",
  "sourceProvider",
  "sourceId",
  "kind",
  "pageUrl",
  "createdAt",
]) {
  assert.doesNotMatch(
    writeBlock,
    new RegExp(`"${protectedColumn}"\\s*=`),
    `provider enrichment must not overwrite ${protectedColumn}`
  );
}
assert.match(
  writeBlock,
  /"sourceRawJson" = COALESCE\("RaceVideo"\."sourceRawJson", EXCLUDED\."sourceRawJson"\)/,
  "provider enrichment must preserve existing non-null provenance"
);

const sqlWrites = [...source.matchAll(/\b(?:INSERT INTO|UPDATE|DELETE FROM|TRUNCATE)\s+([^\s(]+)/g)]
  .map((match) => match[0])
  .filter((statement) => !statement.startsWith("UPDATE SET"));
assert.deepEqual(
  sqlWrites,
  [
    "INSERT INTO _giq_history_merge.quarantine",
    'INSERT INTO "RaceVideo"',
  ],
  "the script may write only candidate-local quarantine and RaceVideo rows"
);
assert.doesNotMatch(source, /(?:INSERT INTO|UPDATE|DELETE FROM|TRUNCATE)[^\n]*(?:giq_rehearsal_restore_v8|giq_full_history_rehearsal_20260716_r2)/);

assert.ok(
  source.indexOf("normaliseLegacyRaceReplayUrls(options)") <
    source.indexOf("backfillTheDogs(options)"),
  "recognized legacy replay references must be normalized before provider resolution"
);
assert.match(source, /normalizeOnly: flags\.has\("normalize-only"\)/);
assert.match(source, /sourceIds\.size !== 1/);
assert.match(source, /videoIds\.length !== 1/);
assert.match(source, /perSourceDate:/);
assert.match(source, /unresolvedSamples/);
assert.match(
  source,
  /\["NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"\]/,
  "the audit must explicitly cover every supported provider jurisdiction"
);

console.log("candidate-only all-state race replay backfill contract checks passed");
