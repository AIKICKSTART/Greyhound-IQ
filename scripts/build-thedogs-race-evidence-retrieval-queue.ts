/**
 * Build a source-bound retrieval queue for exact TheDogs race-result paths.
 *
 * This script reads the immutable normalized export only. It never contacts a
 * provider or database, and queue rows are explicitly promotion-ineligible.
 */
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { once } from "node:events";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const RACE_EVIDENCE_QUEUE_VERSION =
  "giq-thedogs-race-evidence-retrieval/v1";
export const RACE_EVIDENCE_QUEUE_MANIFEST_VERSION =
  "giq-thedogs-race-evidence-retrieval-manifest/v1";
export const RACE_EVIDENCE_QUEUE_FILE = "race-evidence-queue.jsonl";
export const RACE_EVIDENCE_QUEUE_MANIFEST_FILE = "queue.manifest.json";
export const RACE_EVIDENCE_QUEUE_MANIFEST_SHA_FILE =
  "queue.manifest.sha256";

const THEDOGS_ORIGIN = "https://www.thedogs.com.au";
const TARGET_ISSUE = "profile-form-race-unresolved";
const ALLOWED_TRANSFORMS = new Set([
  "thedogs-normalized-harvest/v1",
  "thedogs-normalized-harvest/v2",
]);
const SHA256 = /^[0-9a-f]{64}$/;
const PARTITION_DIRECTORY = /^partition-(\d{4})-of-(\d{4})$/;
const ORPHAN_FILE = /^orphans-\d{4}-of-\d{4}\.jsonl$/;
const MAX_PARTITIONS = 4_096;
const MAX_SHARD_BYTES = 128 * 1024 * 1024;
const MAX_ORPHAN_LINE_BYTES = 64 * 1024;
const MAX_QUEUE_LINE_BYTES = 4 * 1024 * 1024;

type JsonRecord = Record<string, unknown>;

export type TheDogsRaceIdentity = {
  trackSlug: string;
  date: string;
  /** Exact numeric URL segment only; later normalization must prove the canonical race number. */
  raceNumber: number;
  raceSlug: string;
  trial: boolean | null;
};

export type RaceEvidenceOccurrence = {
  partition: number;
  shardFile: string;
  lineNumber: number;
  naturalKey: string;
  sourceArchiveKey: string;
  sourceDogId: string;
};

export type RaceEvidenceQueueRow = {
  schemaVersion: 1;
  queueVersion: typeof RACE_EVIDENCE_QUEUE_VERSION;
  provider: "thedogs";
  providerKey: string;
  racePath: string;
  identity: TheDogsRaceIdentity;
  occurrenceCount: number;
  occurrences: RaceEvidenceOccurrence[];
  normalizedManifestSha256: string;
  sourceInventorySha256: string;
  sourceCutoff: string;
  transformVersion: string;
  retrievalStatus: "unverified";
  canonicalPromotionEligible: false;
  evidenceSha256: string;
};

export type RaceEvidenceQueueManifest = {
  schemaVersion: 1;
  manifestVersion: typeof RACE_EVIDENCE_QUEUE_MANIFEST_VERSION;
  queueVersion: typeof RACE_EVIDENCE_QUEUE_VERSION;
  provider: "thedogs";
  source: {
    normalizedManifestSha256: string;
    sourceInventorySha256: string;
    sourceCutoff: string;
    transformVersion: string;
    fullCorpus: true;
    partitionCount: number;
    orphanShardAggregateSha256: string;
    orphanShardRowCount: number;
  };
  selection: {
    issueType: typeof TARGET_ISSUE;
    providerKeyPrefix: "thedogs:race:/racing/";
    exactTrackDateRaceIdentityRequired: true;
    profileFormFieldsUsedForRaceCreation: false;
  };
  queue: {
    file: typeof RACE_EVIDENCE_QUEUE_FILE;
    sha256: string;
    evidenceSha256: string;
    bytes: number;
    rowCount: number;
    occurrenceCount: number;
    duplicateOccurrenceCount: number;
  };
  canonicalPromotionEligible: false;
};

export type BuildRaceEvidenceQueueOptions = {
  normalizedDir: string;
  outputDir?: string;
  dryRun: boolean;
};

export type BuildRaceEvidenceQueueResult = {
  outputDir: string | null;
  manifest: RaceEvidenceQueueManifest;
  manifestSha256: string;
  rows: RaceEvidenceQueueRow[];
};

type NormalizedSource = {
  manifestSha256: string;
  transformVersion: string;
  inventorySha256: string;
  sourceCutoff: string;
  partitionCount: number;
  orphanShardAggregateSha256: string;
  orphanShardRowCount: number;
  occurrences: Map<
    string,
    { racePath: string; identity: TheDogsRaceIdentity; rows: RaceEvidenceOccurrence[] }
  >;
};

