import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, isAbsolute, parse, relative, resolve } from "node:path";
import { createInterface } from "node:readline";
import { Transform } from "node:stream";
import { fileURLToPath } from "node:url";
import { createGunzip } from "node:zlib";
import {
  CUTOFF,
  DATABASE_NAME,
  emptyClassificationCounts,
  redactDiagnostic,
} from "./lib.mjs";
import { validateInventoryRecord } from "./verify.mjs";

const LEDGER_NAME = "race-replay-inventory.restricted.jsonl.gz";
const CONTEXT_NAME = "export-context.json";
const UPSTREAM_MANIFEST_NAME = "manifest.json";
const COVERAGE_NAME = "replay-month-coverage.json";
const SCOPE_NAME = "scope-evidence.json";
const COMPANION_MANIFEST_NAME = "companion-manifest.json";
const SUMS_NAME = "SHA256SUMS";
const MAX_JSON_BYTES = 1024 * 1024;
const MAX_LINE_BYTES = 64 * 1024 * 1024;
const INVENTORY_SQL = resolve(dirname(fileURLToPath(import.meta.url)), "inventory.sql");

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value == null || value.startsWith("--")) {
      throw new Error(
        "Usage: node build-companion.mjs --inventory FINAL_RUN --output NEW_DIRECTORY " +
        "--source-dump FILE --source-dump-sha256 SHA256 --recovery-evidence FILE"
      );
    }
    values.set(key.slice(2), value);
  }
  const names = [
    "inventory",
    "output",
    "source-dump",
    "source-dump-sha256",
    "recovery-evidence",
  ];
  if (values.size !== names.length || names.some((name) => !values.has(name))) {
    throw new Error("All five companion arguments are required and no defaults exist");
  }
  return {
    inventory: values.get("inventory"),
    output: values.get("output"),
    sourceDump: values.get("source-dump"),
    sourceDumpSha256: values.get("source-dump-sha256"),
    recoveryEvidence: values.get("recovery-evidence"),
  };
}

function assertOptions(options) {
  for (const field of ["inventory", "output", "sourceDump", "recoveryEvidence"]) {
    if (!isAbsolute(options[field])) throw new Error(`${field} must be an absolute path`);
  }
  if (resolve(options.output) === parse(resolve(options.output)).root) {
    throw new Error("Output cannot be a filesystem root");
  }
  if (!/^[a-f0-9]{64}$/i.test(options.sourceDumpSha256)) {
    throw new Error("sourceDumpSha256 must be one SHA-256 digest");
  }
}

async function assertAbsent(path, label) {
  try {
    await lstat(path);
    throw new Error(`${label} already exists`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function assertRealDirectory(path, label) {
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new Error(`${label} must be one real directory`);
  }
  return info;
}

async function assertRegularFile(path, label, maximumBytes = null) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error(`${label} must be one regular, non-symlink file`);
  }
  if (maximumBytes != null && info.size > maximumBytes) {
    throw new Error(`${label} exceeds its ${maximumBytes}-byte safety ceiling`);
  }
  return info;
}

