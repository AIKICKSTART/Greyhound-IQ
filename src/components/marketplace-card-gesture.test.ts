import assert from "node:assert/strict";

import { resolveMarketplaceCardGesture } from "./marketplace-card-gesture";

assert.equal(resolveMarketplaceCardGesture({ deltaX: 2, deltaY: 4 }), "tap");
assert.equal(resolveMarketplaceCardGesture({ deltaX: 64, deltaY: 8 }), "save");
assert.equal(
  resolveMarketplaceCardGesture({ deltaX: -64, deltaY: 8 }),
  "dismiss"
);
assert.equal(
  resolveMarketplaceCardGesture({ deltaX: 30, deltaY: 76 }),
  "scroll"
);
assert.equal(
  resolveMarketplaceCardGesture({ deltaX: 40, deltaY: 5 }),
  "scroll"
);

console.log("marketplace card gesture tests passed");