export async function buildRaceEvidenceQueue(
  options: BuildRaceEvidenceQueueOptions,
): Promise<BuildRaceEvidenceQueueResult> {
  const source = await readNormalizedSource(options.normalizedDir);
  const rows = [...source.occurrences.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([providerKey, candidate]) =>
      buildQueueRow(providerKey, candidate, source),
    );
  const queueStats = queueStatistics(rows);
  const manifest: RaceEvidenceQueueManifest = {
    schemaVersion: 1,
    manifestVersion: RACE_EVIDENCE_QUEUE_MANIFEST_VERSION,
    queueVersion: RACE_EVIDENCE_QUEUE_VERSION as typeof RACE_EVIDENCE_QUEUE_VERSION,
    provider: "thedogs",
    source: {
      normalizedManifestSha256: source.manifestSha256,
      sourceInventorySha256: source.inventorySha256,
      sourceCutoff: source.sourceCutoff,
      transformVersion: source.transformVersion,
      fullCorpus: true,
      partitionCount: source.partitionCount,
      orphanShardAggregateSha256: source.orphanShardAggregateSha256,
      orphanShardRowCount: source.orphanShardRowCount,
    },
    selection: {
      issueType: TARGET_ISSUE,
      providerKeyPrefix: "thedogs:race:/racing/",
      exactTrackDateRaceIdentityRequired: true,
      profileFormFieldsUsedForRaceCreation: false,
    },
    queue: {
      file: RACE_EVIDENCE_QUEUE_FILE,
      ...queueStats,
      duplicateOccurrenceCount:
        queueStats.occurrenceCount - queueStats.rowCount,
    },
    canonicalPromotionEligible: false,
  };
  const manifestBody = `${JSON.stringify(manifest, null, 2)}\n`;
  const manifestSha256 = sha256Text(manifestBody);

  if (options.dryRun) {
    return { outputDir: null, manifest, manifestSha256, rows };
  }
  if (!options.outputDir) {
    throw new Error("--output-dir is required unless --dry-run is used");
  }
  const outputDir = path.resolve(options.outputDir);
  if (await exists(outputDir)) {
    throw new Error(`immutable queue output already exists: ${outputDir}`);
  }
  const parent = path.dirname(outputDir);
  await mkdir(parent, { recursive: true });
  const temporaryDir = await mkdtemp(
    path.join(parent, `.${path.basename(outputDir)}.tmp-`),
  );
  assertDirectChild(parent, temporaryDir);
  try {
    await writeQueueFile(
      path.join(temporaryDir, RACE_EVIDENCE_QUEUE_FILE),
      rows,
    );
    await writeFile(
      path.join(temporaryDir, RACE_EVIDENCE_QUEUE_MANIFEST_FILE),
      manifestBody,
      { encoding: "utf8", flag: "wx" },
    );
    await writeFile(
      path.join(temporaryDir, RACE_EVIDENCE_QUEUE_MANIFEST_SHA_FILE),
      `${manifestSha256}\n`,
      { encoding: "utf8", flag: "wx" },
    );
    await rename(temporaryDir, outputDir);
  } catch (error) {
    await rm(temporaryDir, { recursive: true, force: true });
    throw error;
  }
  return { outputDir, manifest, manifestSha256, rows };
}

export async function loadRaceEvidenceQueue(queueDir: string) {
  const root = path.resolve(queueDir);
  const manifestPath = safeChild(root, RACE_EVIDENCE_QUEUE_MANIFEST_FILE);
  const manifestBody = await readFile(manifestPath, "utf8");
  const recordedManifestSha256 = requireSha256(
    (await readFile(
      safeChild(root, RACE_EVIDENCE_QUEUE_MANIFEST_SHA_FILE),
      "utf8",
    )).trim(),
    "queue manifest sidecar",
  );
  const manifestSha256 = sha256Text(manifestBody);
  if (recordedManifestSha256 !== manifestSha256) {
    throw new Error("queue manifest SHA256 mismatch");
  }
  const manifest = validateQueueManifest(JSON.parse(manifestBody));
  const queuePath = safeChild(root, manifest.queue.file);
  const queueBuffer = await readFile(queuePath);
  if (
    queueBuffer.byteLength !== manifest.queue.bytes ||
    sha256Buffer(queueBuffer) !== manifest.queue.sha256
  ) {
    throw new Error("queue file digest or byte count mismatch");
  }
  const rows = parseQueueRows(queueBuffer, manifest);
  const actual = queueStatistics(rows);
  if (
    actual.rowCount !== manifest.queue.rowCount ||
    actual.occurrenceCount !== manifest.queue.occurrenceCount ||
    actual.evidenceSha256 !== manifest.queue.evidenceSha256 ||
    actual.sha256 !== manifest.queue.sha256 ||
    actual.bytes !== manifest.queue.bytes ||
    actual.occurrenceCount - actual.rowCount !==
      manifest.queue.duplicateOccurrenceCount
  ) {
    throw new Error("queue manifest counts or evidence digest mismatch");
  }
  return { root, manifest, manifestSha256, rows };
}

