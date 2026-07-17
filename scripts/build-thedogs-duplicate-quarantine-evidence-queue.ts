/**
 * Reconstruct duplicate and quarantine evidence from a normalized TheDogs export.
 *
 * This script is filesystem-only. It never contacts a provider or database and
 * every row remains ineligible for canonical promotion or duplicate removal.
 */
import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  parseExactTheDogsRacePath,
  type TheDogsRaceIdentity,
} from "./build-thedogs-race-evidence-retrieval-queue";

export const DUPLICATE_QUARANTINE_EVIDENCE_VERSION =
  "giq-thedogs-duplicate-quarantine-evidence/v1" as const;
export const DUPLICATE_QUARANTINE_MANIFEST_VERSION =
  "giq-thedogs-duplicate-quarantine-evidence-manifest/v1" as const;
export const DUPLICATE_QUARANTINE_EVIDENCE_FILE =
  "duplicate-quarantine-evidence.jsonl";
export const DUPLICATE_QUARANTINE_QUEUE_FILE =
  "duplicate-quarantine-race-retrieval-queue.jsonl";
export const DUPLICATE_QUARANTINE_MANIFEST_FILE = "queue.manifest.json";
export const DUPLICATE_QUARANTINE_MANIFEST_SHA_FILE =
  "queue.manifest.sha256";

const ALLOWED_TRANSFORMS = new Set([
  "thedogs-normalized-harvest/v1",
  "thedogs-normalized-harvest/v2",
]);
const SHA256 = /^[0-9a-f]{64}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PARTITION_DIRECTORY = /^partition-(\d{4})-of-(\d{4})$/;
const DATASET_FILE: Record<DatasetName, RegExp> = {
  archives: /^archives-\d{4}-of-\d{4}\.jsonl$/,
  duplicates: /^duplicates-\d{4}-of-\d{4}\.jsonl$/,
  quarantine: /^quarantine-\d{4}-of-\d{4}\.jsonl$/,
};
const MAX_PARTITIONS = 4_096;
const MAX_SHARD_BYTES = 256 * 1024 * 1024;
const MAX_LINE_BYTES = 4 * 1024 * 1024;
const MAX_RAW_ARCHIVE_BYTES = 64 * 1024 * 1024;

type JsonRecord = Record<string, unknown>;
type DatasetName = "archives" | "duplicates" | "quarantine";
type DuplicateClassification =
  | "potential-exact-same-identity"
  | "potential-complementary-same-identity"
  | "identity-conflict-or-unknown";

type IssueSource = {
  partition: number;
  partitionDirectory: string;
  shardFile: string;
  lineNumber: number;
  rowSha256: string;
};

type NormalizedDuplicateIssue = IssueSource & {
  issueType: "runner-natural-key";
  naturalKey: string;
  sourceArchiveKey: string;
  selectedRowOrdinal: number;
  droppedRowOrdinal: number;
  selection: "completeness_then_latest_ordinal";
};

type NormalizedQuarantineIssue = IssueSource & {
  issueType: "runner-row" | "race-row";
  naturalKey: string;
  sourceArchiveKey: string;
  reason: "missing_dog_provider_identity" | "missing_race_distance";
};

type NormalizedIssue = NormalizedDuplicateIssue | NormalizedQuarantineIssue;

type RaceArchiveIndex = {
  sourceArchiveKey: string;
  sourceId: string;
  sourcePath: string;
  sourceSha256: string;
  sourceBytes: number;
};

type ShardMetadata = {
  dataset: DatasetName;
  file: string;
  sha256: string;
  bytes: number;
  rowCount: number;
};

type NormalizedSource = {
  manifestSha256: string;
  transformVersion: string;
  inventorySha256: string;
  sourceCutoff: string;
  sourceRaceRoot: string;
  partitionCount: number;
  diagnosticOnly: boolean;
  duplicateShardAggregateSha256: string;
  quarantineShardAggregateSha256: string;
  archiveShardAggregateSha256: string;
  duplicateShardRowCount: number;
  quarantineShardRowCount: number;
  archiveShardRowCount: number;
  issues: NormalizedIssue[];
  raceArchives: Map<string, RaceArchiveIndex>;
};

type RacePathEvidence = {
  status: "exact" | "unavailable";
  racePath: string | null;
  identity: TheDogsRaceIdentity | null;
  gapReason: string | null;
};

type RawCandidateBase = {
  signature: string;
  naturalKey: string;
  sourceArchiveKey: string;
  meetingOrdinal: number;
  raceOrdinal: number;
  racePathEvidence: RacePathEvidence;
};

type RawDuplicateCandidate = RawCandidateBase & {
  kind: "duplicate-runner";
  selectedRowOrdinal: number;
  droppedRowOrdinal: number;
  selectedRow: JsonRecord;
  droppedRow: JsonRecord;
};

type RawQuarantineCandidate = RawCandidateBase & {
  kind: "quarantine-runner" | "quarantine-race";
  reason: "missing_dog_provider_identity" | "missing_race_distance";
  rowOrdinal: number;
  row: JsonRecord;
};

type RawCandidate = RawDuplicateCandidate | RawQuarantineCandidate;

type FieldValue = { path: string; value: unknown };
type FieldConflict = { path: string; selected: unknown; dropped: unknown };

export type DuplicateQuarantineEvidenceRow = {
  schemaVersion: 1;
  evidenceVersion: typeof DUPLICATE_QUARANTINE_EVIDENCE_VERSION;
  evidenceId: string;
  provider: "thedogs";
  issueKind: RawCandidate["kind"];
  issueType: string;
  reason: string | null;
  naturalKey: string;
  sourceArchiveKey: string;
  normalizedIssueSource: IssueSource;
  rawArchive: RaceArchiveIndex;
  rawLocation: {
    meetingOrdinal: number;
    raceOrdinal: number;
    selectedRowOrdinal: number | null;
    droppedRowOrdinal: number | null;
    rowOrdinal: number | null;
  };
  racePathEvidence: RacePathEvidence;
  classification: DuplicateClassification;
  selectedObservation: Observation | null;
  droppedObservation: Observation | null;
  quarantinedObservation: Observation | null;
  fieldComparison: {
    equalPaths: string[];
    selectedOnly: FieldValue[];
    droppedOnly: FieldValue[];
    conflicts: FieldConflict[];
  } | null;
  authoritativeDuplicateProofPresent: false;
  exhaustiveReferenceProofPresent: false;
  noDataLossProofPresent: false;
  canonicalPromotionEligible: false;
  duplicateRemovalEligible: false;
  normalizedManifestSha256: string;
  sourceInventorySha256: string;
  sourceCutoff: string;
  transformVersion: string;
  rebuildRequiredFromV2: boolean;
  evidenceSha256: string;
};

type Observation = {
  rowSha256: string;
  row: JsonRecord;
  dogIdentity: {
    exactSourceId: string | null;
    observedSourceIds: string[];
    invalidIdentityEvidence: string[];
    name: string | null;
  };
};

export type DuplicateQuarantineRaceQueueRow = {
  schemaVersion: 1;
  queueVersion: typeof DUPLICATE_QUARANTINE_EVIDENCE_VERSION;
  provider: "thedogs";
  providerKey: string;
  racePath: string;
  identity: TheDogsRaceIdentity;
  issueOccurrenceCount: number;
  evidenceIds: string[];
  normalizedManifestSha256: string;
  sourceInventorySha256: string;
  sourceCutoff: string;
  transformVersion: string;
  retrievalStatus: "unverified";
  canonicalPromotionEligible: false;
  evidenceSha256: string;
};

