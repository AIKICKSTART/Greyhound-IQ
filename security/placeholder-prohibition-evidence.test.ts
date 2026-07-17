import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import { DATABASE_OPERATIONS } from "./database-operations";
import { DATABASE_QUERY_RECORDS } from "./database-query-records";
import {
  GENERIC_SECURITY_PLACEHOLDER_EVIDENCE_SCOPE,
  GENERIC_SECURITY_PLACEHOLDER_EXPECTED_GAIN,
  GENERIC_SECURITY_PLACEHOLDER_MASTER_EVIDENCE,
  GENERIC_SECURITY_PLACEHOLDER_REQUIREMENT_IDS,
  OPEN_EXACT_CONTROL_REFERENCE_REQUIREMENT_IDS,
  SECURITY_CONTROL_REFERENCE_EXPECTED_GAIN,
  SECURITY_CONTROL_REFERENCE_REQUIREMENT_IDS,
} from "./placeholder-prohibition-evidence";
import { SECURITY_TRACES } from "./traces";

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
const completedRequirementIds = [
  ...GENERIC_SECURITY_PLACEHOLDER_REQUIREMENT_IDS,
  ...SECURITY_CONTROL_REFERENCE_REQUIREMENT_IDS,
];

assert.equal(GENERIC_SECURITY_PLACEHOLDER_EXPECTED_GAIN, 10);
assert.equal(SECURITY_CONTROL_REFERENCE_EXPECTED_GAIN, 9);
assert.equal(sectionRequirements.length, 19);
assert.deepEqual(
  [
    ...completedRequirementIds,
    ...OPEN_EXACT_CONTROL_REFERENCE_REQUIREMENT_IDS,
  ].toSorted(),
  sectionIds.toSorted(),
  "the +10 batch and nine residuals must partition the immutable section",
);
assert.deepEqual(
  Object.keys(GENERIC_SECURITY_PLACEHOLDER_MASTER_EVIDENCE),
  completedRequirementIds,
  "only generic placeholder absence and exhaustive named-reference proof may receive this evidence",
);
assert.match(GENERIC_SECURITY_PLACEHOLDER_EVIDENCE_SCOPE, /Source-static/);
assert.match(GENERIC_SECURITY_PLACEHOLDER_EVIDENCE_SCOPE, /does not verify/);

