import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { MARKETPLACE_TEMPLATE_LISTINGS } from "../../components/marketplace-template-data";
import { DEMO_LISTING_ITEM_IMAGE_PATHS } from "../../lib/demo-listing-media";

const pageSource = readFileSync(join(__dirname, "page.tsx"), "utf8");
const marketplaceRouteSource = readFileSync(
  join(__dirname, "..", "marketplace", "page.tsx"),
  "utf8"
);

assert.equal(MARKETPLACE_TEMPLATE_LISTINGS.length, 6);
assert.ok(
  pageSource.includes(
    "!q && !category && page === 1 ? <MarketplaceProfileShowcase /> : null"
  )
);
assert.ok(pageSource.includes("MARKETPLACE_TEMPLATE_LISTINGS.map"));
assert.ok(pageSource.includes('saveMode="local"'));
assert.ok(pageSource.includes("not active sale"));
assert.ok(pageSource.includes("All marketplace items"));
assert.ok(
  pageSource.includes("getMarketplaceListings(MARKETPLACE_PAGE_SIZE + 1")
);
assert.ok(pageSource.includes("data-marketplace-inventory-item"));
assert.ok(pageSource.includes("Illustrative demo media"));
assert.ok(pageSource.includes("does not verify a listing or seller"));
assert.ok(marketplaceRouteSource.includes('from "../listings/page"'));

assert.equal(Object.keys(DEMO_LISTING_ITEM_IMAGE_PATHS).length, 10);
assert.equal(
  new Set(Object.values(DEMO_LISTING_ITEM_IMAGE_PATHS)).size,
  Object.keys(DEMO_LISTING_ITEM_IMAGE_PATHS).length
);
for (const src of Object.values(DEMO_LISTING_ITEM_IMAGE_PATHS)) {
  assert.ok(src.startsWith("/images/demo-listings/items/"));
  assert.ok(src.endsWith(".webp"));
}

for (const listing of MARKETPLACE_TEMPLATE_LISTINGS) {
  assert.ok(listing.profileHref.startsWith("/dogs/"));
  assert.ok(
    existsSync(join(process.cwd(), "public", listing.artworkSrc.slice(1))),
    `Missing Marketplace card artwork: ${listing.artworkSrc}`
  );
}

console.log("Marketplace complete inventory contract tests passed");
