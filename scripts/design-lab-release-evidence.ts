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

export type ReleaseEvidenceManifestEntry = {
  path: string;
  sha256: string;
};

export function resolveReleaseEvidenceReferences(
  repoRoot: string,
  references: readonly string[]
) {
  const canonicalRoot = realpathSync(repoRoot);
  const headFiles = collectHeadEvidenceFiles(canonicalRoot);
  const resolvedFiles = new Set<string>();

  for (const reference of new Set(references)) {
    const files = resolveEvidenceReference(canonicalRoot, reference, headFiles);
    if (files.length === 0) {
      throw new Error(
        `Completed release evidence resolves to no regular files: ${reference}`
      );
    }
    files.forEach((file) => resolvedFiles.add(file));
  }

  return [...resolvedFiles].toSorted();
}

export function createReleaseEvidenceManifest(
  repoRoot: string,
  repositoryRelativeFiles: readonly string[]
): ReleaseEvidenceManifestEntry[] {
  const canonicalRoot = realpathSync(repoRoot);
  return [...new Set(repositoryRelativeFiles)].toSorted().map((path) => {
    if (isAbsolute(path)) {
      throw new Error(`Release evidence path must be repository-relative: ${path}`);
    }
    const absolutePath = resolve(canonicalRoot, path);
    if (!isInside(canonicalRoot, absolutePath) || !existsSync(absolutePath)) {
      throw new Error(
        `Completed release evidence is missing or escapes the repository: ${path}`
      );
    }
    if (lstatSync(absolutePath).isSymbolicLink()) {
      throw new Error(`Completed release evidence must not be a symbolic link: ${path}`);
    }
    const canonicalPath = realpathSync(absolutePath);
    if (
      !isInside(canonicalRoot, canonicalPath) ||
      !lstatSync(canonicalPath).isFile()
    ) {
      throw new Error(`Completed release evidence is not a regular file: ${path}`);
    }
    return {
      path: normalizeRepositoryPath(relative(canonicalRoot, canonicalPath)),
      sha256: createHash("sha256")
        .update(readFileSync(canonicalPath))
        .digest("hex"),
    };
  });
}

function resolveEvidenceReference(
  canonicalRoot: string,
  reference: string,
  headFiles: readonly string[]
): string[] {
  if (!reference || isAbsolute(reference)) {
    throw new Error(`Release evidence path must be repository-relative: ${reference}`);
  }
  const absolutePath = resolve(canonicalRoot, reference);
  if (!isInside(canonicalRoot, absolutePath) || !existsSync(absolutePath)) {
    throw new Error(
      `Completed release evidence is missing or escapes the repository: ${reference}`
    );
  }
  if (lstatSync(absolutePath).isSymbolicLink()) {
    throw new Error(`Completed release evidence must not be a symbolic link: ${reference}`);
  }
  const canonicalPath = realpathSync(absolutePath);
  if (!isInside(canonicalRoot, canonicalPath)) {
    throw new Error(
      `Completed release evidence resolves outside the repository: ${reference}`
    );
  }

  const normalizedReference = normalizeRepositoryPath(
    relative(canonicalRoot, canonicalPath)
  );
  if (!normalizedReference) {
    throw new Error("Completed release evidence must not reference the repository root.");
  }
  const workingFiles = collectWorkingEvidenceFiles(canonicalRoot, canonicalPath);
  const committedFiles = headFiles.filter(
    (path) => path === normalizedReference || path.startsWith(`${normalizedReference}/`)
  );
  return [...new Set([...workingFiles, ...committedFiles])].toSorted();
}

function collectWorkingEvidenceFiles(
  canonicalRoot: string,
  canonicalPath: string
): string[] {
  const status = lstatSync(canonicalPath);
  const repositoryPath = normalizeRepositoryPath(
    relative(canonicalRoot, canonicalPath)
  );
  if (status.isSymbolicLink()) {
    throw new Error(
      `Completed release evidence must not be a symbolic link: ${repositoryPath}`
    );
  }
  if (status.isFile()) return [repositoryPath];
  if (!status.isDirectory()) {
    throw new Error(
      `Completed release evidence is not a file or directory: ${repositoryPath}`
    );
  }

  return readdirSync(canonicalPath, { withFileTypes: true }).flatMap((entry) => {
    const childPath = resolve(canonicalPath, entry.name);
    if (entry.isSymbolicLink() || lstatSync(childPath).isSymbolicLink()) {
      throw new Error(
        `Completed release evidence must not be a symbolic link: ${normalizeRepositoryPath(
          relative(canonicalRoot, childPath)
        )}`
      );
    }
    const canonicalChild = realpathSync(childPath);
    if (!isInside(canonicalRoot, canonicalChild)) {
      throw new Error(
        `Completed release evidence resolves outside the repository: ${normalizeRepositoryPath(
          relative(canonicalRoot, childPath)
        )}`
      );
    }
    return collectWorkingEvidenceFiles(canonicalRoot, canonicalChild);
  });
}

function collectHeadEvidenceFiles(canonicalRoot: string) {
  const result = spawnSync(
    "git",
    ["ls-tree", "-r", "--name-only", "-z", "HEAD"],
    { cwd: canonicalRoot, encoding: "utf8" }
  );
  if (result.status !== 0) {
    throw new Error("Unable to inspect completed release evidence at HEAD.");
  }
  return result.stdout
    .split("\0")
    .filter(Boolean)
    .map(normalizeRepositoryPath)
    .toSorted();
}

function normalizeRepositoryPath(path: string) {
  return path.replaceAll("\\", "/");
}

function isInside(root: string, candidate: string) {
  const pathFromRoot = relative(root, candidate);
  return (
    pathFromRoot === "" ||
    (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot))
  );
}
