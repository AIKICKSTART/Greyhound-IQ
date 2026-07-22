import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import {
  chmod,
  lstat,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import { basename, resolve } from "node:path";
import { createInterface } from "node:readline";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { createGunzip, createGzip } from "node:zlib";
import {
  CLASSIFICATIONS,
  CUTOFF,
  DATABASE_NAME,
  INVENTORY_SCHEMA,
  INVENTORY_VERSION,
  RUNTIME_CANDIDATE_LIMIT,
  STALE_AFTER_SECONDS,
  emptyClassificationCounts,
  redactDiagnostic,
  sha256Text,
} from "./lib.mjs";

const LEDGER_NAME = "race-replay-inventory.restricted.jsonl.gz";
const AGGREGATES_NAME = "replay-aggregates.json";
const ANOMALIES_NAME = "replay-anomalies.jsonl.gz";
const CONTEXT_NAME = "export-context.json";
const MANIFEST_NAME = "manifest.json";
const CLASSIFICATION_SET = new Set(CLASSIFICATIONS);
const MAX_LINE_BYTES = 64 * 1024 * 1024;

function assertInteger(value, label, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${label} must be a safe integer >= ${minimum}`);
  }
}

function assertDigest(value, label) {
  if (value != null && !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${label} is not a SHA-256 digest`);
  }
}

function assertNoRawPayloads(record) {
  const stack = [record];
  while (stack.length > 0) {
    const value = stack.pop();
    if (!value || typeof value !== "object") continue;
    for (const [key, child] of Object.entries(value)) {
      if (key === "sourceRawJson" || key === "profileSourceRawJson" || key === "gpsData") {
        throw new Error(`Raw payload field ${key} is forbidden in the ledger`);
      }
      if (key.endsWith("Sha256")) assertDigest(child, key);
      if (child && typeof child === "object") stack.push(child);
    }
  }
}

function expectedClassification(record) {
  if (record.flags?.identityConflict) return "identity_conflict";
  if (record.videos.some((video) => video.thedogsLicenceGate)) {
    return "license_gated_unverified";
  }
  if (
    record.videos.length > 0 &&
    record.videos.every((video) =>
      !video.syntheticIngest &&
      Number.isInteger(video.sourceStatus) &&
      (video.sourceStatus < 200 || video.sourceStatus >= 300)
    )
  ) return "stored_source_failure_only";
  if (record.videos.some((video) => video.directStreamShape || video.embedShape)) {
    return "structurally_resolvable_unverified";
  }
  if (record.videos.some((video) => video.providerResolvableShape)) {
    return "provider_resolvable_unverified";
  }
  if (record.videos.length > 0) return "partial_source";
  if (typeof record.race?.replayUrl === "string" && record.race.replayUrl.trim()) {
    return "legacy_reference_unverified";
  }
  const state = String(record.track?.state ?? "").trim().toUpperCase();
  if (["ACT", "NSW", "NZ", "QLD", "SA", "TAS", "VIC", "WA"].includes(state)) {
    return "provider_discovery_unverified";
  }
  return "no_stored_replay_evidence";
}

