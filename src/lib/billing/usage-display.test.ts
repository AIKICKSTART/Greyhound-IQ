import assert from "node:assert/strict";

import { formatUsageLimitDisplay } from "@/lib/billing/usage-display";
import { DEFAULT_TIER_ENTITLEMENT_LIMITS } from "@/lib/billing/entitlements";

const freeLimits = formatUsageLimitDisplay(
  DEFAULT_TIER_ENTITLEMENT_LIMITS.free
);
const raceViews = freeLimits.find(
  (limit) => limit.key === "race_detail_views_per_month"
);

assert.equal(raceViews?.value, "Unlimited");

console.log("usage display tests passed");
