import assert from "node:assert/strict";

import {
  BILLING_RATE_LIMIT_RECOVERY_SECONDS,
  normalizeRateLimitRecoverySeconds,
  prefersHtmlRateLimitRecovery,
} from "./rate-limit-recovery";

assert.equal(BILLING_RATE_LIMIT_RECOVERY_SECONDS, 60);
assert.equal(
  prefersHtmlRateLimitRecovery(
    new Request("https://greyhoundsiq.com.au/api/billing/checkout", {
      method: "POST",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
      },
    }),
  ),
  true,
);
assert.equal(
  prefersHtmlRateLimitRecovery(
    new Request("https://greyhoundsiq.com.au/api/billing/checkout", {
      method: "POST",
      headers: { accept: "application/json" },
    }),
  ),
  false,
);
assert.equal(
  prefersHtmlRateLimitRecovery(
    new Request("https://greyhoundsiq.com.au/api/billing/checkout", {
      method: "GET",
      headers: { accept: "text/html" },
    }),
  ),
  false,
);
assert.equal(normalizeRateLimitRecoverySeconds(Number.NaN), 60);
assert.equal(normalizeRateLimitRecoverySeconds(-1), 1);
assert.equal(normalizeRateLimitRecoverySeconds(1.2), 2);
assert.equal(normalizeRateLimitRecoverySeconds(5_000), 900);

console.log("rate-limit browser recovery tests passed");