export function validateInventoryRecord(record, lineNumber) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error(`Line ${lineNumber} is not one JSON object`);
  }
  const meta = record.inventory;
  if (
    meta?.schema !== INVENTORY_SCHEMA ||
    meta?.version !== INVENTORY_VERSION ||
    meta?.database !== DATABASE_NAME ||
    meta?.cutoff !== CUTOFF ||
    meta?.runtimeCandidateLimit !== RUNTIME_CANDIDATE_LIMIT ||
    meta?.staleAfterSeconds !== STALE_AFTER_SECONDS ||
    meta?.playbackVerified !== false ||
    typeof meta?.generatedAt !== "string" ||
    typeof meta?.snapshotId !== "string" ||
    meta.snapshotId.length === 0
  ) {
    throw new Error(`Line ${lineNumber} has an invalid fail-closed inventory header`);
  }
  assertInteger(meta.expectedRaceCount, `Line ${lineNumber} expectedRaceCount`, 1);
  if (typeof record.race?.id !== "string" || record.race.id.length === 0) {
    throw new Error(`Line ${lineNumber} has no canonical race ID`);
  }
  if (
    typeof record.meeting?.id !== "string" ||
    typeof record.meeting?.meetingDate !== "string" ||
    typeof record.track?.id !== "string" ||
    typeof record.track?.name !== "string" ||
    typeof record.track?.state !== "string"
  ) {
    throw new Error(`Line ${lineNumber} has incomplete meeting or track identity`);
  }
  if (!CLASSIFICATION_SET.has(record.classification)) {
    throw new Error(`Line ${lineNumber} has a forbidden classification`);
  }
  if (record.playbackStatus !== "unverified") {
    throw new Error(`Line ${lineNumber} makes a playback claim`);
  }
  if (!Array.isArray(record.runners) || !Array.isArray(record.videos)) {
    throw new Error(`Line ${lineNumber} runners/videos are not arrays`);
  }
  assertInteger(record.videoCandidateCount, `Line ${lineNumber} videoCandidateCount`);
  if (record.videoCandidateCount !== record.videos.length) {
    throw new Error(`Line ${lineNumber} candidate count does not match videos`);
  }
  if (record.runtimeTruncationRisk !== (record.videos.length > RUNTIME_CANDIDATE_LIMIT)) {
    throw new Error(`Line ${lineNumber} runtime truncation flag is inconsistent`);
  }

  const runnerIds = new Set();
  for (const runner of record.runners) {
    if (
      typeof runner?.id !== "string" ||
      runnerIds.has(runner.id) ||
      typeof runner?.dog?.id !== "string" ||
      typeof runner?.dog?.name !== "string" ||
      (runner.result && runner.result.runnerId !== runner.id)
    ) {
      throw new Error(`Line ${lineNumber} has invalid runner, dog, or result identity`);
    }
    runnerIds.add(runner.id);
  }
  const resultRaceMismatch = record.runners.some(
    (runner) => runner.result && runner.result.raceId !== runner.raceId
  );
  if (record.flags?.resultRaceMismatch !== resultRaceMismatch) {
    throw new Error(`Line ${lineNumber} result-race mismatch flag is inconsistent`);
  }
  if (record.runners.some((runner) => runner?.raceId !== record.race.id)) {
    throw new Error(`Line ${lineNumber} contains a runner from another race`);
  }
  const sourceIdentityCollision = record.videos.some((video) => video.sourceIdentityRaceCount > 1);
  const pageUrlCollision = record.videos.some((video) => video.pageUrlRaceCount > 1);
  const streamUrlCollision = record.videos.some((video) => video.streamUrlRaceCount > 1);
  const streamResourceCollision = record.videos.some((video) => video.streamResourceRaceCount > 1);
  const providerStateMismatch = record.videos.some((video) => video.providerStateMismatch);
  const possibleSignedExpiryQuery = record.videos.some((video) => video.possibleSignedExpiryQuery);
  const thedogsLicenceGate = record.videos.some((video) => video.thedogsLicenceGate);
  const syntheticOrStale = record.videos.some((video) => video.syntheticOrStale);
  const legacyTheDogsConflict =
    record.legacyTheDogsReplayId != null &&
    record.videos.some(
      (video) =>
        normalizedProvider(video.sourceProvider) === "thedogs" &&
        String(video.sourceId ?? "").trim() !== String(record.legacyTheDogsReplayId)
    );
  const flagChecks = {
    sourceIdentityCollision,
    pageUrlCollision,
    streamUrlCollision,
    streamResourceCollision,
    legacyTheDogsConflict,
    providerStateMismatch,
    possibleSignedExpiryQuery,
    thedogsLicenceGate,
    syntheticOrStale,
  };
  for (const [flag, expected] of Object.entries(flagChecks)) {
    if (record.flags?.[flag] !== expected) {
      throw new Error(`Line ${lineNumber} ${flag} is inconsistent`);
    }
  }
  const identityConflict =
    resultRaceMismatch ||
    sourceIdentityCollision ||
    pageUrlCollision ||
    streamUrlCollision ||
    streamResourceCollision ||
    legacyTheDogsConflict ||
    providerStateMismatch;
  if (record.flags?.identityConflict !== identityConflict) {
    throw new Error(`Line ${lineNumber} identityConflict is inconsistent`);
  }
  if (record.classification !== expectedClassification(record)) {
    throw new Error(`Line ${lineNumber} provisional classification is inconsistent`);
  }

  const ranks = new Set();
  let primaryCount = 0;
  const primaryCandidates = [];
  for (const video of record.videos) {
    if (video?.raceId !== record.race.id) {
      throw new Error(`Line ${lineNumber} contains a video from another race`);
    }
    if (
      video.playbackStatus !== "unverified" ||
      video.licensingStatus !== (video.thedogsLicenceGate ? "license_gated" : "unverified") ||
      video.fieldCoherenceVerified !== false
    ) {
      throw new Error(`Line ${lineNumber} has an unsafe playback or licensing status`);
    }
    for (const field of [
      "sourceIdentityRaceCount",
      "pageUrlRaceCount",
      "streamUrlRaceCount",
      "streamResourceRaceCount",
    ]) {
      assertInteger(video[field], `Line ${lineNumber} ${field}`);
    }
    assertInteger(video.fetchedRank, `Line ${lineNumber} fetchedRank`, 1);
    if (ranks.has(video.fetchedRank)) throw new Error(`Line ${lineNumber} repeats a fetched rank`);
    ranks.add(video.fetchedRank);
    const expectedLoaded = video.fetchedRank <= RUNTIME_CANDIDATE_LIMIT;
    if (video.runtimeLoaded !== expectedLoaded) {
      throw new Error(`Line ${lineNumber} runtimeLoaded is inconsistent`);
    }
    if (typeof video.runtimePrimary !== "boolean") {
      throw new Error(`Line ${lineNumber} runtimePrimary is not boolean`);
    }
    if (
      expectedLoaded &&
      typeof video.streamUrl === "string" &&
      video.streamUrl.trim().length > 0
    ) {
      primaryCandidates.push(video.fetchedRank);
    }
    if (video.runtimePrimary === true) primaryCount += 1;
  }
  for (let rank = 1; rank <= record.videos.length; rank += 1) {
    if (!ranks.has(rank)) throw new Error(`Line ${lineNumber} fetched ranks are not contiguous`);
  }
  if (primaryCount > 1) throw new Error(`Line ${lineNumber} has multiple runtime primaries`);
  const expectedPrimaryRank = primaryCandidates.length > 0 ? Math.min(...primaryCandidates) : null;
  const markedPrimary = record.videos.find((video) => video.runtimePrimary === true)?.fetchedRank ?? null;
  if (markedPrimary !== expectedPrimaryRank) {
    throw new Error(`Line ${lineNumber} runtime primary is not the first loaded truthy stream`);
  }

  assertNoRawPayloads(record);
  return record;
}

