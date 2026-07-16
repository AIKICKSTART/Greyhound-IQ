import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { getLocalSourceClosure } from "../src/components/screen-contracts/screen-contract-source-audit";

const SOURCE_DIRECTORIES = ["src", "security", "prisma"] as const;
const SOURCE_FILES = [
  "package.json",
  "package-lock.json",
  "docker-compose.design-lab-db.yml",
  "docker-compose.local-db.yml",
  "next.config.ts",
  "tsconfig.json",
  "scripts/audit-demo-routes.ts",
  "scripts/audit-local-postgres-catalog.ts",
  "scripts/audit-local-postgres-catalog.test.ts",
  "scripts/check-database-compatibility-inventory.ts",
  "scripts/check-database-compatibility-inventory.test.ts",
  "scripts/check-database-migration-replay.ts",
  "scripts/check-database-migration-replay.test.ts",
  "scripts/check-demo-route-fixture-evidence.test.ts",
  "scripts/check-demo-route-fixture-idempotency.ts",
  "scripts/check-demo-route-fixture-idempotency.test.ts",
  "scripts/check-design-lab-database-parity.ts",
  "scripts/check-design-lab-database-parity.test.ts",
  "scripts/design-lab-database-parity-catalog.ts",
  "scripts/design-lab-database-parity-contract.ts",
  "scripts/design-lab-database-parity-evidence.ts",
  "scripts/design-lab-database-parity-runtime.ts",
  "scripts/design-lab-database-parity-support.ts",
  "scripts/audit-design-lab-hydrated-stories-atomic.test.ts",
  "scripts/audit-design-lab-hydrated-stories.ts",
  "scripts/audit-design-lab-hydrated-stories.test.ts",
  "scripts/audit-design-lab-hydrated-wave2-atomic.test.ts",
  "scripts/audit-design-lab-hydrated-wave2.ts",
  "scripts/audit-design-lab-hydrated-wave2.test.ts",
  "scripts/audit-design-lab-user-stories.ts",
  "scripts/audit-design-lab-user-stories.test.ts",
  "scripts/check-design-lab-sync.ts",
  "scripts/check-design-lab-sync.test.ts",
  "scripts/design-lab-source-fingerprint.ts",
  "scripts/design-lab-database.ts",
  "scripts/design-lab-database.test.ts",
  "scripts/demo-route-fixture-contract.ts",
  "scripts/local-database-policy.ts",
  "scripts/local-database-policy.test.ts",
  "scripts/seed-demo-route-fixtures.ts",
  "scripts/staging-load-policy.ts",
] as const;
const OPERATIONAL_STATUS_FILES = new Set([
  "src/components/design-lab-delivery-progress.ts",
  "src/components/master-audit-evidence.ts",
]);

export type DesignLabSourceFingerprint = {
  schemaVersion: 1;
  sha256: string;
  fileCount: number;
};

export type DesignLabSourceContract = Readonly<{
  directFiles: readonly string[];
  transitiveImportRoots: readonly string[];
  fixtures: readonly string[];
  schemaFiles: readonly string[];
  runtimeContractFiles: readonly string[];
}>;

export const DESIGN_LAB_DEMO_FIXTURE_FILES = Object.freeze([
  "scripts/demo-route-fixture-contract.ts",
  "scripts/seed-demo-route-fixtures.ts",
]);

export const DESIGN_LAB_SAFE_RUNTIME_CONTRACT_FILES = Object.freeze([
  "next.config.ts",
  "src/app/globals.css",
  "src/app/layout.tsx",
  "src/proxy.ts",
]);

export const DESIGN_LAB_HTTP_RUNTIME_CONTRACT_FILES = Object.freeze([
  "next.config.ts",
  "src/app/layout.tsx",
  "src/proxy.ts",
]);

export function getDesignLabSourceFingerprint(
  repoRoot: string,
  contract?: DesignLabSourceContract,
): DesignLabSourceFingerprint {
  return fingerprintRepositoryFiles(
    repoRoot,
    getDesignLabSourcePaths(repoRoot, contract),
  );
}