export function parseExactTheDogsRacePath(value: string): {
  racePath: string;
  identity: TheDogsRaceIdentity;
} {
  if (
    typeof value !== "string" ||
    value.length > 512 ||
    !value.startsWith("/racing/") ||
    /[\\\0]/.test(value) ||
    /%(?:2e|2f|5c)/i.test(value)
  ) {
    throw new Error("race path is not an exact TheDogs racing path");
  }
  let url: URL;
  try {
    url = new URL(value, THEDOGS_ORIGIN);
  } catch {
    throw new Error("race path is not a valid URL");
  }
  if (
    url.origin !== THEDOGS_ORIGIN ||
    url.username ||
    url.password ||
    url.hash ||
    `${url.pathname}${url.search}` !== value
  ) {
    throw new Error("race path escaped the exact TheDogs origin or path");
  }
  const match = url.pathname.match(
    /^\/racing\/([a-z0-9]+(?:[-_][a-z0-9]+)*)\/(\d{4}-\d{2}-\d{2})\/(\d{1,10})\/([a-z0-9]+(?:[-_][a-z0-9]+)*)$/,
  );
  if (!match) {
    throw new Error("race path must bind track, date, race number and slug");
  }
  const [, trackSlug, date, raceNumberText, raceSlug] = match;
  if (!trackSlug || !date || !raceNumberText || !raceSlug || !validDate(date)) {
    throw new Error("race path has an invalid track/date/race identity");
  }
  const raceNumber = Number(raceNumberText);
  if (raceNumber > 2_147_483_647) {
    throw new Error("race path numeric identity is outside the provider bound");
  }
  let trial: boolean | null = null;
  if (url.search) {
    if (url.search !== "?trial=false" && url.search !== "?trial=true") {
      throw new Error("race path has unsupported query parameters");
    }
    trial = url.search === "?trial=true";
  }
  return {
    racePath: value,
    identity: { trackSlug, date, raceNumber, raceSlug, trial },
  };
}

export function sameRaceTriple(
  left: TheDogsRaceIdentity,
  right: TheDogsRaceIdentity,
) {
  return (
    left.trackSlug === right.trackSlug &&
    left.date === right.date &&
    left.raceNumber === right.raceNumber
  );
}

export function sha256Text(value: string) {
  return createHash("sha256").update(value).digest("hex");
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
    "normalized manifest transformVersion",
  );
  if (!ALLOWED_TRANSFORMS.has(transformVersion)) {
    throw new Error(`unsupported normalized transform: ${transformVersion}`);
  }
  const source = requireRecord(manifest.source, "normalized manifest source");
  if (source.provider !== "thedogs") {
    throw new Error("normalized source provider must be thedogs");
  }
  const inventorySha256 = requireSha256(
    source.inventorySha256,
    "normalized source inventory SHA256",
  );
  const sourceCutoff = requireIsoTimestamp(
    source.sourceCutoff,
    "normalized source cutoff",
  );
  validateFullCorpus(manifest);
  const partitions = requireArray(manifest.partitions, "normalized partitions");
  if (partitions.length === 0 || partitions.length > MAX_PARTITIONS) {
    throw new Error("normalized partition count is invalid");
  }
  const orphanMetadata: Array<{ file: string; sha256: string; bytes: number; rowCount: number }> = [];
  const occurrences: NormalizedSource["occurrences"] = new Map();
  let orphanShardRowCount = 0;

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
      (await readFile(
        safeChild(partitionRoot, "partition-manifest.sha256"),
        "utf8",
      )).trim(),
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
    const outputs = requireArray(partition.outputs, `${directory} outputs`);
    const orphanOutputs = outputs
      .map((value, outputIndex) =>
        requireRecord(value, `${directory} outputs[${outputIndex}]`),
      )
      .filter((value) => value.dataset === "orphans");
    if (orphanOutputs.length !== 1) {
      throw new Error(`${directory} must contain exactly one orphan shard`);
    }
    const output = validateOrphanOutput(
      orphanOutputs[0]!,
      directory,
      transformVersion,
      sourceCutoff,
    );
    const rootOutputs = requireArray(
      rootPartition.outputs,
      `normalized partitions[${index}].outputs`,
    );
    const rootOrphan = rootOutputs
      .map((value, outputIndex) =>
        requireRecord(
          value,
          `normalized partitions[${index}].outputs[${outputIndex}]`,
        ),
      )
      .filter((value) => value.dataset === "orphans");
    if (
      rootOrphan.length !== 1 ||
      JSON.stringify(rootOrphan[0]) !== JSON.stringify(orphanOutputs[0])
    ) {
      throw new Error(`${directory} orphan metadata changed across manifests`);
    }
    const shardPath = safeChild(partitionRoot, output.file);
    const buffer = await readFile(shardPath);
    if (
      buffer.byteLength !== output.bytes ||
      sha256Buffer(buffer) !== output.sha256
    ) {
      throw new Error(`${directory}/${output.file} digest or byte count mismatch`);
    }
    const rowCount = collectOrphanOccurrences(
      buffer,
      index,
      output.file,
      occurrences,
    );
    if (rowCount !== output.rowCount) {
      throw new Error(`${directory}/${output.file} row count mismatch`);
    }
    orphanShardRowCount += rowCount;
    orphanMetadata.push(output);
  }
  const orphanShardAggregateSha256 = sha256Text(
    orphanMetadata.map((output) => `${output.file}:${output.sha256}`).join("\n"),
  );
  validateOrphanDataset(
    manifest,
    orphanMetadata,
    orphanShardAggregateSha256,
    orphanShardRowCount,
  );
  return {
    manifestSha256,
    transformVersion,
    inventorySha256,
    sourceCutoff,
    partitionCount: partitions.length,
    orphanShardAggregateSha256,
    orphanShardRowCount,
    occurrences,
  };
}