async function readJson(path, label) {
  await assertRegularFile(path, label, MAX_JSON_BYTES);
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    throw new Error(`${label} is not valid bounded JSON`);
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

function assertSafeInteger(value, label, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${label} must be a safe integer >= ${minimum}`);
  }
}

function assertDigest(value, label) {
  if (!/^[a-f0-9]{64}$/.test(String(value ?? ""))) {
    throw new Error(`${label} is not a lowercase SHA-256 digest`);
  }
}

function comparableHeader(header) {
  return {
    schema: header?.schema,
    version: header?.version,
    generatedAt: header?.generatedAt,
    snapshotId: header?.snapshotId,
    database: header?.database,
    cutoff: header?.cutoff,
    expectedRaceCount: header?.expectedRaceCount,
    runtimeCandidateLimit: header?.runtimeCandidateLimit,
    staleAfterSeconds: header?.staleAfterSeconds,
    playbackVerified: header?.playbackVerified,
  };
}

function validateUpstreamManifest(manifest) {
  if (
    manifest?.schema !== "greyhoundiq.replay-production-inventory.manifest" ||
    manifest?.version !== 1 ||
    manifest?.database !== DATABASE_NAME ||
    manifest?.cutoff !== CUTOFF ||
    manifest?.playbackVerified !== false
  ) {
    throw new Error("Upstream manifest identity or playback boundary is invalid");
  }
  assertSafeInteger(manifest.lineCount, "manifest lineCount", 1);
  assertSafeInteger(manifest.uniqueRaceIds, "manifest uniqueRaceIds", 1);
  if (
    manifest.lineCount !== manifest.uniqueRaceIds ||
    manifest.snapshot?.expectedRaceCount !== manifest.lineCount ||
    manifest.snapshot?.database !== DATABASE_NAME ||
    manifest.snapshot?.cutoff !== CUTOFF ||
    manifest.snapshot?.playbackVerified !== false
  ) {
    throw new Error("Upstream manifest snapshot/count reconciliation failed");
  }
  for (const [name, expectedFlags] of [
    [LEDGER_NAME, { restricted: true, containsUrls: true }],
    [CONTEXT_NAME, { restricted: false, containsUrls: false }],
  ]) {
    const file = manifest.files?.[name];
    assertSafeInteger(file?.bytes, `${name} bytes`, 1);
    assertDigest(file?.sha256, `${name} sha256`);
    if (
      file.restricted !== expectedFlags.restricted ||
      file.containsUrls !== expectedFlags.containsUrls
    ) {
      throw new Error(`${name} sensitivity flags do not match the verified contract`);
    }
  }
}

function validateContext(context, manifest, contextFile, sqlFile) {
  const preflight = context?.preflight;
  if (
    context?.schema !== "greyhoundiq.replay-production-inventory.export-context" ||
    context?.version !== 1 ||
    context?.database !== DATABASE_NAME ||
    context?.cutoff !== CUTOFF ||
    context?.container?.networkMode !== "none" ||
    context?.container?.publishedPorts !== 0 ||
    !context.container.id ||
    !context.container.name ||
    !context.container.image ||
    preflight?.database !== DATABASE_NAME ||
    preflight?.readOnly !== true ||
    preflight?.isolation !== "repeatable read" ||
    preflight?.unixSocket !== true ||
    preflight?.sessionUser !== "postgres" ||
    preflight?.pgcrypto !== true ||
    context?.rawLedgerContainsRestrictedUrls !== true ||
    context?.playbackVerified !== false
  ) {
    throw new Error("Export context does not prove the isolated read-only boundary");
  }
  for (const [label, count] of [
    ["preflight raceCount", preflight.raceCount],
    ["preflight runnerCount", preflight.runnerCount],
    ["preflight videoCount", preflight.videoCount],
  ]) assertSafeInteger(count, label, label === "preflight raceCount" ? 1 : 0);
  if (preflight.raceCount !== manifest.lineCount) {
    throw new Error("Preflight race count does not match the upstream manifest");
  }
  if (
    contextFile.bytes !== manifest.files[CONTEXT_NAME].bytes ||
    contextFile.sha256 !== manifest.files[CONTEXT_NAME].sha256
  ) {
    throw new Error("Export-context bytes or hash changed after upstream verification");
  }
  assertDigest(context.querySha256, "context querySha256");
  if (context.querySha256 !== sqlFile.sha256) {
    throw new Error("Export context is not bound to the current inventory.sql bytes");
  }
}

function parseUtcTimestamp(value, label, { requireZone = false } = {}) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} is missing`);
  const hasTime = /[T ]\d{2}:\d{2}/.test(text);
  const hasZone = hasTime && /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(text);
  if (requireZone && !hasZone) throw new Error(`${label} has no explicit timezone`);
  let normalized = text.replace(" ", "T");
  if (!hasTime) normalized = `${normalized}T00:00:00Z`;
  else if (!hasZone) normalized = `${normalized}Z`;
  const milliseconds = Date.parse(normalized);
  if (!Number.isFinite(milliseconds)) throw new Error(`${label} is not a valid timestamp`);
  return { milliseconds, iso: new Date(milliseconds).toISOString() };
}

