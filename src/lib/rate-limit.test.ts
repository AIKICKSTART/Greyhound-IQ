import assert from "node:assert/strict";
import { checkLocalRateLimit, checkRateLimit } from "./rate-limit";

// Input-validation throws — no DB needed. Wrap in async IIFE for assert.rejects.
(async () => {
  await assert.rejects(
    checkRateLimit("", 10, 1000),
    /rate_limit\.key_required/,
    "empty key must throw"
  );

  await assert.rejects(
    checkRateLimit("   ", 10, 1000),
    /rate_limit\.key_required/,
    "whitespace-only key must throw"
  );

  await assert.rejects(
    checkRateLimit("valid", 0, 1000),
    /rate_limit\.limit_invalid/,
    "limit=0 must throw"
  );

  await assert.rejects(
    checkRateLimit("valid", 1.5, 1000),
    /rate_limit\.limit_invalid/,
    "non-integer limit must throw"
  );

  await assert.rejects(
    checkRateLimit("valid", 10, 0),
    /rate_limit\.window_invalid/,
    "windowMs=0 must throw"
  );

  await assert.rejects(
    checkRateLimit("valid", 10, 500.5),
    /rate_limit\.window_invalid/,
    "non-integer window must throw"
  );

  // Without a real DB the stub returns [] → in-memory fallback → fail-open.
  // The limiter must never become an outage mode.
  const result = await checkRateLimit("unit-test-key", 5, 60_000);
  assert.equal(result.allowed, true);

  const now = Date.UTC(2026, 6, 14, 0, 0, 0);
  const first = checkLocalRateLimit("local-unit-test-key", 2, 1000, now);
  const second = checkLocalRateLimit("local-unit-test-key", 2, 1000, now + 1);
  const denied = checkLocalRateLimit("local-unit-test-key", 2, 1000, now + 2);
  const reset = checkLocalRateLimit("local-unit-test-key", 2, 1000, now + 1000);
  assert.deepEqual(
    [first.allowed, second.allowed, denied.allowed, reset.allowed],
    [true, true, false, true]
  );
  assert.equal(denied.remaining, 0);
  assert.equal(reset.remaining, 1);
  assert.throws(
    () => checkLocalRateLimit("", 2, 1000, now),
    /rate_limit\.key_required/
  );

  console.log("rate-limit tests passed");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