export type DuplicateQuarantineEvidenceManifest = {
  schemaVersion: 1;
  manifestVersion: typeof DUPLICATE_QUARANTINE_MANIFEST_VERSION;
  evidenceVersion: typeof DUPLICATE_QUARANTINE_EVIDENCE_VERSION;
  provider: "thedogs";
  source: {
    normalizedManifestSha256: string;
    sourceInventorySha256: string;
    sourceCutoff: string;
    transformVersion: string;
    sourceRaceRoot: string;
    fullCorpus: true;
    partitionCount: number;
    diagnosticOnly: boolean;
    rebuildRequiredFromV2: boolean;
    duplicateShardAggregateSha256: string;
    quarantineShardAggregateSha256: string;
    archiveShardAggregateSha256: string;
    duplicateShardRowCount: number;
    quarantineShardRowCount: number;
    archiveShardRowCount: number;
    rawArchiveCount: number;
    rawArchiveAggregateSha256: string;
  };
  evidence: FileStats & {
    file: typeof DUPLICATE_QUARANTINE_EVIDENCE_FILE;
    duplicateRunnerObservations: number;
    duplicateRunnerNaturalKeys: number;
    quarantineObservations: number;
    missingDogIdentityObservations: number;
    missingRaceDistanceObservations: number;
    classifications: Record<DuplicateClassification, number>;
  };
  retrievalQueue: FileStats & {
    file: typeof DUPLICATE_QUARANTINE_QUEUE_FILE;
    issueOccurrenceCount: number;
    unavailablePathOccurrenceCount: number;
    unavailablePathGaps: Record<string, number>;
  };
  authoritativeDuplicateProofPresent: false;
  exhaustiveReferenceProofPresent: false;
  noDataLossProofPresent: false;
  canonicalPromotionEligible: false;
  duplicateRemovalEligible: false;
};

type FileStats = {
  sha256: string;
  evidenceSha256: string;
  bytes: number;
  rowCount: number;
};

export type BuildDuplicateQuarantineEvidenceOptions = {
  normalizedDir: string;
  rawRaceRoot: string;
  outputDir?: string;
  dryRun: boolean;
};

export type BuildDuplicateQuarantineEvidenceResult = {
  outputDir: string | null;
  manifest: DuplicateQuarantineEvidenceManifest;
  manifestSha256: string;
  evidenceRows: DuplicateQuarantineEvidenceRow[];
  queueRows: DuplicateQuarantineRaceQueueRow[];
};

export async function buildDuplicateQuarantineEvidenceQueue(
  options: BuildDuplicateQuarantineEvidenceOptions,
): Promise<BuildDuplicateQuarantineEvidenceResult> {
  const source = await readNormalizedSource(options.normalizedDir);
  const issuesByArchive = groupBy(source.issues, (issue) => issue.sourceArchiveKey);
  const evidenceRows: DuplicateQuarantineEvidenceRow[] = [];
  const rawArchives: RaceArchiveIndex[] = [];
  const realRawRoot = await realpath(path.resolve(options.rawRaceRoot));

  for (const sourceArchiveKey of [...issuesByArchive.keys()].sort()) {
    const archiveIndex = source.raceArchives.get(sourceArchiveKey);
    if (!archiveIndex) {
      throw new Error(`missing normalized race archive index: ${sourceArchiveKey}`);
    }
    rawArchives.push(archiveIndex);
    const archive = await readRawArchive(realRawRoot, archiveIndex);
    const candidates = reconstructRawCandidates(archive, archiveIndex);
    const candidatesBySignature = groupBy(candidates, (candidate) => candidate.signature);
    const issues = issuesByArchive.get(sourceArchiveKey)!.sort(compareIssueSource);

    for (const issue of issues) {
      const signature = issueSignature(issue);
      const matches = candidatesBySignature.get(signature);
      const candidate = matches?.shift();
      if (!candidate) {
        throw new Error(`normalized issue has no exact raw observation: ${signature}`);
      }
      evidenceRows.push(buildEvidenceRow(issue, candidate, archiveIndex, source));
    }
    const leftovers = [...candidatesBySignature.values()].reduce(
      (count, rows) => count + rows.length,
      0,
    );
    if (leftovers !== 0) {
      throw new Error(`${sourceArchiveKey} has ${leftovers} unaccounted raw issue observations`);
    }
  }

  evidenceRows.sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
  if (new Set(evidenceRows.map((row) => row.evidenceId)).size !== evidenceRows.length) {
    throw new Error("duplicate evidence IDs were produced");
  }
  if (evidenceRows.length !== source.issues.length) {
    throw new Error("normalized issue conservation failed");
  }

  const queueRows = buildRetrievalQueue(evidenceRows, source);
  const { body: evidenceBody, ...evidenceStats } = jsonlStats(evidenceRows);
  const { body: queueBody, ...queueStats } = jsonlStats(queueRows);
  const duplicateRows = evidenceRows.filter((row) => row.issueKind === "duplicate-runner");
  const unavailable = evidenceRows.filter(
    (row) => row.racePathEvidence.status === "unavailable",
  );
  const unavailablePathGaps = countBy(
    unavailable,
    (row) => row.racePathEvidence.gapReason ?? "unknown",
  );
  const classifications = countBy(
    evidenceRows,
    (row) => row.classification,
    [
      "potential-exact-same-identity",
      "potential-complementary-same-identity",
      "identity-conflict-or-unknown",
    ] as const,
  ) as Record<DuplicateClassification, number>;
  const rawArchiveAggregateSha256 = sha256Text(
    [...rawArchives]
      .sort((left, right) => left.sourcePath.localeCompare(right.sourcePath))
      .map(
        (archive) =>
          `${archive.sourcePath}:${archive.sourceSha256}:${archive.sourceBytes}`,
      )
      .join("\n"),
  );
  const rebuildRequiredFromV2 = source.transformVersion !== "thedogs-normalized-harvest/v2";
  const manifest: DuplicateQuarantineEvidenceManifest = {
    schemaVersion: 1,
    manifestVersion: DUPLICATE_QUARANTINE_MANIFEST_VERSION,
    evidenceVersion: DUPLICATE_QUARANTINE_EVIDENCE_VERSION as typeof DUPLICATE_QUARANTINE_EVIDENCE_VERSION,
    provider: "thedogs",
    source: {
      normalizedManifestSha256: source.manifestSha256,
      sourceInventorySha256: source.inventorySha256,
      sourceCutoff: source.sourceCutoff,
      transformVersion: source.transformVersion,
      sourceRaceRoot: source.sourceRaceRoot,
      fullCorpus: true,
      partitionCount: source.partitionCount,
      diagnosticOnly: source.diagnosticOnly,
      rebuildRequiredFromV2,
      duplicateShardAggregateSha256: source.duplicateShardAggregateSha256,
      quarantineShardAggregateSha256: source.quarantineShardAggregateSha256,
      archiveShardAggregateSha256: source.archiveShardAggregateSha256,
      duplicateShardRowCount: source.duplicateShardRowCount,
      quarantineShardRowCount: source.quarantineShardRowCount,
      archiveShardRowCount: source.archiveShardRowCount,
      rawArchiveCount: rawArchives.length,
      rawArchiveAggregateSha256,
    },
    evidence: {
      file: DUPLICATE_QUARANTINE_EVIDENCE_FILE,
      ...evidenceStats,
      duplicateRunnerObservations: duplicateRows.length,
      duplicateRunnerNaturalKeys: new Set(
        duplicateRows.map((row) => row.naturalKey),
      ).size,
      quarantineObservations: evidenceRows.length - duplicateRows.length,
      missingDogIdentityObservations: evidenceRows.filter(
        (row) => row.reason === "missing_dog_provider_identity",
      ).length,
      missingRaceDistanceObservations: evidenceRows.filter(
        (row) => row.reason === "missing_race_distance",
      ).length,
      classifications,
    },
    retrievalQueue: {
      file: DUPLICATE_QUARANTINE_QUEUE_FILE,
      ...queueStats,
      issueOccurrenceCount: queueRows.reduce(
        (sum, row) => sum + row.issueOccurrenceCount,
        0,
      ),
      unavailablePathOccurrenceCount: unavailable.length,
      unavailablePathGaps,
    },
    authoritativeDuplicateProofPresent: false,
    exhaustiveReferenceProofPresent: false,
    noDataLossProofPresent: false,
    canonicalPromotionEligible: false,
    duplicateRemovalEligible: false,
  };
  if (
    manifest.retrievalQueue.issueOccurrenceCount +
      manifest.retrievalQueue.unavailablePathOccurrenceCount !==
    evidenceRows.length
  ) {
    throw new Error("retrieval queue occurrence conservation failed");
  }
  const manifestBody = `${JSON.stringify(manifest, null, 2)}\n`;
  const manifestSha256 = sha256Text(manifestBody);

  if (options.dryRun) {
    return {
      outputDir: null,
      manifest,
      manifestSha256,
      evidenceRows,
      queueRows,
    };
  }
  if (!options.outputDir) {
    throw new Error("--output-dir is required unless --dry-run is used");
  }
  const outputDir = path.resolve(options.outputDir);
  if (await exists(outputDir)) {
    throw new Error(`immutable evidence output already exists: ${outputDir}`);
  }
  const parent = path.dirname(outputDir);
  await mkdir(parent, { recursive: true });
  const temporaryDir = await mkdtemp(
    path.join(parent, `.${path.basename(outputDir)}.tmp-`),
  );
  assertDirectChild(parent, temporaryDir);
  try {
    await writeFile(
      path.join(temporaryDir, DUPLICATE_QUARANTINE_EVIDENCE_FILE),
      evidenceBody,
      { encoding: "utf8", flag: "wx" },
    );
    await writeFile(
      path.join(temporaryDir, DUPLICATE_QUARANTINE_QUEUE_FILE),
      queueBody,
      { encoding: "utf8", flag: "wx" },
    );
    await writeFile(
      path.join(temporaryDir, DUPLICATE_QUARANTINE_MANIFEST_FILE),
      manifestBody,
      { encoding: "utf8", flag: "wx" },
    );
    await writeFile(
      path.join(temporaryDir, DUPLICATE_QUARANTINE_MANIFEST_SHA_FILE),
      `${manifestSha256}\n`,
      { encoding: "utf8", flag: "wx" },
    );
    await rename(temporaryDir, outputDir);
  } catch (error) {
    await rm(temporaryDir, { recursive: true, force: true });
    throw error;
  }
  return { outputDir, manifest, manifestSha256, evidenceRows, queueRows };
}

