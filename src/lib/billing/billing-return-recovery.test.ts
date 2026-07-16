import assert from "node:assert/strict";

import {
  buildBillingFailureUrl,
  buildBillingRateLimitUrl,
} from "./billing-return-recovery";

const APP_URL = "https://greyhoundsiq.com.au";

assert.equal(
  buildBillingFailureUrl({
    appUrl: APP_URL,
    interval: "yearly",
    surface: "subscription",
  }).toString(),
  "https://greyhoundsiq.com.au/pricing?checkout=failed&plan=pro&interval=yearly",
);
assert.equal(
  buildBillingFailureUrl({ appUrl: APP_URL, surface: "portal" }).toString(),
  "https://greyhoundsiq.com.au/account/billing?billing=failed",
);
assert.equal(
  buildBillingFailureUrl({ appUrl: APP_URL, surface: "bespoke" }).toString(),
  "https://greyhoundsiq.com.au/account/pages?bespoke=failed",
);
assert.equal(
  buildBillingRateLimitUrl({
    appUrl: APP_URL,
    interval: "monthly",
    surface: "subscription",
  }).toString(),
  "https://greyhoundsiq.com.au/pricing?checkout=rate-limited&plan=pro&interval=monthly",
);
assert.equal(
  buildBillingRateLimitUrl({ appUrl: APP_URL, surface: "portal" }).toString(),
  "https://greyhoundsiq.com.au/account/billing?billing=rate-limited",
);
assert.equal(
  buildBillingRateLimitUrl({ appUrl: APP_URL, surface: "bespoke" }).toString(),
  "https://greyhoundsiq.com.au/account/pages?bespoke=rate-limited",
);

console.log("billing return recovery URL tests passed");
