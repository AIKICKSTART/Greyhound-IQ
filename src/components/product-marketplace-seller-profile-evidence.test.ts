import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

import {
  PRODUCT_MARKETPLACE_SELLER_PROFILE_EVIDENCE_FILE,
  PRODUCT_MARKETPLACE_SELLER_PROFILE_EXPECTED_GAIN,
  PRODUCT_MARKETPLACE_SELLER_PROFILE_MASTER_EVIDENCE,
  PRODUCT_MARKETPLACE_SELLER_PROFILE_REQUIREMENT_IDS,
  PRODUCT_MARKETPLACE_SELLER_PROFILE_SCOPE,
  PRODUCT_MARKETPLACE_SELLER_PROFILE_TEST_FILE,
} from "./product-marketplace-seller-profile-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-MARKETPLACE-SELLER-PROFILE

const REQUIREMENT_ID = "ROUTE.MARKET.seller-profile" as const;
const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
  ({ id }) => id === REQUIREMENT_ID,
);
assert.ok(requirement, REQUIREMENT_ID);
assert.equal(requirement.requirement, "Support opening the seller profile.");
assert.deepEqual(PRODUCT_MARKETPLACE_SELLER_PROFILE_REQUIREMENT_IDS, [
  REQUIREMENT_ID,
]);
assert.equal(PRODUCT_MARKETPLACE_SELLER_PROFILE_EXPECTED_GAIN, 1);
assert.deepEqual(
  Object.keys(PRODUCT_MARKETPLACE_SELLER_PROFILE_MASTER_EVIDENCE),
  [REQUIREMENT_ID],
);

const evidence =
  PRODUCT_MARKETPLACE_SELLER_PROFILE_MASTER_EVIDENCE[REQUIREMENT_ID];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_MARKETPLACE_SELLER_PROFILE_EVIDENCE_FILE,
  PRODUCT_MARKETPLACE_SELLER_PROFILE_TEST_FILE,
]);
assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
evidence.evidence.forEach((path) => assert.equal(existsSync(path), true, path));

assert.match(PRODUCT_MARKETPLACE_SELLER_PROFILE_SCOPE, /source-static/i);
assert.match(PRODUCT_MARKETPLACE_SELLER_PROFILE_SCOPE, /only for a published actor/i);
assert.match(PRODUCT_MARKETPLACE_SELLER_PROFILE_SCOPE, /unlinked private fallback/i);
assert.match(PRODUCT_MARKETPLACE_SELLER_PROFILE_SCOPE, /does not prove hydrated browser navigation/i);
assert.match(PRODUCT_MARKETPLACE_SELLER_PROFILE_SCOPE, /database RLS/i);

const listingService = source("src/lib/listing-service.ts");
const listingInclude = functionSource(listingService, "listingInclude");
assert.match(
  compact(listingInclude),
  /profile:\s*\{\s*select:\s*\{[\s\S]*?socialActor:\s*\{\s*select:\s*\{\s*handle:\s*true,\s*published:\s*true/,
);
assert.doesNotMatch(
  compact(listingInclude),
  /socialActor:\s*\{\s*(?:include:\s*true|select:\s*\{[\s\S]*?(?:contactVisibility|ownerProfileId|profileId|createdAt|updatedAt):)/,
  "listing reads must not expand the seller actor beyond link routing and disclosure state",
);
for (const functionName of [
  "getPublicListingById",
  "getListingForViewerById",
]) {
  assert.match(
    functionSource(listingService, functionName),
    /include: listingInclude\(\)/,
    functionName,
  );
}

const detailPage = functionSource(
  source("src/app/listings/[id]/page.tsx"),
  "ListingDetailPage",
);
assert.match(
  detailPage,
  /listing\.profile\.socialActor\?\.published \? \(/,
);
assert.match(
  detailPage,
  /href=\{`\/p\/\$\{listing\.profile\.socialActor\.handle\}`\}/,
);
assert.match(detailPage, />\s*View seller profile\s*<\/Link>/);
assert.match(detailPage, />\s*Seller profile is not public\.\s*<\/p>/);
assert.equal(
  detailPage.split("listing.profile.socialActor.handle").length - 1,
  1,
  "the private fallback must not render or serialize the seller handle",
);
assert.equal(
  detailPage.split("View seller profile").length - 1,
  1,
  "the detail screen must expose one unambiguous seller destination",
);

const profilePage = source("src/app/p/[handle]/page.tsx");
assert.match(profilePage, /params: Promise<\{ handle: string \}>/);
assert.match(profilePage, /getSocialActorProfileByHandle\(handle, viewer\)/);
assert.match(profilePage, /notFound\(\)/);

const evidenceSource = source(PRODUCT_MARKETPLACE_SELLER_PROFILE_EVIDENCE_FILE);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);

console.log(
  "Marketplace seller-profile evidence passed in isolation: published sellers receive one same-origin profile link, while unpublished sellers receive an unlinked fallback; exact +1 central wiring is ready.",
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

function compact(value: string) {
  return value.replace(/\r?\n/g, " ");
}