async function readNormalizedSource(normalizedDir: string): Promise<NormalizedSource> {
  const root = path.resolve(normalizedDir);
  const manifestBody = await readFile(safeChild(root, "manifest.json"), "utf8");
  const manifestSha256 = sha256Text(manifestBody);
  const recordedManifestSha256 = requireSha256(
    (await readFile(safeChild(root, "manifest.sha256"), "utf8")).trim(),
    "normalized manifest sidecar",
  );
  if (manifestSha256 !== recordedManifestSha256) {
    throw new Error("normalized manifest SHA256 mismatch");
  }
  const manifest = requireRecord(JSON.parse(manifestBody), "normalized manifest");
  if (manifest.schemaVersion !== 1) {
    throw new Error("normalized manifest schemaVersion must be 1");
  }
  const transformVersion = requireString(
    manifest.transformVersion,
    "normalized transformVersion",
  );
  if (!ALLOWED_TRANSFORMS.has(transformVersion)) {
    throw new Error(`unsupported normalized transform: ${transformVersion}`);
  }
  const source = requireRecord(manifest.source, "normalized source");
  if (source.provider !== "thedogs") {
    throw new Error("normalized source provider must be thedogs");
  }
  const inventorySha256 = requireSha256(
    source.inventorySha256,
    "normalized inventory SHA256",
  );
  const sourceCutoff = requireIsoTimestamp(
    source.sourceCutoff,
    "normalized source cutoff",
  );
  const sourceRaceRoot = requireString(
    source.raceRoot,
    "normalized source raceRoot",
  );
  validateFullCorpus(manifest, transformVersion);
  const partitions = requireArray(manifest.partitions, "normalized partitions");
  if (partitions.length === 0 || partitions.length > MAX_PARTITIONS) {
    throw new Error("normalized partition count is invalid");
  }

  const metadata: Record<DatasetName, ShardMetadata[]> = {
    archives: [],
    duplicates: [],
    quarantine: [],
  };
  const issues: NormalizedIssue[] = [];
  const raceArchives = new Map<string, RaceArchiveIndex>();
  const rowCounts: Record<DatasetName, number> = {
    archives: 0,
    duplicates: 0,
    quarantine: 0,
  };

  for (let index = 0; index < partitions.length; index += 1) {
    const rootPartition = requireRecord(
      partitions[index],
      `normalized partitions[${index}]`,
    );
    const directory = requireString(
      rootPartition.directory,
      `normalized partitions[${index}].directory`,
    );
    validatePartitionDirectory(directory, index, partitions.length);
    const partitionRoot = safeChild(root, directory);
    const partitionBody = await readFile(
      safeChild(partitionRoot, "partition-manifest.json"),
      "utf8",
    );
    const partitionSha256 = sha256Text(partitionBody);
    const partitionSidecar = requireSha256(
      (
        await readFile(
          safeChild(partitionRoot, "partition-manifest.sha256"),
          "utf8",
        )
      ).trim(),
      `${directory} manifest sidecar`,
    );
    if (
      partitionSha256 !== partitionSidecar ||
      partitionSha256 !== rootPartition.manifestSha256
    ) {
      throw new Error(`${directory} manifest SHA256 mismatch`);
    }
    const partition = requireRecord(
      JSON.parse(partitionBody),
      `${directory} manifest`,
    );
    validatePartitionContract(
      partition,
      rootPartition,
      index,
      partitions.length,
      transformVersion,
      inventorySha256,
      sourceCutoff,
    );
    const outputs = requireArray(partition.outputs, `${directory} outputs`).map(
      (value, outputIndex) =>
        requireRecord(value, `${directory} outputs[${outputIndex}]`),
    );
    const rootOutputs = requireArray(
      rootPartition.outputs,
      `${directory} root outputs`,
    ).map((value, outputIndex) =>
      requireRecord(value, `${directory} root outputs[${outputIndex}]`),
    );

    for (const dataset of ["archives", "duplicates", "quarantine"] as const) {
      const matches = outputs.filter((output) => output.dataset === dataset);
      const rootMatches = rootOutputs.filter((output) => output.dataset === dataset);
      if (
        matches.length !== 1 ||
        rootMatches.length !== 1 ||
        stableJson(matches[0]) !== stableJson(rootMatches[0])
      ) {
        throw new Error(`${directory} ${dataset} metadata changed across manifests`);
      }
      const output = validateOutput(
        matches[0]!,
        dataset,
        directory,
        transformVersion,
        sourceCutoff,
      );
      metadata[dataset].push(output);
      const buffer = await readFile(safeChild(partitionRoot, output.file));
      if (
        buffer.byteLength !== output.bytes ||
        sha256Buffer(buffer) !== output.sha256
      ) {
        throw new Error(`${directory}/${output.file} digest or byte count mismatch`);
      }
      const rows = parseJsonLines(buffer, output.file);
      if (rows.length !== output.rowCount) {
        throw new Error(`${directory}/${output.file} row count mismatch`);
      }
      rowCounts[dataset] += rows.length;
      for (let lineIndex = 0; lineIndex < rows.length; lineIndex += 1) {
        const { row, line } = rows[lineIndex]!;
        if (dataset === "duplicates") {
          issues.push(
            parseDuplicateIssue(row, line, index, directory, output.file, lineIndex + 1),
          );
        } else if (dataset === "quarantine") {
          issues.push(
            parseQuarantineIssue(row, line, index, directory, output.file, lineIndex + 1),
          );
        } else {
          collectRaceArchive(row, raceArchives, `${output.file}:${lineIndex + 1}`);
        }
      }
    }
  }

  for (const dataset of ["archives", "duplicates", "quarantine"] as const) {
    validateDatasetAggregate(manifest, dataset, metadata[dataset], rowCounts[dataset]);
  }
  const manifestIssues = requireRecord(manifest.issues, "normalized issues");
  if (
    manifestIssues.duplicates !== rowCounts.duplicates ||
    manifestIssues.quarantine !== rowCounts.quarantine
  ) {
    throw new Error("normalized issue totals do not match issue shards");
  }
  issues.sort(compareIssueSource);
  return {
    manifestSha256,
    transformVersion,
    inventorySha256,
    sourceCutoff,
    sourceRaceRoot,
    partitionCount: partitions.length,
    diagnosticOnly: transformVersion === "thedogs-normalized-harvest/v1",
    duplicateShardAggregateSha256: aggregateShardSha(metadata.duplicates),
    quarantineShardAggregateSha256: aggregateShardSha(metadata.quarantine),
    archiveShardAggregateSha256: aggregateShardSha(metadata.archives),
    duplicateShardRowCount: rowCounts.duplicates,
    quarantineShardRowCount: rowCounts.quarantine,
    archiveShardRowCount: rowCounts.archives,
    issues,
    raceArchives,
  };
}

