import assert from "node:assert/strict";

import {
  MARKETPLACE_MAX_PAGE,
  MARKETPLACE_PAGE_SIZE,
  marketplacePageHref,
  marketplacePageOffset,
  parseMarketplaceCategory,
  parseMarketplaceOffset,
  parseMarketplacePage,
  parseMarketplaceSearch,
  parseMarketplaceSort,
} from "./marketplace-navigation";

assert.equal(parseMarketplaceSearch("  racing dog  "), "racing dog");
assert.equal(parseMarketplaceSearch("x".repeat(250)).length, 200);
assert.equal(parseMarketplaceSearch(["dog"]), "");

assert.equal(parseMarketplaceCategory("  pups  "), "pups");
assert.equal(parseMarketplaceCategory("x".repeat(150)).length, 100);

for (const sort of ["", "created_at", "price", "expires_at"] as const) {
  assert.equal(parseMarketplaceSort(sort), sort);
}
assert.equal(parseMarketplaceSort("seller_rating"), "");
assert.equal(parseMarketplaceSort(["price"]), "");

assert.equal(parseMarketplacePage(undefined), 1);
assert.equal(parseMarketplacePage("0"), 1);
assert.equal(parseMarketplacePage("1.5"), 1);
assert.equal(parseMarketplacePage("2"), 2);
assert.equal(parseMarketplacePage("999999"), MARKETPLACE_MAX_PAGE);
assert.equal(marketplacePageOffset(1), 0);
assert.equal(marketplacePageOffset(3), MARKETPLACE_PAGE_SIZE * 2);
assert.equal(parseMarketplaceOffset(-1), 0);
assert.equal(parseMarketplaceOffset(24.5), 0);
assert.equal(parseMarketplaceOffset(48), 48);
assert.equal(
  parseMarketplaceOffset(Number.MAX_SAFE_INTEGER),
  (MARKETPLACE_MAX_PAGE - 1) * MARKETPLACE_PAGE_SIZE,
);

assert.equal(
  marketplacePageHref(
    { q: "  fast dog ", category: "dogs", sort: "price" },
    3,
  ),
  "/marketplace?q=fast+dog&category=dogs&sort=price&page=3",
);
assert.equal(
  marketplacePageHref({ q: "", category: "", sort: "created_at" }, 1),
  "/marketplace?sort=created_at",
);
assert.equal(
  marketplacePageHref({ q: "", category: "", sort: "invalid" }, 1),
  "/marketplace",
);

console.log(
  "Marketplace navigation passed: bounded search, category, sort, page and offset parsing preserve allowlisted filters in canonical page links.",
);
