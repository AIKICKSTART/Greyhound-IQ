import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCT_MARKETPLACE_ACCESS_SAFETY_EVIDENCE_FILE,
  PRODUCT_MARKETPLACE_ACCESS_SAFETY_EXPECTED_GAIN,
  PRODUCT_MARKETPLACE_ACCESS_SAFETY_MASTER_EVIDENCE,
  PRODUCT_MARKETPLACE_ACCESS_SAFETY_REQUIREMENT_IDS,
  PRODUCT_MARKETPLACE_ACCESS_SAFETY_SCOPE,
  PRODUCT_MARKETPLACE_ACCESS_SAFETY_TEST_FILE,
} from "./product-marketplace-access-safety-evidence";

// screen-evidence-test-id: PRODUCT-MARKETPLACE-ACCESS-SAFETY

const EXPECTED_REQUIREMENTS = {
  "ROUTE.MARKET.auth-ownership":
    "Enforce authentication and ownership for create, edit, save, and enquiry paths.",
  "ROUTE.MARKET.hide-seller-controls":
    "Do not show seller controls to unauthorised users.",
  "ROUTE.MARKET.no-get-mutation":
    "Do not trigger destructive mutations through a public GET request.",
} as const;

assert.deepEqual(
  PRODUCT_MARKETPLACE_ACCESS_SAFETY_REQUIREMENT_IDS,
  Object.keys(EXPECTED_REQUIREMENTS),
);
assert.equal(PRODUCT_MARKETPLACE_ACCESS_SAFETY_EXPECTED_GAIN, 3);
assert.deepEqual(
  Object.keys(PRODUCT_MARKETPLACE_ACCESS_SAFETY_MASTER_EVIDENCE),
  Object.keys(EXPECTED_REQUIREMENTS),
);

for (const [requirementId, requirementText] of Object.entries(
  EXPECTED_REQUIREMENTS,
)) {
  const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
    ({ id }) => id === requirementId,
  );
  assert.ok(requirement, requirementId);
  assert.equal(requirement.requirement, requirementText, requirementId);

  const evidence =
    PRODUCT_MARKETPLACE_ACCESS_SAFETY_MASTER_EVIDENCE[
      requirementId as keyof typeof EXPECTED_REQUIREMENTS
    ];
  assert.equal(evidence.status, "tested", requirementId);
  assert.deepEqual(evidence.evidence.slice(0, 2), [
    PRODUCT_MARKETPLACE_ACCESS_SAFETY_EVIDENCE_FILE,
    PRODUCT_MARKETPLACE_ACCESS_SAFETY_TEST_FILE,
  ]);
  assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
  evidence.evidence.forEach((evidencePath) =>
    assert.equal(existsSync(evidencePath), true, evidencePath),
  );
}

assert.match(PRODUCT_MARKETPLACE_ACCESS_SAFETY_SCOPE, /source-static/i);
assert.match(PRODUCT_MARKETPLACE_ACCESS_SAFETY_SCOPE, /create, edit, save and enquiry/i);
assert.match(PRODUCT_MARKETPLACE_ACCESS_SAFETY_SCOPE, /does not prove deployed identity/i);
assert.match(PRODUCT_MARKETPLACE_ACCESS_SAFETY_SCOPE, /database RLS/i);
assert.match(PRODUCT_MARKETPLACE_ACCESS_SAFETY_SCOPE, /hydrated browser behavior/i);

const createRoute = source("src/app/api/listings/route.ts");
const updateRoute = source("src/app/api/listings/[id]/route.ts");
const saveRoute = source("src/app/api/listings/[id]/save/route.ts");
const enquiryRoute = source("src/app/api/listings/[id]/enquiry/route.ts");
const listingService = source("src/lib/listing-service.ts");

assertInOrder(createRoute, [
  "export async function POST",
  "requireCurrentUserProfile()",
  "checkRateLimit(",
  "listingWriteSchema.parse(await readBoundedJsonRequest(request))",
  "createListingForCurrentUser(current, parsed)",
]);
assertInOrder(updateRoute, [
  "export async function PATCH",
  "requireCurrentUserProfile()",
  "checkRateLimit(",
  "listingPatchSchema.parse(await readBoundedJsonRequest(request))",
  "updateListingForCurrentUser(current, id, parsed)",
]);
assertInOrder(saveRoute, [
  "export async function POST",
  "requireCurrentUserProfile()",
  "checkRateLimit(",
  "toggleSavedListingForCurrentUser(current, id)",
]);
assertInOrder(enquiryRoute, [
  "export async function POST",
  "requireCurrentUserProfile()",
  "checkRateLimit(",
  "listingEnquirySchema.parse(await readBoundedJsonRequest(request))",
  "createListingEnquiryForCurrentUser(",
]);

const createListing = functionSource(
  listingService,
  "createListingForCurrentUser",
);
assertInOrder(createListing, [
  "assertPaidFeatureAccess(current)",
  "assertDogListingAllowed(current, input)",
  "assertListingMediaAttachable(current, mediaIds)",
  "tx.listing.create",
  "profileId: current.profileId",
]);

