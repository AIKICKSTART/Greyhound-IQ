import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PROVIDER_RIGHTS_REGISTRY_SCHEMA_VERSION,
  canonicalProviderRightsJson,
  createProviderRightsReleaseAttestation,
  validateProviderRightsRegistry,
  validateProviderRightsReleaseAttestation,
} from "../src/lib/provider-rights";

const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const DATABASE_PATTERN = /^[a-z][a-z0-9_]{0,62}$/u;
const SAFE_DUMP_FILE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/u;

interface CompletedDumpManifestFile {
  path: string;
  bytes: number;
  sha256: string;
}

interface CompletedDumpManifest {
  schemaVersion: 1;
  createdUtc: string;
  database: string;
  stage: 11;
  stageSha256: string;
  archiveFormat: "PostgreSQL directory";
  archiveFiles: number;
  archiveBytes: number;
  files: CompletedDumpManifestFile[];
}

function usage() {
  return [
    "Usage:",
    "  tsx scripts/provider-rights-release.ts --validate-registry <path>",
    "  tsx scripts/provider-rights-release.ts --check-release <attestation-path>",
    "    --attestation-sha256 <exact-sha256> --registry <current-path>",
    "    --dump-manifest <current-path> --dump-checksum <current-path>",
    "    --source-database <dump-source-name> --database <restore-target-name>",
    "  tsx scripts/provider-rights-release.ts --attest --registry <path> --inventory <path>",
    "    --release-id <id> --source-database <dump-source-name> --database <target-name>",
    "    --dump-manifest <path>",
    "    --dump-checksum <path> --approved-at <UTC timestamp> --out <new path>",
    "  Both release operations derive a clean Git HEAD and never accept a supplied commit SHA.",
    "  Release checking is offline, read-only, current-time, and requires every listed input.",
  ].join("\n");
}

function argumentValue(args: readonly string[], name: string) {
  const position = args.indexOf(name);
  if (position < 0 || !args[position + 1] || args[position + 1].startsWith("--")) {
    throw new Error(`Missing required argument ${name}`);
  }
  return args[position + 1];
}