export function getDesignLabSourcePaths(
  repoRoot: string,
  contract?: DesignLabSourceContract,
) {
  if (contract) {
    const declaredFiles = [
      ...contract.directFiles,
      ...contract.transitiveImportRoots,
      ...contract.fixtures,
      ...contract.schemaFiles,
      ...contract.runtimeContractFiles,
    ];
    const importRoots = [
      ...contract.directFiles,
      ...contract.transitiveImportRoots,
      ...contract.fixtures,
      ...contract.runtimeContractFiles,
    ].filter((file) => /\.[cm]?[jt]sx?$/.test(file));
    return normalizeRepositoryPaths([
      ...declaredFiles,
      ...importRoots.flatMap((file) => [
        ...getLocalSourceClosure(file, repoRoot, {
          ignoredFiles: OPERATIONAL_STATUS_FILES,
        }),
      ]),
    ]);
  }
  const files = [
    ...SOURCE_DIRECTORIES.flatMap((directory) =>
      collectSourceFiles(repoRoot, directory)
    ),
    ...SOURCE_FILES.filter((file) => existsSync(resolve(repoRoot, file))),
  ];
  return [...new Set(files)].sort();
}

export function parseDesignLabSourceFiles(value: unknown) {
  if (
    typeof value !== "object" ||
    value === null ||
    !("sourceFiles" in value) ||
    !Array.isArray(value.sourceFiles) ||
    value.sourceFiles.length === 0 ||
    value.sourceFiles.some((file) => typeof file !== "string")
  ) {
    return null;
  }
  try {
    const sourceFiles = normalizeRepositoryPaths(value.sourceFiles as string[]);
    return JSON.stringify(sourceFiles) === JSON.stringify(value.sourceFiles)
      ? sourceFiles
      : null;
  } catch {
    return null;
  }
}

export function fingerprintRepositoryFiles(
  repoRoot: string,
  repositoryRelativeFiles: readonly string[]
): DesignLabSourceFingerprint {
  const canonicalRoot = realpathSync(repoRoot);
  const hash = createHash("sha256");
  hash.update("greyhoundiq-design-lab-source-v1\0");

  for (const repositoryPath of [...repositoryRelativeFiles].sort()) {
    if (isAbsolute(repositoryPath)) {
      throw new Error(`Source fingerprint path must be relative: ${repositoryPath}`);
    }
    const absolutePath = resolve(canonicalRoot, repositoryPath);
    if (lstatSync(absolutePath).isSymbolicLink()) {
      throw new Error(`Source fingerprint refuses symbolic link: ${repositoryPath}`);
    }
    const canonicalPath = realpathSync(absolutePath);
    if (!isInside(canonicalRoot, canonicalPath)) {
      throw new Error(`Source fingerprint path escapes repository: ${repositoryPath}`);
    }
    const bytes = readFileSync(canonicalPath);
    const normalizedPath = relative(canonicalRoot, canonicalPath).replaceAll("\\", "/");
    hash.update(normalizedPath);
    hash.update("\0");
    hash.update(String(bytes.byteLength));
    hash.update("\0");
    hash.update(bytes);
    hash.update("\0");
  }

  return {
    schemaVersion: 1,
    sha256: hash.digest("hex"),
    fileCount: repositoryRelativeFiles.length,
  };
}

