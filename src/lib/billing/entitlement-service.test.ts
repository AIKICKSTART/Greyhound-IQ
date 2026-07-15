import assert from "node:assert/strict";

import { parseEntitlementLimits } from "@/lib/billing/entitlement-service";
import { DEFAULT_TIER_ENTITLEMENT_LIMITS } from "@/lib/billing/entitlements";

assert.deepEqual(
  parseEntitlementLimits(JSON.stringify(DEFAULT_TIER_ENTITLEMENT_LIMITS.free)),
  DEFAULT_TIER_ENTITLEMENT_LIMITS.free,
  "the documented -1 unlimited sentinel must survive snapshot parsing"
);

assert.equal(
  parseEntitlementLimits(
    JSON.stringify({
      ...DEFAULT_TIER_ENTITLEMENT_LIMITS.pro,
      race_detail_views_per_month: -2,
    })
  ),
  null,
  "numeric limits below the -1 sentinel must fail closed"
);

assert.equal(
  parseEntitlementLimits(
    JSON.stringify({
      ...DEFAULT_TIER_ENTITLEMENT_LIMITS.pro,
      prediction_runs_per_month: 100 * 1024 ** 3,
    })
  ),
  null,
  "cost-bearing snapshot limits must remain bounded"
);

assert.equal(
  parseEntitlementLimits(
    JSON.stringify({
      ...DEFAULT_TIER_ENTITLEMENT_LIMITS.pro,
      advanced_prediction_agents: "yes",
    })
  ),
  null,
  "boolean entitlements must reject type confusion"
);

assert.equal(
  parseEntitlementLimits(
    JSON.stringify({ prediction_runs_per_month: 10 })
  ),
  null,
  "incomplete snapshots must fail closed to the tier fallback"
);

console.log("entitlement snapshot parsing tests passed");