function formatSydney(iso) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Sydney",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      timeZoneName: "short",
    }).formatToParts(new Date(iso)).map(({ type, value }) => [type, value])
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} ${parts.timeZoneName}`;
}

function monthSequence(lowerIso, upperIso) {
  const lower = new Date(lowerIso);
  const upper = new Date(upperIso);
  let year = lower.getUTCFullYear();
  let month = lower.getUTCMonth() + 1;
  const lastYear = upper.getUTCFullYear();
  const lastMonth = upper.getUTCMonth() + 1;
  const months = [];
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month === 13) {
      year += 1;
      month = 1;
    }
  }
  return months;
}

function newCoverage(identity = {}) {
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

function incrementCoverage(group, record) {
  group.races += 1;
  if (record.videoCandidateCount > 0) group.withVideoCandidates += 1;
  const legacy = typeof record.race.replayUrl === "string" && record.race.replayUrl.trim();
  if (legacy) group.withLegacyReference += 1;
  if (record.videoCandidateCount > 0 || legacy) group.withStoredReplayEvidence += 1;
  if (record.runtimeTruncationRisk) group.runtimeTruncationRisks += 1;
  if (record.flags.identityConflict) group.identityConflicts += 1;
  if (record.flags.syntheticOrStale) group.syntheticOrStale += 1;
  group.classifications[record.classification] += 1;
}

function withCoverage(group) {
  const percent = (count) => group.races === 0
    ? null
    : Number(((count / group.races) * 100).toFixed(6));
  return {
    ...group,
    storedCandidateCoveragePercent: percent(group.withVideoCandidates),
    storedEvidenceCoveragePercent: percent(group.withStoredReplayEvidence),
    verifiedPlaybackCoveragePercent: null,
  };
}

function newProviderCoverage(identity = {}) {
  return {
    ...newCoverage(identity),
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
}

function incrementProvider(group, videos) {
  for (const video of videos) {
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
}

function sourceName(value) {
  return String(value ?? "").trim().toLowerCase() || "(blank)";
}

function legacyHost(value) {
  try {
    return new URL(value.trim()).hostname.toLowerCase() || "(invalid-or-relative)";
  } catch {
    return "(invalid-or-relative)";
  }
}

function grouped(map, key, identity, factory = newCoverage) {
  let group = map.get(key);
  if (!group) {
    group = { identity, total: factory(identity), months: new Map() };
    map.set(key, group);
  } else if (JSON.stringify(group.identity) !== JSON.stringify(identity)) {
    throw new Error(`Grouping identity drift for ${key}`);
  }
  return group;
}

function incrementGrouped(group, month, record, factory = newCoverage, videos = null) {
  incrementCoverage(group.total, record);
  let monthGroup = group.months.get(month);
  if (!monthGroup) {
    monthGroup = factory({ month });
    group.months.set(month, monthGroup);
  }
  incrementCoverage(monthGroup, record);
  if (videos) {
    incrementProvider(group.total, videos);
    incrementProvider(monthGroup, videos);
  }
}

function compareFields(fields) {
  return (left, right) => {
    for (const field of fields) {
      const a = String(left.identity?.[field] ?? left[field] ?? "");
      const b = String(right.identity?.[field] ?? right[field] ?? "");
      if (a < b) return -1;
      if (a > b) return 1;
    }
    return 0;
  };
}

function finalizeGroups(map, fields, months, monthlyTotals, kind) {
  return [...map.values()].sort(compareFields(fields)).map((group) => {
    const total = withCoverage(group.total);
    const monthRows = months.map((month) => {
      const empty = kind === "provider"
        ? newProviderCoverage({ month })
        : newCoverage({ month });
      const row = withCoverage(group.months.get(month) ?? empty);
      if (kind === "provider") {
        const denominator = monthlyTotals.get(month)?.races ?? 0;
        row.candidateRaceSharePercent = row.races === 0 || denominator === 0
          ? null
          : Number(((row.races / denominator) * 100).toFixed(6));
      } else if (kind === "legacy") {
        const denominator = monthlyTotals.get(month)?.races ?? 0;
        row.legacyReferenceRaceSharePercent = row.races === 0 || denominator === 0
          ? null
          : Number(((row.races / denominator) * 100).toFixed(6));
      }
      return row;
    });
    if (kind === "provider") {
      total.candidateRaceSharePercent = monthlyTotals.overall.races === 0
        ? null
        : Number(((total.races / monthlyTotals.overall.races) * 100).toFixed(6));
    } else if (kind === "legacy") {
      total.legacyReferenceRaceSharePercent = monthlyTotals.overall.races === 0
        ? null
        : Number(((total.races / monthlyTotals.overall.races) * 100).toFixed(6));
    }
    return { ...total, months: monthRows };
  });
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, sortJson(value[key])])
  );
}

function jsonText(value) {
  return `${JSON.stringify(sortJson(value), null, 2)}\n`;
}

function assertUrlFree(value, label) {
  if (/https?:\/\//i.test(JSON.stringify(value))) {
    throw new Error(`${label} unexpectedly contains a shareable URL`);
  }
}

function observeFields(fields, entity, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  let names = fields.get(entity);
  if (!names) {
    names = new Set();
    fields.set(entity, names);
  }
  for (const name of Object.keys(value)) names.add(name);
}

function recoveryPoint(text) {
  const match = /^recovery_point_utc\|([^\r\n]+)$/m.exec(text);
  if (!match) throw new Error("Recovery evidence has no recovery_point_utc row");
  const parsed = parseUtcTimestamp(match[1], "recovery_point_utc", { requireZone: true });
  return {
    utc: match[1].trim(),
    australiaSydney: formatSydney(parsed.iso),
  };
}

export async function buildCompanion(rawOptions) {
  assertOptions(rawOptions);
  const options = {
    ...rawOptions,
    inventory: resolve(rawOptions.inventory),
    output: resolve(rawOptions.output),
    sourceDump: resolve(rawOptions.sourceDump),
    recoveryEvidence: resolve(rawOptions.recoveryEvidence),
    sourceDumpSha256: rawOptions.sourceDumpSha256.toLowerCase(),
  };
  if (basename(options.inventory).toLowerCase().endsWith(".partial")) {
    throw new Error("Companion input must be a finalized inventory, never .partial");
  }
  if (basename(options.output).toLowerCase().endsWith(".partial")) {
    throw new Error("Do not include the reserved .partial suffix in output");
  }
  await assertRealDirectory(options.inventory, "Inventory input");
  const outputRelative = relative(options.inventory, options.output);
  if (outputRelative === "" || (!outputRelative.startsWith("..") && !isAbsolute(outputRelative))) {
    throw new Error("Output must not modify or sit inside the finalized inventory");
  }
  const outputParent = dirname(options.output);
  await assertRealDirectory(outputParent, "Output parent");
  const partial = `${options.output}.partial`;
  await Promise.all([
    assertAbsent(options.output, "Final companion directory"),
    assertAbsent(partial, "Partial companion directory"),
  ]);

  const ledgerPath = resolve(options.inventory, LEDGER_NAME);
  const contextPath = resolve(options.inventory, CONTEXT_NAME);
  const manifestPath = resolve(options.inventory, UPSTREAM_MANIFEST_NAME);
  const [ledgerInfo, manifest, context, manifestFile, contextFile, sqlFile] = await Promise.all([
    assertRegularFile(ledgerPath, LEDGER_NAME),
    readJson(manifestPath, "Upstream manifest"),
    readJson(contextPath, "Export context"),
    sha256File(manifestPath),
    sha256File(contextPath),
    sha256File(INVENTORY_SQL),
  ]);
  validateUpstreamManifest(manifest);
  if (ledgerInfo.size !== manifest.files[LEDGER_NAME].bytes) {
    throw new Error("Ledger byte count changed after upstream verification");
  }
  validateContext(context, manifest, contextFile, sqlFile);

  const [dumpInfo, recoveryInfo] = await Promise.all([
    assertRegularFile(options.sourceDump, "Source dump"),
    assertRegularFile(options.recoveryEvidence, "Recovery evidence", MAX_JSON_BYTES),
  ]);
  const dumpFile = await sha256File(options.sourceDump);
  if (dumpFile.bytes !== dumpInfo.size || dumpFile.sha256 !== options.sourceDumpSha256) {
    throw new Error("Source dump bytes changed or its SHA-256 does not match the supplied digest");
  }
  const recoveryText = await readFile(options.recoveryEvidence, "utf8");
  const recoveryFile = await sha256File(options.recoveryEvidence);
  if (recoveryFile.bytes !== recoveryInfo.size) {
    throw new Error("Recovery evidence changed while it was read");
  }
  const recovery = recoveryPoint(recoveryText);

  const sourceHeader = comparableHeader(manifest.snapshot);
  const upper = parseUtcTimestamp(sourceHeader.generatedAt, "snapshot generatedAt", { requireZone: true });
  const lower = parseUtcTimestamp(CUTOFF, "inventory cutoff", { requireZone: true });
  if (upper.milliseconds < lower.milliseconds) {
    throw new Error("Snapshot generatedAt predates the fixed lower cutoff");
  }
  const months = monthSequence(lower.iso, upper.iso);
  const monthSet = new Set(months);
  const years = [...new Set(months.map((month) => month.slice(0, 4)))];

  await mkdir(partial, { mode: 0o700 });
  await chmod(partial, 0o700);

  const overall = newCoverage();
  const yearGroups = new Map(years.map((year) => [year, newCoverage({ year })]));
  const monthGroups = new Map(months.map((month) => [month, newCoverage({ month })]));
  const jurisdictions = new Map();
  const tracks = new Map();
  const providers = new Map();
  const legacyHosts = new Map();
  const raceIds = new Set();
  const meetingIds = new Set();
  const trackIds = new Set();
  const effectiveMeetingIds = new Set();
  const effectiveTrackIds = new Set();
  const fieldNames = new Map();
  const sourceRows = { races: 0, runners: 0, results: 0, raceVideos: 0 };
  const effectiveRows = { races: 0, runners: 0, results: 0, raceVideos: 0 };
  let excludedFutureScheduledRows = 0;
  let futureMinimum = null;
  let futureMaximum = null;

  const ledgerHash = createHash("sha256");
  let ledgerBytes = 0;
  const hashTap = new Transform({
    transform(chunk, _encoding, callback) {
      ledgerHash.update(chunk);
      ledgerBytes += chunk.length;
      callback(null, chunk);
    },
  });
  const lines = createInterface({
    input: createReadStream(ledgerPath).pipe(hashTap).pipe(createGunzip()),
    crlfDelay: Infinity,
  });
  let lineCount = 0;
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
    if (JSON.stringify(comparableHeader(record.inventory)) !== JSON.stringify(sourceHeader)) {
      throw new Error(`Line ${lineCount} does not match the upstream manifest header`);
    }
    if (raceIds.has(record.race.id)) {
      throw new Error(`Line ${lineCount} duplicates canonical race ID ${record.race.id}`);
    }
    if (record.meeting.trackId !== record.track.id) {
      throw new Error(`Line ${lineCount} meeting/track identity is inconsistent`);
    }
    raceIds.add(record.race.id);
    meetingIds.add(record.meeting.id);
    trackIds.add(record.track.id);
    sourceRows.races += 1;
    sourceRows.runners += record.runners.length;
    sourceRows.results += record.runners.filter((runner) => runner.result).length;
    sourceRows.raceVideos += record.videos.length;
    observeFields(fieldNames, "InventoryRecord", record);
    observeFields(fieldNames, "Race", record.race);
    observeFields(fieldNames, "Meeting", record.meeting);
    observeFields(fieldNames, "Track", record.track);
    for (const runner of record.runners) {
      observeFields(fieldNames, "Runner", runner);
      observeFields(fieldNames, "Dog", runner.dog);
      observeFields(fieldNames, "Trainer", runner.trainer);
      observeFields(fieldNames, "Result", runner.result);
    }
    for (const video of record.videos) observeFields(fieldNames, "RaceVideo", video);

    const raceTime = parseUtcTimestamp(record.race.raceTime, `Line ${lineCount} raceTime`);
    if (raceTime.milliseconds < lower.milliseconds) {
      throw new Error(`Line ${lineCount} predates the fixed lower cutoff`);
    }
    if (raceTime.milliseconds > upper.milliseconds) {
      excludedFutureScheduledRows += 1;
      futureMinimum = futureMinimum == null ? raceTime.milliseconds : Math.min(futureMinimum, raceTime.milliseconds);
      futureMaximum = futureMaximum == null ? raceTime.milliseconds : Math.max(futureMaximum, raceTime.milliseconds);
      continue;
    }

    const groupingValue = String(record.meeting.meetingDate ?? "").trim() || record.race.raceTime;
    const groupingTime = parseUtcTimestamp(groupingValue, `Line ${lineCount} grouping date`);
    const month = groupingTime.iso.slice(0, 7);
    if (!monthSet.has(month)) {
      throw new Error(`Line ${lineCount} grouping month falls outside the effective scope`);
    }
    const year = month.slice(0, 4);
    const jurisdiction = String(record.track.state).trim().toUpperCase() || "(blank)";
    const trackId = String(record.track.id);
    const trackName = String(record.track.name);
    effectiveRows.races += 1;
    effectiveRows.runners += record.runners.length;
    effectiveRows.results += record.runners.filter((runner) => runner.result).length;
    effectiveRows.raceVideos += record.videos.length;
    effectiveMeetingIds.add(record.meeting.id);
    effectiveTrackIds.add(record.track.id);
    incrementCoverage(overall, record);
    incrementCoverage(yearGroups.get(year), record);
    incrementCoverage(monthGroups.get(month), record);
    incrementGrouped(
      grouped(jurisdictions, jurisdiction, { jurisdiction }),
      month,
      record
    );
    incrementGrouped(
      grouped(tracks, `${jurisdiction}\u0000${trackId}`, { jurisdiction, trackId, trackName }),
      month,
      record
    );

    const videosByProvider = new Map();
    for (const video of record.videos) {
      const provider = sourceName(video.sourceProvider);
      let providerVideos = videosByProvider.get(provider);
      if (!providerVideos) {
        providerVideos = [];
        videosByProvider.set(provider, providerVideos);
      }
      providerVideos.push(video);
    }
    for (const [provider, videos] of videosByProvider) {
      incrementGrouped(
        grouped(providers, provider, { provider }, newProviderCoverage),
        month,
        record,
        newProviderCoverage,
        videos
      );
    }

    const replayUrl = typeof record.race.replayUrl === "string"
      ? record.race.replayUrl.trim()
      : "";
    if (replayUrl) {
      const host = legacyHost(replayUrl);
      incrementGrouped(grouped(legacyHosts, host, { host }), month, record);
    }
  }

  const ledgerFile = { bytes: ledgerBytes, sha256: ledgerHash.digest("hex") };
  if (
    lineCount !== manifest.lineCount ||
    raceIds.size !== manifest.uniqueRaceIds ||
    sourceHeader.expectedRaceCount !== lineCount ||
    ledgerFile.bytes !== manifest.files[LEDGER_NAME].bytes ||
    ledgerFile.sha256 !== manifest.files[LEDGER_NAME].sha256
  ) {
    throw new Error("Streaming ledger header/count/hash reconciliation failed");
  }
  if (
    sourceRows.runners !== context.preflight.runnerCount ||
    sourceRows.raceVideos !== context.preflight.videoCount
  ) {
    throw new Error("Embedded Runner/RaceVideo totals do not reconcile with export preflight");
  }
  if (overall.races === 0) throw new Error("Effective historical coverage scope is empty");

  const monthlyTotals = monthGroups;
  monthlyTotals.overall = overall;
  const createdAt = new Date().toISOString();
  const coverage = {
    schema: "greyhoundiq.replay-production-inventory.month-coverage",
    version: 1,
    generatedAt: createdAt,
    source: sourceHeader,
    scope: {
      lowerCutoff: lower.iso,
      effectiveUpperCutoff: upper.iso,
      sourceRows: lineCount,
      includedRows: overall.races,
      excludedFutureScheduledRows,
    },
    semantics: {
      playbackVerified: false,
      provisionalClassificationsOnly: true,
      rawLedgerRestricted: true,
      sourceGroupsAreNonExclusive: true,
      zeroCellPercentagesAreNull: true,
    },
    overall: withCoverage(overall),
    years: years.map((year) => withCoverage(yearGroups.get(year))),
    months: months.map((month) => withCoverage(monthGroups.get(month))),
    jurisdictions: finalizeGroups(
      jurisdictions,
      ["jurisdiction"],
      months,
      monthlyTotals,
      "coverage"
    ),
    tracks: finalizeGroups(
      tracks,
      ["jurisdiction", "trackName", "trackId"],
      months,
      monthlyTotals,
      "coverage"
    ),
    raceVideoProviders: finalizeGroups(
      providers,
      ["provider"],
      months,
      monthlyTotals,
      "provider"
    ),
    legacyReplayHosts: finalizeGroups(
      legacyHosts,
      ["host"],
      months,
      monthlyTotals,
      "legacy"
    ),
  };
  assertUrlFree(coverage, "Month coverage");

  const scope = {
    schema: "greyhoundiq.replay-production-inventory.scope-evidence",
    version: 1,
    createdAt,
    database: DATABASE_NAME,
    container: {
      id: context.container.id,
      name: context.container.name,
      image: context.container.image,
      networkMode: "none",
      publishedPorts: 0,
    },
    sourceDump: {
      path: options.sourceDump,
      bytes: dumpFile.bytes,
      sha256: dumpFile.sha256,
      exactLogicalSnapshotInstantRecorded: false,
    },
    recoveryEvidence: {
      path: options.recoveryEvidence,
      bytes: recoveryFile.bytes,
      sha256: recoveryFile.sha256,
      googlePitrRecoveryPointUtc: recovery.utc,
      googlePitrRecoveryPointAustraliaSydney: recovery.australiaSydney,
    },
    inventoryEvidence: {
      path: options.inventory,
      upstreamManifestSha256: manifestFile.sha256,
      exportContextSha256: contextFile.sha256,
      compressedLedgerBytes: ledgerFile.bytes,
      compressedLedgerSha256: ledgerFile.sha256,
      inventorySqlSha256: sqlFile.sha256,
    },
    snapshot: {
      id: sourceHeader.snapshotId,
      generatedAtUtc: upper.iso,
      generatedAtAustraliaSydney: formatSydney(upper.iso),
      lowerCutoff: lower.iso,
      effectiveUpperCutoff: upper.iso,
      timestampWithoutTimezonePolicy: "interpret as UTC",
    },
    rowTotals: {
      source: {
        ...sourceRows,
        uniqueMeetings: meetingIds.size,
        uniqueTracks: trackIds.size,
      },
      effectiveHistorical: {
        ...effectiveRows,
        uniqueMeetings: effectiveMeetingIds.size,
        uniqueTracks: effectiveTrackIds.size,
      },
      excludedFutureScheduledRows,
      excludedFutureScheduledRaceTimeRangeUtc: excludedFutureScheduledRows === 0
        ? null
        : {
            earliest: new Date(futureMinimum).toISOString(),
            latest: new Date(futureMaximum).toISOString(),
          },
    },
    jurisdictions: [...jurisdictions.keys()].sort(),
    entities: [...fieldNames.entries()]
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([entity, fields]) => ({ entity, fields: [...fields].sort() })),
    reconciliation: {
      manifestLineCountMatchesLedger: lineCount === manifest.lineCount,
      manifestUniqueRaceIdsMatchLedger: raceIds.size === manifest.uniqueRaceIds,
      headerExpectedRaceCountMatchesLedger: sourceHeader.expectedRaceCount === lineCount,
      preflightRaceCountMatchesLedger: context.preflight.raceCount === lineCount,
      preflightRunnerCountMatchesEmbeddedRows: context.preflight.runnerCount === sourceRows.runners,
      preflightVideoCountMatchesEmbeddedRows: context.preflight.videoCount === sourceRows.raceVideos,
      upstreamLedgerHashAndBytesMatch: true,
      upstreamContextHashAndBytesMatch: true,
      inventorySqlHashMatchesExportContext: true,
      sourceDumpHashMatchesSuppliedDigest: true,
      futureScheduledRowsExcludedFromCoverage: true,
    },
    playbackVerified: false,
    rawLedgerRestricted: true,
    limitations: [
      "No replay playback, seeking, audio, duration, mobile, licensing, or race-field coherence was verified.",
      "Stored source status and URL shape are candidate metadata only and are not playback proof.",
      "The source SQL has no upper cutoff; races scheduled after generatedAt are counted separately and excluded here.",
      "Bare Race.raceTime and grouping timestamps are interpreted as UTC, never as host-local time.",
      "The dump's exact logical snapshot instant was not recorded; PITR recovery time and export generatedAt are distinct provenance points.",
      "Standalone Meeting, Result, Track, and Trainer table totals were not present in export preflight; embedded and unique totals are reported instead.",
      "RaceVideo-provider and legacy-host groups are non-exclusive and must not be summed as a partition of all races.",
      "Legacy replay hosts are parsed from Race.replayUrl only; no provider is inferred from race metadata or titles.",
    ],
  };
  assertUrlFree(scope, "Scope evidence");

  const coveragePath = resolve(partial, COVERAGE_NAME);
  const scopePath = resolve(partial, SCOPE_NAME);
  await Promise.all([
    writeFile(coveragePath, jsonText(coverage), { encoding: "utf8", flag: "wx", mode: 0o600 }),
    writeFile(scopePath, jsonText(scope), { encoding: "utf8", flag: "wx", mode: 0o600 }),
  ]);
  const [coverageFile, scopeFile] = await Promise.all([
    sha256File(coveragePath),
    sha256File(scopePath),
  ]);
  const companionManifest = {
    schema: "greyhoundiq.replay-production-inventory.companion-manifest",
    version: 1,
    createdAt,
    database: DATABASE_NAME,
    sourceInventory: {
      path: options.inventory,
      manifestSha256: manifestFile.sha256,
      ledgerSha256: ledgerFile.sha256,
      snapshot: sourceHeader,
    },
    lineCount,
    includedHistoricalRaceCount: overall.races,
    excludedFutureScheduledRows,
    playbackVerified: false,
    files: {
      [COVERAGE_NAME]: { ...coverageFile, restricted: false, containsUrls: false },
      [SCOPE_NAME]: { ...scopeFile, restricted: false, containsUrls: false },
    },
  };
  assertUrlFree(companionManifest, "Companion manifest");
  const companionManifestPath = resolve(partial, COMPANION_MANIFEST_NAME);
  await writeFile(companionManifestPath, jsonText(companionManifest), {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  const companionManifestFile = await sha256File(companionManifestPath);
  const sums = [
    [coverageFile.sha256, COVERAGE_NAME],
    [scopeFile.sha256, SCOPE_NAME],
    [companionManifestFile.sha256, COMPANION_MANIFEST_NAME],
  ].sort((left, right) => left[1] < right[1] ? -1 : left[1] > right[1] ? 1 : 0);
  const sumsPath = resolve(partial, SUMS_NAME);
  await writeFile(
    sumsPath,
    `${sums.map(([sha256, name]) => `${sha256}  ${name}`).join("\n")}\n`,
    { encoding: "utf8", flag: "wx", mode: 0o600 }
  );
  await Promise.all(
    [coveragePath, scopePath, companionManifestPath, sumsPath].map((path) => chmod(path, 0o600))
  );
  await rename(partial, options.output);
  return {
    directory: options.output,
    coverage,
    scope,
    manifest: companionManifest,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  Promise.resolve()
    .then(() => parseArgs(process.argv.slice(2)))
    .then(buildCompanion)
    .then((result) => {
      process.stdout.write(
        `Replay companion complete: ${result.manifest.includedHistoricalRaceCount} historical races; ` +
        `${result.manifest.excludedFutureScheduledRows} future scheduled rows excluded\n`
      );
    })
    .catch((error) => {
      process.stderr.write(`Replay companion refused: ${redactDiagnostic(error?.message ?? error)}\n`);
      process.exitCode = 1;
    });
}
