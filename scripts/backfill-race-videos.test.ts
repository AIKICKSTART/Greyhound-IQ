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
  mainBlock.indexOf("await assertCandidateReplayTarget(options)") <
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
  "async function assertCandidateReplayTarget(options: Options)",
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
assert.match(targetBlock, /if \(options\.nativeLocal\)/);
assert.match(targetBlock, /!isExpectedNativeHost\(identity\.host\)/);
assert.match(targetBlock, /identity\.port !== EXPECTED_NATIVE_PORT/);
assert.match(
  targetBlock,
  /Math\.trunc\(identity\.serverVersionNum \/ 10_000\) !==[\s\S]*?EXPECTED_NATIVE_POSTGRES_MAJOR/
);
assert.match(
  targetBlock,
  /sameWindowsPath\(identity\.dataDirectory, EXPECTED_NATIVE_DATA_DIRECTORY\)/
);
assert.match(source, /const EXPECTED_NATIVE_HOST = "127\.0\.0\.1";/);
assert.match(source, /const EXPECTED_NATIVE_PORT = 55435;/);
assert.match(source, /const EXPECTED_NATIVE_POSTGRES_MAJOR = 16;/);
assert.ok(
  source.includes(
    '"G:\\\\GreyhoundIQ\\\\native-postgres16-canonical\\\\data"'
  )
);
assert.doesNotMatch(source, /const EXPECTED_NATIVE_PORT = 55434;/);
assert.ok(
  !source.includes('"C:\\\\GreyhoundIQ\\\\native-postgres16\\\\data"'),
  "the replay guard must reject the original pre-canonical native candidate"
);
assert.match(source, /nativeLocal: flags\.has\("native-local"\)/);
assert.match(source, /race_videos\.native_candidate_identity_mismatch/);
assert.match(
  source,
  /value === EXPECTED_NATIVE_HOST \|\| value === `\$\{EXPECTED_NATIVE_HOST\}\/32`/,
  "Prisma may render the exact IPv4 loopback inet value with its /32 mask"
);
assert.match(targetBlock, /_giq_history_merge\.run/);
assert.match(targetBlock, /_giq_history_stage\.media_resolution/);
assert.match(targetBlock, /_giq_history_merge\.snapshot_race_video_proof/);
assert.match(targetBlock, /_giq_history_merge\.canonical_table_delta/);
assert.match(targetBlock, /_giq_history_merge\.verification_check/);
assert.match(targetBlock, /!identity\.canonicalDeltaPresent/);
assert.match(targetBlock, /!identity\.verificationCheckPresent/);
assert.ok(
  source.includes(
    'const EXPECTED_NORMALIZED_HISTORY_CUTOFF = "2026-07-16T16:12:26.544Z";'
  ),
  "the replay guard must use the current normalized history lineage cutoff"
);
assert.doesNotMatch(
  source,
  /2026-07-01T02:49:36\.504Z/,
  "the stale pre-v2 history cutoff must not remain in the replay guard"
);
assert.doesNotMatch(source, /EXPECTED_HISTORY_CUTOFF/);
assert.ok(
  source.includes(
    '"13bc8d83c048633b57c5299ec1e778179276fee855182b9c932f8a28a77fbf1c"'
  ),
  "the exact current normalized manifest must be pinned"
);
assert.match(targetBlock, /marker\.phase !== "canonical_merged"/);
assert.ok(
  targetBlock.indexOf(
    'throw new Error("race_videos.candidate_merge_phase_mismatch")'
  ) < targetBlock.indexOf("if (!identity.canonicalDeltaPresent"),
  "a pre-canonical candidate must fail at the phase guard before canonical proof relations are read"
);
assert.match(targetBlock, /normalized_manifest_sha256 AS "normalizedManifestSha256"/);
assert.match(targetBlock, /normalized_transform_version AS "normalizedTransformVersion"/);
assert.match(
  targetBlock,
  /marker\.normalizedManifestSha256 !== EXPECTED_NORMALIZED_MANIFEST_SHA256/
);
assert.match(
  targetBlock,
  /marker\.normalizedTransformVersion !== EXPECTED_NORMALIZED_TRANSFORM_VERSION/
);
assert.match(
  source,
  /const EXPECTED_NORMALIZED_TRANSFORM_VERSION = "thedogs-normalized-harvest\/v2";/
);
assert.match(targetBlock, /normalization_manifest/);
assert.match(targetBlock, /!marker\.normalizationManifestValid/);
assert.match(targetBlock, /canonical_merged_at AS "canonicalMergedAt"/);
assert.match(targetBlock, /marker\.canonicalMergedAt === null/);
assert.match(targetBlock, /live_delta_applied_at AS "liveDeltaAppliedAt"/);
assert.match(targetBlock, /verified_at AS "verifiedAt"/);
assert.match(targetBlock, /canonical_merge_manifest/);
assert.match(targetBlock, /marker\.canonicalMergeManifest === null/);
assert.match(targetBlock, /!proof\.canonicalManifestValid/);
assert.match(targetBlock, /canonical_delta\.manifest/);
assert.match(targetBlock, /EXPECTED_CANONICAL_DELTA_TABLES\.length/);
assert.match(targetBlock, /proof\.canonicalDeltaUnexpectedRows !== BigInt\(0\)/);
const canonicalDeltaArray = source.match(
  /const EXPECTED_CANONICAL_DELTA_TABLES = \[([\s\S]*?)\] as const;/
);
assert.ok(canonicalDeltaArray, "the canonical delta proof table set must be explicit");
assert.deepEqual(
  [...canonicalDeltaArray[1].matchAll(/"([A-Za-z]+)"/g)].map((match) => match[1]),
  [
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
    "PedigreeImportRun",
    "DogSourceIdentity",
    "PedigreeAssertion",
    "PedigreeMergeLedger",
  ],
  "the replay guard must bind the exact table delta set created by merge-canonical.sql"
);
assert.match(targetBlock, /check_name = 'canonical_merge_partition'/);
assert.match(targetBlock, /proof\.canonicalVerificationRows !== BigInt\(1\)/);
assert.match(targetBlock, /check_name = 'race_media_partition'/);
assert.match(targetBlock, /proof\.raceMediaVerificationRows !== BigInt\(1\)/);
assert.match(targetBlock, /check_name = 'standalone_replay_membership'/);
assert.match(targetBlock, /proof\.standaloneReplayVerificationRows !== BigInt\(1\)/);
assert.match(targetBlock, /race_videos\.candidate_merge_proof_mismatch/);
assert.ok(
  source.includes(
    '"89b90198d3197238a2476381c0917108f21d2e209c02ca066e8ec90c1e8385b1"'
  ),
  "the replay normalization artifact must be pinned independently of its taxonomy counts"
);
assert.ok(
  source.includes(
    '"aa6e63533daf5dd8c8e0aa2d5654b91f49140aeb2338904664430551600aae16"'
  ),
  "the standalone replay evidence contract must be pinned"
);
assert.match(targetBlock, /replay_evidence_staged_at AS "replayEvidenceStagedAt"/);
assert.match(targetBlock, /marker\.replayEvidenceStagedAt === null/);
assert.match(targetBlock, /marker\.liveDeltaAppliedAt !== null/);
assert.match(targetBlock, /marker\.liveDeltaSourceManifest !== null/);
assert.match(targetBlock, /marker\.verifiedAt !== null/);
assert.match(targetBlock, /marker\.verificationManifest !== null/);
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
  /const SUPPORTED_JURISDICTIONS = \[[\s\S]*?"ACT"[\s\S]*?"NSW"[\s\S]*?"NT"[\s\S]*?"QLD"[\s\S]*?"SA"[\s\S]*?"TAS"[\s\S]*?"VIC"[\s\S]*?"WA"[\s\S]*?\];/,
  "the audit must explicitly cover every supported provider jurisdiction"
);

const providerCollisionBlock = sourceBlock(
  "async function auditProviderSourceCollisions()",
  "async function auditReplayUrlEvidenceConflicts(options: Options)"
);
assert.match(
  providerCollisionBlock,
  /GROUP BY rv\."sourceProvider", rv\."sourceId"/
);
assert.match(
  providerCollisionBlock,
  /HAVING COUNT\(DISTINCT rv\."raceId"\) > 1/
);
assert.match(providerCollisionBlock, /mode: "read-only"|scope: "all RaceVideo rows"/);

const replayConflictBlock = sourceBlock(
  "async function auditReplayUrlEvidenceConflicts(options: Options)",
  "async function backfillTheDogs(options: Options)"
);
assert.match(replayConflictBlock, /normaliseLegacyRaceReplaySource/);
assert.match(
  replayConflictBlock,
  /rv\."sourceId" IS DISTINCT FROM expected\."sourceId"/
);
assert.match(replayConflictBlock, /JOIN "RaceVideo" rv/);
assert.doesNotMatch(replayConflictBlock, /INSERT INTO|UPDATE|DELETE FROM|TRUNCATE/);

console.log("candidate-only all-state race replay backfill contract checks passed");