function validateFullCorpus(manifest: JsonRecord, transformVersion: string) {
  const scope = requireRecord(manifest.scope, "normalized scope");
  if (
    scope.profiles !== true ||
    scope.races !== true ||
    scope.from !== null ||
    scope.to !== null ||
    scope.limitProfiles !== 0 ||
    scope.limitRaceDays !== 0 ||
    scope.fullCorpus !== true
  ) {
    throw new Error("normalized source is not a complete full-corpus export");
  }
  const identityPolicy = requireRecord(
    manifest.identityPolicy,
    "normalized identityPolicy",
  );
  if (
    identityPolicy.providerKeys !== true ||
    identityPolicy.stableNaturalKeys !== true ||
    identityPolicy.targetIdsGenerated !== false ||
    identityPolicy.targetIdAssignments !== 0
  ) {
    throw new Error("normalized identity policy is not fail-closed");
  }
  if (
    transformVersion === "thedogs-normalized-harvest/v2" &&
    identityPolicy.profileArchivesExactProviderIdentity !== true
  ) {
    throw new Error("normalized v2 source lacks exact profile identity proof");
  }
  const inventory = requireRecord(manifest.inventory, "normalized inventory");
  for (const kind of ["profile", "race-day"] as const) {
    const row = requireRecord(inventory[kind], `normalized inventory.${kind}`);
    const discovered = requireNonNegativeInteger(
      row.discoveredFiles,
      `normalized inventory.${kind}.discoveredFiles`,
    );
    const valid = requireNonNegativeInteger(
      row.validFiles,
      `normalized inventory.${kind}.validFiles`,
    );
    const unique = requireNonNegativeInteger(
      row.uniqueNaturalKeys,
      `normalized inventory.${kind}.uniqueNaturalKeys`,
    );
    const selected = requireNonNegativeInteger(
      row.selectedFiles,
      `normalized inventory.${kind}.selectedFiles`,
    );
    if (
      row.coverageProven !== true ||
      row.invalidFiles !== 0 ||
      row.excludedByFilter !== 0 ||
      row.excludedByLimit !== 0 ||
      discovered !== valid ||
      unique !== selected ||
      unique > valid
    ) {
      throw new Error(`normalized ${kind} inventory coverage is not proven`);
    }
  }
}

function validatePartitionContract(
  partition: JsonRecord,
  rootPartition: JsonRecord,
  index: number,
  count: number,
  transformVersion: string,
  inventorySha256: string,
  sourceCutoff: string,
) {
  if (
    partition.transformVersion !== transformVersion ||
    partition.sourceInventorySha256 !== inventorySha256 ||
    partition.sourceCutoff !== sourceCutoff ||
    partition.partition !== index ||
    partition.partitionCount !== count ||
    partition.inputCount !== rootPartition.inputCount ||
    partition.inputSha256 !== rootPartition.inputSha256
  ) {
    throw new Error(`partition ${index} is not bound to the normalized source`);
  }
  requireNonNegativeInteger(partition.inputCount, `partition ${index} inputCount`);
  requireSha256(partition.inputSha256, `partition ${index} inputSha256`);
}

function validateOutput(
  output: JsonRecord,
  dataset: DatasetName,
  directory: string,
  transformVersion: string,
  sourceCutoff: string,
): ShardMetadata {
  const file = requireString(output.file, `${directory} ${dataset} file`);
  if (!DATASET_FILE[dataset].test(file) || path.basename(file) !== file) {
    throw new Error(`${directory} ${dataset} file is not a safe shard name`);
  }
  const bytes = requireNonNegativeInteger(output.bytes, `${directory} ${dataset} bytes`);
  if (bytes > MAX_SHARD_BYTES) {
    throw new Error(`${directory} ${dataset} shard exceeds the read bound`);
  }
  if (
    output.dataset !== dataset ||
    output.transformVersion !== transformVersion ||
    output.sourceCutoff !== sourceCutoff
  ) {
    throw new Error(`${directory} ${dataset} source contract changed`);
  }
  return {
    dataset,
    file,
    sha256: requireSha256(output.sha256, `${directory} ${dataset} SHA256`),
    bytes,
    rowCount: requireNonNegativeInteger(
      output.rowCount,
      `${directory} ${dataset} rowCount`,
    ),
  };
}

function validateDatasetAggregate(
  manifest: JsonRecord,
  dataset: DatasetName,
  files: ShardMetadata[],
  rowCount: number,
) {
  const datasets = requireRecord(manifest.datasets, "normalized datasets");
  const summary = requireRecord(datasets[dataset], `normalized datasets.${dataset}`);
  if (
    summary.shards !== files.length ||
    summary.rowCount !== rowCount ||
    summary.bytes !== files.reduce((sum, file) => sum + file.bytes, 0) ||
    summary.sha256 !== aggregateShardSha(files)
  ) {
    throw new Error(`normalized ${dataset} aggregate does not match its shards`);
  }
}

function aggregateShardSha(files: ShardMetadata[]) {
  return sha256Text(files.map((file) => `${file.file}:${file.sha256}`).join("\n"));
}

function parseDuplicateIssue(
  row: JsonRecord,
  line: string,
  partition: number,
  partitionDirectory: string,
  shardFile: string,
  lineNumber: number,
): NormalizedDuplicateIssue {
  assertExactKeys(
    row,
    new Set([
      "issueType",
      "naturalKey",
      "sourceArchiveKey",
      "selectedRowOrdinal",
      "droppedRowOrdinal",
      "selection",
    ]),
    `${shardFile}:${lineNumber}`,
  );
  if (row.issueType !== "runner-natural-key") {
    throw new Error(`${shardFile}:${lineNumber} is not a runner duplicate`);
  }
  if (row.selection !== "completeness_then_latest_ordinal") {
    throw new Error(`${shardFile}:${lineNumber} has an unknown selection policy`);
  }
  const selectedRowOrdinal = requireNonNegativeInteger(
    row.selectedRowOrdinal,
    `${shardFile}:${lineNumber}.selectedRowOrdinal`,
  );
  const droppedRowOrdinal = requireNonNegativeInteger(
    row.droppedRowOrdinal,
    `${shardFile}:${lineNumber}.droppedRowOrdinal`,
  );
  if (selectedRowOrdinal === droppedRowOrdinal) {
    throw new Error(`${shardFile}:${lineNumber} selected and dropped the same row`);
  }
  return {
    partition,
    partitionDirectory,
    shardFile,
    lineNumber,
    rowSha256: sha256Text(line),
    issueType: "runner-natural-key",
    naturalKey: requireRunnerNaturalKey(
      row.naturalKey,
      `${shardFile}:${lineNumber}.naturalKey`,
    ),
    sourceArchiveKey: requireRaceArchiveKey(
      row.sourceArchiveKey,
      `${shardFile}:${lineNumber}.sourceArchiveKey`,
    ),
    selectedRowOrdinal,
    droppedRowOrdinal,
    selection: "completeness_then_latest_ordinal",
  };
}

