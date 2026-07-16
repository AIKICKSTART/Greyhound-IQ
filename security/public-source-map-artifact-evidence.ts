export const PUBLIC_SOURCE_MAP_ARTIFACT_REQUIREMENT_ID =
  "security.browser-data-handling.public-source-maps";

export type PublicArtifactFile = Readonly<{
  path: string;
  source?: string;
}>;

export type PublicSourceMapArtifactInput = Readonly<{
  buildId: string;
  nextConfigSource: string;
  resolvedProductionBrowserSourceMaps: unknown;
  publicRoots: readonly string[];
  files: readonly PublicArtifactFile[];
}>;

const PUBLIC_ASSET_ROOTS = [
  ".next/static",
  ".next/standalone/public",
] as const;
const MAP_DIRECTIVE =
  /(?:^|\r?\n)[\t ]*(?:\/\/[#@]|\/\*[#@])[\t ]*sourceMappingURL\s*=/u;

export const PUBLIC_SOURCE_MAP_ARTIFACT_SCOPE =
  "Local production-artifact proof for the exact .next candidate identified by BUILD_ID. It scans every file beneath the generated browser-static root and the standalone public root, rejects public .map files and active JavaScript/CSS sourceMappingURL directives, and requires both source config and resolved production config to keep productionBrowserSourceMaps disabled. This verifies only the current local production candidate; it does not claim server-internal map absence, deployed artifact parity, immutable commit/image binding, CDN behavior, or production readiness.";

export const PUBLIC_SOURCE_MAP_ARTIFACT_MASTER_EVIDENCE = {
  [PUBLIC_SOURCE_MAP_ARTIFACT_REQUIREMENT_ID]: {
    status: "verified" as const,
    evidence: [
      "next.config.ts",
      ".next/BUILD_ID",
      ".next/required-server-files.json",
      ".next/static",
      ".next/standalone/public",
      "security/public-source-map-artifact-evidence.ts",
      "security/public-source-map-artifact-evidence.test.ts",
    ],
  },
};

export function auditPublicSourceMapArtifact(
  input: PublicSourceMapArtifactInput,
) {
  const issues: string[] = [];
  const buildId = input.buildId.trim();
  const roots = input.publicRoots.map(normalizePath);
  const files = input.files.map(({ path, source }) => ({
    path: normalizePath(path),
    source,
  }));

  if (!/^[A-Za-z0-9_-]{8,128}$/u.test(buildId)) {
    issues.push("PUBLIC_SOURCE_MAP_BUILD_ID_INVALID");
  }
  if (/productionBrowserSourceMaps\s*:\s*true/u.test(input.nextConfigSource)) {
    issues.push("PUBLIC_SOURCE_MAP_SOURCE_CONFIG_ENABLED");
  }
  if (input.resolvedProductionBrowserSourceMaps !== false) {
    issues.push("PUBLIC_SOURCE_MAP_RESOLVED_CONFIG_NOT_DISABLED");
  }
  if (roots.length === 0) {
    issues.push("PUBLIC_SOURCE_MAP_ROOT_INVENTORY_VACUOUS");
  }
  if (new Set(roots).size !== roots.length) {
    issues.push("PUBLIC_SOURCE_MAP_ROOT_DUPLICATE");
  }
  for (const requiredRoot of PUBLIC_ASSET_ROOTS) {
    if (!roots.includes(requiredRoot)) {
      issues.push(`PUBLIC_SOURCE_MAP_REQUIRED_ROOT_MISSING:${requiredRoot}`);
    }
  }
  for (const root of roots) {
    if (!(PUBLIC_ASSET_ROOTS as readonly string[]).includes(root)) {
      issues.push(`PUBLIC_SOURCE_MAP_ROOT_UNREVIEWED:${root}`);
    }
  }
  if (files.length === 0) {
    issues.push("PUBLIC_SOURCE_MAP_FILE_INVENTORY_VACUOUS");
  }
  const paths = files.map(({ path }) => path);
  if (new Set(paths).size !== paths.length) {
    issues.push("PUBLIC_SOURCE_MAP_FILE_DUPLICATE");
  }

  for (const file of files) {
    if (!roots.some((root) => file.path.startsWith(`${root}/`))) {
      issues.push(`PUBLIC_SOURCE_MAP_FILE_OUTSIDE_ROOT:${file.path}`);
    }
    if (/\.map$/iu.test(file.path)) {
      issues.push(`PUBLIC_SOURCE_MAP_FILE_EXPOSED:${file.path}`);
    }
    if (/\.(?:css|js|mjs)$/iu.test(file.path)) {
      if (file.source === undefined) {
        issues.push(`PUBLIC_SOURCE_MAP_TEXT_MISSING:${file.path}`);
      } else if (MAP_DIRECTIVE.test(file.source)) {
        issues.push(`PUBLIC_SOURCE_MAP_DIRECTIVE_EXPOSED:${file.path}`);
      }
    }
  }

  for (const root of PUBLIC_ASSET_ROOTS) {
    if (!files.some(({ path }) => path.startsWith(`${root}/`))) {
      issues.push(`PUBLIC_SOURCE_MAP_ROOT_EMPTY:${root}`);
    }
  }

  return issues;
}

function normalizePath(path: string) {
  return path.replaceAll("\\", "/").replace(/\/+$/u, "");
}