function assertExactArguments(
  args: readonly string[],
  valueFlags: readonly string[],
  booleanFlags: readonly string[] = [],
) {
  const allowed = new Set([...valueFlags, ...booleanFlags]);
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (!allowed.has(flag)) {
      throw new Error(`Unexpected argument ${flag}`);
    }
    if (seen.has(flag)) {
      throw new Error(`Duplicate argument ${flag}`);
    }
    seen.add(flag);
    if (booleanFlags.includes(flag)) {
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing required argument ${flag}`);
    }
    index += 1;
  }
  for (const flag of [...valueFlags, ...booleanFlags]) {
    if (!seen.has(flag)) {
      throw new Error(`Missing required argument ${flag}`);
    }
  }
}

function readBoundedFile(pathValue: string, maximumBytes: number) {
  const path = resolve(pathValue);
  const stats = statSync(path);
  if (!stats.isFile()) {
    throw new Error(`Input is not a file: ${path}`);
  }
  if (stats.size > maximumBytes) {
    throw new Error(`Input exceeds ${maximumBytes} bytes: ${path}`);
  }
  return { path, bytes: readFileSync(path) };
}

function parseJsonBytes(input: Buffer): unknown {
  return JSON.parse(input.toString("utf8")) as unknown;
}

function readJson(pathValue: string): unknown {
  return parseJsonBytes(readBoundedFile(pathValue, MAX_INPUT_BYTES).bytes);
}

function sha256Bytes(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function exactSha256(value: string, label: string) {
  if (!SHA256_PATTERN.test(value)) {
    throw new Error(`${label} must be an exact lowercase SHA-256`);
  }
  return value;
}

function exactDatabase(value: string) {
  if (!DATABASE_PATTERN.test(value)) {
    throw new Error("Expected database must be one exact PostgreSQL database name");
  }
  return value;
}

function exactObject(
  value: unknown,
  expectedKeys: readonly string[],
  label: string,
) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const record = value as Record<string, unknown>;
  const actualKeys = Object.keys(record).sort();
  const requiredKeys = [...expectedKeys].sort();
  if (
    actualKeys.length !== requiredKeys.length ||
    actualKeys.some((key, index) => key !== requiredKeys[index])
  ) {
    throw new Error(`${label} must contain only ${requiredKeys.join(", ")}`);
  }
  return record;
}

function nonNegativeSafeInteger(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value as number;
}

function completedDumpManifest(
  value: unknown,
  expectedDatabase: string,
): CompletedDumpManifest {
  const manifest = exactObject(
    value,
    [
      "schemaVersion",
      "createdUtc",
      "database",
      "stage",
      "stageSha256",
      "archiveFormat",
      "archiveFiles",
      "archiveBytes",
      "files",
    ],
    "Dump manifest",
  );
  if (manifest.schemaVersion !== 1) {
    throw new Error("Dump manifest schemaVersion must be 1");
  }
  if (
    typeof manifest.createdUtc !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{7}Z$/u.test(
      manifest.createdUtc,
    ) ||
    Number.isNaN(Date.parse(manifest.createdUtc))
  ) {
    throw new Error("Dump manifest createdUtc must be a producer-format UTC timestamp");
  }
  if (manifest.database !== expectedDatabase) {
    throw new Error("Dump manifest database does not match the exact expected database");
  }
  if (manifest.stage !== 11) {
    throw new Error("Dump manifest stage must be 11");
  }
  if (typeof manifest.stageSha256 !== "string") {
    throw new Error("Dump manifest stageSha256 must be an exact lowercase SHA-256");
  }
  exactSha256(manifest.stageSha256, "Dump manifest stageSha256");
  if (manifest.archiveFormat !== "PostgreSQL directory") {
    throw new Error('Dump manifest archiveFormat must be "PostgreSQL directory"');
  }
  const archiveFiles = nonNegativeSafeInteger(
    manifest.archiveFiles,
    "Dump manifest archiveFiles",
  );
  if (archiveFiles < 1) {
    throw new Error("Dump manifest archiveFiles must be positive");
  }
  const archiveBytes = nonNegativeSafeInteger(
    manifest.archiveBytes,
    "Dump manifest archiveBytes",
  );
  if (!Array.isArray(manifest.files) || manifest.files.length !== archiveFiles) {
    throw new Error("Dump manifest files length must equal archiveFiles");
  }

  const seenPaths = new Set<string>();
  let observedBytes = 0;
  const files = manifest.files.map((value, index) => {
    const file = exactObject(
      value,
      ["path", "bytes", "sha256"],
      `Dump manifest files[${index}]`,
    );
    if (
      typeof file.path !== "string" ||
      !SAFE_DUMP_FILE_PATTERN.test(file.path) ||
      file.path === "." ||
      file.path === ".."
    ) {
      throw new Error(`Dump manifest files[${index}].path must be a safe flat relative path`);
    }
    if (seenPaths.has(file.path)) {
      throw new Error(`Dump manifest contains duplicate path ${file.path}`);
    }
    seenPaths.add(file.path);
    const bytes = nonNegativeSafeInteger(
      file.bytes,
      `Dump manifest files[${index}].bytes`,
    );
    if (typeof file.sha256 !== "string") {
      throw new Error(
        `Dump manifest files[${index}].sha256 must be an exact lowercase SHA-256`,
      );
    }
    exactSha256(file.sha256, `Dump manifest files[${index}].sha256`);
    observedBytes += bytes;
    if (!Number.isSafeInteger(observedBytes)) {
      throw new Error("Dump manifest file byte sum exceeds the safe integer range");
    }
    return { path: file.path, bytes, sha256: file.sha256 };
  });
  if (!seenPaths.has("toc.dat")) {
    throw new Error("Dump manifest must include toc.dat");
  }
  if (observedBytes !== archiveBytes) {
    throw new Error("Dump manifest file byte sum does not match archiveBytes");
  }

  return {
    schemaVersion: 1,
    createdUtc: manifest.createdUtc,
    database: expectedDatabase,
    stage: 11,
    stageSha256: manifest.stageSha256,
    archiveFormat: "PostgreSQL directory",
    archiveFiles,
    archiveBytes,
    files,
  };
}

function hashDumpManifest(pathValue: string, expectedDatabase: string) {
  const input = readBoundedFile(pathValue, MAX_INPUT_BYTES);
  const manifest = completedDumpManifest(
    parseJsonBytes(input.bytes),
    expectedDatabase,
  );
  return { manifest, sha256: sha256Bytes(input.bytes) };
}

function hashDumpChecksum(
  pathValue: string,
  manifest: CompletedDumpManifest,
) {
  const input = readBoundedFile(pathValue, MAX_INPUT_BYTES);
  const lines = input.bytes.toString("utf8").split(/\r?\n/u).filter(Boolean);
  if (lines.length !== manifest.archiveFiles) {
    throw new Error("Dump checksum line count must equal dump manifest archiveFiles");
  }
  const expectedFiles = new Map(
    manifest.files.map((file) => [file.path, file.sha256] as const),
  );
  const observedPaths = new Set<string>();
  for (const [index, line] of lines.entries()) {
    const match = /^([0-9a-f]{64})\s+\*?([^\s]+)$/u.exec(line);
    if (!match) {
      throw new Error(`Dump checksum line ${index + 1} is malformed`);
    }
    const [, sha256, path] = match;
    if (!SAFE_DUMP_FILE_PATTERN.test(path) || path === "." || path === "..") {
      throw new Error(`Dump checksum line ${index + 1} has an unsafe path`);
    }
    if (observedPaths.has(path)) {
      throw new Error(`Dump checksum contains duplicate path ${path}`);
    }
    observedPaths.add(path);
    if (expectedFiles.get(path) !== sha256) {
      throw new Error(`Dump checksum does not match manifest entry ${path}`);
    }
  }
  return sha256Bytes(input.bytes);
}

function cleanSourceCommitSha(operation: "attestation" | "release verification") {
  try {
    const sourceCommitSha = execFileSync(
      "git",
      ["rev-parse", "--verify", "HEAD"],
      { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();
    if (!/^[0-9a-f]{40}$/u.test(sourceCommitSha)) {
      throw new Error("Git returned a non-canonical commit SHA");
    }
    const dirtyLines = execFileSync(
      "git",
      ["status", "--porcelain=v1", "--untracked-files=all"],
      { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    )
      .split(/\r?\n/u)
      .filter(Boolean);
    if (dirtyLines.length > 0) {
      throw new Error(
        `Provider rights ${operation} requires a clean worktree; observed ${dirtyLines.length} changed paths`,
      );
    }
    return sourceCommitSha;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Provider rights ")) {
      throw error;
    }
    throw new Error("Unable to derive a clean source commit from the current repository");
  }
}

function writeNewJson(pathValue: string, value: unknown) {
  const path = resolve(pathValue);
  if (existsSync(path)) {
    throw new Error(`Refusing to overwrite existing attestation: ${path}`);
  }
  const bytes = `${canonicalProviderRightsJson(value)}\n`;
  writeFileSync(path, bytes, { encoding: "utf8", flag: "wx", mode: 0o600 });
  return path;
}

export function runProviderRightsRelease(args: readonly string[]) {
  const modes = [
    args.includes("--validate-registry"),
    args.includes("--check-release"),
    args.includes("--attest"),
  ].filter(Boolean).length;
  if (modes !== 1) {
    throw new Error(usage());
  }

  if (args.includes("--validate-registry")) {
    assertExactArguments(args, ["--validate-registry"]);
    const registry = validateProviderRightsRegistry(
      readJson(argumentValue(args, "--validate-registry")),
    );
    console.log(
      `PROVIDER_RIGHTS_REGISTRY_VALID authorizations=${registry.authorizations.length} releaseRequiresAttestation=true`,
    );
    return;
  }

  if (args.includes("--check-release")) {
    assertExactArguments(args, [
      "--check-release",
      "--attestation-sha256",
      "--registry",
      "--dump-manifest",
      "--dump-checksum",
      "--source-database",
      "--database",
    ]);
    const expectedAttestationSha256 = exactSha256(
      argumentValue(args, "--attestation-sha256"),
      "Expected attestation SHA-256",
    );
    const expectedDatabase = exactDatabase(argumentValue(args, "--database"));
    const expectedSourceDatabase = exactDatabase(
      argumentValue(args, "--source-database"),
    );
    const attestationInput = readBoundedFile(
      argumentValue(args, "--check-release"),
      MAX_INPUT_BYTES,
    );
    const attestationSha256 = sha256Bytes(attestationInput.bytes);
    if (attestationSha256 !== expectedAttestationSha256) {
      throw new Error("Attestation bytes do not match the caller-supplied SHA-256");
    }
    const attestation = validateProviderRightsReleaseAttestation(
      parseJsonBytes(attestationInput.bytes),
    );
    if (attestation.release.database !== expectedDatabase) {
      throw new Error("Attestation database does not match the exact expected database");
    }
    const currentRegistry = validateProviderRightsRegistry(
      readJson(argumentValue(args, "--registry")),
    );
    const attestedRegistry = validateProviderRightsRegistry({
      schemaVersion: PROVIDER_RIGHTS_REGISTRY_SCHEMA_VERSION,
      authorizations: attestation.authorizations,
    });
    if (
      canonicalProviderRightsJson(currentRegistry) !==
      canonicalProviderRightsJson(attestedRegistry)
    ) {
      throw new Error("Current provider rights registry does not match the attestation");
    }
    const dumpManifest = hashDumpManifest(
      argumentValue(args, "--dump-manifest"),
      expectedSourceDatabase,
    );
    if (dumpManifest.sha256 !== attestation.release.dumpManifestSha256) {
      throw new Error("Current dump manifest SHA-256 does not match the attestation");
    }
    const dumpChecksumSha256 = hashDumpChecksum(
      argumentValue(args, "--dump-checksum"),
      dumpManifest.manifest,
    );
    if (dumpChecksumSha256 !== attestation.release.dumpChecksumSha256) {
      throw new Error("Current dump checksum SHA-256 does not match the attestation");
    }
    const sourceCommitSha = cleanSourceCommitSha("release verification");
    if (sourceCommitSha !== attestation.review.sourceCommitSha) {
      throw new Error("Current clean Git HEAD does not match the attestation review commit");
    }
    console.log(
      `PROVIDER_RIGHTS_RELEASE_VERIFIED releaseId=${attestation.release.releaseId} database=${expectedDatabase} inventoryEntries=${attestation.inventory.entries.length} attestationSha256=${attestationSha256} sourceCommitSha=${sourceCommitSha}`,
    );
    return;
  }

  assertExactArguments(
    args,
    [
      "--registry",
      "--inventory",
      "--release-id",
      "--source-database",
      "--database",
      "--dump-manifest",
      "--dump-checksum",
      "--approved-at",
      "--out",
    ],
    ["--attest"],
  );
  const registry = readJson(argumentValue(args, "--registry"));
  const inventory = readJson(argumentValue(args, "--inventory"));
  const database = exactDatabase(argumentValue(args, "--database"));
  const sourceDatabase = exactDatabase(
    argumentValue(args, "--source-database"),
  );
  const dumpManifest = hashDumpManifest(
    argumentValue(args, "--dump-manifest"),
    sourceDatabase,
  );
  const attestation = createProviderRightsReleaseAttestation({
    registry,
    inventory,
    releaseId: argumentValue(args, "--release-id"),
    database,
    dumpManifestSha256: dumpManifest.sha256,
    dumpChecksumSha256: hashDumpChecksum(
      argumentValue(args, "--dump-checksum"),
      dumpManifest.manifest,
    ),
    approvedAt: argumentValue(args, "--approved-at"),
    sourceCommitSha: cleanSourceCommitSha("attestation"),
  });
  const outputPath = writeNewJson(argumentValue(args, "--out"), attestation);
  console.log(
    `PROVIDER_RIGHTS_RELEASE_ATTESTATION_CREATED releaseId=${attestation.release.releaseId} output=${outputPath}`,
  );
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    runProviderRightsRelease(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Provider rights release failed");
    process.exitCode = 1;
  }
}