function parseQuarantineIssue(
  row: JsonRecord,
  line: string,
  partition: number,
  partitionDirectory: string,
  shardFile: string,
  lineNumber: number,
): NormalizedQuarantineIssue {
  assertExactKeys(
    row,
    new Set(["issueType", "naturalKey", "sourceArchiveKey", "reason"]),
    `${shardFile}:${lineNumber}`,
  );
  const sourceArchiveKey = requireRaceArchiveKey(
    row.sourceArchiveKey,
    `${shardFile}:${lineNumber}.sourceArchiveKey`,
  );
  if (
    row.issueType === "runner-row" &&
    row.reason === "missing_dog_provider_identity"
  ) {
    return {
      partition,
      partitionDirectory,
      shardFile,
      lineNumber,
      rowSha256: sha256Text(line),
      issueType: "runner-row",
      naturalKey: requireRunnerNaturalKey(
        row.naturalKey,
        `${shardFile}:${lineNumber}.naturalKey`,
      ),
      sourceArchiveKey,
      reason: "missing_dog_provider_identity",
    };
  }
  if (row.issueType === "race-row" && row.reason === "missing_race_distance") {
    return {
      partition,
      partitionDirectory,
      shardFile,
      lineNumber,
      rowSha256: sha256Text(line),
      issueType: "race-row",
      naturalKey: requireRaceNaturalKey(
        row.naturalKey,
        `${shardFile}:${lineNumber}.naturalKey`,
      ),
      sourceArchiveKey,
      reason: "missing_race_distance",
    };
  }
  throw new Error(`${shardFile}:${lineNumber} has an unsupported quarantine issue`);
}

function collectRaceArchive(
  row: JsonRecord,
  raceArchives: Map<string, RaceArchiveIndex>,
  label: string,
) {
  if (row.archiveType !== "race-day") return;
  if (row.provider !== "thedogs" || row.payloadCopied !== false) {
    throw new Error(`${label} has an unsafe race archive contract`);
  }
  const sourceId = requireDate(row.sourceId, `${label}.sourceId`);
  const sourceArchiveKey = requireRaceArchiveKey(row.naturalKey, `${label}.naturalKey`);
  if (sourceArchiveKey !== `thedogs:race-day:${sourceId}`) {
    throw new Error(`${label} race archive identity mismatch`);
  }
  const sourcePath = requireString(row.sourcePath, `${label}.sourcePath`).replaceAll("\\", "/");
  const expectedPath = `${sourceId.slice(0, 4)}/${sourceId.slice(5, 7)}/${sourceId.slice(8, 10)}.json`;
  if (sourcePath !== expectedPath) {
    throw new Error(`${label} race archive path does not match its date`);
  }
  const value: RaceArchiveIndex = {
    sourceArchiveKey,
    sourceId,
    sourcePath,
    sourceSha256: requireSha256(row.sourceSha256, `${label}.sourceSha256`),
    sourceBytes: requireNonNegativeInteger(row.sourceBytes, `${label}.sourceBytes`),
  };
  if (raceArchives.has(sourceArchiveKey)) {
    throw new Error(`${label} duplicates the race archive index`);
  }
  raceArchives.set(sourceArchiveKey, value);
}

async function readRawArchive(realRoot: string, index: RaceArchiveIndex) {
  const filePath = safeChild(realRoot, index.sourcePath);
  const realFile = await realpath(filePath);
  assertContained(realRoot, realFile);
  const fileStat = await stat(realFile);
  if (!fileStat.isFile() || fileStat.size > MAX_RAW_ARCHIVE_BYTES) {
    throw new Error(`${index.sourcePath} is not a bounded raw archive file`);
  }
  const buffer = await readFile(realFile);
  if (
    buffer.byteLength !== index.sourceBytes ||
    sha256Buffer(buffer) !== index.sourceSha256
  ) {
    throw new Error(`${index.sourcePath} changed after normalized export`);
  }
  const archive = requireRecord(JSON.parse(buffer.toString("utf8")), index.sourcePath);
  if (
    archive.source !== "thedogs" ||
    requireDate(archive.date, `${index.sourcePath}.date`) !== index.sourceId ||
    !Array.isArray(archive.meetings)
  ) {
    throw new Error(`${index.sourcePath} has an invalid race-day identity`);
  }
  return archive;
}

function reconstructRawCandidates(
  archive: JsonRecord,
  archiveIndex: RaceArchiveIndex,
): RawCandidate[] {
  const candidates: RawCandidate[] = [];
  const selectedMeetings = selectRows(
    objectArray(archive.meetings).map((row, index) => {
      const trackName = stringValue(row.trackName);
      const state = stringValue(row.state);
      const trackToken = naturalToken(trackName ?? canonicalSourceId(row.sourceId) ?? `unknown-${index}`);
      const stateToken = naturalToken(state ?? "unknown");
      return {
        row,
        index,
        naturalKey: `thedogs:meeting:${archiveIndex.sourceId}:${stateToken}:${trackToken}`,
        score: shallowCompleteness(row) + objectArray(row.races).length * 100,
        trackToken,
      };
    }),
  );

  for (const meeting of selectedMeetings) {
    const races = objectArray(meeting.row.races).map((row, index) => {
      const raceNumber = positiveInteger(row.raceNumber);
      const sourceId = canonicalSourceId(row.sourceId);
      const suffix = raceNumber != null ? `number:${raceNumber}` : `source:${sourceId ?? index}`;
      const naturalKey = `${meeting.naturalKey}:race:${suffix}`;
      const distance = positiveInteger(row.distance);
      const racePathEvidence = inspectRacePath(
        row,
        meeting.trackToken,
        archiveIndex.sourceId,
        raceNumber,
      );
      if (raceNumber != null && distance == null) {
        candidates.push({
          kind: "quarantine-race",
          signature: quarantineSignature(
            "race-row",
            naturalKey,
            archiveIndex.sourceArchiveKey,
            "missing_race_distance",
          ),
          naturalKey,
          sourceArchiveKey: archiveIndex.sourceArchiveKey,
          meetingOrdinal: meeting.index,
          raceOrdinal: index,
          racePathEvidence,
          reason: "missing_race_distance",
          rowOrdinal: index,
          row,
        });
      }
      return {
        row,
        index,
        naturalKey,
        score: shallowCompleteness(row) + objectArray(row.runners).length * 20,
        raceNumber,
        racePathEvidence,
      };
    });

    for (const race of selectRows(races)) {
      const selectedRunners = new Map<
        string,
        {
          row: JsonRecord;
          index: number;
          naturalKey: string;
          score: number;
        }
      >();
      for (const [index, row] of objectArray(race.row.runners).entries()) {
        const boxNumber = positiveInteger(row.boxNumber);
        const sourceId = canonicalOpaqueId(row.sourceId);
        const suffix = boxNumber != null ? `box:${boxNumber}` : `source:${sourceId ?? index}`;
        const naturalKey = `${race.naturalKey}:runner:${suffix}`;
        const incoming = {
          row,
          index,
          naturalKey,
          score: shallowCompleteness(row),
        };
        const current = selectedRunners.get(naturalKey);
        if (!current) {
          selectedRunners.set(naturalKey, incoming);
          continue;
        }
        const incomingWins =
          incoming.score > current.score ||
          (incoming.score === current.score && incoming.index > current.index);
        const winner = incomingWins ? incoming : current;
        const loser = incomingWins ? current : incoming;
        selectedRunners.set(naturalKey, winner);
        candidates.push({
          kind: "duplicate-runner",
          signature: duplicateSignature(
            naturalKey,
            archiveIndex.sourceArchiveKey,
            winner.index,
            loser.index,
          ),
          naturalKey,
          sourceArchiveKey: archiveIndex.sourceArchiveKey,
          meetingOrdinal: meeting.index,
          raceOrdinal: race.index,
          racePathEvidence: race.racePathEvidence,
          selectedRowOrdinal: winner.index,
          droppedRowOrdinal: loser.index,
          selectedRow: winner.row,
          droppedRow: loser.row,
        });
      }
      for (const runner of selectedRunners.values()) {
        if (runnerDogSourceId(runner.row) != null) continue;
        candidates.push({
          kind: "quarantine-runner",
          signature: quarantineSignature(
            "runner-row",
            runner.naturalKey,
            archiveIndex.sourceArchiveKey,
            "missing_dog_provider_identity",
          ),
          naturalKey: runner.naturalKey,
          sourceArchiveKey: archiveIndex.sourceArchiveKey,
          meetingOrdinal: meeting.index,
          raceOrdinal: race.index,
          racePathEvidence: race.racePathEvidence,
          reason: "missing_dog_provider_identity",
          rowOrdinal: runner.index,
          row: runner.row,
        });
      }
    }
  }
  return candidates.sort(compareRawCandidate);
}