for (const requirementId of completedRequirementIds) {
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

assert.ok(SECURITY_TRACES.length > 0, "canonical trace registry must not be empty");
assert.ok(DATABASE_OPERATIONS.length > 0, "database control registry must not be empty");

const tracesById = new Map(SECURITY_TRACES.map((trace) => [trace.traceId, trace]));
for (const trace of SECURITY_TRACES) {
  assertNamed(trace.traceId, "policy", trace.server.authorizationPolicy);
  assertNamed(trace.traceId, "owner", trace.owner);
  assert.ok(trace.server.entryFiles.length > 0, `${trace.traceId}: server file missing`);
  assert.ok(trace.server.handlers.length > 0, `${trace.traceId}: handler missing`);
  assert.ok(trace.tests.length > 0, `${trace.traceId}: test missing`);
  assert.ok(trace.evidence.length > 0, `${trace.traceId}: evidence missing`);
  for (const sourceFile of [...trace.server.entryFiles, ...trace.tests]) {
    assertExactFile(trace.traceId, sourceFile);
  }
  for (const handler of trace.server.handlers) {
    assertNamed(trace.traceId, "function", handler);
  }
  for (const evidence of trace.evidence) {
    assertEvidence(trace.traceId, evidence);
  }
  assertExactSchema(trace.traceId, "request", trace.server.requestValidationSchema);
  assertExactSchema(trace.traceId, "output", trace.server.outputSchema);
  assertExactSchema(trace.traceId, "response", trace.response.responseSchema);
  for (const operation of trace.backgroundOperations) {
    assertExactSchema(trace.traceId, "background payload", operation.payloadSchema);
  }
  for (const operation of trace.externalOperations) {
    assertExactSchema(trace.traceId, "external request", operation.requestSchema);
    assertExactSchema(trace.traceId, "external response", operation.responseSchema);
  }
}

for (const operation of DATABASE_OPERATIONS) {
  const trace = tracesById.get(operation.traceId);
  assert.ok(trace, `${operation.queryId}: linked trace missing`);
  assertExactFile(operation.queryId, operation.sourceFile);
  assertNamed(operation.queryId, "function", operation.sourceSymbol);
  assertExactSchema(operation.queryId, "database", operation.schemaName);
  assertNamed(operation.queryId, "database role", operation.databaseRole);
  assert.ok(operation.tests.length > 0, `${operation.queryId}: test missing`);
  assert.ok(operation.evidence.length > 0, `${operation.queryId}: evidence missing`);
  for (const testFile of operation.tests) {
    assertExactFile(operation.queryId, testFile);
  }
  for (const evidence of operation.evidence) {
    assertEvidence(operation.queryId, evidence);
  }
}

assert.equal(DATABASE_QUERY_RECORDS.length, DATABASE_OPERATIONS.length);
assert.deepEqual(
  DATABASE_QUERY_RECORDS
    .filter((record) => record.normalisedSql.length === 0)
    .map((record) => record.queryId),
  [],
  "every canonical database operation requires a captured normalized SQL statement",
);

const designLabTrace = tracesById.get("DESIGN_LAB.SCREEN.REVIEW");
assert.ok(designLabTrace);
assert.match(designLabTrace.server.requestValidationSchema, /DesignLabSearchParams/);
assert.match(
  readFileSync("src/app/design-lab/page.tsx", "utf8"),
  /type DesignLabSearchParams = \{\s*area\?: string \| string\[\];\s*route\?: string \| string\[\];\s*\}/,
);
assert.match(readFileSync("src/app/design-lab/page.tsx", "utf8"), /resolveDesignLabArea\(query\.area\)/);

const authkitTrace = tracesById.get("AUTH.CALLBACK.COMPLETE");
assert.ok(authkitTrace);
assert.match(authkitTrace.server.requestValidationSchema, /StateSchema/);
assert.match(authkitTrace.externalOperations[0]?.requestSchema ?? "", /code=<string>&state=<string>/);
assert.match(readFileSync("package-lock.json", "utf8"), /authkit-nextjs-4\.1\.4\.tgz/);
const authkitCallbackSource = readFileSync(
  "node_modules/@workos-inc/authkit-nextjs/src/authkit-callback-route.ts",
  "utf8",
);
assert.match(authkitCallbackSource, /searchParams\.get\('code'\)/);
assert.match(authkitCallbackSource, /searchParams\.get\('state'\)/);
assert.match(authkitCallbackSource, /if \(!code \|\| !state\)/);
assert.match(
  authkitCallbackSource,
  /const \{ accessToken, refreshToken, user, impersonator, oauthTokens, authenticationMethod, organizationId \} =\s*await getWorkOS\(\)\.userManagement\.authenticateWithCode\(/,
);
assert.match(
  readFileSync("node_modules/@workos-inc/authkit-nextjs/src/interfaces.ts", "utf8"),
  /export const StateSchema = v\.object\(\{\s*nonce: v\.string\(\),\s*customState: v\.optional\(v\.string\(\)\),\s*returnPathname: v\.optional\(v\.string\(\)\),\s*codeVerifier: v\.string\(\),\s*\}\)/,
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
  `Security placeholder evidence passed: ${completedRequirementIds.length}/19 requirements across ${scannedFiles.length} owned files, ${SECURITY_TRACES.length} canonical traces and ${DATABASE_OPERATIONS.length} database controls.`,
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

function assertExactFile(controlId: string, sourceFile: string) {
  assert.ok(!path.isAbsolute(sourceFile), `${controlId}: file must be repository-relative`);
  assert.ok(!sourceFile.startsWith("../"), `${controlId}: file must stay in repository`);
  assert.equal(existsSync(sourceFile), true, `${controlId}: file missing: ${sourceFile}`);
}

function assertNamed(controlId: string, field: string, value: string) {
  assert.ok(value.trim().length > 0, `${controlId}: ${field} missing`);
  assert.doesNotMatch(value, /\b(?:unknown|not verified|not captured)\b/i, `${controlId}: ${field} is not exact`);
}

function assertExactSchema(controlId: string, field: string, value: string) {
  assertNamed(controlId, `${field} schema`, value);
  assert.doesNotMatch(
    value,
    /\b(?:not applicable|missing|unverified|incomplete)\b/i,
    `${controlId}: ${field} schema is not exact`,
  );
}

function assertEvidence(controlId: string, value: string) {
  assert.ok(value.trim().length > 0, `${controlId}: evidence missing`);
}
