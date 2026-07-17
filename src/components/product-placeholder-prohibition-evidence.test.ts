import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "./master-audit-requirements";
import { PRODUCT_MASTER_EVIDENCE } from "./master-audit-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCT_PLACEHOLDER_PROHIBITION_EVIDENCE_FILE,
  PRODUCT_PLACEHOLDER_PROHIBITION_EVIDENCE_SCOPE,
  PRODUCT_PLACEHOLDER_PROHIBITION_EXPECTED_GAIN,
  PRODUCT_PLACEHOLDER_PROHIBITION_MASTER_EVIDENCE,
  PRODUCT_PLACEHOLDER_PROHIBITION_OPEN_GAPS,
  PRODUCT_PLACEHOLDER_PROHIBITION_OPEN_REQUIREMENT_IDS,
  PRODUCT_PLACEHOLDER_PROHIBITION_REQUIREMENT_IDS,
  PRODUCT_PLACEHOLDER_PROHIBITION_TEST_FILE,
  type ProductPlaceholderProhibitionRequirementId,
} from "./product-placeholder-prohibition-evidence";

const PHRASES = {
  "COMPLETE.NO_PLACEHOLDER.add-later": "Add later",
  "COMPLETE.NO_PLACEHOLDER.todo": "TODO",
  "COMPLETE.NO_PLACEHOLDER.coming-soon": "Coming soon",
  "COMPLETE.NO_PLACEHOLDER.mock-this": "Mock this",
  "COMPLETE.NO_PLACEHOLDER.handle-errors": "Handle errors",
  "COMPLETE.NO_PLACEHOLDER.support-mobile": "Support mobile",
  "COMPLETE.NO_PLACEHOLDER.add-accessibility": "Add accessibility",
} as const satisfies Readonly<
  Record<ProductPlaceholderProhibitionRequirementId, string>
>;

const EXCLUDED_PROMPT_AND_EVIDENCE_FILES = new Set([
  "src/components/product-master-requirements.ts",
  "src/components/security-master-requirements.ts",
  PRODUCT_PLACEHOLDER_PROHIBITION_EVIDENCE_FILE,
  PRODUCT_PLACEHOLDER_PROHIBITION_TEST_FILE,
]);
const RUNTIME_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);
const completedIds = [...PRODUCT_PLACEHOLDER_PROHIBITION_REQUIREMENT_IDS];
const intentionallyOpenIds = [
  ...PRODUCT_PLACEHOLDER_PROHIBITION_OPEN_REQUIREMENT_IDS,
];

assert.equal(completedIds.length, 7);
assert.equal(new Set(completedIds).size, completedIds.length);
assert.equal(intentionallyOpenIds.length, 1);
assert.equal(PRODUCT_PLACEHOLDER_PROHIBITION_EXPECTED_GAIN, 7);
assert.deepEqual(
  Object.keys(PRODUCT_PLACEHOLDER_PROHIBITION_MASTER_EVIDENCE),
  completedIds,
);

const sectionRequirements = PRODUCT_MASTER_REQUIREMENTS.filter(
  ({ section }) => section === "completion.prohibited-placeholders",
);
assert.equal(sectionRequirements.length, 8);
assert.deepEqual(
  [...completedIds, ...intentionallyOpenIds].toSorted(),
  sectionRequirements.map(({ id }) => id).toSorted(),
  "The tested phrases and named residuals must partition the immutable placeholder section",
);

for (const requirementId of completedIds) {
  const record = PRODUCT_PLACEHOLDER_PROHIBITION_MASTER_EVIDENCE[requirementId];
  assert.equal(record.status, "tested", requirementId);
  assert.deepEqual(record.evidence, [
    PRODUCT_PLACEHOLDER_PROHIBITION_EVIDENCE_FILE,
    PRODUCT_PLACEHOLDER_PROHIBITION_TEST_FILE,
  ]);
  for (const evidencePath of record.evidence) {
    assert.equal(existsSync(evidencePath), true, evidencePath);
  }
  assert.deepEqual(PRODUCT_MASTER_EVIDENCE[requirementId], record);
}

for (const requirementId of intentionallyOpenIds) {
  assert.equal(
    requirementId in PRODUCT_PLACEHOLDER_PROHIBITION_MASTER_EVIDENCE,
    false,
    `${requirementId} must remain open`,
  );
  assert.ok(
    PRODUCT_PLACEHOLDER_PROHIBITION_OPEN_GAPS[requirementId].length > 150,
    `${requirementId} needs a precise residual-gap explanation`,
  );
}
assert.match(
  PRODUCT_PLACEHOLDER_PROHIBITION_OPEN_GAPS[
    "COMPLETE.NO_PLACEHOLDER.explicit-exclusion"
  ],
  /no exhaustive, reviewed record/i,
);