function inspectRacePath(
  race: JsonRecord,
  expectedTrack: string,
  expectedDate: string,
  expectedRaceNumber: number | null,
): RacePathEvidence {
  const rawText = stringValue(race.sourceRawJson);
  let raw: JsonRecord | undefined;
  if (rawText) {
    try {
      raw = asRecord(JSON.parse(rawText));
    } catch {
      return unavailablePath("source_raw_json_invalid");
    }
    if (!raw) return unavailablePath("source_raw_json_invalid");
  } else {
    raw = asRecord(race.sourceRawJson);
  }
  const values = [stringValue(race.sourceId), stringValue(raw?.href)].filter(
    (value): value is string => value != null,
  );
  if (values.length === 0) return unavailablePath("missing_exact_race_path");
  const parsed: Array<ReturnType<typeof parseExactTheDogsRacePath>> = [];
  for (const value of values) {
    try {
      parsed.push(parseExactTheDogsRacePath(value));
    } catch {
      return unavailablePath("malformed_exact_race_path");
    }
  }
  if (new Set(parsed.map((value) => value.racePath)).size !== 1) {
    return unavailablePath("conflicting_race_paths");
  }
  const exact = parsed[0]!;
  if (exact.identity.trackSlug !== expectedTrack) {
    return unavailablePath("track_identity_mismatch");
  }
  if (exact.identity.date !== expectedDate) {
    return unavailablePath("date_identity_mismatch");
  }
  if (
    expectedRaceNumber == null ||
    exact.identity.raceNumber !== expectedRaceNumber
  ) {
    return unavailablePath("race_number_identity_mismatch");
  }
  return {
    status: "exact",
    racePath: exact.racePath,
    identity: exact.identity,
    gapReason: null,
  };
}

function unavailablePath(gapReason: string): RacePathEvidence {
  return { status: "unavailable", racePath: null, identity: null, gapReason };
}

function buildEvidenceRow(
  issue: NormalizedIssue,
  candidate: RawCandidate,
  archive: RaceArchiveIndex,
  source: NormalizedSource,
): DuplicateQuarantineEvidenceRow {
  const normalizedIssueSource: IssueSource = {
    partition: issue.partition,
    partitionDirectory: issue.partitionDirectory,
    shardFile: issue.shardFile,
    lineNumber: issue.lineNumber,
    rowSha256: issue.rowSha256,
  };
  const selectedObservation =
    candidate.kind === "duplicate-runner"
      ? buildObservation(candidate.selectedRow)
      : null;
  const droppedObservation =
    candidate.kind === "duplicate-runner"
      ? buildObservation(candidate.droppedRow)
      : null;
  const quarantinedObservation =
    candidate.kind === "duplicate-runner" ? null : buildObservation(candidate.row);
  const fieldComparison =
    candidate.kind === "duplicate-runner"
      ? compareAllFields(candidate.selectedRow, candidate.droppedRow)
      : null;
  const classification =
    candidate.kind === "duplicate-runner"
      ? classifyDuplicate(
          selectedObservation!,
          droppedObservation!,
          fieldComparison!,
        )
      : "identity-conflict-or-unknown";
  const rebuildRequiredFromV2 = source.transformVersion !== "thedogs-normalized-harvest/v2";
  const base = {
    schemaVersion: 1 as const,
    evidenceVersion: DUPLICATE_QUARANTINE_EVIDENCE_VERSION,
    provider: "thedogs" as const,
    issueKind: candidate.kind,
    issueType: issue.issueType,
    reason: "reason" in issue ? issue.reason : null,
    naturalKey: issue.naturalKey,
    sourceArchiveKey: issue.sourceArchiveKey,
    normalizedIssueSource,
    rawArchive: archive,
    rawLocation: {
      meetingOrdinal: candidate.meetingOrdinal,
      raceOrdinal: candidate.raceOrdinal,
      selectedRowOrdinal:
        candidate.kind === "duplicate-runner" ? candidate.selectedRowOrdinal : null,
      droppedRowOrdinal:
        candidate.kind === "duplicate-runner" ? candidate.droppedRowOrdinal : null,
      rowOrdinal: candidate.kind === "duplicate-runner" ? null : candidate.rowOrdinal,
    },
    racePathEvidence: candidate.racePathEvidence,
    classification,
    selectedObservation,
    droppedObservation,
    quarantinedObservation,
    fieldComparison,
    authoritativeDuplicateProofPresent: false as const,
    exhaustiveReferenceProofPresent: false as const,
    noDataLossProofPresent: false as const,
    canonicalPromotionEligible: false as const,
    duplicateRemovalEligible: false as const,
    normalizedManifestSha256: source.manifestSha256,
    sourceInventorySha256: source.inventorySha256,
    sourceCutoff: source.sourceCutoff,
    transformVersion: source.transformVersion,
    rebuildRequiredFromV2,
  };
  const evidenceId = sha256Text(
    stableJson({
      normalizedManifestSha256: source.manifestSha256,
      normalizedIssueSource,
      sourceArchiveKey: issue.sourceArchiveKey,
      naturalKey: issue.naturalKey,
      rawLocation: base.rawLocation,
    }),
  );
  return {
    ...base,
    evidenceId,
    evidenceSha256: sha256Text(stableJson({ ...base, evidenceId })),
  };
}

function buildObservation(row: JsonRecord): Observation {
  const stableRow = stableValue(row) as JsonRecord;
  const identity = dogIdentity(row);
  return {
    rowSha256: sha256Text(stableJson(stableRow)),
    row: stableRow,
    dogIdentity: identity,
  };
}

function dogIdentity(row: JsonRecord): Observation["dogIdentity"] {
  const dog = asRecord(row.dog);
  const raw = parsedRecord(row.sourceRawJson);
  const identities: Array<[string, unknown]> = [
    ["dog.earBrand", dog?.earBrand],
    ["runner.sourceId", row.sourceId],
    ["sourceRawJson.dogId", raw?.dogId],
    ["sourceRawJson.dogProfileUrl", raw?.dogProfileUrl],
  ];
  const observedSourceIds: string[] = [];
  const invalidIdentityEvidence: string[] = [];
  for (const [label, value] of identities) {
    const parsed = parseDogIdentity(label, value);
    if (parsed === "invalid") invalidIdentityEvidence.push(label);
    else if (parsed) observedSourceIds.push(parsed);
  }
  const unique = [...new Set(observedSourceIds)].sort(numericTextCompare);
  if (unique.length > 1) invalidIdentityEvidence.push("conflicting_source_ids");
  return {
    exactSourceId:
      unique.length === 1 && invalidIdentityEvidence.length === 0 ? unique[0]! : null,
    observedSourceIds: unique,
    invalidIdentityEvidence: [...new Set(invalidIdentityEvidence)].sort(),
    name: stringValue(dog?.name) ?? null,
  };
}

function parseDogIdentity(label: string, value: unknown): string | null | "invalid" {
  const text = stringValue(value);
  if (!text) return null;
  let match: RegExpMatchArray | null = null;
  if (label === "dog.earBrand") match = text.match(/^thedogs:([0-9]+)$/i);
  else if (label === "runner.sourceId") match = text.match(/^dog:([0-9]+):box:[^:]+$/i);
  else if (label === "sourceRawJson.dogId") match = text.match(/^([0-9]+)$/);
  else if (label === "sourceRawJson.dogProfileUrl") {
    match = text.match(/^\/dogs\/([0-9]+)(?:\/[a-z0-9]+(?:[-_][a-z0-9]+)*)?$/i);
  }
  return match?.[1] ?? "invalid";
}

