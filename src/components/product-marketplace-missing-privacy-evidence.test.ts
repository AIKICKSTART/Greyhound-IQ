import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCT_MARKETPLACE_MISSING_PRIVACY_EVIDENCE_FILE,
  PRODUCT_MARKETPLACE_MISSING_PRIVACY_EXPECTED_GAIN,
  PRODUCT_MARKETPLACE_MISSING_PRIVACY_MASTER_EVIDENCE,
  PRODUCT_MARKETPLACE_MISSING_PRIVACY_REQUIREMENT_IDS,
  PRODUCT_MARKETPLACE_MISSING_PRIVACY_SCOPE,
  PRODUCT_MARKETPLACE_MISSING_PRIVACY_TEST_FILE,
} from "./product-marketplace-missing-privacy-evidence";

// screen-evidence-test-id: PRODUCT-MARKETPLACE-MISSING-PRIVACY

const REQUIREMENT_ID = "ROUTE.MARKET.safe-missing" as const;
const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
  ({ id }) => id === REQUIREMENT_ID,
);
assert.ok(requirement);
assert.equal(
  requirement.requirement,
  "Do not leak private information for missing sellers or listings.",
);
assert.deepEqual(PRODUCT_MARKETPLACE_MISSING_PRIVACY_REQUIREMENT_IDS, [
  REQUIREMENT_ID,
]);
assert.equal(PRODUCT_MARKETPLACE_MISSING_PRIVACY_EXPECTED_GAIN, 1);
assert.deepEqual(
  Object.keys(PRODUCT_MARKETPLACE_MISSING_PRIVACY_MASTER_EVIDENCE),
  [REQUIREMENT_ID],
);

const evidence =
  PRODUCT_MARKETPLACE_MISSING_PRIVACY_MASTER_EVIDENCE[REQUIREMENT_ID];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_MARKETPLACE_MISSING_PRIVACY_EVIDENCE_FILE,
  PRODUCT_MARKETPLACE_MISSING_PRIVACY_TEST_FILE,
]);
assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
evidence.evidence.forEach((evidencePath) =>
  assert.equal(existsSync(evidencePath), true, evidencePath),
);

assert.match(PRODUCT_MARKETPLACE_MISSING_PRIVACY_SCOPE, /source-static/i);
assert.match(PRODUCT_MARKETPLACE_MISSING_PRIVACY_SCOPE, /same listing\.not_found result/i);
assert.match(PRODUCT_MARKETPLACE_MISSING_PRIVACY_SCOPE, /does not prove deployed database RLS/i);
assert.match(PRODUCT_MARKETPLACE_MISSING_PRIVACY_SCOPE, /cross-account runtime denial/i);
assert.match(PRODUCT_MARKETPLACE_MISSING_PRIVACY_SCOPE, /every marketplace privacy path/i);

const serviceSource = source("src/lib/listing-service.ts");
const viewerLookup = functionSource(serviceSource, "getListingForViewerById");
assertInOrder(viewerLookup, [
  "tx.listing.findUnique",
  'if (!listing) throw new Error("listing.not_found")',
  "if (listingIsPublic(listing))",
  "current?.profileId === listing.profileId || isModeratorRole(current?.role)",
  'if (!canView) throw new Error("listing.not_found")',
  "return listing",
]);
assert.equal(
  viewerLookup.split('throw new Error("listing.not_found")').length - 1,
  2,
);
assert.doesNotMatch(viewerLookup, /auth\.forbidden|private_listing|seller_not_found/);

const publicLookup = functionSource(serviceSource, "getPublicListingById");
assertInOrder(publicLookup, [
  "tx.listing.findUnique",
  "if (!listing || !listingIsPublic(listing))",
  'throw new Error("listing.not_found")',
  "return listing",
]);
assert.doesNotMatch(publicLookup, /auth\.forbidden|private_listing|seller_not_found/);

const detailSource = source("src/app/listings/[id]/page.tsx");
const detailPage = functionSource(detailSource, "ListingDetailPage");
assertInOrder(detailPage, [
  "getListingForViewerById(id, user)",
  "catch",
  "notFound()",
  "const isOwner = user?.profileId === listing.profileId",
  "listing.profile.displayName",
]);
assert.equal(detailPage.split("listing.profile.displayName").length - 1, 1);
assert.doesNotMatch(
  detailPage.slice(0, detailPage.indexOf("notFound()") + "notFound()".length),
  /listing\.profile\.(?:displayName|kennelName|state|verified)/,
);
assert.doesNotMatch(
  detailPage,
  /href=\{?`?\/(?:seller|profile)s?\/\$\{listing\.profile/,
);

const marketplaceAlias = source("src/app/marketplace/[id]/page.tsx");
assert.match(
  marketplaceAlias,
  /import ListingDetailPage,[\s\S]*from "\.\.\/\.\.\/listings\/\[id\]\/page"/,
);
assert.match(marketplaceAlias, /export default ListingDetailPage/);
assert.doesNotMatch(marketplaceAlias, /listing\.profile|findUnique|findFirst/);

const apiGet = exportedFunctionSource(
  source("src/app/api/listings/[id]/route.ts"),
  "GET",
);
assertInOrder(apiGet, [
  "const { id } = await params",
  "getPublicListingById(id)",
  "NextResponse.json({ item: listing })",
]);

const evidenceSource = source(PRODUCT_MARKETPLACE_MISSING_PRIVACY_EVIDENCE_FILE);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);

console.log(
  "Marketplace missing/privacy evidence passed in isolation: missing and unauthorized listings share one not-found result before seller data renders across both public aliases; exact +1 central wiring is ready.",
);

function source(file: string) {
  return readFileSync(file, "utf8");
}

function functionSource(value: string, name: string) {
  const sourceFile = ts.createSourceFile(
    "source.tsx",
    value,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const declaration = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  assert.ok(declaration, `Missing function ${name}`);
  return declaration.getText(sourceFile);
}

function exportedFunctionSource(value: string, name: string) {
  const sourceFile = ts.createSourceFile(
    "route.ts",
    value,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const declaration = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === name &&
      statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      ) === true,
  );
  assert.ok(declaration, `Missing exported function ${name}`);
  return declaration.getText(sourceFile);
}

function assertInOrder(value: string, expected: readonly string[]) {
  let cursor = -1;
  for (const token of expected) {
    const next = value.indexOf(token, cursor + 1);
    assert.ok(next > cursor, `Expected ordered token: ${token}`);
    cursor = next;
  }
}