function validateFullCorpus(manifest: JsonRecord) {
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

function validateOrphanOutput(
  output: JsonRecord,
  directory: string,
  transformVersion: string,
  sourceCutoff: string,
) {
  const file = requireString(output.file, `${directory} orphan file`);
  if (!ORPHAN_FILE.test(file) || path.basename(file) !== file) {
    throw new Error(`${directory} orphan file is not a safe shard name`);
  }
  const bytes = requireNonNegativeInteger(
    output.bytes,
    `${directory} orphan bytes`,
  );
  if (bytes > MAX_SHARD_BYTES) {
    throw new Error(`${directory} orphan shard exceeds the read bound`);
  }
  if (
    output.dataset !== "orphans" ||
    output.transformVersion !== transformVersion ||
    output.sourceCutoff !== sourceCutoff
  ) {
    throw new Error(`${directory} orphan shard source contract changed`);
  }
  return {
    file,
    sha256: requireSha256(output.sha256, `${directory} orphan SHA256`),
    bytes,
    rowCount: requireNonNegativeInteger(
      output.rowCount,
      `${directory} orphan rowCount`,
    ),
  };
}

function validateOrphanDataset(
  manifest: JsonRecord,
  files: Array<{ file: string; sha256: string; bytes: number; rowCount: number }>,
  aggregateSha256: string,
  rowCount: number,
) {
  const datasets = requireRecord(manifest.datasets, "normalized datasets");
  const orphans = requireRecord(datasets.orphans, "normalized datasets.orphans");
  if (
    orphans.shards !== files.length ||
    orphans.rowCount !== rowCount ||
    orphans.bytes !== files.reduce((sum, file) => sum + file.bytes, 0) ||
    orphans.sha256 !== aggregateSha256
  ) {
    throw new Error("normalized orphan aggregate does not match its shards");
  }
}

function collectOrphanOccurrences(
  buffer: Buffer,
  partition: number,
  shardFile: string,
  candidates: NormalizedSource["occurrences"],
) {
  const text = buffer.toString("utf8");
  if (text && !text.endsWith("\n")) {
    throw new Error(`${shardFile} must end with a newline`);
  }
  const lines = text ? text.slice(0, -1).split("\n") : [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (!line || Buffer.byteLength(line) > MAX_ORPHAN_LINE_BYTES) {
      throw new Error(`${shardFile}:${index + 1} is empty or exceeds the line bound`);
    }
    const row = requireRecord(
      JSON.parse(line),
      `${shardFile}:${index + 1}`,
    );
    if (typeof row.issueType !== "string") {
      throw new Error(`${shardFile}:${index + 1} is missing issueType`);
    }
    if (row.issueType !== TARGET_ISSUE) continue;
    assertExactKeys(
      row,
      new Set([
        "issueType",
        "naturalKey",
        "missingProviderKey",
        "sourceArchiveKey",
      ]),
      `${shardFile}:${index + 1}`,
    );
    const providerKey = requireString(
      row.missingProviderKey,
      `${shardFile}:${index + 1}.missingProviderKey`,
    );
    if (!providerKey.startsWith("thedogs:race:")) {
      throw new Error(`${shardFile}:${index + 1} has a non-TheDogs race key`);
    }
    const sourceArchiveKey = requireString(
      row.sourceArchiveKey,
      `${shardFile}:${index + 1}.sourceArchiveKey`,
    );
    const dogMatch = sourceArchiveKey.match(/^thedogs:dog-profile:([0-9]+)$/);
    if (!dogMatch) {
      throw new Error(`${shardFile}:${index + 1} has invalid profile provenance`);
    }
    const naturalKey = requireString(
      row.naturalKey,
      `${shardFile}:${index + 1}.naturalKey`,
    );
    const unresolvedPath = providerKey.slice(13);
    if (unresolvedPath.startsWith("/dogs/")) {
      const dogPath = parseExactTheDogsDogPath(unresolvedPath);
      if (
        naturalKey !==
        `thedogs:profile-form:${dogMatch[1]}:${dogPath}`
      ) {
        throw new Error(`${shardFile}:${index + 1} has inconsistent dog-path provenance`);
      }
      continue;
    }
    let parsed: ReturnType<typeof parseExactTheDogsRacePath>;
    try {
      parsed = parseExactTheDogsRacePath(unresolvedPath);
    } catch (error) {
      throw new Error(
        `${shardFile}:${index + 1} has an invalid exact race path: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    }
    if (
      naturalKey !==
      `thedogs:profile-form:${dogMatch[1]}:${parsed.racePath}`
    ) {
      throw new Error(`${shardFile}:${index + 1} has inconsistent occurrence identity`);
    }
    const occurrence: RaceEvidenceOccurrence = {
      partition,
      shardFile,
      lineNumber: index + 1,
      naturalKey,
      sourceArchiveKey,
      sourceDogId: dogMatch[1]!,
    };
    const candidate = candidates.get(providerKey);
    if (candidate) {
      if (!sameRaceIdentity(candidate.identity, parsed.identity)) {
        throw new Error(`${providerKey} resolved to conflicting exact identities`);
      }
      candidate.rows.push(occurrence);
    } else {
      candidates.set(providerKey, {
        racePath: parsed.racePath,
        identity: parsed.identity,
        rows: [occurrence],
      });
    }
  }
  return lines.length;
}

function parseExactTheDogsDogPath(value: string) {
  if (
    value.length > 512 ||
    /[\\\0]/.test(value) ||
    /%(?:2e|2f|5c)/i.test(value)
  ) {
    throw new Error("unresolved dog path is unsafe");
  }
  const url = new URL(value, THEDOGS_ORIGIN);
  if (
    url.origin !== THEDOGS_ORIGIN ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== value ||
    !/^\/dogs\/[0-9]+\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(url.pathname)
  ) {
    throw new Error("unresolved dog path is not an exact TheDogs dog path");
  }
  return url.pathname;
}

function buildQueueRow(
  providerKey: string,
  candidate: {
    racePath: string;
    identity: TheDogsRaceIdentity;
    rows: RaceEvidenceOccurrence[];
  },
  source: NormalizedSource,
): RaceEvidenceQueueRow {
  const occurrences = [...candidate.rows].sort(compareOccurrence);
  const unsigned = {
    schemaVersion: 1 as const,
    queueVersion: RACE_EVIDENCE_QUEUE_VERSION as typeof RACE_EVIDENCE_QUEUE_VERSION,
    provider: "thedogs" as const,
    providerKey,
    racePath: candidate.racePath,
    identity: candidate.identity,
    occurrenceCount: occurrences.length,
    occurrences,
    normalizedManifestSha256: source.manifestSha256,
    sourceInventorySha256: source.inventorySha256,
    sourceCutoff: source.sourceCutoff,
    transformVersion: source.transformVersion,
    retrievalStatus: "unverified" as const,
    canonicalPromotionEligible: false as const,
  };
  return { ...unsigned, evidenceSha256: sha256Text(JSON.stringify(unsigned)) };
}

function parseQueueRows(
  buffer: Buffer,
  manifest: RaceEvidenceQueueManifest,
) {
  const text = buffer.toString("utf8");
  if (text && !text.endsWith("\n")) throw new Error("queue must end with a newline");
  const lines = text ? text.slice(0, -1).split("\n") : [];
  const rows = lines.map((line, index) => {
    if (!line || Buffer.byteLength(line) > MAX_QUEUE_LINE_BYTES) {
      throw new Error(`queue line ${index + 1} is empty or exceeds the line bound`);
    }
    return validateQueueRow(JSON.parse(line), manifest, index + 1);
  });
  for (let index = 0; index < rows.length; index += 1) {
    if (
      index > 0 &&
      rows[index - 1]!.providerKey.localeCompare(rows[index]!.providerKey) >= 0
    ) {
      throw new Error("queue rows must be unique and strictly sorted");
    }
  }
  return rows;
}

function validateQueueManifest(value: unknown): RaceEvidenceQueueManifest {
  const row = requireRecord(value, "queue manifest");
  assertExactKeys(
    row,
    new Set([
      "schemaVersion",
      "manifestVersion",
      "queueVersion",
      "provider",
      "source",
      "selection",
      "queue",
      "canonicalPromotionEligible",
    ]),
    "queue manifest",
  );
  if (
    row.schemaVersion !== 1 ||
    row.manifestVersion !== RACE_EVIDENCE_QUEUE_MANIFEST_VERSION ||
    row.queueVersion !== RACE_EVIDENCE_QUEUE_VERSION ||
    row.provider !== "thedogs" ||
    row.canonicalPromotionEligible !== false
  ) {
    throw new Error("queue manifest contract changed");
  }
  const source = requireRecord(row.source, "queue manifest source");
  assertExactKeys(
    source,
    new Set([
      "normalizedManifestSha256",
      "sourceInventorySha256",
      "sourceCutoff",
      "transformVersion",
      "fullCorpus",
      "partitionCount",
      "orphanShardAggregateSha256",
      "orphanShardRowCount",
    ]),
    "queue manifest source",
  );
  if (
    source.fullCorpus !== true ||
    !ALLOWED_TRANSFORMS.has(
      requireString(source.transformVersion, "queue source transformVersion"),
    )
  ) {
    throw new Error("queue source is not a supported full corpus");
  }
  requireSha256(source.normalizedManifestSha256, "queue source manifest SHA256");
  requireSha256(source.sourceInventorySha256, "queue source inventory SHA256");
  requireIsoTimestamp(source.sourceCutoff, "queue source cutoff");
  requirePositiveInteger(source.partitionCount, "queue source partitionCount");
  requireSha256(
    source.orphanShardAggregateSha256,
    "queue source orphan aggregate SHA256",
  );
  requireNonNegativeInteger(
    source.orphanShardRowCount,
    "queue source orphan rowCount",
  );
  const selection = requireRecord(row.selection, "queue manifest selection");
  assertExactKeys(
    selection,
    new Set([
      "issueType",
      "providerKeyPrefix",
      "exactTrackDateRaceIdentityRequired",
      "profileFormFieldsUsedForRaceCreation",
    ]),
    "queue manifest selection",
  );
  if (
    selection.issueType !== TARGET_ISSUE ||
    selection.providerKeyPrefix !== "thedogs:race:/racing/" ||
    selection.exactTrackDateRaceIdentityRequired !== true ||
    selection.profileFormFieldsUsedForRaceCreation !== false
  ) {
    throw new Error("queue selection contract changed");
  }
  const queue = requireRecord(row.queue, "queue manifest queue");
  assertExactKeys(
    queue,
    new Set([
      "file",
      "sha256",
      "evidenceSha256",
      "bytes",
      "rowCount",
      "occurrenceCount",
      "duplicateOccurrenceCount",
    ]),
    "queue manifest queue",
  );
  if (queue.file !== RACE_EVIDENCE_QUEUE_FILE) {
    throw new Error("queue manifest file changed");
  }
  requireSha256(queue.sha256, "queue SHA256");
  requireSha256(queue.evidenceSha256, "queue evidence SHA256");
  for (const key of [
    "bytes",
    "rowCount",
    "occurrenceCount",
    "duplicateOccurrenceCount",
  ]) {
    requireNonNegativeInteger(queue[key], `queue ${key}`);
  }
  if (
    (queue.occurrenceCount as number) < (queue.rowCount as number) ||
    (queue.duplicateOccurrenceCount as number) !==
      (queue.occurrenceCount as number) - (queue.rowCount as number)
  ) {
    throw new Error("queue duplicate occurrence accounting is invalid");
  }
  return row as RaceEvidenceQueueManifest;
}

function validateQueueRow(
  value: unknown,
  manifest: RaceEvidenceQueueManifest,
  lineNumber: number,
): RaceEvidenceQueueRow {
  const row = requireRecord(value, `queue line ${lineNumber}`);
  const allowed = new Set([
    "schemaVersion",
    "queueVersion",
    "provider",
    "providerKey",
    "racePath",
    "identity",
    "occurrenceCount",
    "occurrences",
    "normalizedManifestSha256",
    "sourceInventorySha256",
    "sourceCutoff",
    "transformVersion",
    "retrievalStatus",
    "canonicalPromotionEligible",
    "evidenceSha256",
  ]);
  assertExactKeys(row, allowed, `queue line ${lineNumber}`);
  if (
    row.schemaVersion !== 1 ||
    row.queueVersion !== RACE_EVIDENCE_QUEUE_VERSION ||
    row.provider !== "thedogs" ||
    row.retrievalStatus !== "unverified" ||
    row.canonicalPromotionEligible !== false ||
    row.normalizedManifestSha256 !== manifest.source.normalizedManifestSha256 ||
    row.sourceInventorySha256 !== manifest.source.sourceInventorySha256 ||
    row.sourceCutoff !== manifest.source.sourceCutoff ||
    row.transformVersion !== manifest.source.transformVersion
  ) {
    throw new Error(`queue line ${lineNumber} is not source-bound`);
  }
  const providerKey = requireString(row.providerKey, `queue line ${lineNumber}.providerKey`);
  const racePath = requireString(row.racePath, `queue line ${lineNumber}.racePath`);
  if (providerKey !== `thedogs:race:${racePath}`) {
    throw new Error(`queue line ${lineNumber} provider key/path mismatch`);
  }
  const parsed = parseExactTheDogsRacePath(racePath);
  const identity = validateIdentity(row.identity, `queue line ${lineNumber}.identity`);
  if (!sameRaceIdentity(identity, parsed.identity)) {
    throw new Error(`queue line ${lineNumber} identity mismatch`);
  }
  const occurrences = validateOccurrences(
    row.occurrences,
    racePath,
    `queue line ${lineNumber}.occurrences`,
  );
  if (
    requirePositiveInteger(
      row.occurrenceCount,
      `queue line ${lineNumber}.occurrenceCount`,
    ) !== occurrences.length
  ) {
    throw new Error(`queue line ${lineNumber} occurrence count mismatch`);
  }
  const evidenceSha256 = requireSha256(
    row.evidenceSha256,
    `queue line ${lineNumber}.evidenceSha256`,
  );
  const unsigned = Object.fromEntries(
    Object.entries(row).filter(([key]) => key !== "evidenceSha256"),
  );
  if (sha256Text(JSON.stringify(unsigned)) !== evidenceSha256) {
    throw new Error(`queue line ${lineNumber} evidence digest mismatch`);
  }
  return row as RaceEvidenceQueueRow;
}

function validateIdentity(value: unknown, label: string): TheDogsRaceIdentity {
  const row = requireRecord(value, label);
  assertExactKeys(
    row,
    new Set(["trackSlug", "date", "raceNumber", "raceSlug", "trial"]),
    label,
  );
  const trackSlug = requireString(row.trackSlug, `${label}.trackSlug`);
  const date = requireString(row.date, `${label}.date`);
  const raceSlug = requireString(row.raceSlug, `${label}.raceSlug`);
  const raceNumber = requireNonNegativeInteger(row.raceNumber, `${label}.raceNumber`);
  if (
    !/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(trackSlug) ||
    !/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(raceSlug) ||
    !validDate(date) ||
    raceNumber > 2_147_483_647 ||
    (row.trial !== null && typeof row.trial !== "boolean")
  ) {
    throw new Error(`${label} is invalid`);
  }
  return { trackSlug, date, raceNumber, raceSlug, trial: row.trial };
}

function validateOccurrences(value: unknown, racePath: string, label: string) {
  const rows = requireArray(value, label).map((entry, index) => {
    const row = requireRecord(entry, `${label}[${index}]`);
    assertExactKeys(
      row,
      new Set([
        "partition",
        "shardFile",
        "lineNumber",
        "naturalKey",
        "sourceArchiveKey",
        "sourceDogId",
      ]),
      `${label}[${index}]`,
    );
    const sourceDogId = requireString(row.sourceDogId, `${label}[${index}].sourceDogId`);
    const sourceArchiveKey = requireString(
      row.sourceArchiveKey,
      `${label}[${index}].sourceArchiveKey`,
    );
    const naturalKey = requireString(row.naturalKey, `${label}[${index}].naturalKey`);
    if (
      !/^[0-9]+$/.test(sourceDogId) ||
      sourceArchiveKey !== `thedogs:dog-profile:${sourceDogId}` ||
      naturalKey !== `thedogs:profile-form:${sourceDogId}:${racePath}` ||
      !ORPHAN_FILE.test(requireString(row.shardFile, `${label}[${index}].shardFile`))
    ) {
      throw new Error(`${label}[${index}] provenance is inconsistent`);
    }
    requireNonNegativeInteger(row.partition, `${label}[${index}].partition`);
    requirePositiveInteger(row.lineNumber, `${label}[${index}].lineNumber`);
    return row as RaceEvidenceOccurrence;
  });
  const sorted = [...rows].sort(compareOccurrence);
  if (JSON.stringify(rows) !== JSON.stringify(sorted)) {
    throw new Error(`${label} must preserve deterministic occurrence order`);
  }
  return rows;
}

function queueStatistics(rows: RaceEvidenceQueueRow[]) {
  const queueHash = createHash("sha256");
  const evidenceHash = createHash("sha256");
  let bytes = 0;
  let occurrenceCount = 0;
  for (const row of rows) {
    const line = `${JSON.stringify(row)}\n`;
    queueHash.update(line);
    evidenceHash.update(`${row.evidenceSha256}\n`);
    bytes += Buffer.byteLength(line);
    occurrenceCount += row.occurrenceCount;
  }
  return {
    sha256: queueHash.digest("hex"),
    evidenceSha256: evidenceHash.digest("hex"),
    bytes,
    rowCount: rows.length,
    occurrenceCount,
  };
}

async function writeQueueFile(filePath: string, rows: RaceEvidenceQueueRow[]) {
  const stream = createWriteStream(filePath, { encoding: "utf8", flags: "wx" });
  try {
    for (const row of rows) {
      if (!stream.write(`${JSON.stringify(row)}\n`)) {
        await once(stream, "drain");
      }
    }
    stream.end();
    await once(stream, "finish");
  } catch (error) {
    stream.destroy();
    throw error;
  }
}

function compareOccurrence(left: RaceEvidenceOccurrence, right: RaceEvidenceOccurrence) {
  return (
    left.partition - right.partition ||
    left.shardFile.localeCompare(right.shardFile) ||
    left.lineNumber - right.lineNumber ||
    left.naturalKey.localeCompare(right.naturalKey)
  );
}

function sameRaceIdentity(left: TheDogsRaceIdentity, right: TheDogsRaceIdentity) {
  return (
    sameRaceTriple(left, right) &&
    left.raceSlug === right.raceSlug &&
    left.trial === right.trial
  );
}

function validatePartitionDirectory(value: string, index: number, count: number) {
  const match = value.match(PARTITION_DIRECTORY);
  if (
    !match ||
    Number(match[1]) !== index ||
    Number(match[2]) !== count
  ) {
    throw new Error(`partition directory ${value} is out of sequence`);
  }
}

function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
  );
}

function requireIsoTimestamp(value: unknown, label: string) {
  const text = requireString(value, label);
  if (!Number.isFinite(Date.parse(text)) || new Date(text).toISOString() !== text) {
    throw new Error(`${label} must be a canonical ISO timestamp`);
  }
  return text;
}

function requireRecord(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonRecord;
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function requireString(value: unknown, label: string) {
  if (typeof value !== "string" || !value) throw new Error(`${label} is required`);
  return value;
}

function requireSha256(value: unknown, label: string) {
  const digest = requireString(value, label);
  if (!SHA256.test(digest)) throw new Error(`${label} must be lowercase SHA-256`);
  return digest;
}

function requireNonNegativeInteger(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value as number;
}

function requirePositiveInteger(value: unknown, label: string) {
  const number = requireNonNegativeInteger(value, label);
  if (number === 0) throw new Error(`${label} must be positive`);
  return number;
}

function assertExactKeys(value: JsonRecord, allowed: Set<string>, label: string) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${label} has unknown field ${key}`);
  }
  for (const key of allowed) {
    if (!(key in value)) throw new Error(`${label} is missing field ${key}`);
  }
}

function safeChild(root: string, relative: string) {
  if (!relative || path.isAbsolute(relative)) throw new Error("unsafe artifact path");
  const resolved = path.resolve(root, relative);
  const prefix = `${path.resolve(root)}${path.sep}`;
  if (!resolved.startsWith(prefix)) throw new Error("artifact path escaped its root");
  return resolved;
}

function assertDirectChild(parent: string, child: string) {
  if (path.dirname(path.resolve(child)) !== path.resolve(parent)) {
    throw new Error("temporary output escaped its intended parent");
  }
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

function parseOptions(args: string[]): BuildRaceEvidenceQueueOptions {
  const values = parseFlags(args, new Set(["normalized-dir", "output-dir", "dry-run"]));
  const normalizedDir = optionString(values, "normalized-dir");
  if (!normalizedDir) throw new Error("--normalized-dir is required");
  return {
    normalizedDir,
    outputDir: optionString(values, "output-dir"),
    dryRun: values.get("dry-run") === true,
  };
}

function parseFlags(args: string[], allowed: Set<string>) {
  const values = new Map<string, string | true>();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (!argument.startsWith("--")) throw new Error(`unexpected argument: ${argument}`);
    const [rawKey, inlineValue] = argument.slice(2).split("=", 2);
    if (!rawKey || !allowed.has(rawKey)) throw new Error(`unknown option: --${rawKey}`);
    if (values.has(rawKey)) throw new Error(`duplicate option: --${rawKey}`);
    if (inlineValue != null) {
      values.set(rawKey, inlineValue);
    } else if (rawKey === "dry-run") {
      values.set(rawKey, true);
    } else {
      const next = args[index + 1];
      if (!next || next.startsWith("--")) throw new Error(`--${rawKey} requires a value`);
      values.set(rawKey, next);
      index += 1;
    }
  }
  return values;
}

function optionString(values: Map<string, string | true>, key: string) {
  const value = values.get(key);
  return typeof value === "string" && value ? value : undefined;
}

const isCli =
  process.argv[1] != null &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isCli) {
  buildRaceEvidenceQueue(parseOptions(process.argv.slice(2)))
    .then((result) => {
      console.log(
        JSON.stringify(
          {
            dryRun: result.outputDir == null,
            outputDir: result.outputDir,
            manifestSha256: result.manifestSha256,
            source: result.manifest.source,
            queue: result.manifest.queue,
            canonicalPromotionEligible: false,
          },
          null,
          2,
        ),
      );
    })
    .catch((error: unknown) => {
      console.error(
        `[build:thedogs:race-evidence-queue] failed: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
      process.exitCode = 1;
    });
}