function classifyDuplicate(
  selected: Observation,
  dropped: Observation,
  comparison: NonNullable<DuplicateQuarantineEvidenceRow["fieldComparison"]>,
): DuplicateClassification {
  const selectedId = selected.dogIdentity.exactSourceId;
  const droppedId = dropped.dogIdentity.exactSourceId;
  const namesAgree =
    selected.dogIdentity.name == null ||
    dropped.dogIdentity.name == null ||
    normalizeName(selected.dogIdentity.name) === normalizeName(dropped.dogIdentity.name);
  if (
    selectedId == null ||
    droppedId == null ||
    selectedId !== droppedId ||
    !namesAgree ||
    comparison.conflicts.length > 0
  ) {
    return "identity-conflict-or-unknown";
  }
  return comparison.selectedOnly.length === 0 && comparison.droppedOnly.length === 0
    ? "potential-exact-same-identity"
    : "potential-complementary-same-identity";
}

function compareAllFields(
  selected: JsonRecord,
  dropped: JsonRecord,
): NonNullable<DuplicateQuarantineEvidenceRow["fieldComparison"]> {
  const left = flattenRecord(comparisonRecord(selected));
  const right = flattenRecord(comparisonRecord(dropped));
  const paths = [...new Set([...left.keys(), ...right.keys()])].sort();
  const equalPaths: string[] = [];
  const selectedOnly: FieldValue[] = [];
  const droppedOnly: FieldValue[] = [];
  const conflicts: FieldConflict[] = [];
  for (const fieldPath of paths) {
    const leftHas = left.has(fieldPath);
    const rightHas = right.has(fieldPath);
    if (leftHas && !rightHas) {
      selectedOnly.push({ path: fieldPath, value: left.get(fieldPath) });
    } else if (!leftHas && rightHas) {
      droppedOnly.push({ path: fieldPath, value: right.get(fieldPath) });
    } else if (stableJson(left.get(fieldPath)) === stableJson(right.get(fieldPath))) {
      equalPaths.push(fieldPath);
    } else {
      conflicts.push({
        path: fieldPath,
        selected: left.get(fieldPath),
        dropped: right.get(fieldPath),
      });
    }
  }
  return { equalPaths, selectedOnly, droppedOnly, conflicts };
}

function comparisonRecord(row: JsonRecord) {
  const result = { ...row };
  const raw = parsedRecord(row.sourceRawJson);
  if (raw) result.sourceRawJson = raw;
  return result;
}

function flattenRecord(value: JsonRecord) {
  const result = new Map<string, unknown>();
  const visit = (current: unknown, currentPath: string) => {
    if (current == null || current === "") return;
    if (Array.isArray(current)) {
      result.set(currentPath, stableValue(current));
      return;
    }
    const object = asRecord(current);
    if (!object) {
      result.set(currentPath, current);
      return;
    }
    const entries = Object.entries(object).sort(([left], [right]) => left.localeCompare(right));
    if (entries.length === 0) result.set(currentPath, {});
    for (const [key, child] of entries) {
      visit(child, `${currentPath}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`);
    }
  };
  visit(value, "");
  return result;
}

function buildRetrievalQueue(
  evidenceRows: DuplicateQuarantineEvidenceRow[],
  source: NormalizedSource,
) {
  const groups = new Map<
    string,
    { identity: TheDogsRaceIdentity; evidenceIds: string[] }
  >();
  for (const evidence of evidenceRows) {
    const pathEvidence = evidence.racePathEvidence;
    if (
      pathEvidence.status !== "exact" ||
      !pathEvidence.racePath ||
      !pathEvidence.identity
    ) {
      continue;
    }
    const current = groups.get(pathEvidence.racePath);
    if (current) current.evidenceIds.push(evidence.evidenceId);
    else {
      groups.set(pathEvidence.racePath, {
        identity: pathEvidence.identity,
        evidenceIds: [evidence.evidenceId],
      });
    }
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([racePath, group]): DuplicateQuarantineRaceQueueRow => {
      const evidenceIds = [...group.evidenceIds].sort();
      const base = {
        schemaVersion: 1 as const,
        queueVersion: DUPLICATE_QUARANTINE_EVIDENCE_VERSION as typeof DUPLICATE_QUARANTINE_EVIDENCE_VERSION,
        provider: "thedogs" as const,
        providerKey: `thedogs:race:${racePath}`,
        racePath,
        identity: group.identity,
        issueOccurrenceCount: evidenceIds.length,
        evidenceIds,
        normalizedManifestSha256: source.manifestSha256,
        sourceInventorySha256: source.inventorySha256,
        sourceCutoff: source.sourceCutoff,
        transformVersion: source.transformVersion,
        retrievalStatus: "unverified" as const,
        canonicalPromotionEligible: false as const,
      };
      return { ...base, evidenceSha256: sha256Text(stableJson(base)) };
    });
}

function issueSignature(issue: NormalizedIssue) {
  return issue.issueType === "runner-natural-key"
    ? duplicateSignature(
        issue.naturalKey,
        issue.sourceArchiveKey,
        issue.selectedRowOrdinal,
        issue.droppedRowOrdinal,
      )
    : quarantineSignature(
        issue.issueType,
        issue.naturalKey,
        issue.sourceArchiveKey,
        issue.reason,
      );
}

function duplicateSignature(
  naturalKey: string,
  sourceArchiveKey: string,
  selectedRowOrdinal: number,
  droppedRowOrdinal: number,
) {
  return stableJson({
    issueType: "runner-natural-key",
    naturalKey,
    sourceArchiveKey,
    selectedRowOrdinal,
    droppedRowOrdinal,
    selection: "completeness_then_latest_ordinal",
  });
}

function quarantineSignature(
  issueType: "runner-row" | "race-row",
  naturalKey: string,
  sourceArchiveKey: string,
  reason: "missing_dog_provider_identity" | "missing_race_distance",
) {
  return stableJson({ issueType, naturalKey, sourceArchiveKey, reason });
}

function selectRows<T extends { naturalKey: string; score: number; index: number }>(rows: T[]) {
  const selected = new Map<string, T>();
  for (const incoming of rows) {
    const current = selected.get(incoming.naturalKey);
    if (
      !current ||
      incoming.score > current.score ||
      (incoming.score === current.score && incoming.index > current.index)
    ) {
      selected.set(incoming.naturalKey, incoming);
    }
  }
  return [...selected.values()].sort((left, right) =>
    left.naturalKey.localeCompare(right.naturalKey),
  );
}

function shallowCompleteness(value: JsonRecord) {
  return Object.values(value).reduce<number>((score, entry) => {
    if (entry == null || entry === "") return score;
    if (Array.isArray(entry)) return score + entry.length;
    if (typeof entry === "object") return score + Object.keys(entry).length;
    return score + 1;
  }, 0);
}

function runnerDogSourceId(runner: JsonRecord) {
  const dog = asRecord(runner.dog);
  return cleanDogSourceId(dog?.earBrand) ?? cleanDogSourceId(runner.sourceId);
}

function cleanDogSourceId(value: unknown) {
  const text = stringValue(value);
  if (!text) return null;
  return text.match(/^thedogs:(.+)$/i)?.[1] ?? text.match(/^dog:([^:]+):box:/i)?.[1] ?? text;
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

function normalizeName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-AU");
}

function parsedRecord(value: unknown) {
  if (typeof value !== "string") return asRecord(value);
  try {
    return asRecord(JSON.parse(value));
  } catch {
    return undefined;
  }
}

function jsonlStats(rows: unknown[]): FileStats & { body: string } {
  const body = rows.map((row) => `${stableJson(row)}\n`).join("");
  return {
    body,
    sha256: sha256Text(body),
    evidenceSha256: sha256Text(rows.map(stableJson).join("\n")),
    bytes: Buffer.byteLength(body),
    rowCount: rows.length,
  };
}

