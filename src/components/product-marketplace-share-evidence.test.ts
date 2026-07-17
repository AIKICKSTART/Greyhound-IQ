import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

import {
  PRODUCT_MARKETPLACE_SHARE_EVIDENCE_FILE,
  PRODUCT_MARKETPLACE_SHARE_EXPECTED_GAIN,
  PRODUCT_MARKETPLACE_SHARE_MASTER_EVIDENCE,
  PRODUCT_MARKETPLACE_SHARE_REQUIREMENT_IDS,
  PRODUCT_MARKETPLACE_SHARE_SCOPE,
  PRODUCT_MARKETPLACE_SHARE_TEST_FILE,
} from "./product-marketplace-share-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-MARKETPLACE-SHARE

const REQUIREMENT_ID = "ROUTE.MARKET.share" as const;
const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
  ({ id }) => id === REQUIREMENT_ID,
);
assert.ok(requirement, REQUIREMENT_ID);
assert.equal(requirement.requirement, "Support sharing a listing.");
assert.deepEqual(PRODUCT_MARKETPLACE_SHARE_REQUIREMENT_IDS, [REQUIREMENT_ID]);
assert.equal(PRODUCT_MARKETPLACE_SHARE_EXPECTED_GAIN, 1);
assert.deepEqual(Object.keys(PRODUCT_MARKETPLACE_SHARE_MASTER_EVIDENCE), [
  REQUIREMENT_ID,
]);

const evidence = PRODUCT_MARKETPLACE_SHARE_MASTER_EVIDENCE[REQUIREMENT_ID];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_MARKETPLACE_SHARE_EVIDENCE_FILE,
  PRODUCT_MARKETPLACE_SHARE_TEST_FILE,
]);
assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
evidence.evidence.forEach((path) => assert.equal(existsSync(path), true, path));

assert.match(PRODUCT_MARKETPLACE_SHARE_SCOPE, /source and unit verification/i);
assert.match(PRODUCT_MARKETPLACE_SHARE_SCOPE, /native share sheet/i);
assert.match(PRODUCT_MARKETPLACE_SHARE_SCOPE, /explicit user cancellation/i);
assert.match(PRODUCT_MARKETPLACE_SHARE_SCOPE, /clipboard copy/i);
assert.match(PRODUCT_MARKETPLACE_SHARE_SCOPE, /does not prove hydrated behavior/i);

const detailPage = functionSource(
  source("src/app/listings/[id]/page.tsx"),
  "ListingDetailPage",
);
assert.equal(detailPage.split("<ListingShareButton").length - 1, 1);
assert.match(
  detailPage,
  /<ListingShareButton listingId=\{listing\.id\} title=\{listing\.title\} \/>/,
);
const aliasPage = source("src/app/marketplace/[id]/page.tsx");
assert.match(aliasPage, /from "\.\.\/\.\.\/listings\/\[id\]\/page"/);

const shareComponent = source("src/components/listing-share-button.tsx");
assert.equal(shareComponent.startsWith('"use client";'), true);
assert.match(
  shareComponent,
  /`\/marketplace\/\$\{encodeURIComponent\(listingId\)\}`/,
);
assert.match(shareComponent, /await adapter\.share\(\{ title, text: title, url \}\)/);
assert.match(shareComponent, /error\.name === "AbortError"/);
assert.match(shareComponent, /adapter\.clipboard\.writeText\(url\)/);
assert.match(shareComponent, /role="status" aria-live="polite"/);
assert.match(shareComponent, /Sharing is unavailable in this browser/);
assert.match(shareComponent, /disabled=\{status === "sharing"\}/);

const evidenceSource = source(PRODUCT_MARKETPLACE_SHARE_EVIDENCE_FILE);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);

console.log(
  "Marketplace share evidence passed in isolation: one detail control uses canonical same-origin URLs, native sharing, cancellation safety, clipboard fallback, and accessible status; exact +1 central wiring is ready.",
);

function source(path: string) {
  return readFileSync(path, "utf8");
}

function parse(value: string, kind = ts.ScriptKind.TS) {
  return ts.createSourceFile(
    "evidence.ts",
    value,
    ts.ScriptTarget.Latest,
    true,
    kind,
  );
}

function functionSource(value: string, name: string) {
  const sourceFile = parse(value, ts.ScriptKind.TSX);
  const match = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  assert.ok(match, `Missing function ${name}`);
  return match.getText(sourceFile);
}