function newRaceAggregate(identity = {}) {
  return {
    ...identity,
    races: 0,
    withVideoCandidates: 0,
    withLegacyReference: 0,
    withStoredReplayEvidence: 0,
    runtimeTruncationRisks: 0,
    identityConflicts: 0,
    syntheticOrStale: 0,
    classifications: emptyClassificationCounts(),
  };
}

function incrementRaceAggregate(group, record) {
  group.races += 1;
  if (record.videoCandidateCount > 0) group.withVideoCandidates += 1;
  const hasLegacyReference =
    typeof record.race.replayUrl === "string" && record.race.replayUrl.trim();
  if (hasLegacyReference) {
    group.withLegacyReference += 1;
  }
  if (record.videoCandidateCount > 0 || hasLegacyReference) group.withStoredReplayEvidence += 1;
  if (record.runtimeTruncationRisk) group.runtimeTruncationRisks += 1;
  if (record.flags?.identityConflict) group.identityConflicts += 1;
  if (record.flags?.syntheticOrStale) group.syntheticOrStale += 1;
  group.classifications[record.classification] += 1;
}

function mapGroup(map, key, identity) {
  let group = map.get(key);
  if (!group) {
    group = newRaceAggregate(identity);
    map.set(key, group);
  }
  return group;
}

function providerGroup(map, provider) {
  let group = map.get(provider);
  if (!group) {
    group = {
      provider,
      races: 0,
      candidateRows: 0,
      successfulSourceMetadataRows: 0,
      failedSourceMetadataRows: 0,
      unknownSourceMetadataRows: 0,
      syntheticIngestRows: 0,
      directStreamShapes: 0,
      embedShapes: 0,
      providerResolvableShapes: 0,
      collisionRows: 0,
      possibleSignedExpiryRows: 0,
      licenceGatedRows: 0,
      syntheticOrStaleRows: 0,
    };
    map.set(provider, group);
  }
  return group;
}

function normalizedProvider(value) {
  const provider = typeof value === "string" ? value.trim().toLowerCase() : "";
  return provider || "(blank)";
}

