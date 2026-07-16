import assert from "node:assert/strict";

import {
  SELLER_LISTING_VIEWS,
  sellerListingStatuses,
} from "./seller-listing-view";

assert.deepEqual(SELLER_LISTING_VIEWS, ["all", "drafts", "archived"]);
assert.equal(sellerListingStatuses("all"), null);
assert.deepEqual(sellerListingStatuses("drafts"), ["draft"]);
assert.deepEqual(sellerListingStatuses("archived"), ["archived"]);

console.log(
  "Seller listing views passed: the route allowlist maps only dedicated draft and archived screens to lifecycle filters.",
);
