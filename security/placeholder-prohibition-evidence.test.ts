import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  GENERIC_SECURITY_PLACEHOLDER_EVIDENCE_SCOPE,
  GENERIC_SECURITY_PLACEHOLDER_EXPECTED_GAIN,
  GENERIC_SECURITY_PLACEHOLDER_MASTER_EVIDENCE,
  GENERIC_SECURITY_PLACEHOLDER_REQUIREMENT_IDS,
  OPEN_EXACT_CONTROL_REFERENCE_REQUIREMENT_IDS,
} from "./placeholder-prohibition-evidence";

const OWNED_SCAN_ROOTS = [
  ".github",
  "config",
  "docs",
  "infra",
  "prisma",
  "public",
  "scripts",
  "security",
  "src",
] as const;
const EXCLUDED_PROMPT_EXTRACTIONS = new Set([
  "src/components/product-master-requirements.ts",
  "src/components/product-placeholder-prohibition-evidence.test.ts",
  "src/components/security-master-requirements.ts",
]);
const SCANNED_EXTENSIONS = new Set([
  ".cjs",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".ps1",
  ".sh",
  ".sql",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

const sectionRequirements = SECURITY_MASTER_REQUIREMENTS.filter(
  (requirement) => requirement.section === "placeholder-prohibition",
);
const sectionIds = sectionRequirements.map(({ id }) => id);

assert.equal(GENERIC_SECURITY_PLACEHOLDER_EXPECTED_GAIN, 10);
assert.equal(sectionRequirements.length, 19);
assert.deepEqual(
  [
    ...GENERIC_SECURITY_PLACEHOLDER_REQUIREMENT_IDS,
    ...OPEN_EXACT_CONTROL_REFERENCE_REQUIREMENT_IDS,
  ].toSorted(),
  sectionIds.toSorted(),
  "the +10 batch and nine residuals must partition the immutable section",
);
assert.deepEqual(
  Object.keys(GENERIC_SECURITY_PLACEHOLDER_MASTER_EVIDENCE),
  [...GENERIC_SECURITY_PLACEHOLDER_REQUIREMENT_IDS],
  "only exact generic-placeholder absence may receive this evidence",
);
assert.match(GENERIC_SECURITY_PLACEHOLDER_EVIDENCE_SCOPE, /Source-static/);
assert.match(GENERIC_SECURITY_PLACEHOLDER_EVIDENCE_SCOPE, /does not verify/);

for (const requirementId of GENERIC_SECURITY_PLACEHOLDER_REQUIREMENT_IDS) {
  const record = GENERIC_SECURITY_PLACEHOLDER_MASTER_EVIDENCE[requirementId];
  assert.equal(record.status, "verified", requirementId);
  for (const evidencePath of record.evidence) {
    assert.equal(existsSync(evidencePath), true, `${requirementId}: ${evidencePath}`);
  }
}
for (const requirementId of OPEN_EXACT_CONTROL_REFERENCE_REQUIREMENT_IDS) {
  assert.equal(
    requirementId in GENERIC_SECURITY_PLACEHOLDER_MASTER_EVIDENCE,
    false,
    `${requirementId}: requires separate exhaustive control-reference proof`,
  );
}

const phrases = new Map(
  sectionRequirements
    .filter(({ id }) =>
      GENERIC_SECURITY_PLACEHOLDER_REQUIREMENT_IDS.some(
        (requirementId) => requirementId === id,
      ),
    )
    .map(({ id, requirement }) => {
      const phrase = /placeholder '([^']+)'\.$/.exec(requirement)?.[1];
      assert.ok(phrase, `${id}: immutable placeholder phrase is missing`);
      return [id, phrase] as const;
    }),
);
assert.equal(phrases.size, GENERIC_SECURITY_PLACEHOLDER_EXPECTED_GAIN);

const scannedFiles = [
  ...OWNED_SCAN_ROOTS.flatMap((root) => walkFiles(root)),
  ...readdirSync(".", { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name),
]
  .map(toRepoPath)
  .filter((file) => !EXCLUDED_PROMPT_EXTRACTIONS.has(file))
  .filter(isScannedFile)
  .toSorted();
assert.ok(scannedFiles.length > 0);

const violations: string[] = [];
for (const file of scannedFiles) {
  const source = readFileSync(file, "utf8");
  for (const [requirementId, phrase] of phrases) {
    for (const [index, line] of source.split(/\r?\n/).entries()) {
      if (isGenericPlaceholderDirective(line, phrase)) {
        violations.push(`${requirementId}:${file}:${index + 1}`);
      }
    }
  }
}
assert.deepEqual(
  violations,
  [],
  `generic security placeholders remain:\n${violations.join("\n")}`,
);

for (const phrase of phrases.values()) {
  assert.equal(isGenericPlaceholderDirective(phrase, phrase), true);
  assert.equal(isGenericPlaceholderDirective(`TODO: ${phrase}`, phrase), true);
  assert.equal(isGenericPlaceholderDirective(`const gap = "${phrase}";`, phrase), true);
  assert.equal(
    isGenericPlaceholderDirective(`${phrase} with an exact implementation`, phrase),
    false,
  );
}

console.log(
  `Generic security placeholder evidence passed: ${GENERIC_SECURITY_PLACEHOLDER_EXPECTED_GAIN}/19 requirements across ${scannedFiles.length} owned files; nine exact-reference requirements remain open`,
);

function walkFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(child) : [child];
  });
}

function toRepoPath(file: string) {
  return file.replaceAll("\\", "/").replace(/^\.\//, "");
}

function isScannedFile(file: string) {
  return path.basename(file) === "Dockerfile" || SCANNED_EXTENSIONS.has(path.extname(file));
}

function isGenericPlaceholderDirective(line: string, phrase: string) {
  const escaped = escapeRegExp(phrase);
  return (
    new RegExp(`[\"'\\x60]\\s*${escaped}\\s*[\"'\\x60]`, "i").test(line) ||
    new RegExp(
      `^\\s*(?:(?://|#|--|/\\*+|\\*|<!--)\\s*)?(?:(?:TODO|FIXME|PLACEHOLDER)\\s*:?\\s*)?${escaped}[.!]?\\s*(?:\\*/|-->)?\\s*$`,
      "i",
    ).test(line)
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