const evidenceSource = readFileSync(
  PRODUCT_PLACEHOLDER_PROHIBITION_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);
assert.match(PRODUCT_PLACEHOLDER_PROHIBITION_EVIDENCE_SCOPE, /Source-static absence/i);
assert.match(PRODUCT_PLACEHOLDER_PROHIBITION_EVIDENCE_SCOPE, /does not prove/i);
assert.match(PRODUCT_PLACEHOLDER_PROHIBITION_EVIDENCE_SCOPE, /production-ready/i);

for (const [requirementId, phrase] of Object.entries(PHRASES)) {
  const requirement = sectionRequirements.find(({ id }) => id === requirementId);
  assert.ok(requirement, requirementId);
  assert.match(requirement.requirement, new RegExp(escapeRegExp(phrase), "i"));
}

const scannedFiles = walkFiles("src")
  .map(toRepoPath)
  .filter(isRuntimeSource)
  .filter((file) => !EXCLUDED_PROMPT_AND_EVIDENCE_FILES.has(file))
  .toSorted();
assert.ok(scannedFiles.length > 300);

const violations: string[] = [];
for (const file of scannedFiles) {
  const source = readFileSync(file, "utf8");
  for (const [requirementId, phrase] of Object.entries(PHRASES)) {
    for (const [index, line] of source.split(/\r?\n/).entries()) {
      if (isPlaceholderDirective(line, phrase)) {
        violations.push(`${requirementId}:${file}:${index + 1}`);
      }
    }
  }
}
assert.deepEqual(
  violations,
  [],
  `Generic product placeholders remain:\n${violations.join("\n")}`,
);

for (const phrase of Object.values(PHRASES)) {
  assert.equal(isPlaceholderDirective(`const copy = "${phrase}";`, phrase), true);
  assert.equal(isPlaceholderDirective(`<p>${phrase}</p>`, phrase), true);
  assert.equal(isPlaceholderDirective(`// ${phrase}`, phrase), true);
  if (phrase !== "TODO") {
    assert.equal(
      isPlaceholderDirective(`${phrase} with an exact implementation`, phrase),
      false,
    );
  }
}
assert.equal(isPlaceholderDirective("// TODO: implement this", "TODO"), true);

const siteContentSource = readFileSync("src/lib/site-content.ts", "utf8");
assert.match(siteContentSource, /PROHIBITED_PLACEHOLDER_COPY/);
assert.match(siteContentSource, /safeEditableText\(raw\.description/);
assert.match(siteContentSource, /safeEditableText\(raw\.cta/);
assert.match(siteContentSource, /safeEditableTextList\(raw\.features/);
assert.match(siteContentSource, /safeEditableTextList\(raw\.notIncluded/);
assert.match(siteContentSource, /safeEditableText\(\s*raw\.yearlyNote/);

const selectedIdSet = new Set<string>(completedIds);
const currentCompleted = MASTER_AUDIT_REQUIREMENTS.filter(
  isMasterRequirementComplete,
).length;
const withoutThisBatch = MASTER_AUDIT_REQUIREMENTS.map((requirement) =>
  selectedIdSet.has(requirement.id)
    ? { ...requirement, status: "not-started", evidence: [] }
    : requirement,
).filter(isMasterRequirementComplete).length;
assert.equal(
  currentCompleted - withoutThisBatch,
  PRODUCT_PLACEHOLDER_PROHIBITION_EXPECTED_GAIN,
  "This isolated evidence batch must add exactly seven completed requirements",
);

console.log(
  `Product placeholder prohibition passed: 7 exact directives absent across ${scannedFiles.length} runtime source files; 1 truthful gap remains open.`,
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

function isRuntimeSource(file: string) {
  if (!RUNTIME_EXTENSIONS.has(path.extname(file))) return false;
  return !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file);
}

function isPlaceholderDirective(line: string, phrase: string) {
  if (phrase === "TODO") return /\bTODO\b/i.test(line);
  const escaped = escapeRegExp(phrase);
  return (
    new RegExp(`["'\\x60]\\s*${escaped}[.!]?\\s*["'\\x60]`, "i").test(line) ||
    new RegExp(`>\\s*${escaped}[.!]?\\s*<`, "i").test(line) ||
    new RegExp(
      `^\\s*(?:(?://|#|--|/\\*+|\\*|<!--)\\s*)?${escaped}[.!]?\\s*(?:\\*/|-->)?\\s*$`,
      "i",
    ).test(line)
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