function stableJson(value: unknown) {
  return JSON.stringify(stableValue(value));
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  const record = asRecord(value);
  if (!record) return value;
  return Object.fromEntries(
    Object.entries(record)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stableValue(child)]),
  );
}

function parseJsonLines(buffer: Buffer, label: string) {
  const text = buffer.toString("utf8");
  if (text && !text.endsWith("\n")) {
    throw new Error(`${label} must end with a newline`);
  }
  const lines = text ? text.slice(0, -1).split("\n") : [];
  return lines.map((line, index) => {
    if (!line || Buffer.byteLength(line) > MAX_LINE_BYTES) {
      throw new Error(`${label}:${index + 1} is empty or exceeds the line bound`);
    }
    return { line, row: requireRecord(JSON.parse(line), `${label}:${index + 1}`) };
  });
}

function groupBy<T>(values: T[], key: (value: T) => string) {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const itemKey = key(value);
    const group = groups.get(itemKey);
    if (group) group.push(value);
    else groups.set(itemKey, [value]);
  }
  return groups;
}

function countBy<T>(
  values: T[],
  key: (value: T) => string,
  required: readonly string[] = [],
) {
  const counts: Record<string, number> = Object.fromEntries(
    required.map((value) => [value, 0]),
  );
  for (const value of values) {
    const itemKey = key(value);
    counts[itemKey] = (counts[itemKey] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function compareIssueSource(left: NormalizedIssue, right: NormalizedIssue) {
  return (
    left.partition - right.partition ||
    left.shardFile.localeCompare(right.shardFile) ||
    left.lineNumber - right.lineNumber
  );
}

function compareRawCandidate(left: RawCandidate, right: RawCandidate) {
  return (
    left.signature.localeCompare(right.signature) ||
    left.meetingOrdinal - right.meetingOrdinal ||
    left.raceOrdinal - right.raceOrdinal ||
    ("rowOrdinal" in left ? left.rowOrdinal : left.selectedRowOrdinal) -
      ("rowOrdinal" in right ? right.rowOrdinal : right.selectedRowOrdinal)
  );
}

function numericTextCompare(left: string, right: string) {
  return left.length - right.length || left.localeCompare(right);
}

function requireRunnerNaturalKey(value: unknown, label: string) {
  const key = requireString(value, label);
  if (
    !/^thedogs:meeting:\d{4}-\d{2}-\d{2}:[a-z0-9-]+:[a-z0-9-]+:race:number:\d+:runner:box:\d+$/.test(
      key,
    )
  ) {
    throw new Error(`${label} is not an exact runner natural key`);
  }
  return key;
}

function requireRaceNaturalKey(value: unknown, label: string) {
  const key = requireString(value, label);
  if (
    !/^thedogs:meeting:\d{4}-\d{2}-\d{2}:[a-z0-9-]+:[a-z0-9-]+:race:number:\d+$/.test(
      key,
    )
  ) {
    throw new Error(`${label} is not an exact race natural key`);
  }
  return key;
}

function requireRaceArchiveKey(value: unknown, label: string) {
  const key = requireString(value, label);
  const match = key.match(/^thedogs:race-day:(\d{4}-\d{2}-\d{2})$/);
  if (!match || !validDate(match[1]!)) {
    throw new Error(`${label} is not an exact race archive key`);
  }
  return key;
}

function requireDate(value: unknown, label: string) {
  const date = requireString(value, label);
  if (!validDate(date)) throw new Error(`${label} is not a valid date`);
  return date;
}

function validDate(value: string) {
  return (
    DATE.test(value) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
  );
}

function validatePartitionDirectory(value: string, index: number, count: number) {
  const match = value.match(PARTITION_DIRECTORY);
  if (
    !match ||
    Number(match[1]) !== index ||
    Number(match[2]) !== count ||
    path.basename(value) !== value
  ) {
    throw new Error(`partition directory ${value} is not canonical`);
  }
}

function assertExactKeys(value: JsonRecord, allowed: Set<string>, label: string) {
  const keys = Object.keys(value).sort();
  const expected = [...allowed].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} has unexpected fields`);
  }
}

function requireRecord(value: unknown, label: string): JsonRecord {
  const record = asRecord(value);
  if (!record) throw new Error(`${label} must be an object`);
  return record;
}

function asRecord(value: unknown) {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function requireArray(value: unknown, label: string) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function objectArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(asRecord).filter((item): item is JsonRecord => item != null)
    : [];
}

function stringValue(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function requireString(value: unknown, label: string) {
  const text = stringValue(value);
  if (!text) throw new Error(`${label} must be a non-empty string`);
  return text;
}

function positiveInteger(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}

function requireNonNegativeInteger(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value;
}

function requireSha256(value: unknown, label: string) {
  if (typeof value !== "string" || !SHA256.test(value)) {
    throw new Error(`${label} must be a lowercase SHA256`);
  }
  return value;
}

function requireIsoTimestamp(value: unknown, label: string) {
  const text = requireString(value, label);
  if (new Date(text).toISOString() !== text) {
    throw new Error(`${label} must be a canonical ISO timestamp`);
  }
  return text;
}

function safeChild(root: string, relative: string) {
  if (!relative || path.isAbsolute(relative)) {
    throw new Error("unsafe absolute or empty child path");
  }
  const child = path.resolve(root, relative);
  assertContained(root, child);
  return child;
}

function assertContained(root: string, child: string) {
  const relative = path.relative(path.resolve(root), path.resolve(child));
  if (
    !relative ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error("path escaped or did not identify a child of its root");
  }
}

function assertDirectChild(parent: string, child: string) {
  if (path.dirname(path.resolve(child)) !== path.resolve(parent)) {
    throw new Error("temporary output escaped its intended parent");
  }
}

function sha256Text(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Buffer(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseOptions(args: string[]): BuildDuplicateQuarantineEvidenceOptions {
  const values = new Map<string, string | true>();
  const allowed = new Set(["normalized-dir", "raw-race-root", "output-dir", "dry-run"]);
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (!argument.startsWith("--")) throw new Error(`unexpected argument: ${argument}`);
    const [key, inlineValue] = argument.slice(2).split("=", 2);
    if (!key || !allowed.has(key)) throw new Error(`unknown option: --${key}`);
    if (values.has(key)) throw new Error(`duplicate option: --${key}`);
    if (inlineValue != null) values.set(key, inlineValue);
    else if (key === "dry-run") values.set(key, true);
    else {
      const next = args[index + 1];
      if (!next || next.startsWith("--")) throw new Error(`--${key} requires a value`);
      values.set(key, next);
      index += 1;
    }
  }
  const normalizedDir = values.get("normalized-dir");
  const rawRaceRoot = values.get("raw-race-root");
  if (typeof normalizedDir !== "string" || !normalizedDir) {
    throw new Error("--normalized-dir is required");
  }
  if (typeof rawRaceRoot !== "string" || !rawRaceRoot) {
    throw new Error("--raw-race-root is required");
  }
  const outputDir = values.get("output-dir");
  return {
    normalizedDir,
    rawRaceRoot,
    outputDir: typeof outputDir === "string" ? outputDir : undefined,
    dryRun: values.get("dry-run") === true,
  };
}

const isCli =
  process.argv[1] != null &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isCli) {
  buildDuplicateQuarantineEvidenceQueue(parseOptions(process.argv.slice(2)))
    .then((result) => {
      console.log(
        JSON.stringify(
          {
            dryRun: result.outputDir == null,
            outputDir: result.outputDir,
            manifestSha256: result.manifestSha256,
            source: result.manifest.source,
            evidence: result.manifest.evidence,
            retrievalQueue: result.manifest.retrievalQueue,
            canonicalPromotionEligible: false,
            duplicateRemovalEligible: false,
          },
          null,
          2,
        ),
      );
    })
    .catch((error: unknown) => {
      console.error(
        `[build:thedogs:duplicate-quarantine-evidence] failed: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
      process.exitCode = 1;
    });
}