export function getRepositoryHeadSha(repoRoot: string) {
  const result = spawnSync("git", ["rev-parse", "--verify", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const sha = result.stdout.trim().toLowerCase();
  if (result.status !== 0 || !/^[a-f0-9]{40}$/.test(sha)) {
    throw new Error("Unable to resolve the tested Git commit.");
  }
  return sha;
}

export function isRepositoryCommitAncestor(
  repoRoot: string,
  ancestorSha: string,
  descendantSha = getRepositoryHeadSha(repoRoot)
) {
  const normalizedAncestor = ancestorSha.toLowerCase();
  const normalizedDescendant = descendantSha.toLowerCase();
  if (
    !/^[a-f0-9]{40}$/.test(normalizedAncestor) ||
    !/^[a-f0-9]{40}$/.test(normalizedDescendant)
  ) {
    return false;
  }
  if (
    repositoryObjectType(repoRoot, normalizedAncestor) !== "commit" ||
    repositoryObjectType(repoRoot, normalizedDescendant) !== "commit"
  ) {
    return false;
  }
  const result = spawnSync(
    "git",
    ["merge-base", "--is-ancestor", normalizedAncestor, normalizedDescendant],
    { cwd: repoRoot, encoding: "utf8" }
  );
  return result.status === 0;
}

export function getDesignLabSourceChangesBetween(
  repoRoot: string,
  ancestorSha: string,
  descendantSha: string,
  repositoryRelativeFiles?: readonly string[],
) {
  if (!isRepositoryCommitAncestor(repoRoot, ancestorSha, descendantSha)) return null;
  const scopedPaths = repositoryRelativeFiles
    ? normalizeRepositoryPaths(repositoryRelativeFiles)
    : null;
  const scopedPathSet = scopedPaths ? new Set(scopedPaths) : null;
  const result = spawnSync(
    "git",
    [
      "diff",
      "--no-renames",
      "--name-only",
      "-z",
      `${ancestorSha}..${descendantSha}`,
      "--",
      ...(scopedPaths ?? [...SOURCE_DIRECTORIES, ...SOURCE_FILES]),
    ],
    { cwd: repoRoot, encoding: "utf8" }
  );
  if (result.status !== 0) return null;
  return result.stdout
    .split("\0")
    .filter(Boolean)
    .map(normalizeRepositoryPath)
    .filter(
      scopedPathSet ? (file) => scopedPathSet.has(file) : isDesignLabSourcePath,
    )
    .toSorted();
}

export function getDesignLabSourcePathsAtCommit(
  repoRoot: string,
  commitSha = getRepositoryHeadSha(repoRoot)
) {
  if (repositoryObjectType(repoRoot, commitSha) !== "commit") return null;
  const result = spawnSync(
    "git",
    [
      "ls-tree",
      "-r",
      "--name-only",
      "-z",
      commitSha,
      "--",
      ...SOURCE_DIRECTORIES,
      ...SOURCE_FILES,
    ],
    { cwd: repoRoot, encoding: "utf8" }
  );
  if (result.status !== 0) return null;
  return result.stdout
    .split("\0")
    .filter(Boolean)
    .map(normalizeRepositoryPath)
    .filter(isDesignLabSourcePath)
    .toSorted();
}

function collectSourceFiles(repoRoot: string, directory: string): string[] {
  const absoluteDirectory = resolve(repoRoot, directory);
  if (!existsSync(absoluteDirectory)) return [];
  const results: string[] = [];
  for (const entry of readdirSync(absoluteDirectory, { withFileTypes: true })) {
    const absolutePath = resolve(absoluteDirectory, entry.name);
    const relativePath = relative(repoRoot, absolutePath).replaceAll("\\", "/");
    if (OPERATIONAL_STATUS_FILES.has(relativePath)) continue;
    if (entry.isSymbolicLink() || lstatSync(absolutePath).isSymbolicLink()) {
      throw new Error(`Source fingerprint refuses symbolic link: ${relativePath}`);
    }
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(repoRoot, relativePath));
      continue;
    }
    results.push(relativePath);
  }
  return results;
}

function isDesignLabSourcePath(filePath: string) {
  const normalizedPath = normalizeRepositoryPath(filePath);
  if (OPERATIONAL_STATUS_FILES.has(normalizedPath)) return false;
  if (SOURCE_FILES.includes(normalizedPath as (typeof SOURCE_FILES)[number])) return true;
  return SOURCE_DIRECTORIES.some((directory) =>
    normalizedPath.startsWith(`${directory}/`)
  );
}

function normalizeRepositoryPath(filePath: string) {
  return filePath.replaceAll("\\", "/");
}

function normalizeRepositoryPaths(filePaths: readonly string[]) {
  return [...new Set(filePaths.map((filePath) => {
    const normalizedPath = normalizeRepositoryPath(filePath);
    if (
      isAbsolute(normalizedPath) ||
      normalizedPath === ".." ||
      normalizedPath.startsWith("../") ||
      /[\0\r\n\t]/.test(normalizedPath)
    ) {
      throw new Error(`Source fingerprint path must be repository-relative: ${filePath}`);
    }
    return normalizedPath;
  }))].sort();
}

function repositoryObjectType(repoRoot: string, objectSha: string) {
  const result = spawnSync("git", ["cat-file", "-t", objectSha], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function isInside(root: string, candidate: string) {
  const pathFromRoot = relative(root, candidate);
  return (
    pathFromRoot === "" ||
    (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot))
  );
}
