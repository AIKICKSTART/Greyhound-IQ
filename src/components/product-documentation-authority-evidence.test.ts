import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  PRODUCT_DOCUMENTATION_AUTHORITIES,
  PRODUCT_DOCUMENTATION_AUTHORITY_EVIDENCE_FILE,
  PRODUCT_DOCUMENTATION_AUTHORITY_EXPECTED_GAIN,
  PRODUCT_DOCUMENTATION_AUTHORITY_MASTER_EVIDENCE,
  PRODUCT_DOCUMENTATION_AUTHORITY_REQUIREMENT_IDS,
  PRODUCT_DOCUMENTATION_AUTHORITY_SCOPE,
  PRODUCT_DOCUMENTATION_AUTHORITY_TEST_FILE,
} from "./product-documentation-authority-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

const completedIds = [...PRODUCT_DOCUMENTATION_AUTHORITY_REQUIREMENT_IDS];
assert.deepEqual(completedIds, ["DOC.PATH.parity", "DOC.PATH.no-duplicate"]);
assert.equal(PRODUCT_DOCUMENTATION_AUTHORITY_EXPECTED_GAIN, 2);
assert.deepEqual(
  Object.keys(PRODUCT_DOCUMENTATION_AUTHORITY_MASTER_EVIDENCE),
  completedIds,
);

const documentationRequirements = PRODUCT_MASTER_REQUIREMENTS.filter(
  ({ section }) => section === "documentation.recommended-paths",
);
assert.equal(documentationRequirements.length, 11);
assert.deepEqual(
  PRODUCT_DOCUMENTATION_AUTHORITIES.map(([requirementId]) => requirementId),
  documentationRequirements
    .filter(({ id }) => id !== "DOC.PATH.no-duplicate")
    .map(({ id }) => id),
  "Every path-owning documentation requirement must have one canonical owner",
);

const canonicalPaths = PRODUCT_DOCUMENTATION_AUTHORITIES.map(([, path]) => path);
assert.equal(new Set(canonicalPaths).size, canonicalPaths.length);
for (const canonicalPath of canonicalPaths) {
  assert.equal(existsSync(canonicalPath), true, canonicalPath);
  assert.match(readFileSync(canonicalPath, "utf8"), /^# /);
}

for (const requirementId of completedIds) {
  const record = PRODUCT_DOCUMENTATION_AUTHORITY_MASTER_EVIDENCE[requirementId];
  assert.equal(record.status, "tested");
  assert.deepEqual(record.evidence.slice(0, 2), [
    PRODUCT_DOCUMENTATION_AUTHORITY_EVIDENCE_FILE,
    PRODUCT_DOCUMENTATION_AUTHORITY_TEST_FILE,
  ]);
  assert.equal(new Set(record.evidence).size, record.evidence.length);
  for (const evidencePath of record.evidence) {
    assert.equal(existsSync(evidencePath), true, evidencePath);
  }
}

const authoritySource = readFileSync(
  "docs/product/documentation-authority.md",
  "utf8",
);
for (const [requirementId, canonicalPath] of PRODUCT_DOCUMENTATION_AUTHORITIES) {
  assert.ok(authoritySource.includes(`\`${requirementId}\``), requirementId);
  const filename = canonicalPath.split("/").at(-1);
  assert.ok(filename && authoritySource.includes(`(${filename})`), canonicalPath);
}
assert.match(authoritySource, /one canonical Markdown owner/i);
assert.match(authoritySource, /link to it.*instead of copying its tables/i);
assert.match(authoritySource, /historical observation must not be rewritten as a current runtime claim/i);
assert.match(authoritySource, /does not prove.*production-ready/i);

const paritySource = readFileSync("docs/product/production-parity.md", "utf8");
assert.match(paritySource, /Crawl date: 2026-07-13 AEST/);
assert.match(paritySource, /Canonical owner:.*documentation-authority\.md/);
assert.match(paritySource, /Ten routes registered, including the stored `\/meetings\/\[id\]` detail resource/);
assert.match(paritySource, /Local changes after the dated crawl/);
assert.match(paritySource, /local source and pure-helper evidence only/i);
assert.match(paritySource, /does not mean the route is deployed/i);

const finalReport = readFileSync("docs/product/final-audit-report.md", "utf8");
assert.match(
  finalReport,
  /\[Product-audit documentation authority\]\(documentation-authority\.md\)/,
);

const evidenceSource = readFileSync(
  PRODUCT_DOCUMENTATION_AUTHORITY_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);
assert.match(PRODUCT_DOCUMENTATION_AUTHORITY_SCOPE, /dated production crawl remains distinct/i);
assert.match(PRODUCT_DOCUMENTATION_AUTHORITY_SCOPE, /one unique canonical Markdown owner/i);
assert.match(PRODUCT_DOCUMENTATION_AUTHORITY_SCOPE, /does not prove.*historical production crawl is current/i);
assert.match(PRODUCT_DOCUMENTATION_AUTHORITY_SCOPE, /production-ready/i);

console.log(
  "Product documentation authority evidence passed in isolation: parity has one dated canonical owner and the managed audit topics have unique owners; exact +2 central wiring is ready.",
);