function anomalyFor(record) {
  const videos = record.videos.filter((video) =>
    video.sourceIdentityRaceCount > 1 ||
    video.pageUrlRaceCount > 1 ||
    video.streamUrlRaceCount > 1 ||
    video.streamResourceRaceCount > 1 ||
    video.providerStateMismatch ||
    video.possibleSignedExpiryQuery ||
    video.thedogsLicenceGate ||
    video.syntheticOrStale
  );
  const hasAnomaly =
    record.runtimeTruncationRisk ||
    record.flags?.resultRaceMismatch ||
    record.flags?.legacyTheDogsConflict ||
    videos.length > 0;
  if (!hasAnomaly) return null;
  return {
    raceId: record.race.id,
    meetingDate: record.meeting?.meetingDate ?? null,
    raceNumber: record.race?.raceNumber ?? null,
    trackId: record.track?.id ?? null,
    state: record.track?.state ?? null,
    classification: record.classification,
    flags: record.flags,
    runtimeTruncationRisk: record.runtimeTruncationRisk,
    candidateFlags: videos.map((video) => ({
      provider: normalizedProvider(video.sourceProvider),
      fetchedRank: video.fetchedRank,
      sourceIdentityRaceCount: video.sourceIdentityRaceCount,
      pageUrlRaceCount: video.pageUrlRaceCount,
      streamUrlRaceCount: video.streamUrlRaceCount,
      streamResourceRaceCount: video.streamResourceRaceCount,
      providerStateMismatch: Boolean(video.providerStateMismatch),
      possibleSignedExpiryQuery: Boolean(video.possibleSignedExpiryQuery),
      thedogsLicenceGate: Boolean(video.thedogsLicenceGate),
      syntheticOrStale: Boolean(video.syntheticOrStale),
      pageUrlSha256: video.pageUrl ? sha256Text(video.pageUrl) : null,
      streamUrlSha256: video.streamUrl ? sha256Text(video.streamUrl) : null,
      streamResourceSha256: video.streamUrl
        ? sha256Text(video.streamUrl.replace(/[?#].*$/, ""))
        : null,
    })),
  };
}

function assertNoShareableUrls(value, label) {
  if (/https?:\/\//i.test(JSON.stringify(value))) {
    throw new Error(`${label} unexpectedly contains a full URL`);
  }
}

async function sha256File(path) {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
    bytes += chunk.length;
  }
  return { bytes, sha256: hash.digest("hex") };
}

function withCoverage(group) {
  const percent = (count) => Number(((count / group.races) * 100).toFixed(6));
  return {
    ...group,
    storedCandidateCoveragePercent: percent(group.withVideoCandidates),
    storedEvidenceCoveragePercent: percent(group.withStoredReplayEvidence),
    verifiedPlaybackCoveragePercent: null,
  };
}

function sortValues(values, fields) {
  return [...values].sort((left, right) => {
    for (const field of fields) {
      const order = String(left[field] ?? "").localeCompare(String(right[field] ?? ""));
      if (order !== 0) return order;
    }
    return 0;
  });
}

function sortRaceGroups(groups, fields) {
  return sortValues([...groups.values()].map(withCoverage), fields);
}

async function assertInputFile(path) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error(`${basename(path)} must be one regular, non-symlink file`);
  }
}

