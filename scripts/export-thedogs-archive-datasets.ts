/**
 * Build an immutable, source-bound normalized export from the local The Dogs
 * harvest. This command reads files only; it never opens a database connection.
 *
 * Output is partitioned and checkpointed under .backfill. A completed run is
 * keyed by the exact source inventory digest and is never overwritten.
 */
import { createHash, randomUUID } from "node:crypto";
import { createWriteStream, type WriteStream } from "node:fs";
import { access, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { once } from "node:events";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { sanitizeArchiveValue } from "../src/lib/live/raw-sanitizer";
import { verifyTheDogsProfileArchiveIdentity } from "./thedogs-profile-archive-identity";

export const TRANSFORM_VERSION = "thedogs-normalized-harvest/v2";

const DEFAULT_PROFILE_DIR = ".backfill/thedogs-dog-profiles-raw";
const DEFAULT_RAW_DIR = ".backfill/thedogs-raw";
const DEFAULT_OUT_DIR = ".backfill/exports";
const DEFAULT_SHARDS = 64;
const PROVIDER = "thedogs";

const DATASETS = [
  "profiles",
  "pedigree_edges",
  "profile_forms",
  "meetings",
  "races",
  "runners",
  "results",
  "archives",
  "race_media",
  "duplicates",
  "orphans",
  "quarantine",
] as const;

type Dataset = (typeof DATASETS)[number];
type JsonObject = Record<string, unknown>;
type SourceKind = "profile" | "race-day";

export type NormalizedHarvestOptions = {
  profileDir: string;
  rawDir: string;
  outDir: string;
  shards: number;
  profiles: boolean;
  races: boolean;
  from?: string;
  to?: string;
  limitProfiles: number;
  limitRaceDays: number;
};

export type SnapshotRank = {
  snapshotTimeMs: number;
  completeness: number;
  sha256: string;
  sourcePath: string;
};

type Candidate = SnapshotRank & {
  kind: SourceKind;
  naturalKey: string;
  providerKey: string;
  sourceId: string;
  absolutePath: string;
  relativePath: string;
  bytes: number;
  fetchedAt: string | null;
  snapshotTime: string;
  snapshotTimeSource: "fetchedAt" | "mtime";
  dataDate: string | null;
};

type InvalidSource = {
  kind: SourceKind;
  relativePath: string;
  bytes: number;
  sha256: string;
  reason: string;
};

type DuplicateSnapshot = {
  kind: SourceKind;
  naturalKey: string;
  selected: Candidate;
  dropped: Candidate;
};

type ScopeCounts = {
  discoveredFiles: number;
  validFiles: number;
  invalidFiles: number;
  excludedByFilter: number;
  uniqueNaturalKeys: number;
  duplicateSnapshots: number;
  selectedFiles: number;
  excludedByLimit: number;
};

type ReferenceIndex = {
  profileProviderKeys: Set<string>;
  raceProviderKeys: Set<string>;
};

type Inventory = {
  selected: Candidate[];
  invalid: InvalidSource[];
  duplicates: DuplicateSnapshot[];
  counts: Record<SourceKind, ScopeCounts>;
  inventorySha256: string;
  sourceCutoff: string;
  references: ReferenceIndex;
};

type ShardFileMetadata = {
  dataset: Dataset;
  file: string;
  sha256: string;
  bytes: number;
  rowCount: number;
  minDate: string | null;
  maxDate: string | null;
  sourceCutoff: string;
  transformVersion: string;
};

type IssueCounts = {
  duplicates: number;
  orphans: number;
  quarantine: number;
  targetIdAssignments: 0;
};

type PartitionManifest = {
  transformVersion: string;
  sourceInventorySha256: string;
  sourceCutoff: string;
  partition: number;
  partitionCount: number;
  inputCount: number;
  inputSha256: string;
  outputs: ShardFileMetadata[];
  issues: IssueCounts;
};

type CompletedPartition = {
  directory: string;
  manifest: PartitionManifest;
  manifestSha256: string;
};

type HarvestManifest = {
  schemaVersion: 1;
  transformVersion: string;
  generatedAt: string;
  status: "complete" | "operator_attention" | "blocked" | "subset";
  source: {
    provider: typeof PROVIDER;
    runInstanceId: string;
    inventorySha256: string;
    sourceCutoff: string;
    profileRoot: string | null;
    raceRoot: string | null;
  };
  scope: {
    profiles: boolean;
    races: boolean;
    from: string | null;
    to: string | null;
    limitProfiles: number;
    limitRaceDays: number;
    fullCorpus: boolean;
  };
  identityPolicy: {
    providerKeys: true;
    stableNaturalKeys: true;
    profileArchivesExactProviderIdentity: true;
    targetIdsGenerated: false;
    targetIdAssignments: 0;
  };
  inventory: Record<SourceKind, ScopeCounts & { coverageProven: boolean }>;
  datasets: Record<Dataset, { shards: number; rowCount: number; bytes: number; sha256: string }>;
  issues: IssueCounts;
  partitions: Array<{
    directory: string;
    manifestSha256: string;
    inputCount: number;
    inputSha256: string;
    outputs: ShardFileMetadata[];
    issues: IssueCounts;
  }>;
  archivePolicy: {
    payloadCopied: false;
    sourceFilesRetained: true;
    sourceFilesBoundBySha256: true;
    rawProfilePiiLogged: false;
    note: string;
  };
};

export type NormalizedHarvestResult = {
  outputDir: string;
  manifest: HarvestManifest;
  manifestSha256: string;
  reused: boolean;
};

export function compareSnapshotRank(left: SnapshotRank, right: SnapshotRank) {
  if (left.snapshotTimeMs !== right.snapshotTimeMs) {
    return left.snapshotTimeMs - right.snapshotTimeMs;
  }
  if (left.completeness !== right.completeness) {
    return left.completeness - right.completeness;
  }
  const hashOrder = left.sha256.localeCompare(right.sha256);
  if (hashOrder !== 0) return hashOrder;
  return right.sourcePath.localeCompare(left.sourcePath);
}

export async function runNormalizedHarvest(options: NormalizedHarvestOptions): Promise<NormalizedHarvestResult> {
  validateOptions(options);
  const inventory = await buildInventory(options);
  const runConfig = {
    profiles: options.profiles,
    races: options.races,
    from: options.from ?? null,
    to: options.to ?? null,
    limitProfiles: options.limitProfiles,
    limitRaceDays: options.limitRaceDays,
    shards: options.shards,
  };
  const runDigest = sha256Text(`${TRANSFORM_VERSION}\n${inventory.inventorySha256}\n${JSON.stringify(runConfig)}`);
  const runName = `thedogs-normalized-v2-${runDigest.slice(0, 16)}`;
  const finalDir = path.resolve(options.outDir, runName);
  const workDir = path.resolve(options.outDir, `.${runName}.work`);

  if (await exists(finalDir)) {
    const completed = await verifyCompletedRun(finalDir, inventory.inventorySha256, runConfig);
    return { ...completed, outputDir: finalDir, reused: true };
  }

  await mkdir(workDir, { recursive: true });
  await cleanupOwnedTemporaryPartitions(workDir);

  const candidateBuckets = partitionValues(inventory.selected, options.shards, (item) => item.naturalKey);
  const invalidBuckets = partitionValues(
    inventory.invalid,
    options.shards,
    (item) => `${item.kind}:${item.relativePath}`,
  );
  const duplicateBuckets = partitionValues(inventory.duplicates, options.shards, (item) => item.naturalKey);
  const partitions: CompletedPartition[] = [];

  for (let index = 0; index < options.shards; index += 1) {
    const inputs = candidateBuckets[index].sort(compareCandidateIdentity);
    const invalid = invalidBuckets[index].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    const duplicates = duplicateBuckets[index].sort((a, b) =>
      `${a.naturalKey}:${a.dropped.relativePath}`.localeCompare(`${b.naturalKey}:${b.dropped.relativePath}`),
    );
    const inputSha256 = partitionInputDigest(inputs, invalid, duplicates);
    const partitionDirName = partitionName(index, options.shards);
    const partitionDir = path.join(workDir, partitionDirName);

    if (await exists(partitionDir)) {
      partitions.push(
        await verifyPartition(
          partitionDir,
          inventory.inventorySha256,
          inputSha256,
          inventory.sourceCutoff,
          index,
          options.shards,
        ),
      );
      if (isCli) {
        console.error(`[export:thedogs:datasets] verified partition ${index + 1}/${options.shards}`);
      }
      continue;
    }

    partitions.push(
      await generatePartition({
        workDir,
        partitionDir,
        partitionDirName,
        index,
        partitionCount: options.shards,
        inputs,
        invalid,
        duplicates,
        inputSha256,
        inventory,
      }),
    );
    if (isCli) {
      console.error(`[export:thedogs:datasets] completed partition ${index + 1}/${options.shards}`);
    }
  }

  const manifest = buildManifest(options, inventory, partitions);
  const manifestPath = path.join(workDir, "manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  const manifestSha256 = await sha256File(manifestPath);
  await writeFile(path.join(workDir, "manifest.sha256"), `${manifestSha256}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  await cleanupOwnedTemporaryPartitions(workDir);
  await rename(workDir, finalDir);

  return { outputDir: finalDir, manifest, manifestSha256, reused: false };
}

async function buildInventory(options: NormalizedHarvestOptions): Promise<Inventory> {
  const selectedByKey = new Map<string, Candidate>();
  const droppedByKey = new Map<string, Candidate[]>();
  const invalid: InvalidSource[] = [];
  const hasher = createHash("sha256");
  const references: ReferenceIndex = {
    profileProviderKeys: new Set<string>(),
    raceProviderKeys: new Set<string>(),
  };
  const counts: Record<SourceKind, ScopeCounts> = {
    profile: emptyScopeCounts(),
    "race-day": emptyScopeCounts(),
  };

  const sources: Array<{ kind: SourceKind; root: string }> = [];
  if (options.profiles) sources.push({ kind: "profile", root: options.profileDir });
  if (options.races) sources.push({ kind: "race-day", root: options.rawDir });

  for (const source of sources) {
    await assertDirectory(source.root);
    const files = await discoverJsonFiles(source.root);
    if (files.length === 0) {
      throw new Error(`no JSON source files found for ${source.kind}`);
    }
    counts[source.kind].discoveredFiles = files.length;

    let processedFiles = 0;
    for (const absolutePath of files) {
      const inspected = await inspectSourceFile(source.kind, source.root, absolutePath, references);
      processedFiles += 1;
      if (isCli && (processedFiles % 5_000 === 0 || processedFiles === files.length)) {
        console.error(`[export:thedogs:datasets] inventoried ${source.kind} ${processedFiles}/${files.length}`);
      }
      hasher.update(`${inventoryDigestLine(inspected)}\n`);

      if ("reason" in inspected) {
        invalid.push(inspected);
        counts[source.kind].invalidFiles += 1;
        continue;
      }

      counts[source.kind].validFiles += 1;
      if (!candidateInScope(inspected, options)) {
        counts[source.kind].excludedByFilter += 1;
        continue;
      }

      const mapKey = `${source.kind}:${inspected.naturalKey}`;
      const current = selectedByKey.get(mapKey);
      if (!current) {
        selectedByKey.set(mapKey, inspected);
        continue;
      }

      const dropped = droppedByKey.get(mapKey) ?? [];
      if (compareSnapshotRank(inspected, current) > 0) {
        dropped.push(current);
        selectedByKey.set(mapKey, inspected);
      } else {
        dropped.push(inspected);
      }
      droppedByKey.set(mapKey, dropped);
    }
  }

  const selected = [...selectedByKey.values()].sort(compareCandidateIdentity);
  const selectedProfiles = applyLimit(
    selected.filter((item) => item.kind === "profile"),
    options.limitProfiles,
    counts.profile,
  );
  const selectedRaceDays = applyLimit(
    selected.filter((item) => item.kind === "race-day"),
    options.limitRaceDays,
    counts["race-day"],
  );
  const limitedSelected = [...selectedProfiles, ...selectedRaceDays].sort(compareCandidateIdentity);

  const duplicates: DuplicateSnapshot[] = [];
  for (const [mapKey, dropped] of droppedByKey) {
    const winner = selectedByKey.get(mapKey);
    if (!winner) throw new Error("snapshot selection invariant failed");
    for (const loser of dropped) {
      duplicates.push({
        kind: winner.kind,
        naturalKey: winner.naturalKey,
        selected: winner,
        dropped: loser,
      });
    }
  }
  duplicates.sort((a, b) =>
    `${a.kind}:${a.naturalKey}:${a.dropped.relativePath}`.localeCompare(
      `${b.kind}:${b.naturalKey}:${b.dropped.relativePath}`,
    ),
  );

  for (const kind of ["profile", "race-day"] as const) {
    const scope = counts[kind];
    scope.uniqueNaturalKeys = selected.filter((item) => item.kind === kind).length;
    scope.duplicateSnapshots = duplicates.filter((item) => item.kind === kind).length;
    scope.selectedFiles = limitedSelected.filter((item) => item.kind === kind).length;
  }

  if (options.profiles && counts.profile.selectedFiles === 0) {
    throw new Error("profile scope selected zero valid source files");
  }
  if (options.races && counts["race-day"].selectedFiles === 0) {
    throw new Error("race-day scope selected zero valid source files");
  }

  const cutoffMs = limitedSelected.reduce((maximum, candidate) => Math.max(maximum, candidate.snapshotTimeMs), 0);
  if (cutoffMs === 0) throw new Error("source cutoff could not be established");

  return {
    selected: limitedSelected,
    invalid,
    duplicates,
    counts,
    inventorySha256: hasher.digest("hex"),
    sourceCutoff: new Date(cutoffMs).toISOString(),
    references,
  };
}

async function inspectSourceFile(
  kind: SourceKind,
  root: string,
  absolutePath: string,
  references: ReferenceIndex,
): Promise<Candidate | InvalidSource> {
  const relativePath = slash(path.relative(root, absolutePath));
  const [buffer, fileStat] = await Promise.all([readFile(absolutePath), stat(absolutePath)]);
  const sourceSha256 = sha256Buffer(buffer);
  let parsed: JsonObject;
  try {
    parsed = requireObject(JSON.parse(buffer.toString("utf8")));
  } catch {
    return {
      kind,
      relativePath,
      bytes: buffer.byteLength,
      sha256: sourceSha256,
      reason: "invalid_json",
    };
  }

  try {
    return kind === "profile"
      ? inspectProfile(parsed, absolutePath, relativePath, buffer.byteLength, sourceSha256, fileStat.mtime, references)
      : inspectRaceDay(parsed, absolutePath, relativePath, buffer.byteLength, sourceSha256, fileStat.mtime, references);
  } catch (error) {
    return {
      kind,
      relativePath,
      bytes: buffer.byteLength,
      sha256: sourceSha256,
      reason: validationReason(error),
    };
  }
}

function inspectProfile(
  archive: JsonObject,
  absolutePath: string,
  relativePath: string,
  bytes: number,
  sourceSha256: string,
  mtime: Date,
  references: ReferenceIndex,
): Candidate {
  const pathSourceId = path.basename(relativePath, path.extname(relativePath));
  const identity = verifyTheDogsProfileArchiveIdentity(pathSourceId, archive);
  if (!identity.verified) failValidation("unverified_profile_identity");
  if (stringValue(archive.source) !== PROVIDER) failValidation("unsupported_provider");
  const parsed = requireObject(archive.parsed, "missing_parsed_profile");
  const parsedProvider = stringValue(parsed.sourceProvider);
  if (parsedProvider && parsedProvider !== PROVIDER) {
    failValidation("unsupported_provider");
  }

  const ids = [
    pathSourceId,
    stringValue(archive.sourceId),
    stringValue(parsed.sourceId),
    stringValue(asObject(archive.candidate)?.sourceId),
  ].filter((value): value is string => Boolean(value));
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== 1) failValidation("profile_source_id_mismatch");
  const sourceId = ids[0];
  if (!sourceId) failValidation("missing_profile_source_id");

  const profileKey = dogProviderKey(sourceId);
  references.profileProviderKeys.add(profileKey);
  const fetchedAt = isoValue(archive.fetchedAt);
  const snapshotTime = fetchedAt ?? mtime.toISOString();
  return {
    kind: "profile",
    naturalKey: profileKey,
    providerKey: profileKey,
    sourceId,
    absolutePath,
    relativePath,
    bytes,
    sha256: sourceSha256,
    fetchedAt,
    snapshotTime,
    snapshotTimeMs: Date.parse(snapshotTime),
    snapshotTimeSource: fetchedAt ? "fetchedAt" : "mtime",
    completeness: profileCompleteness(archive, parsed),
    dataDate: dateOnly(parsed.whelpDate),
    sourcePath: relativePath,
  };
}

function inspectRaceDay(
  archive: JsonObject,
  absolutePath: string,
  relativePath: string,
  bytes: number,
  sourceSha256: string,
  mtime: Date,
  references: ReferenceIndex,
): Candidate {
  const source = stringValue(archive.source);
  if (source && source !== PROVIDER) failValidation("unsupported_provider");
  const sourceDate = dateFromRelativeRacePath(relativePath);
  if (!sourceDate) failValidation("invalid_race_day_path");
  const archiveDate = dateOnly(archive.date);
  if (archiveDate && archiveDate !== sourceDate) failValidation("race_day_date_mismatch");
  const meetings = objectArray(archive.meetings);
  if (!Array.isArray(archive.meetings)) failValidation("missing_meetings_array");

  collectRaceProviderReferences(meetings, references.raceProviderKeys);
  const fetchedAt = isoValue(archive.fetchedAt);
  const snapshotTime = fetchedAt ?? mtime.toISOString();
  const naturalKey = `${PROVIDER}:race-day:${sourceDate}`;
  return {
    kind: "race-day",
    naturalKey,
    providerKey: naturalKey,
    sourceId: sourceDate,
    absolutePath,
    relativePath,
    bytes,
    sha256: sourceSha256,
    fetchedAt,
    snapshotTime,
    snapshotTimeMs: Date.parse(snapshotTime),
    snapshotTimeSource: fetchedAt ? "fetchedAt" : "mtime",
    completeness: raceDayCompleteness(meetings),
    dataDate: sourceDate,
    sourcePath: relativePath,
  };
}

type GeneratePartitionInput = {
  workDir: string;
  partitionDir: string;
  partitionDirName: string;
  index: number;
  partitionCount: number;
  inputs: Candidate[];
  invalid: InvalidSource[];
  duplicates: DuplicateSnapshot[];
  inputSha256: string;
  inventory: Inventory;
};

async function generatePartition(input: GeneratePartitionInput): Promise<CompletedPartition> {
  const temporaryDir = await mkdtemp(path.join(input.workDir, `${input.partitionDirName}.tmp-`));
  const label = partitionLabel(input.index, input.partitionCount);
  const writers = new Map<Dataset, ShardWriter>();
  const issues: IssueCounts = {
    duplicates: 0,
    orphans: 0,
    quarantine: 0,
    targetIdAssignments: 0,
  };

  try {
    for (const dataset of DATASETS) {
      writers.set(
        dataset,
        new ShardWriter(dataset, path.join(temporaryDir, `${dataset}-${label}.jsonl`), input.inventory.sourceCutoff),
      );
    }

    const emit = async (dataset: Dataset, record: JsonObject) => {
      assertNoTargetIdentity(record, dataset);
      await requireWriter(writers, dataset).write(record);
    };

    for (const duplicate of input.duplicates) {
      await emit("duplicates", duplicateSnapshotRecord(duplicate));
      issues.duplicates += 1;
    }
    for (const invalid of input.invalid) {
      await emit("quarantine", {
        issueType: "source-file",
        sourceKind: invalid.kind,
        sourcePath: invalid.relativePath,
        sourceSha256: invalid.sha256,
        sourceBytes: invalid.bytes,
        reason: invalid.reason,
      });
      issues.quarantine += 1;
    }

    for (const candidate of input.inputs) {
      const buffer = await readFile(candidate.absolutePath);
      if (buffer.byteLength !== candidate.bytes || sha256Buffer(buffer) !== candidate.sha256) {
        throw new Error(`source changed after inventory: ${candidate.kind}/${candidate.relativePath}`);
      }
      const archive = requireObject(JSON.parse(buffer.toString("utf8")));
      if (candidate.kind === "profile") {
        await emitProfileCandidate(candidate, archive, input.inventory.references, emit, issues);
      } else {
        await emitRaceDayCandidate(candidate, archive, input.inventory.references, emit, issues);
      }
    }

    const outputs: ShardFileMetadata[] = [];
    for (const dataset of DATASETS) {
      outputs.push(await requireWriter(writers, dataset).close());
    }
    const manifest: PartitionManifest = {
      transformVersion: TRANSFORM_VERSION,
      sourceInventorySha256: input.inventory.inventorySha256,
      sourceCutoff: input.inventory.sourceCutoff,
      partition: input.index,
      partitionCount: input.partitionCount,
      inputCount: input.inputs.length,
      inputSha256: input.inputSha256,
      outputs,
      issues,
    };
    const manifestPath = path.join(temporaryDir, "partition-manifest.json");
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    const manifestSha256 = await sha256File(manifestPath);
    await writeFile(path.join(temporaryDir, "partition-manifest.sha256"), `${manifestSha256}\n`, "utf8");
    await rename(temporaryDir, input.partitionDir);
    return {
      directory: input.partitionDirName,
      manifest,
      manifestSha256,
    };
  } catch (error) {
    for (const writer of writers.values()) writer.abort();
    throw error;
  }
}

async function emitProfileCandidate(
  candidate: Candidate,
  archive: JsonObject,
  references: ReferenceIndex,
  emit: (dataset: Dataset, record: JsonObject) => Promise<void>,
  issues: IssueCounts,
) {
  const profile = requireObject(archive.parsed, "missing_parsed_profile");
  const profileKey = dogProviderKey(candidate.sourceId);
  const candidateObject = asObject(archive.candidate);
  const profileName = stringValue(profile.name) ?? stringValue(candidateObject?.name);
  const mergeStatus = profileName ? "ready" : "quarantine";

  if (!profileName) {
    await emit("quarantine", {
      issueType: "profile-row",
      sourceArchiveKey: archiveNaturalKey(candidate),
      naturalKey: profileKey,
      reason: "missing_profile_name",
    });
    issues.quarantine += 1;
  }

  await emit(
    "profiles",
    compactRecord({
      provider: PROVIDER,
      sourceId: candidate.sourceId,
      providerKey: profileKey,
      naturalKey: profileKey,
      mergeStatus,
      sourceArchiveKey: archiveNaturalKey(candidate),
      profileUrl: stringValue(profile.profileUrl),
      name: profileName,
      trainerName: stringValue(profile.trainerName),
      ownerName: stringValue(profile.ownerName),
      colour: stringValue(profile.colour),
      sex: stringValue(profile.sex),
      whelpDate: isoValue(profile.whelpDate),
      careerStarts: numberValue(profile.careerStarts),
      careerWins: numberValue(profile.careerWins),
      careerSeconds: numberValue(profile.careerSeconds),
      careerThirds: numberValue(profile.careerThirds),
      prizeMoney: numberValue(profile.prizeMoney),
      winPercentage: numberValue(profile.winPercentage),
      placePercentage: numberValue(profile.placePercentage),
      profileStats: parsedSanitizedValue(profile.profileStatsJson),
      bestTimes: parsedSanitizedValue(profile.bestTimesJson),
      boxHistory: parsedSanitizedValue(profile.boxHistoryJson),
      distanceHistory: parsedSanitizedValue(profile.distanceHistoryJson),
      candidateProfilePath: stringValue(candidateObject?.profilePath),
      candidateFirstSeenDate: dateOnly(candidateObject?.firstSeenDate),
      candidateLastSeenDate: dateOnly(candidateObject?.lastSeenDate),
      candidateRaceAppearances: integerValue(candidateObject?.raceAppearances),
      observedNames: sanitizeArchiveValue(candidateObject?.names),
      observedProfilePaths: sanitizeArchiveValue(candidateObject?.profilePaths),
      fetchedAt: candidate.fetchedAt,
    }),
  );

  for (const relation of ["sire", "dam"] as const) {
    const parent = asObject(profile[relation]);
    if (!parent) continue;
    const parentSourceId = cleanDogSourceId(parent.sourceId);
    const parentName = stringValue(parent.name);
    const parentNaturalKey = parentSourceId
      ? dogProviderKey(parentSourceId)
      : parentName
        ? `${PROVIDER}:dog-name:${naturalToken(parentName)}`
        : null;
    if (!parentNaturalKey) {
      await emit("quarantine", {
        issueType: "pedigree-edge",
        sourceArchiveKey: archiveNaturalKey(candidate),
        childNaturalKey: profileKey,
        relation,
        reason: "missing_parent_identity",
      });
      issues.quarantine += 1;
      continue;
    }

    const resolution = parentSourceId
      ? references.profileProviderKeys.has(parentNaturalKey)
        ? "profile-present"
        : "provider-stub"
      : "name-only";
    const edgeNaturalKey = `${profileKey}:pedigree:${relation}`;
    await emit(
      "pedigree_edges",
      compactRecord({
        provider: PROVIDER,
        providerKey: parentSourceId ? `${PROVIDER}:pedigree:${candidate.sourceId}:${relation}:${parentSourceId}` : null,
        naturalKey: edgeNaturalKey,
        childNaturalKey: profileKey,
        relation,
        parentSourceId,
        parentNaturalKey,
        parentName,
        resolution,
        sourceArchiveKey: archiveNaturalKey(candidate),
      }),
    );
    if (resolution !== "profile-present") {
      await emit(
        "orphans",
        compactRecord({
          issueType: "pedigree-parent-profile-unresolved",
          naturalKey: edgeNaturalKey,
          childNaturalKey: profileKey,
          relation,
          missingNaturalKey: parentNaturalKey,
          resolution,
          sourceArchiveKey: archiveNaturalKey(candidate),
        }),
      );
      issues.orphans += 1;
    }
  }

  const forms = selectProfileForms(candidate, profile, emit, issues);
  for (const selected of await forms) {
    const row = selected.row;
    const raceSourceId = selected.raceSourceId;
    const raceProviderKey = providerKey("race", raceSourceId);
    const naturalKey = `${PROVIDER}:profile-form:${candidate.sourceId}:${raceSourceId}`;
    const winnerSourceId = cleanDogSourceId(row.winnerDogSourceId);
    await emit(
      "profile_forms",
      compactRecord({
        provider: PROVIDER,
        sourceId: raceSourceId,
        providerKey: naturalKey,
        naturalKey,
        dogNaturalKey: profileKey,
        raceProviderKey,
        raceUrl: stringValue(row.raceUrl) ?? stringValue(row.sourceId),
        date: isoValue(row.date),
        trackCode: stringValue(row.trackCode),
        trackName: stringValue(row.trackName),
        raceName: stringValue(row.raceName),
        finishText: stringValue(row.finishText),
        finishingPosition: integerValue(row.finishingPosition),
        starters: integerValue(row.starters),
        boxNumber: integerValue(row.boxNumber),
        weight: numberValue(row.weight),
        distance: integerValue(row.distance),
        grade: stringValue(row.grade),
        runningTime: numberValue(row.runningTime),
        winnerTime: numberValue(row.winnerTime),
        bestOfNightTime: numberValue(row.bestOfNightTime),
        firstSectional: numberValue(row.firstSectional),
        margin: numberValue(row.margin),
        winnerDogName: stringValue(row.winnerDogName),
        winnerDogSourceId: winnerSourceId,
        winnerDogNaturalKey: winnerSourceId ? dogProviderKey(winnerSourceId) : null,
        inRunningPositions: stringValue(row.inRunningPositions),
        hasVideo: booleanValue(row.hasVideo) ?? false,
        sourceArchiveKey: archiveNaturalKey(candidate),
      }),
    );
    if (!references.raceProviderKeys.has(raceProviderKey)) {
      await emit("orphans", {
        issueType: "profile-form-race-unresolved",
        naturalKey,
        missingProviderKey: raceProviderKey,
        sourceArchiveKey: archiveNaturalKey(candidate),
      });
      issues.orphans += 1;
    }
  }

  const formRows = objectArray(profile.formRows).length;
  await emit(
    "archives",
    compactRecord({
      archiveType: "dog-profile",
      provider: PROVIDER,
      sourceId: candidate.sourceId,
      providerKey: `${PROVIDER}:dog-profile:${candidate.sourceId}`,
      naturalKey: archiveNaturalKey(candidate),
      subjectNaturalKey: profileKey,
      sourcePath: candidate.relativePath,
      sourceSha256: candidate.sha256,
      sourceBytes: candidate.bytes,
      fetchedAt: candidate.fetchedAt,
      snapshotTime: candidate.snapshotTime,
      snapshotTimeSource: candidate.snapshotTimeSource,
      completenessScore: candidate.completeness,
      showMorePath: stringValue(archive.showMorePath),
      formRows,
      profileHtmlBytes: utf8Bytes(archive.profileHtml),
      fullFormHtmlBytes: utf8Bytes(archive.fullFormHtml),
      payloadCopied: false,
    }),
  );
}

async function selectProfileForms(
  candidate: Candidate,
  profile: JsonObject,
  emit: (dataset: Dataset, record: JsonObject) => Promise<void>,
  issues: IssueCounts,
) {
  const selected = new Map<string, { row: JsonObject; raceSourceId: string; score: number; index: number }>();
  const rows = objectArray(profile.formRows);
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const raceSourceId = canonicalSourceId(stringValue(row.sourceId) ?? stringValue(row.raceUrl));
    const date = isoValue(row.date);
    if (!raceSourceId || !date) {
      await emit("quarantine", {
        issueType: "profile-form-row",
        sourceArchiveKey: archiveNaturalKey(candidate),
        rowOrdinal: index,
        reason: !raceSourceId ? "missing_race_identity" : "missing_form_date",
      });
      issues.quarantine += 1;
      continue;
    }
    const naturalKey = `${candidate.naturalKey}:${raceSourceId}`;
    const score = shallowCompleteness(row);
    const current = selected.get(naturalKey);
    if (!current || score > current.score || (score === current.score && index > current.index)) {
      if (current) {
        await emit("duplicates", {
          issueType: "profile-form-natural-key",
          naturalKey,
          sourceArchiveKey: archiveNaturalKey(candidate),
          selectedRowOrdinal: index,
          droppedRowOrdinal: current.index,
          selection: "completeness_then_latest_ordinal",
        });
        issues.duplicates += 1;
      }
      selected.set(naturalKey, { row, raceSourceId, score, index });
    } else {
      await emit("duplicates", {
        issueType: "profile-form-natural-key",
        naturalKey,
        sourceArchiveKey: archiveNaturalKey(candidate),
        selectedRowOrdinal: current.index,
        droppedRowOrdinal: index,
        selection: "completeness_then_latest_ordinal",
      });
      issues.duplicates += 1;
    }
  }
  return [...selected.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, value]) => value);
}

async function emitRaceDayCandidate(
  candidate: Candidate,
  archive: JsonObject,
  references: ReferenceIndex,
  emit: (dataset: Dataset, record: JsonObject) => Promise<void>,
  issues: IssueCounts,
) {
  const meetings = await selectMeetings(candidate, objectArray(archive.meetings), emit, issues);
  let raceCount = 0;
  let runnerCount = 0;
  let resultCount = 0;

  for (const meetingSelection of meetings) {
    const meeting = meetingSelection.row;
    const meetingNaturalKey = meetingSelection.naturalKey;
    const meetingSourceId = canonicalSourceId(stringValue(meeting.sourceId));
    const meetingProviderKey = meetingSourceId ? providerKey("meeting", meetingSourceId) : null;
    const races = await selectRaces(candidate, meetingNaturalKey, objectArray(meeting.races), emit, issues);
    raceCount += races.length;

    await emit(
      "meetings",
      compactRecord({
        provider: PROVIDER,
        sourceId: meetingSourceId,
        providerKey: meetingProviderKey,
        naturalKey: meetingNaturalKey,
        mergeStatus: meetingSelection.mergeStatus,
        trackNaturalKey: meetingSelection.trackNaturalKey,
        trackName: stringValue(meeting.trackName),
        state: stringValue(meeting.state),
        meetingDate: `${candidate.dataDate}T00:00:00.000Z`,
        meetingType: stringValue(meeting.meetingType),
        raceCount: races.length,
        sourceArchiveKey: archiveNaturalKey(candidate),
      }),
    );

    for (const raceSelection of races) {
      const race = raceSelection.row;
      const raceNaturalKey = raceSelection.naturalKey;
      const raceSourceId = canonicalSourceId(stringValue(race.sourceId));
      const raceProviderKey = raceSourceId ? providerKey("race", raceSourceId) : null;
      const runners = await selectRunners(candidate, raceNaturalKey, objectArray(race.runners), emit, issues);
      runnerCount += runners.length;

      const raceRaw = parsedObject(race.sourceRawJson);
      const replayUrl = stringValue(race.replayUrl) ?? stringValue(raceRaw?.replayUrl);
      const videoSourceId = stringValue(race.videoSourceId) ?? stringValue(raceRaw?.videoSourceId);
      const photoFinishUrl = stringValue(race.photoFinishUrl) ?? stringValue(raceRaw?.photoFinishUrl);

      await emit(
        "races",
        compactRecord({
          provider: PROVIDER,
          sourceId: raceSourceId,
          providerKey: raceProviderKey,
          naturalKey: raceNaturalKey,
          meetingNaturalKey,
          mergeStatus: raceSelection.mergeStatus,
          raceNumber: raceSelection.raceNumber,
          name: stringValue(race.name),
          raceTime: isoValue(race.raceTime),
          raceTimeSource: stringValue(race.raceTimeSource),
          distance: integerValue(race.distance),
          grade: stringValue(race.grade),
          prizeMoney: numberValue(race.prizeMoney),
          resultStatus: stringValue(race.resultStatus),
          runnerCount: runners.length,
          replayAvailable: Boolean(replayUrl || videoSourceId),
          photoFinishAvailable: Boolean(photoFinishUrl),
          weather: sanitizeArchiveValue(raceRaw?.weather),
          trackRecord: numberValue(raceRaw?.trackRecord),
          prizePlaces: sanitizeArchiveValue(raceRaw?.prizePlaces),
          resultSummary: sanitizeArchiveValue(raceRaw?.resultSummary),
          sourceArchiveKey: archiveNaturalKey(candidate),
        }),
      );

      for (const runnerSelection of runners) {
        const runner = runnerSelection.row;
        const runnerNaturalKey = runnerSelection.naturalKey;
        const runnerSourceId = canonicalOpaqueId(stringValue(runner.sourceId));
        const dog = asObject(runner.dog);
        const dogSourceId = runnerDogSourceId(runner, dog);
        const dogNaturalKey = dogSourceId
          ? dogProviderKey(dogSourceId)
          : `${PROVIDER}:dog-name:${naturalToken(stringValue(dog?.name) ?? "unknown")}`;
        const mergeStatus = runnerSelection.mergeStatus === "ready" && dogSourceId ? "ready" : "quarantine";

        if (!dogSourceId) {
          await emit("quarantine", {
            issueType: "runner-row",
            naturalKey: runnerNaturalKey,
            sourceArchiveKey: archiveNaturalKey(candidate),
            reason: "missing_dog_provider_identity",
          });
          issues.quarantine += 1;
        } else if (!references.profileProviderKeys.has(dogNaturalKey)) {
          await emit("orphans", {
            issueType: "runner-dog-profile-unresolved",
            naturalKey: runnerNaturalKey,
            missingProviderKey: dogNaturalKey,
            sourceArchiveKey: archiveNaturalKey(candidate),
          });
          issues.orphans += 1;
        }

        const runnerProviderKey = runnerSourceId
          ? `${PROVIDER}:runner:${raceSourceId ?? raceNaturalKey}:${runnerSourceId}`
          : null;
        const runnerRaw = parsedObject(runner.sourceRawJson);
        await emit(
          "runners",
          compactRecord({
            provider: PROVIDER,
            sourceId: runnerSourceId,
            providerKey: runnerProviderKey,
            naturalKey: runnerNaturalKey,
            raceNaturalKey,
            dogSourceId,
            dogNaturalKey,
            dogName: stringValue(dog?.name),
            dogSex: stringValue(dog?.sex),
            dogColour: stringValue(dog?.colour),
            mergeStatus,
            boxNumber: runnerSelection.boxNumber,
            trainerName: stringValue(runner.trainerName),
            weight: numberValue(runner.weight),
            scratched: booleanValue(runner.scratched) ?? false,
            dogProfileUrl: stringValue(runnerRaw?.dogProfileUrl),
            dogDisplayTime: numberValue(runnerRaw?.dogDisplayTime),
            raceTrait: stringValue(runnerRaw?.raceTrait),
            providerGrade: stringValue(runnerRaw?.grade),
            trainerSourceId: canonicalOpaqueId(runnerRaw?.trainerId),
            trainerProfileUrl: stringValue(runnerRaw?.trainerProfileUrl),
            sourceArchiveKey: archiveNaturalKey(candidate),
          }),
        );

        if (hasResult(runner)) {
          resultCount += 1;
          await emit(
            "results",
            compactRecord({
              provider: PROVIDER,
              sourceId: runnerSourceId,
              providerKey: runnerProviderKey ? `${PROVIDER}:result:${runnerProviderKey}` : null,
              naturalKey: `${runnerNaturalKey}:result`,
              runnerNaturalKey,
              raceNaturalKey,
              finishingPosition: integerValue(runner.finishingPosition),
              runningTime: numberValue(runner.runningTime),
              margin: numberValue(runner.margin),
              prizeMoneyWon: numberValue(runner.prizeMoneyWon),
              splitTime: numberValue(runner.splitTime),
              sectionals: sanitizeArchiveValue(runner.sectionals),
              sourceArchiveKey: archiveNaturalKey(candidate),
            }),
          );
        }
      }

      if (replayUrl || videoSourceId) {
        const mediaIdentity = canonicalSourceId(videoSourceId ?? replayUrl) ?? raceNaturalKey;
        await emit(
          "race_media",
          compactRecord({
            provider: PROVIDER,
            sourceId: videoSourceId ?? canonicalSourceId(replayUrl),
            providerKey: `${PROVIDER}:race-media:replay:${mediaIdentity}`,
            naturalKey: `${raceNaturalKey}:media:replay`,
            raceNaturalKey,
            kind: "replay",
            pageUrl: replayUrl,
            embedSourceType: stringValue(race.videoSourceType) ?? stringValue(raceRaw?.videoSourceType),
            sourceArchiveKey: archiveNaturalKey(candidate),
          }),
        );
      }
      if (photoFinishUrl) {
        const mediaIdentity = canonicalSourceId(photoFinishUrl) ?? photoFinishUrl;
        await emit("race_media", {
          provider: PROVIDER,
          sourceId: mediaIdentity,
          providerKey: `${PROVIDER}:race-media:photo:${mediaIdentity}`,
          naturalKey: `${raceNaturalKey}:media:photo-finish`,
          raceNaturalKey,
          kind: "photo-finish",
          pageUrl: photoFinishUrl,
          sourceArchiveKey: archiveNaturalKey(candidate),
        });
      }
    }
  }

  await emit(
    "archives",
    compactRecord({
      archiveType: "race-day",
      provider: PROVIDER,
      sourceId: candidate.sourceId,
      providerKey: candidate.providerKey,
      naturalKey: archiveNaturalKey(candidate),
      date: candidate.dataDate,
      sourcePath: candidate.relativePath,
      sourceSha256: candidate.sha256,
      sourceBytes: candidate.bytes,
      fetchedAt: candidate.fetchedAt,
      snapshotTime: candidate.snapshotTime,
      snapshotTimeSource: candidate.snapshotTimeSource,
      completenessScore: candidate.completeness,
      meetingCount: meetings.length,
      raceCount,
      runnerCount,
      resultCount,
      payloadCopied: false,
    }),
  );
}

type SelectedMeeting = {
  row: JsonObject;
  naturalKey: string;
  trackNaturalKey: string;
  mergeStatus: "ready" | "quarantine";
  score: number;
  index: number;
};

async function selectMeetings(
  candidate: Candidate,
  rows: JsonObject[],
  emit: (dataset: Dataset, record: JsonObject) => Promise<void>,
  issues: IssueCounts,
) {
  const selected = new Map<string, SelectedMeeting>();
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const trackName = stringValue(row.trackName);
    const state = stringValue(row.state);
    const sourceId = canonicalSourceId(stringValue(row.sourceId));
    const trackToken = naturalToken(trackName ?? sourceId ?? `unknown-${index}`);
    const stateToken = naturalToken(state ?? "unknown");
    const trackNaturalKey = `${PROVIDER}:track:${stateToken}:${trackToken}`;
    const naturalKey = `${PROVIDER}:meeting:${candidate.dataDate}:${stateToken}:${trackToken}`;
    const mergeStatus = trackName ? "ready" : "quarantine";
    if (!trackName) {
      await emit("quarantine", {
        issueType: "meeting-row",
        naturalKey,
        sourceArchiveKey: archiveNaturalKey(candidate),
        reason: "missing_track_name",
      });
      issues.quarantine += 1;
    }
    const item: SelectedMeeting = {
      row,
      naturalKey,
      trackNaturalKey,
      mergeStatus,
      score: shallowCompleteness(row) + objectArray(row.races).length * 100,
      index,
    };
    await selectRow(selected, item, candidate, "meeting-natural-key", emit, issues);
  }
  return [...selected.values()].sort((a, b) => a.naturalKey.localeCompare(b.naturalKey));
}

type SelectedRace = {
  row: JsonObject;
  naturalKey: string;
  raceNumber: number | null;
  mergeStatus: "ready" | "quarantine";
  score: number;
  index: number;
};

async function selectRaces(
  candidate: Candidate,
  meetingNaturalKey: string,
  rows: JsonObject[],
  emit: (dataset: Dataset, record: JsonObject) => Promise<void>,
  issues: IssueCounts,
) {
  const selected = new Map<string, SelectedRace>();
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const raceNumber = positiveInteger(row.raceNumber);
    const sourceId = canonicalSourceId(stringValue(row.sourceId));
    const suffix = raceNumber != null ? `number:${raceNumber}` : `source:${sourceId ?? index}`;
    const naturalKey = `${meetingNaturalKey}:race:${suffix}`;
    const raceTime = isoValue(row.raceTime);
    const distance = positiveInteger(row.distance);
    const mergeStatus = raceNumber != null && raceTime && distance != null ? "ready" : "quarantine";
    if (mergeStatus === "quarantine") {
      await emit("quarantine", {
        issueType: "race-row",
        naturalKey,
        sourceArchiveKey: archiveNaturalKey(candidate),
        reason: raceNumber == null ? "missing_race_number" : !raceTime ? "missing_race_time" : "missing_race_distance",
      });
      issues.quarantine += 1;
    }
    const item: SelectedRace = {
      row,
      naturalKey,
      raceNumber,
      mergeStatus,
      score: shallowCompleteness(row) + objectArray(row.runners).length * 20,
      index,
    };
    await selectRow(selected, item, candidate, "race-natural-key", emit, issues);
  }
  return [...selected.values()].sort(
    (a, b) =>
      (a.raceNumber ?? Number.MAX_SAFE_INTEGER) - (b.raceNumber ?? Number.MAX_SAFE_INTEGER) ||
      a.naturalKey.localeCompare(b.naturalKey),
  );
}

type SelectedRunner = {
  row: JsonObject;
  naturalKey: string;
  boxNumber: number | null;
  mergeStatus: "ready" | "quarantine";
  score: number;
  index: number;
};

async function selectRunners(
  candidate: Candidate,
  raceNaturalKey: string,
  rows: JsonObject[],
  emit: (dataset: Dataset, record: JsonObject) => Promise<void>,
  issues: IssueCounts,
) {
  const selected = new Map<string, SelectedRunner>();
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const boxNumber = positiveInteger(row.boxNumber);
    const sourceId = canonicalOpaqueId(stringValue(row.sourceId));
    const suffix = boxNumber != null ? `box:${boxNumber}` : `source:${sourceId ?? index}`;
    const naturalKey = `${raceNaturalKey}:runner:${suffix}`;
    const mergeStatus = boxNumber != null ? "ready" : "quarantine";
    if (mergeStatus === "quarantine") {
      await emit("quarantine", {
        issueType: "runner-row",
        naturalKey,
        sourceArchiveKey: archiveNaturalKey(candidate),
        reason: "missing_box_number",
      });
      issues.quarantine += 1;
    }
    const item: SelectedRunner = {
      row,
      naturalKey,
      boxNumber,
      mergeStatus,
      score: shallowCompleteness(row),
      index,
    };
    await selectRow(selected, item, candidate, "runner-natural-key", emit, issues);
  }
  return [...selected.values()].sort(
    (a, b) =>
      (a.boxNumber ?? Number.MAX_SAFE_INTEGER) - (b.boxNumber ?? Number.MAX_SAFE_INTEGER) ||
      a.naturalKey.localeCompare(b.naturalKey),
  );
}

async function selectRow<T extends { naturalKey: string; score: number; index: number }>(
  selected: Map<string, T>,
  incoming: T,
  candidate: Candidate,
  issueType: string,
  emit: (dataset: Dataset, record: JsonObject) => Promise<void>,
  issues: IssueCounts,
) {
  const current = selected.get(incoming.naturalKey);
  if (!current) {
    selected.set(incoming.naturalKey, incoming);
    return;
  }
  const incomingWins =
    incoming.score > current.score || (incoming.score === current.score && incoming.index > current.index);
  const winner = incomingWins ? incoming : current;
  const loser = incomingWins ? current : incoming;
  selected.set(incoming.naturalKey, winner);
  await emit("duplicates", {
    issueType,
    naturalKey: incoming.naturalKey,
    sourceArchiveKey: archiveNaturalKey(candidate),
    selectedRowOrdinal: winner.index,
    droppedRowOrdinal: loser.index,
    selection: "completeness_then_latest_ordinal",
  });
  issues.duplicates += 1;
}

class ShardWriter {
  readonly dataset: Dataset;
  readonly filePath: string;
  readonly sourceCutoff: string;
  readonly stream: WriteStream;
  readonly hash = createHash("sha256");
  rowCount = 0;
  bytes = 0;
  minDate: string | null = null;
  maxDate: string | null = null;
  streamError: Error | null = null;
  closed = false;

  constructor(dataset: Dataset, filePath: string, sourceCutoff: string) {
    this.dataset = dataset;
    this.filePath = filePath;
    this.sourceCutoff = sourceCutoff;
    this.stream = createWriteStream(filePath, {
      encoding: "utf8",
      flags: "wx",
    });
    this.stream.on("error", (error) => {
      this.streamError = error;
    });
  }

  async write(record: JsonObject) {
    if (this.closed) throw new Error(`writer already closed: ${this.dataset}`);
    if (this.streamError) throw this.streamError;
    const line = `${JSON.stringify(record)}\n`;
    const lineBytes = Buffer.byteLength(line);
    this.hash.update(line);
    this.bytes += lineBytes;
    this.rowCount += 1;
    const date = recordDate(record);
    if (date) {
      this.minDate = this.minDate == null || date < this.minDate ? date : this.minDate;
      this.maxDate = this.maxDate == null || date > this.maxDate ? date : this.maxDate;
    }
    if (!this.stream.write(line)) await once(this.stream, "drain");
    if (this.streamError) throw this.streamError;
  }

  async close(): Promise<ShardFileMetadata> {
    if (this.closed) throw new Error(`writer already closed: ${this.dataset}`);
    this.closed = true;
    await closeStream(this.stream);
    if (this.streamError) throw this.streamError;
    return {
      dataset: this.dataset,
      file: path.basename(this.filePath),
      sha256: this.hash.digest("hex"),
      bytes: this.bytes,
      rowCount: this.rowCount,
      minDate: this.minDate,
      maxDate: this.maxDate,
      sourceCutoff: this.sourceCutoff,
      transformVersion: TRANSFORM_VERSION,
    };
  }

  abort() {
    if (!this.closed) {
      this.closed = true;
      this.stream.destroy();
    }
  }
}

function buildManifest(
  options: NormalizedHarvestOptions,
  inventory: Inventory,
  partitions: CompletedPartition[],
): HarvestManifest {
  const runInstanceId = `thedogs-export:${randomUUID()}`;
  const datasets = Object.fromEntries(
    DATASETS.map((dataset) => {
      const files = partitions.flatMap((partition) =>
        partition.manifest.outputs.filter((output) => output.dataset === dataset),
      );
      return [
        dataset,
        {
          shards: files.length,
          rowCount: files.reduce((sum, file) => sum + file.rowCount, 0),
          bytes: files.reduce((sum, file) => sum + file.bytes, 0),
          sha256: sha256Text(files.map((file) => `${file.file}:${file.sha256}`).join("\n")),
        },
      ];
    }),
  ) as HarvestManifest["datasets"];
  const issues = partitions.reduce<IssueCounts>(
    (total, partition) => ({
      duplicates: total.duplicates + partition.manifest.issues.duplicates,
      orphans: total.orphans + partition.manifest.issues.orphans,
      quarantine: total.quarantine + partition.manifest.issues.quarantine,
      targetIdAssignments: 0,
    }),
    { duplicates: 0, orphans: 0, quarantine: 0, targetIdAssignments: 0 },
  );
  const fullCorpus =
    options.profiles &&
    options.races &&
    !options.from &&
    !options.to &&
    options.limitProfiles === 0 &&
    options.limitRaceDays === 0;
  const status: HarvestManifest["status"] = !fullCorpus
    ? "subset"
    : issues.quarantine > 0
      ? "blocked"
      : issues.orphans > 0
        ? "operator_attention"
        : "complete";

  return {
    schemaVersion: 1,
    transformVersion: TRANSFORM_VERSION,
    generatedAt: new Date().toISOString(),
    status,
    source: {
      provider: PROVIDER,
      runInstanceId,
      inventorySha256: inventory.inventorySha256,
      sourceCutoff: inventory.sourceCutoff,
      profileRoot: options.profiles ? sourceRootLabel(options.profileDir) : null,
      raceRoot: options.races ? sourceRootLabel(options.rawDir) : null,
    },
    scope: {
      profiles: options.profiles,
      races: options.races,
      from: options.from ?? null,
      to: options.to ?? null,
      limitProfiles: options.limitProfiles,
      limitRaceDays: options.limitRaceDays,
      fullCorpus,
    },
    identityPolicy: {
      providerKeys: true,
      stableNaturalKeys: true,
      profileArchivesExactProviderIdentity: true,
      targetIdsGenerated: false,
      targetIdAssignments: 0,
    },
    inventory: {
      profile: {
        ...inventory.counts.profile,
        coverageProven: coverageProven(inventory.counts.profile),
      },
      "race-day": {
        ...inventory.counts["race-day"],
        coverageProven: coverageProven(inventory.counts["race-day"]),
      },
    },
    datasets,
    issues,
    partitions: partitions
      .sort((a, b) => a.manifest.partition - b.manifest.partition)
      .map((partition) => ({
        directory: partition.directory,
        manifestSha256: partition.manifestSha256,
        inputCount: partition.manifest.inputCount,
        inputSha256: partition.manifest.inputSha256,
        outputs: partition.manifest.outputs,
        issues: partition.manifest.issues,
      })),
    archivePolicy: {
      payloadCopied: false,
      sourceFilesRetained: true,
      sourceFilesBoundBySha256: true,
      rawProfilePiiLogged: false,
      note: "Archive rows index the original local source by relative path, bytes, and SHA256; raw HTML and provider payloads are not duplicated or logged.",
    },
  };
}

async function verifyCompletedRun(outputDir: string, expectedInventorySha256: string, runConfig: JsonObject) {
  const manifestPath = path.join(outputDir, "manifest.json");
  const manifestText = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(manifestText) as HarvestManifest;
  const recordedHash = (await readFile(path.join(outputDir, "manifest.sha256"), "utf8")).trim();
  const actualHash = sha256Text(manifestText);
  if (recordedHash !== actualHash) throw new Error("completed manifest SHA256 mismatch");
  if (manifest.transformVersion !== TRANSFORM_VERSION || manifest.source.inventorySha256 !== expectedInventorySha256) {
    throw new Error("completed output does not match the current source inventory");
  }
  const actualConfig = {
    profiles: manifest.scope.profiles,
    races: manifest.scope.races,
    from: manifest.scope.from,
    to: manifest.scope.to,
    limitProfiles: manifest.scope.limitProfiles,
    limitRaceDays: manifest.scope.limitRaceDays,
    shards: manifest.partitions.length,
  };
  if (JSON.stringify(actualConfig) !== JSON.stringify(runConfig)) {
    throw new Error("completed output does not match the requested scope");
  }

  for (const partition of manifest.partitions) {
    const partitionDir = path.join(outputDir, partition.directory);
    const verified = await verifyPartition(
      partitionDir,
      expectedInventorySha256,
      partition.inputSha256,
      manifest.source.sourceCutoff,
      Number(partition.directory.match(/^partition-(\d+)-/)?.[1]),
      manifest.partitions.length,
    );
    if (verified.manifestSha256 !== partition.manifestSha256) {
      throw new Error(`partition manifest digest mismatch: ${partition.directory}`);
    }
  }
  return { manifest, manifestSha256: actualHash };
}

async function verifyPartition(
  partitionDir: string,
  expectedInventorySha256: string,
  expectedInputSha256: string,
  expectedSourceCutoff: string,
  expectedIndex: number,
  expectedCount: number,
): Promise<CompletedPartition> {
  const manifestPath = path.join(partitionDir, "partition-manifest.json");
  const manifestText = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(manifestText) as PartitionManifest;
  const recordedHash = (await readFile(path.join(partitionDir, "partition-manifest.sha256"), "utf8")).trim();
  const manifestSha256 = sha256Text(manifestText);
  if (recordedHash !== manifestSha256) {
    throw new Error(`partition manifest SHA256 mismatch: ${path.basename(partitionDir)}`);
  }
  if (
    manifest.transformVersion !== TRANSFORM_VERSION ||
    manifest.sourceInventorySha256 !== expectedInventorySha256 ||
    manifest.inputSha256 !== expectedInputSha256 ||
    manifest.sourceCutoff !== expectedSourceCutoff ||
    manifest.partition !== expectedIndex ||
    manifest.partitionCount !== expectedCount
  ) {
    throw new Error(`partition checkpoint mismatch: ${path.basename(partitionDir)}`);
  }
  for (const output of manifest.outputs) {
    const filePath = path.join(partitionDir, output.file);
    const fileStat = await stat(filePath);
    if (fileStat.size !== output.bytes || (await sha256File(filePath)) !== output.sha256) {
      throw new Error(`partition output verification failed: ${output.file}`);
    }
  }
  return {
    directory: path.basename(partitionDir),
    manifest,
    manifestSha256,
  };
}

function duplicateSnapshotRecord(duplicate: DuplicateSnapshot): JsonObject {
  return {
    issueType: "source-snapshot-natural-key",
    sourceKind: duplicate.kind,
    naturalKey: duplicate.naturalKey,
    selectedSourcePath: duplicate.selected.relativePath,
    selectedSourceSha256: duplicate.selected.sha256,
    selectedSnapshotTime: duplicate.selected.snapshotTime,
    selectedCompleteness: duplicate.selected.completeness,
    droppedSourcePath: duplicate.dropped.relativePath,
    droppedSourceSha256: duplicate.dropped.sha256,
    droppedSnapshotTime: duplicate.dropped.snapshotTime,
    droppedCompleteness: duplicate.dropped.completeness,
    selection: "newest_then_completeness_then_sha256",
  };
}

function partitionInputDigest(inputs: Candidate[], invalid: InvalidSource[], duplicates: DuplicateSnapshot[]) {
  const lines = [
    ...inputs.map((item) => `input\t${item.kind}\t${item.naturalKey}\t${item.relativePath}\t${item.sha256}`),
    ...invalid.map((item) => `invalid\t${item.kind}\t${item.relativePath}\t${item.sha256}\t${item.reason}`),
    ...duplicates.map(
      (item) => `duplicate\t${item.kind}\t${item.naturalKey}\t${item.dropped.relativePath}\t${item.dropped.sha256}`,
    ),
  ].sort();
  return sha256Text(lines.join("\n"));
}

function inventoryDigestLine(value: Candidate | InvalidSource) {
  return "reason" in value
    ? `invalid\t${value.kind}\t${value.relativePath}\t${value.bytes}\t${value.sha256}`
    : `valid\t${value.kind}\t${value.relativePath}\t${value.bytes}\t${value.sha256}\t${value.naturalKey}\t${value.snapshotTime}\t${value.completeness}`;
}

function partitionValues<T>(values: T[], partitionCount: number, key: (value: T) => string) {
  const partitions = Array.from({ length: partitionCount }, () => [] as T[]);
  for (const value of values) {
    partitions[partitionIndex(key(value), partitionCount)].push(value);
  }
  return partitions;
}

function partitionIndex(value: string, partitionCount: number) {
  return Number.parseInt(sha256Text(value).slice(0, 8), 16) % partitionCount;
}

function partitionName(index: number, count: number) {
  return `partition-${String(index).padStart(4, "0")}-of-${String(count).padStart(4, "0")}`;
}

function partitionLabel(index: number, count: number) {
  return `${String(index + 1).padStart(4, "0")}-of-${String(count).padStart(4, "0")}`;
}

async function cleanupOwnedTemporaryPartitions(workDir: string) {
  const resolvedWorkDir = path.resolve(workDir);
  for (const entry of await readdir(resolvedWorkDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^partition-\d+-of-\d+\.tmp-/.test(entry.name)) continue;
    const target = path.resolve(resolvedWorkDir, entry.name);
    if (path.dirname(target) !== resolvedWorkDir) {
      throw new Error("refusing to remove a temporary directory outside the work directory");
    }
    await rm(target, { recursive: true, force: true });
  }
}

function collectRaceProviderReferences(meetings: JsonObject[], keys: Set<string>) {
  for (const meeting of meetings) {
    for (const race of objectArray(meeting.races)) {
      const sourceId = canonicalSourceId(stringValue(race.sourceId));
      if (sourceId) keys.add(providerKey("race", sourceId));
    }
  }
}

function profileCompleteness(archive: JsonObject, profile: JsonObject) {
  return (
    shallowCompleteness(profile) * 10 +
    objectArray(profile.formRows).length * 100 +
    (stringValue(archive.profileHtml) ? 5 : 0) +
    (stringValue(archive.fullFormHtml) ? 10 : 0)
  );
}

function raceDayCompleteness(meetings: JsonObject[]) {
  let races = 0;
  let runners = 0;
  let results = 0;
  let media = 0;
  for (const meeting of meetings) {
    const meetingRaces = objectArray(meeting.races);
    races += meetingRaces.length;
    for (const race of meetingRaces) {
      const raceRunners = objectArray(race.runners);
      runners += raceRunners.length;
      results += raceRunners.filter(hasResult).length;
      const raw = parsedObject(race.sourceRawJson);
      if (
        stringValue(race.replayUrl) ||
        stringValue(race.videoSourceId) ||
        stringValue(raw?.replayUrl) ||
        stringValue(raw?.videoSourceId)
      ) {
        media += 1;
      }
      if (stringValue(race.photoFinishUrl) || stringValue(raw?.photoFinishUrl)) {
        media += 1;
      }
    }
  }
  return meetings.length * 1_000_000 + races * 10_000 + runners * 10 + results + media;
}

function shallowCompleteness(value: JsonObject) {
  return Object.values(value).reduce<number>((score, entry) => {
    if (entry == null || entry === "") return score;
    if (Array.isArray(entry)) return score + entry.length;
    if (typeof entry === "object") return score + Object.keys(entry).length;
    return score + 1;
  }, 0);
}

function candidateInScope(candidate: Candidate, options: NormalizedHarvestOptions) {
  if (candidate.kind !== "race-day") return true;
  const date = candidate.dataDate;
  if (!date) return false;
  return (!options.from || date >= options.from) && (!options.to || date <= options.to);
}

function applyLimit(candidates: Candidate[], limit: number, counts: ScopeCounts) {
  const selected = limit > 0 ? candidates.slice(0, limit) : candidates;
  counts.excludedByLimit = candidates.length - selected.length;
  return selected;
}

function coverageProven(counts: ScopeCounts) {
  return (
    counts.discoveredFiles ===
      counts.invalidFiles + counts.excludedByFilter + counts.uniqueNaturalKeys + counts.duplicateSnapshots &&
    counts.uniqueNaturalKeys === counts.selectedFiles + counts.excludedByLimit &&
    counts.validFiles + counts.invalidFiles === counts.discoveredFiles
  );
}

function emptyScopeCounts(): ScopeCounts {
  return {
    discoveredFiles: 0,
    validFiles: 0,
    invalidFiles: 0,
    excludedByFilter: 0,
    uniqueNaturalKeys: 0,
    duplicateSnapshots: 0,
    selectedFiles: 0,
    excludedByLimit: 0,
  };
}

function compareCandidateIdentity(left: Candidate, right: Candidate) {
  return `${left.kind}:${left.naturalKey}:${left.relativePath}`.localeCompare(
    `${right.kind}:${right.naturalKey}:${right.relativePath}`,
  );
}

function dateFromRelativeRacePath(relativePath: string) {
  const match = slash(relativePath).match(/(?:^|\/)(\d{4})\/(\d{2})\/(\d{2})\.json$/i);
  if (!match) return null;
  const value = `${match[1]}-${match[2]}-${match[3]}`;
  return validDateOnly(value) ? value : null;
}

function providerKey(entity: string, sourceId: string) {
  return `${PROVIDER}:${entity}:${sourceId}`;
}

function dogProviderKey(sourceId: string) {
  return providerKey("dog", cleanDogSourceId(sourceId) ?? sourceId);
}

function archiveNaturalKey(candidate: Candidate) {
  return candidate.kind === "profile" ? `${PROVIDER}:dog-profile:${candidate.sourceId}` : candidate.naturalKey;
}

function cleanDogSourceId(value: unknown) {
  const text = stringValue(value);
  if (!text) return null;
  const providerPrefix = text.match(/^thedogs:(.+)$/i)?.[1];
  if (providerPrefix) return providerPrefix;
  const runnerId = text.match(/^dog:([^:]+):box:/i)?.[1];
  return runnerId ?? text;
}

function runnerDogSourceId(runner: JsonObject, dog: JsonObject | undefined) {
  const earBrand = cleanDogSourceId(dog?.earBrand);
  if (earBrand) return earBrand;
  return cleanDogSourceId(runner.sourceId);
}

function canonicalSourceId(value: unknown) {
  const text = stringValue(value);
  if (!text) return null;
  try {
    const url = new URL(text, "https://www.thedogs.com.au");
    const params = [...url.searchParams.entries()].sort(
      ([leftKey, leftValue], [rightKey, rightValue]) =>
        leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue),
    );
    const search = new URLSearchParams(params).toString();
    const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;
    return `${pathname}${search ? `?${search}` : ""}`;
  } catch {
    return canonicalOpaqueId(text);
  }
}

function canonicalOpaqueId(value: unknown) {
  const text = stringValue(value);
  return text ? text.normalize("NFKC") : null;
}

function naturalToken(value: string) {
  const token = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return token || "unknown";
}

function hasResult(runner: JsonObject) {
  return [runner.finishingPosition, runner.runningTime, runner.margin, runner.prizeMoneyWon, runner.splitTime].some(
    (value) => value != null,
  );
}

function parsedObject(value: unknown) {
  if (typeof value !== "string") return asObject(value);
  try {
    return asObject(JSON.parse(value));
  } catch {
    return undefined;
  }
}

function parsedSanitizedValue(value: unknown) {
  if (typeof value !== "string") return sanitizeArchiveValue(value);
  try {
    return sanitizeArchiveValue(JSON.parse(value));
  } catch {
    return null;
  }
}

function compactRecord(record: JsonObject) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined && value !== null));
}

function requireObject(value: unknown, reason = "expected_object"): JsonObject {
  const object = asObject(value);
  if (!object) failValidation(reason);
  return object;
}

function asObject(value: unknown) {
  return value != null && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : undefined;
}

function objectArray(value: unknown) {
  return Array.isArray(value) ? value.map(asObject).filter((item): item is JsonObject => item != null) : [];
}

function stringValue(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function integerValue(value: unknown) {
  const number = numberValue(value);
  return number != null && Number.isInteger(number) ? number : undefined;
}

function positiveInteger(value: unknown) {
  const number = integerValue(value);
  return number != null && number > 0 ? number : null;
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function isoValue(value: unknown) {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function dateOnly(value: unknown) {
  const iso = isoValue(value);
  return iso?.slice(0, 10) ?? null;
}

function validDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function utf8Bytes(value: unknown) {
  return typeof value === "string" ? Buffer.byteLength(value) : 0;
}

function recordDate(record: JsonObject) {
  for (const key of ["date", "meetingDate", "raceTime", "whelpDate", "fetchedAt", "snapshotTime"]) {
    const value = stringValue(record[key]);
    const iso = isoValue(value);
    if (iso) return iso;
  }
  return null;
}

function assertNoTargetIdentity(record: JsonObject, dataset: Dataset) {
  if (["archives", "duplicates", "orphans", "quarantine"].includes(dataset)) return;
  for (const forbidden of [
    "id",
    "dogId",
    "sireId",
    "damId",
    "trackId",
    "meetingId",
    "raceId",
    "runnerId",
    "trainerId",
  ]) {
    if (Object.hasOwn(record, forbidden)) {
      throw new Error(`normalized ${dataset} row assigned forbidden target field ${forbidden}`);
    }
  }
}

function validationReason(error: unknown) {
  return error instanceof SourceValidationError ? error.code : "source_validation_failed";
}

class SourceValidationError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function failValidation(code: string): never {
  throw new SourceValidationError(code);
}

async function discoverJsonFiles(root: string) {
  const output: string[] = [];
  await walk(root, output);
  return output.sort((left, right) => slash(left).localeCompare(slash(right)));
}

async function walk(current: string, output: string[]) {
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, output);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
      output.push(fullPath);
    }
  }
}

async function assertDirectory(directory: string) {
  const fileStat = await stat(directory).catch(() => null);
  if (!fileStat?.isDirectory()) throw new Error(`source directory is missing: ${directory}`);
}

function validateOptions(options: NormalizedHarvestOptions) {
  if (!options.profiles && !options.races) throw new Error("at least one source scope is required");
  if (!Number.isInteger(options.shards) || options.shards < 1 || options.shards > 256) {
    throw new Error("--shards must be an integer from 1 to 256");
  }
  if (options.from && !validDateOnly(options.from)) throw new Error("--from must be YYYY-MM-DD");
  if (options.to && !validDateOnly(options.to)) throw new Error("--to must be YYYY-MM-DD");
  if (options.from && options.to && options.from > options.to) {
    throw new Error("--from must be before or equal to --to");
  }
  if (!Number.isInteger(options.limitProfiles) || options.limitProfiles < 0) {
    throw new Error("--limit-profiles must be a non-negative integer");
  }
  if (!Number.isInteger(options.limitRaceDays) || options.limitRaceDays < 0) {
    throw new Error("--limit-race-days must be a non-negative integer");
  }
  const resolvedOut = path.resolve(options.outDir);
  const resolvedProfile = path.resolve(options.profileDir);
  const resolvedRaw = path.resolve(options.rawDir);
  if (isCli) {
    const backfillRoot = path.resolve(".backfill");
    const relativeOutput = path.relative(backfillRoot, resolvedOut);
    if (relativeOutput === "" || relativeOutput.startsWith("..") || path.isAbsolute(relativeOutput)) {
      throw new Error("--out-dir must be a child of the repository .backfill directory");
    }
  }
  if (resolvedOut === resolvedProfile || resolvedOut === resolvedRaw) {
    throw new Error("output directory must not be a source directory");
  }
}

function sourceRootLabel(root: string) {
  const relative = path.relative(process.cwd(), path.resolve(root));
  return relative && !relative.startsWith("..") ? slash(relative) : slash(path.resolve(root));
}

function sourceSummary(result: NormalizedHarvestResult) {
  return {
    status: result.manifest.status,
    reused: result.reused,
    outputDir: result.outputDir,
    manifestSha256: result.manifestSha256,
    transformVersion: result.manifest.transformVersion,
    sourceInventorySha256: result.manifest.source.inventorySha256,
    sourceCutoff: result.manifest.source.sourceCutoff,
    profileFiles: result.manifest.inventory.profile,
    raceDayFiles: result.manifest.inventory["race-day"],
    datasets: Object.fromEntries(DATASETS.map((dataset) => [dataset, result.manifest.datasets[dataset].rowCount])),
    issues: result.manifest.issues,
  };
}

function parseOptions(args: string[]): NormalizedHarvestOptions {
  const allowed = new Set([
    "profile-dir",
    "raw-dir",
    "out-dir",
    "shards",
    "profiles-only",
    "races-only",
    "from",
    "to",
    "limit-profiles",
    "limit-race-days",
  ]);
  const values = new Map<string, string | true>();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) throw new Error(`unexpected argument: ${arg}`);
    const [key, inline] = arg.slice(2).split("=", 2);
    if (!allowed.has(key)) throw new Error(`unknown option: --${key}`);
    const next = args[index + 1];
    if (inline != null) values.set(key, inline);
    else if (next && !next.startsWith("--")) {
      values.set(key, next);
      index += 1;
    } else values.set(key, true);
  }
  const profilesOnly = values.has("profiles-only");
  const racesOnly = values.has("races-only");
  if (profilesOnly && racesOnly) {
    throw new Error("use only one of --profiles-only or --races-only");
  }
  return {
    profileDir: optionString(values, "profile-dir") ?? DEFAULT_PROFILE_DIR,
    rawDir: optionString(values, "raw-dir") ?? DEFAULT_RAW_DIR,
    outDir: optionString(values, "out-dir") ?? DEFAULT_OUT_DIR,
    shards: optionInteger(values, "shards", DEFAULT_SHARDS),
    profiles: !racesOnly,
    races: !profilesOnly,
    from: optionString(values, "from"),
    to: optionString(values, "to"),
    limitProfiles: optionInteger(values, "limit-profiles", 0),
    limitRaceDays: optionInteger(values, "limit-race-days", 0),
  };
}

function optionString(values: Map<string, string | true>, key: string) {
  const value = values.get(key);
  return typeof value === "string" ? value : undefined;
}

function optionInteger(values: Map<string, string | true>, key: string, fallback: number) {
  const value = optionString(values, key);
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`--${key} must be an integer`);
  return parsed;
}

function requireWriter(writers: Map<Dataset, ShardWriter>, dataset: Dataset) {
  const writer = writers.get(dataset);
  if (!writer) throw new Error(`missing writer: ${dataset}`);
  return writer;
}

function closeStream(stream: WriteStream) {
  return new Promise<void>((resolve, reject) => {
    stream.once("error", reject);
    stream.end(resolve);
  });
}

async function sha256File(filePath: string) {
  const hash = createHash("sha256");
  const stream = (await import("node:fs")).createReadStream(filePath);
  stream.on("data", (chunk) => hash.update(chunk));
  await once(stream, "end");
  return hash.digest("hex");
}

function sha256Buffer(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function sha256Text(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function slash(value: string) {
  return value.replace(/\\/g, "/");
}

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

const isCli = process.argv[1] != null && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isCli) {
  runNormalizedHarvest(parseOptions(process.argv.slice(2)))
    .then((result) => {
      console.log(JSON.stringify(sourceSummary(result), null, 2));
      if (result.manifest.status === "blocked") process.exitCode = 2;
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "unknown failure";
      console.error(`[export:thedogs:datasets] failed: ${message}`);
      process.exitCode = 1;
    });
}
