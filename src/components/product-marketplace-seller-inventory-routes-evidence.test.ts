import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

import {
  SELLER_LISTING_VIEWS,
  sellerListingStatuses,
} from "../lib/seller-listing-view";
import {
  PRODUCT_MARKETPLACE_SELLER_INVENTORY_ROUTES_EVIDENCE_FILE,
  PRODUCT_MARKETPLACE_SELLER_INVENTORY_ROUTES_EXPECTED_GAIN,
  PRODUCT_MARKETPLACE_SELLER_INVENTORY_ROUTES_MASTER_EVIDENCE,
  PRODUCT_MARKETPLACE_SELLER_INVENTORY_ROUTES_REQUIREMENT_IDS,
  PRODUCT_MARKETPLACE_SELLER_INVENTORY_ROUTES_SCOPE,
  PRODUCT_MARKETPLACE_SELLER_INVENTORY_ROUTES_TEST_FILE,
} from "./product-marketplace-seller-inventory-routes-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-MARKETPLACE-SELLER-INVENTORY-ROUTES

const EXPECTED_REQUIREMENTS = {
  "ROUTE.MARKET.seller-inventory-route":
    "Discover or create seller-inventory routes.",
  "ROUTE.MARKET.drafts-route": "Discover or create listing-draft routes.",
  "ROUTE.MARKET.archived-route":
    "Discover or create archived-listing routes.",
} as const;

assert.deepEqual(
  PRODUCT_MARKETPLACE_SELLER_INVENTORY_ROUTES_REQUIREMENT_IDS,
  Object.keys(EXPECTED_REQUIREMENTS),
);
assert.equal(PRODUCT_MARKETPLACE_SELLER_INVENTORY_ROUTES_EXPECTED_GAIN, 3);
assert.deepEqual(
  Object.keys(PRODUCT_MARKETPLACE_SELLER_INVENTORY_ROUTES_MASTER_EVIDENCE),
  Object.keys(EXPECTED_REQUIREMENTS),
);

for (const [id, requirementText] of Object.entries(EXPECTED_REQUIREMENTS)) {
  const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
    (candidate) => candidate.id === id,
  );
  assert.ok(requirement, id);
  assert.equal(requirement.requirement, requirementText);
  const evidence =
    PRODUCT_MARKETPLACE_SELLER_INVENTORY_ROUTES_MASTER_EVIDENCE[
      id as keyof typeof PRODUCT_MARKETPLACE_SELLER_INVENTORY_ROUTES_MASTER_EVIDENCE
    ];
  assert.equal(evidence.status, "tested");
  assert.deepEqual(evidence.evidence.slice(0, 2), [
    PRODUCT_MARKETPLACE_SELLER_INVENTORY_ROUTES_EVIDENCE_FILE,
    PRODUCT_MARKETPLACE_SELLER_INVENTORY_ROUTES_TEST_FILE,
  ]);
  assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
  evidence.evidence.forEach((path) => assert.equal(existsSync(path), true, path));
}

assert.match(PRODUCT_MARKETPLACE_SELLER_INVENTORY_ROUTES_SCOPE, /source and unit/i);
assert.match(PRODUCT_MARKETPLACE_SELLER_INVENTORY_ROUTES_SCOPE, /current-profile scoped/i);
assert.match(PRODUCT_MARKETPLACE_SELLER_INVENTORY_ROUTES_SCOPE, /100-row cap/i);
assert.match(PRODUCT_MARKETPLACE_SELLER_INVENTORY_ROUTES_SCOPE, /does not prove draft creation/i);
assert.match(PRODUCT_MARKETPLACE_SELLER_INVENTORY_ROUTES_SCOPE, /archive mutation/i);
assert.match(PRODUCT_MARKETPLACE_SELLER_INVENTORY_ROUTES_SCOPE, /route-registry integration/i);

assert.deepEqual(SELLER_LISTING_VIEWS, ["all", "drafts", "archived"]);
assert.equal(sellerListingStatuses("all"), null);
assert.deepEqual(sellerListingStatuses("drafts"), ["draft"]);
assert.deepEqual(sellerListingStatuses("archived"), ["archived"]);

const routeAssertions = [
  ["src/app/account/listings/page.tsx", 'view="all"'],
  ["src/app/account/listings/drafts/page.tsx", 'view="drafts"'],
  ["src/app/account/listings/archived/page.tsx", 'view="archived"'],
] as const;
for (const [path, assertion] of routeAssertions) {
  const routeSource = source(path);
  assert.ok(routeSource.includes(assertion), `${path}: ${assertion}`);
  assert.match(routeSource, /robots: \{ index: false, follow: false \}/);
}

const pageSource = source(
  "src/app/account/listings/seller-listings-page.tsx",
);
const pageFunction = functionSource(pageSource, "SellerListingsViewPage", ts.ScriptKind.TSX);
for (const assertion of [
  "requireSellerListingsProfile(view)",
  "getSellerListingsForCurrentUser(current, view)",
  'aria-label="Seller listing views"',
  'href: "/account/listings"',
  'href: "/account/listings/drafts"',
  'href: "/account/listings/archived"',
  "listings.length > 0",
  "Nothing in this view",
  "Bounded to the 100 most recently updated records",
]) {
  assert.ok(pageSource.includes(assertion), assertion);
}
assert.match(pageFunction, /listings\.map\(\(listing\) =>/);

const serviceSource = functionSource(
  source("src/lib/listing-service.ts"),
  "getSellerListingsForCurrentUser",
);
for (const assertion of [
  "sellerListingStatuses(view)",
  "withDbRequestContext(current",
  "profileId: current.profileId",
  "status: { in: [...statuses] }",
  'orderBy: [{ updatedAt: "desc" }, { id: "asc" }]',
  "take: 100",
]) {
  assert.ok(serviceSource.includes(assertion), assertion);
}
assert.doesNotMatch(serviceSource, /withDbSystemContext/);
assert.doesNotMatch(serviceSource, /profile:\s*true|user:\s*true/);

const accountSource = source("src/app/account/page.tsx");
assert.match(accountSource, /href="\/account\/listings"/);
assert.match(accountSource, /My listings/);

const evidenceSource = source(
  PRODUCT_MARKETPLACE_SELLER_INVENTORY_ROUTES_EVIDENCE_FILE,
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);

console.log(
  "Seller inventory route evidence passed in isolation: owner-scoped all, draft and archived views with fixed filters, bounded projections and explicit empty states are ready for exact +3 central wiring; lifecycle mutations remain open.",
);

function source(path: string) {
  return readFileSync(path, "utf8");
}

function functionSource(value: string, name: string, kind = ts.ScriptKind.TS) {
  const sourceFile = ts.createSourceFile(
    "evidence.ts",
    value,
    ts.ScriptTarget.Latest,
    true,
    kind,
  );
  const match = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  assert.ok(match, `Missing function ${name}`);
  return match.getText(sourceFile);
}