export async function verifyInventoryRun(runDirectory, { finalize = false } = {}) {
  const partialDirectory = resolve(runDirectory);
  const directoryInfo = await lstat(partialDirectory);
  if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) {
    throw new Error("Inventory run must be a real directory");
  }
  if (finalize && !basename(partialDirectory).endsWith(".partial")) {
    throw new Error("Atomic finalization requires a run directory ending in .partial");
  }

  const ledgerPath = resolve(partialDirectory, LEDGER_NAME);
  const contextPath = resolve(partialDirectory, CONTEXT_NAME);
  await Promise.all([assertInputFile(ledgerPath), assertInputFile(contextPath)]);
  const context = JSON.parse(await readFile(contextPath, "utf8"));
  if (
    context?.database !== DATABASE_NAME ||
    context?.cutoff !== CUTOFF ||
    context?.container?.networkMode !== "none" ||
    context?.container?.publishedPorts !== 0 ||
    context?.preflight?.database !== DATABASE_NAME ||
    context?.preflight?.readOnly !== true ||
    context?.preflight?.isolation !== "repeatable read" ||
    context?.preflight?.unixSocket !== true ||
    context?.preflight?.sessionUser !== "postgres" ||
    context?.preflight?.pgcrypto !== true ||
    context?.rawLedgerContainsRestrictedUrls !== true ||
    context?.playbackVerified !== false
  ) {
    throw new Error("Export context does not prove the isolated fail-closed boundary");
  }

  const aggregatePath = resolve(partialDirectory, AGGREGATES_NAME);
  const anomalyPath = resolve(partialDirectory, ANOMALIES_NAME);
  const manifestPath = resolve(partialDirectory, MANIFEST_NAME);
  const overall = newRaceAggregate();
  const years = new Map();
  const states = new Map();
  const tracks = new Map();
  const providers = new Map();
  const raceIds = new Set();
  let expectedRaceCount = null;
  let sourceHeader = null;
  let lineCount = 0;
  let anomalyCount = 0;

  const ledgerHash = createHash("sha256");
  const hashTap = new Transform({
    transform(chunk, _encoding, callback) {
      ledgerHash.update(chunk);
      callback(null, chunk);
    },
  });
  const decompressed = createReadStream(ledgerPath).pipe(hashTap).pipe(createGunzip());
  const lines = createInterface({ input: decompressed, crlfDelay: Infinity });
  const anomalyGzip = createGzip({ level: 6 });
  const anomalyOutput = createWriteStream(anomalyPath, { flags: "wx", mode: 0o600 });
  const anomalyDone = pipeline(anomalyGzip, anomalyOutput);

  try {
    for await (const line of lines) {
      lineCount += 1;
      if (Buffer.byteLength(line) > MAX_LINE_BYTES) {
        throw new Error(`Line ${lineCount} exceeds the 64 MiB safety ceiling`);
      }
      let record;
      try {
        record = JSON.parse(line);
      } catch {
        throw new Error(`Line ${lineCount} is not valid JSON`);
      }
      validateInventoryRecord(record, lineCount);
      if (raceIds.has(record.race.id)) {
        throw new Error(`Line ${lineCount} duplicates canonical race ID ${record.race.id}`);
      }
      raceIds.add(record.race.id);

      const header = record.inventory;
      const comparableHeader = {
        schema: header.schema,
        version: header.version,
        generatedAt: header.generatedAt,
        snapshotId: header.snapshotId,
        database: header.database,
        cutoff: header.cutoff,
        expectedRaceCount: header.expectedRaceCount,
        runtimeCandidateLimit: header.runtimeCandidateLimit,
        staleAfterSeconds: header.staleAfterSeconds,
        playbackVerified: header.playbackVerified,
      };
      if (!sourceHeader) {
        sourceHeader = comparableHeader;
        expectedRaceCount = header.expectedRaceCount;
      } else if (JSON.stringify(comparableHeader) !== JSON.stringify(sourceHeader)) {
        throw new Error(`Line ${lineCount} does not share the exact snapshot header`);
      }

      const year = String(record.meeting?.meetingDate ?? record.race?.raceTime ?? "").slice(0, 4);
      const state = String(record.track?.state ?? "(blank)").trim().toUpperCase() || "(blank)";
      const trackId = String(record.track?.id ?? "(blank)");
      incrementRaceAggregate(overall, record);
      incrementRaceAggregate(mapGroup(years, year, { year }), record);
      incrementRaceAggregate(mapGroup(states, state, { state }), record);
      incrementRaceAggregate(
        mapGroup(tracks, `${state}\u0000${trackId}`, {
          state,
          trackId,
          trackName: String(record.track?.name ?? ""),
        }),
        record
      );

      const raceProviders = new Set();
      for (const video of record.videos) {
        const provider = normalizedProvider(video.sourceProvider);
        const group = providerGroup(providers, provider);
        raceProviders.add(provider);
        group.candidateRows += 1;
        if (video.syntheticIngest) group.syntheticIngestRows += 1;
        else if (Number.isInteger(video.sourceStatus) && video.sourceStatus >= 200 && video.sourceStatus < 300) {
          group.successfulSourceMetadataRows += 1;
        } else if (Number.isInteger(video.sourceStatus)) group.failedSourceMetadataRows += 1;
        else group.unknownSourceMetadataRows += 1;
        if (video.directStreamShape) group.directStreamShapes += 1;
        if (video.embedShape) group.embedShapes += 1;
        if (video.providerResolvableShape) group.providerResolvableShapes += 1;
        if (
          video.sourceIdentityRaceCount > 1 ||
          video.pageUrlRaceCount > 1 ||
          video.streamUrlRaceCount > 1 ||
          video.streamResourceRaceCount > 1
        ) group.collisionRows += 1;
        if (video.possibleSignedExpiryQuery) group.possibleSignedExpiryRows += 1;
        if (video.thedogsLicenceGate) group.licenceGatedRows += 1;
        if (video.syntheticOrStale) group.syntheticOrStaleRows += 1;
      }
      for (const provider of raceProviders) providerGroup(providers, provider).races += 1;

      const anomaly = anomalyFor(record);
      if (anomaly) {
        assertNoShareableUrls(anomaly, "Anomaly row");
        anomalyCount += 1;
        if (!anomalyGzip.write(`${JSON.stringify(anomaly)}\n`)) {
          await new Promise((accept) => anomalyGzip.once("drain", accept));
        }
      }
    }
    anomalyGzip.end();
    await anomalyDone;
  } catch (error) {
    anomalyGzip.destroy(error);
    anomalyOutput.destroy(error);
    await anomalyDone.catch(() => {});
    throw error;
  }

  if (lineCount === 0 || lineCount !== expectedRaceCount || raceIds.size !== lineCount) {
    throw new Error(
      `Inventory count gate failed: expected ${expectedRaceCount}, lines ${lineCount}, unique ${raceIds.size}`
    );
  }

  const aggregates = {
    schema: "greyhoundiq.replay-production-inventory.aggregates",
    version: 1,
    generatedAt: new Date().toISOString(),
    source: sourceHeader,
    semantics: {
      sourceStatusIsPlaybackProof: false,
      provisionalClassificationsOnly: true,
      rawLedgerRestricted: true,
    },
    overall: withCoverage(overall),
    years: sortRaceGroups(years, ["year"]),
    states: sortRaceGroups(states, ["state"]),
    tracks: sortRaceGroups(tracks, ["state", "trackName", "trackId"]),
    providers: sortValues(providers.values(), ["provider"]).map((provider) => ({
      ...provider,
      candidateRaceSharePercent: Number(((provider.races / overall.races) * 100).toFixed(6)),
    })),
    anomalies: anomalyCount,
  };
  assertNoShareableUrls(aggregates, "Aggregate report");
  await writeFile(aggregatePath, `${JSON.stringify(aggregates, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  await Promise.all([chmod(aggregatePath, 0o600), chmod(anomalyPath, 0o600)]);

  const [ledger, aggregate, anomalies, exportContext] = await Promise.all([
    sha256File(ledgerPath),
    sha256File(aggregatePath),
    sha256File(anomalyPath),
    sha256File(contextPath),
  ]);
  if (ledger.sha256 !== ledgerHash.digest("hex")) {
    throw new Error("Compressed ledger hash changed during verification");
  }
  const manifest = {
    schema: "greyhoundiq.replay-production-inventory.manifest",
    version: 1,
    createdAt: new Date().toISOString(),
    database: DATABASE_NAME,
    cutoff: CUTOFF,
    snapshot: sourceHeader,
    lineCount,
    uniqueRaceIds: raceIds.size,
    anomalyCount,
    playbackVerified: false,
    files: {
      [LEDGER_NAME]: { ...ledger, restricted: true, containsUrls: true },
      [AGGREGATES_NAME]: { ...aggregate, restricted: false, containsUrls: false },
      [ANOMALIES_NAME]: { ...anomalies, restricted: false, containsUrls: false },
      [CONTEXT_NAME]: { ...exportContext, restricted: false, containsUrls: false },
    },
  };
  assertNoShareableUrls(manifest, "Manifest");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  await chmod(manifestPath, 0o600);

  let finalDirectory = partialDirectory;
  if (finalize) {
    finalDirectory = partialDirectory.slice(0, -".partial".length);
    try {
      await lstat(finalDirectory);
      throw new Error("Final inventory directory already exists");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    await rename(partialDirectory, finalDirectory);
  }
  return {
    directory: finalDirectory,
    manifest,
    manifestPath: resolve(finalDirectory, MANIFEST_NAME),
  };
}

function parseCli(argv) {
  if (argv.length < 1 || argv.length > 2 || (argv[1] && argv[1] !== "--finalize")) {
    throw new Error("Usage: node verify.mjs RUN_DIRECTORY[.partial] [--finalize]");
  }
  return { directory: argv[0], finalize: argv[1] === "--finalize" };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  Promise.resolve()
    .then(() => parseCli(process.argv.slice(2)))
    .then(({ directory, finalize }) => verifyInventoryRun(directory, { finalize }))
    .then((result) => {
      process.stdout.write(
        `Replay inventory verified: ${result.manifest.lineCount} unique races; ` +
        `${result.manifest.anomalyCount} provisional anomaly rows\n`
      );
    })
    .catch((error) => {
      process.stderr.write(`Replay inventory verification failed: ${redactDiagnostic(error?.message ?? error)}\n`);
      process.exitCode = 1;
    });
}
