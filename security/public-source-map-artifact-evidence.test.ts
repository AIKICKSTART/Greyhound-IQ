import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  auditPublicSourceMapArtifact,
  PUBLIC_SOURCE_MAP_ARTIFACT_MASTER_EVIDENCE,
  PUBLIC_SOURCE_MAP_ARTIFACT_REQUIREMENT_ID,
  PUBLIC_SOURCE_MAP_ARTIFACT_SCOPE,
  type PublicSourceMapArtifactInput,
} from "./public-source-map-artifact-evidence";

const publicRoots = [
  ".next/static",
  ".next/standalone/public",
] as const;
for (const root of publicRoots) {
  assert.ok(existsSync(root), `production public artifact root missing: ${root}`);
}
const requiredServerFiles = JSON.parse(
  readFileSync(".next/required-server-files.json", "utf8"),
) as { config?: { productionBrowserSourceMaps?: unknown } };
const current: PublicSourceMapArtifactInput = {
  buildId: readFileSync(".next/BUILD_ID", "utf8"),
  nextConfigSource: readFileSync("next.config.ts", "utf8"),
  resolvedProductionBrowserSourceMaps:
    requiredServerFiles.config?.productionBrowserSourceMaps,
  publicRoots,
  files: publicRoots.flatMap(collectArtifactFiles),
};

assert.deepEqual(auditPublicSourceMapArtifact(current), []);
assert.ok(current.files.length > 200);
assert.ok(
  current.files.filter(({ path }) => /\.(?:css|js|mjs)$/u.test(path)).length >
    40,
);
assert.equal(current.files.filter(({ path }) => path.endsWith(".map")).length, 0);
assert.equal(current.resolvedProductionBrowserSourceMaps, false);

const requirement = SECURITY_MASTER_REQUIREMENTS.find(
  ({ id }) => id === PUBLIC_SOURCE_MAP_ARTIFACT_REQUIREMENT_ID,
);
assert.equal(
  requirement?.requirement,
  "Verify sensitive data is not stored unnecessarily in public source maps.",
);
const evidence =
  PUBLIC_SOURCE_MAP_ARTIFACT_MASTER_EVIDENCE[
    PUBLIC_SOURCE_MAP_ARTIFACT_REQUIREMENT_ID
  ];
assert.equal(evidence.status, "verified");
for (const path of evidence.evidence) {
  assert.ok(existsSync(path), `missing public source-map evidence: ${path}`);
}
assert.match(PUBLIC_SOURCE_MAP_ARTIFACT_SCOPE, /exact \.next candidate identified by BUILD_ID/i);
assert.match(PUBLIC_SOURCE_MAP_ARTIFACT_SCOPE, /every file beneath the generated browser-static root/i);
assert.match(PUBLIC_SOURCE_MAP_ARTIFACT_SCOPE, /sourceMappingURL directives/i);
assert.match(PUBLIC_SOURCE_MAP_ARTIFACT_SCOPE, /current local production candidate/i);
assert.match(PUBLIC_SOURCE_MAP_ARTIFACT_SCOPE, /does not claim server-internal map absence/i);
assert.match(PUBLIC_SOURCE_MAP_ARTIFACT_SCOPE, /deployed artifact parity/i);
assert.match(PUBLIC_SOURCE_MAP_ARTIFACT_SCOPE, /production readiness/i);

const fixture: PublicSourceMapArtifactInput = {
  buildId: "fixture-build-id",
  nextConfigSource: "export default {};",
  resolvedProductionBrowserSourceMaps: false,
  publicRoots,
  files: [
    {
      path: ".next/static/chunks/app.js",
      source: 'const embedded = "//# sourceMappingURL=not-a-directive.map";',
    },
    {
      path: ".next/standalone/public/index.html",
      source: "<!doctype html>",
    },
  ],
};
assert.deepEqual(auditPublicSourceMapArtifact(fixture), []);
assertIssue(
  { ...fixture, buildId: "" },
  "PUBLIC_SOURCE_MAP_BUILD_ID_INVALID",
);
assertIssue(
  {
    ...fixture,
    nextConfigSource: "export default { productionBrowserSourceMaps: true };",
  },
  "PUBLIC_SOURCE_MAP_SOURCE_CONFIG_ENABLED",
);
assertIssue(
  { ...fixture, resolvedProductionBrowserSourceMaps: undefined },
  "PUBLIC_SOURCE_MAP_RESOLVED_CONFIG_NOT_DISABLED",
);
assertIssue(
  { ...fixture, publicRoots: [] },
  "PUBLIC_SOURCE_MAP_ROOT_INVENTORY_VACUOUS",
);
assertIssue(
  { ...fixture, publicRoots: [publicRoots[0]] },
  "PUBLIC_SOURCE_MAP_REQUIRED_ROOT_MISSING",
);
assertIssue(
  {
    ...fixture,
    publicRoots: [...publicRoots, ".next/server"],
  },
  "PUBLIC_SOURCE_MAP_ROOT_UNREVIEWED",
);
assertIssue(
  { ...fixture, files: [] },
  "PUBLIC_SOURCE_MAP_FILE_INVENTORY_VACUOUS",
);
assertIssue(
  { ...fixture, files: [fixture.files[0], fixture.files[0], fixture.files[1]] },
  "PUBLIC_SOURCE_MAP_FILE_DUPLICATE",
);
assertIssue(
  {
    ...fixture,
    files: [
      ...fixture.files,
      { path: ".next/static/chunks/app.js.map", source: "{}" },
    ],
  },
  "PUBLIC_SOURCE_MAP_FILE_EXPOSED",
);
assertIssue(
  {
    ...fixture,
    files: [
      {
        path: fixture.files[0].path,
        source: "const value = true;\n//# sourceMappingURL=app.js.map",
      },
      fixture.files[1],
    ],
  },
  "PUBLIC_SOURCE_MAP_DIRECTIVE_EXPOSED",
);
assertIssue(
  {
    ...fixture,
    files: [
      { path: fixture.files[0].path },
      fixture.files[1],
    ],
  },
  "PUBLIC_SOURCE_MAP_TEXT_MISSING",
);
assertIssue(
  {
    ...fixture,
    files: [
      ...fixture.files,
      { path: ".next/server/private.js", source: "const value = true;" },
    ],
  },
  "PUBLIC_SOURCE_MAP_FILE_OUTSIDE_ROOT",
);

console.log(
  `Public source-map artifact evidence passed: BUILD_ID ${current.buildId.trim()} exposes ${current.files.length} public artifact files across 2 roots, with zero .map files or active sourceMappingURL directives and resolved browser source maps disabled.`,
);

function collectArtifactFiles(root: string) {
  return walk(root).map((path) => ({
    path: path.replaceAll("\\", "/"),
    ...(/\.(?:css|js|mjs)$/u.test(path)
      ? { source: readFileSync(path, "utf8") }
      : {}),
  }));
}

function walk(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function assertIssue(input: PublicSourceMapArtifactInput, expected: string) {
  const issues = auditPublicSourceMapArtifact(input);
  assert.ok(
    issues.some((issue) => issue.startsWith(expected)),
    `${expected}: ${issues.join(" | ")}`,
  );
}
