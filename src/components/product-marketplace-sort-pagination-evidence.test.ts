import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  MARKETPLACE_MAX_PAGE,
  MARKETPLACE_PAGE_SIZE,
  marketplacePageHref,
  marketplacePageOffset,
  parseMarketplacePage,
  parseMarketplaceSort,
} from "../lib/marketplace-navigation";
import {
  PRODUCT_MARKETPLACE_SORT_PAGINATION_EVIDENCE_FILE,
  PRODUCT_MARKETPLACE_SORT_PAGINATION_EXPECTED_GAIN,
  PRODUCT_MARKETPLACE_SORT_PAGINATION_MASTER_EVIDENCE,
  PRODUCT_MARKETPLACE_SORT_PAGINATION_REQUIREMENT_IDS,
  PRODUCT_MARKETPLACE_SORT_PAGINATION_SCOPE,
  PRODUCT_MARKETPLACE_SORT_PAGINATION_TEST_FILE,
} from "./product-marketplace-sort-pagination-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-MARKETPLACE-SORT-PAGINATION

const EXPECTED_REQUIREMENTS = {
  "ROUTE.MARKET.sort": "Support marketplace sorting.",
  "ROUTE.MARKET.pagination": "Support pagination or infinite loading.",
} as const;

assert.deepEqual(
  PRODUCT_MARKETPLACE_SORT_PAGINATION_REQUIREMENT_IDS,
  Object.keys(EXPECTED_REQUIREMENTS),
);
assert.equal(PRODUCT_MARKETPLACE_SORT_PAGINATION_EXPECTED_GAIN, 2);
assert.deepEqual(
  Object.keys(PRODUCT_MARKETPLACE_SORT_PAGINATION_MASTER_EVIDENCE),
  Object.keys(EXPECTED_REQUIREMENTS),
);

for (const [id, requirementText] of Object.entries(EXPECTED_REQUIREMENTS)) {
  const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
    (candidate) => candidate.id === id,
  );
  assert.ok(requirement, id);
  assert.equal(requirement.requirement, requirementText);

  const evidence =
    PRODUCT_MARKETPLACE_SORT_PAGINATION_MASTER_EVIDENCE[
      id as keyof typeof PRODUCT_MARKETPLACE_SORT_PAGINATION_MASTER_EVIDENCE
    ];
  assert.equal(evidence.status, "tested");
  assert.deepEqual(evidence.evidence.slice(0, 2), [
    PRODUCT_MARKETPLACE_SORT_PAGINATION_EVIDENCE_FILE,
    PRODUCT_MARKETPLACE_SORT_PAGINATION_TEST_FILE,
  ]);
  assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
  evidence.evidence.forEach((path) => assert.equal(existsSync(path), true, path));
}

assert.match(PRODUCT_MARKETPLACE_SORT_PAGINATION_SCOPE, /source and unit/i);
assert.match(PRODUCT_MARKETPLACE_SORT_PAGINATION_SCOPE, /caps page input/i);
assert.match(PRODUCT_MARKETPLACE_SORT_PAGINATION_SCOPE, /look-ahead record/i);
assert.match(PRODUCT_MARKETPLACE_SORT_PAGINATION_SCOPE, /deterministic tie-breakers/i);
assert.match(PRODUCT_MARKETPLACE_SORT_PAGINATION_SCOPE, /does not prove hydrated/i);
assert.match(PRODUCT_MARKETPLACE_SORT_PAGINATION_SCOPE, /database performance/i);

for (const sort of ["", "created_at", "price", "expires_at"] as const) {
  assert.equal(parseMarketplaceSort(sort), sort);
}
assert.equal(parseMarketplaceSort("highest_commission"), "");
assert.equal(parseMarketplacePage("2"), 2);
assert.equal(parseMarketplacePage("999999"), MARKETPLACE_MAX_PAGE);
assert.equal(marketplacePageOffset(2), MARKETPLACE_PAGE_SIZE);
assert.equal(
  marketplacePageHref(
    { q: "fast dog", category: "dogs", sort: "expires_at" },
    2,
  ),
  "/marketplace?q=fast+dog&category=dogs&sort=expires_at&page=2",
);

const pageSource = source("src/app/listings/page.tsx");
for (const assertion of [
  "const sort = parseMarketplaceSort(params.sort);",
  "const page = parseMarketplacePage(params.page);",
  "getMarketplaceListings(MARKETPLACE_PAGE_SIZE + 1, {",
  "offset: marketplacePageOffset(page),",
  "listingPage.slice(0, MARKETPLACE_PAGE_SIZE)",
  'name="sort"',
  '<option value="created_at">Newest</option>',
  '<option value="price">Price: low to high</option>',
  '<option value="expires_at">Ending soon</option>',
  'aria-label="Marketplace pagination"',
  "marketplacePageHref(navigationState, page - 1)",
  "marketplacePageHref(navigationState, page + 1)",
]) {
  assert.ok(pageSource.includes(assertion), assertion);
}

const querySource = source("src/lib/queries.ts");
for (const assertion of [
  "offset?: number;",
  "offset: parseMarketplaceOffset(filters.offset)",
  "skip: useRankedSearch ? undefined : offset",
  ".slice(offset, offset + limit)",
  '[{ price: "asc" }, { createdAt: "desc" }, { id: "asc" }]',
  '[{ expiresAt: "asc" }, { createdAt: "desc" }, { id: "asc" }]',
  '[{ createdAt: "desc" }, { id: "asc" }]',
]) {
  assert.ok(querySource.includes(assertion), assertion);
}

const contractSource = source(
  "src/components/screen-contracts/production-screen-coverage.ts",
);
assert.ok(
  contractSource.includes(
    'queryParameters: ["q", "category", "sort", "page", "submitted"]',
  ),
);
assert.ok(contractSource.includes('"MARKETPLACE.ACTION.PAGE.CHANGE"'));

const evidenceSource = source(
  PRODUCT_MARKETPLACE_SORT_PAGINATION_EVIDENCE_FILE,
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);

console.log(
  "Marketplace sort and pagination evidence passed in isolation: allowlisted stable sorting and bounded state-preserving server pagination are ready for exact +2 central wiring.",
);

function source(path: string) {
  return readFileSync(path, "utf8");
}