const updateListing = functionSource(
  listingService,
  "updateListingForCurrentUser",
);
assertInOrder(updateListing, [
  "assertPaidFeatureAccess(current)",
  "getOwnedListing(current, listingId)",
  "tx.listing.update",
]);
const getOwnedListing = functionSource(listingService, "getOwnedListing");
assert.match(
  compact(getOwnedListing),
  /findFirst\(\{\s*where:\s*\{\s*id:\s*listingId,\s*profileId:\s*current\.profileId\s*\}/,
);
assert.match(getOwnedListing, /throw new Error\("listing\.not_found"\)/);

const saveListing = functionSource(
  listingService,
  "toggleSavedListingForCurrentUser",
);
assertInOrder(saveListing, [
  "listingIsPublic(listing)",
  "listing.profileId === current.profileId",
  'throw new Error("listing.cannot_save_own_listing")',
  "profileId: current.profileId",
  "listingId: listing.id",
]);

const createEnquiry = functionSource(
  listingService,
  "createListingEnquiryForCurrentUser",
);
assertInOrder(createEnquiry, [
  "assertPaidFeatureAccess(current)",
  "listingIsPublic(listing)",
  "listing.profileId === current.profileId",
  'throw new Error("listing.cannot_enquire_own_listing")',
  "startOrGetConversation(current, listing.profileId)",
  "fromProfileId: current.profileId",
  "toProfileId: listing.profileId",
]);

const detailPage = functionSource(
  source("src/app/listings/[id]/page.tsx"),
  "ListingDetailPage",
);
assert.match(
  detailPage,
  /const isOwner = user\?\.profileId === listing\.profileId/,
);
const ownerBlockStart = detailPage.indexOf("{isOwner && (");
const ownerBlockEnd = detailPage.indexOf("{!isOwner && user && (", ownerBlockStart);
assert.ok(ownerBlockStart >= 0);
assert.ok(ownerBlockEnd > ownerBlockStart);
const ownerBlock = detailPage.slice(ownerBlockStart, ownerBlockEnd);
for (const ownerControl of [
  "Owner controls",
  "<form action={renewAction}>",
  "<form action={soldAction}>",
  "<form action={withdrawAction}>",
]) {
  assert.equal(detailPage.split(ownerControl).length - 1, 1, ownerControl);
  assert.ok(ownerBlock.includes(ownerControl), ownerControl);
}
assert.doesNotMatch(ownerBlock, /InstantSaveListingButton|InstantListingEnquiryForm|reportAction/);

const listingApiMethods = Object.fromEntries(
  listingRouteFiles().map((file) => [
    file,
    exportedHttpMethods(source(file)),
  ]),
);
assert.deepEqual(listingApiMethods, {
  "src/app/api/listings/[id]/enquiry/route.ts": ["POST"],
  "src/app/api/listings/[id]/renew/route.ts": ["POST"],
  "src/app/api/listings/[id]/route.ts": ["GET", "PATCH"],
  "src/app/api/listings/[id]/save/route.ts": ["POST"],
  "src/app/api/listings/[id]/sold/route.ts": ["POST"],
  "src/app/api/listings/[id]/withdraw/route.ts": ["POST"],
  "src/app/api/listings/route.ts": ["GET", "POST"],
});

for (const file of Object.keys(listingApiMethods)) {
  const fileSource = source(file);
  const getHandler = exportedFunctionSource(fileSource, "GET");
  if (!getHandler) continue;
  assert.deepEqual(destructiveDatabaseCalls(getHandler), [], file);
  assert.doesNotMatch(
    getHandler,
    /(?:create|update|withdraw|renew|markListingSold|toggleSaved|createListingEnquiry)ForCurrentUser\s*\(/,
    file,
  );
  assert.match(
    getHandler,
    file.endsWith("/[id]/route.ts")
      ? /getPublicListingById\(id\)/
      : /getMarketplaceListings\(/,
  );
}

const evidenceSource = source(PRODUCT_MARKETPLACE_ACCESS_SAFETY_EVIDENCE_FILE);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);

console.log(
  "Marketplace access-safety evidence passed in isolation: create/edit/save/enquiry ownership chains, owner-only controls, and seven-route GET mutation safety; exact +3 central wiring is ready.",
);

function source(file: string) {
  return readFileSync(file, "utf8");
}

function parse(value: string, kind = ts.ScriptKind.TS) {
  return ts.createSourceFile("evidence.ts", value, ts.ScriptTarget.Latest, true, kind);
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

function exportedFunctionSource(value: string, name: string) {
  const sourceFile = parse(value);
  const match = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === name &&
      statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      ) === true,
  );
  return match?.getText(sourceFile) ?? null;
}

function exportedHttpMethods(value: string) {
  const sourceFile = parse(value);
  return sourceFile.statements
    .filter(
      (statement): statement is ts.FunctionDeclaration =>
        ts.isFunctionDeclaration(statement) &&
        Boolean(statement.name) &&
        statement.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
        ) === true &&
        /^(?:GET|POST|PUT|PATCH|DELETE)$/.test(statement.name!.text),
    )
    .map((statement) => statement.name!.text)
    .toSorted();
}

function destructiveDatabaseCalls(value: string) {
  const sourceFile = parse(value);
  const calls: string[] = [];
  const destructive = /^(?:create|createMany|update|updateMany|upsert|delete|deleteMany)$/;

  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      destructive.test(node.expression.name.text)
    ) {
      calls.push(node.expression.getText(sourceFile));
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return calls;
}

function listingRouteFiles() {
  const root = "src/app/api/listings";
  const files: string[] = [];

  function walk(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(candidate);
      if (entry.isFile() && entry.name === "route.ts") {
        files.push(candidate.replaceAll("\\", "/"));
      }
    }
  }
  walk(root);
  return files.toSorted();
}

function assertInOrder(value: string, expected: readonly string[]) {
  let cursor = -1;
  for (const token of expected) {
    const next = value.indexOf(token, cursor + 1);
    assert.ok(next > cursor, `Expected ordered token: ${token}`);
    cursor = next;
  }
}

function compact(value: string) {
  return value.replace(/\r?\n/g, " ");
}
