import assert from "node:assert/strict";

import { rateLimitExceededResponse } from "./rate-limit-response";

const NOW = Date.UTC(2026, 6, 14, 0, 0, 0);
const ERROR = {
  code: "rate_limit.exceeded",
  message: "Too many requests",
};

async function main() {
  const beforeReset = rateLimitExceededResponse(
    { remaining: 4, resetAt: NOW + 60_000 },
    10,
    ERROR,
    NOW
  );
  assert.equal(beforeReset.status, 429);
  assert.equal(
    beforeReset.headers.get("access-control-allow-origin"),
    "https://greyhoundsiq.com.au"
  );
  assert.equal(beforeReset.headers.get("cache-control"), "private, no-store");
  assert.equal(beforeReset.headers.get("ratelimit-limit"), "10");
  assert.equal(beforeReset.headers.get("ratelimit-remaining"), "4");
  assert.equal(beforeReset.headers.get("ratelimit-reset"), "60");
  assert.equal(beforeReset.headers.get("retry-after"), "60");
  assert.deepEqual(await beforeReset.json(), { error: ERROR });

  const atReset = rateLimitExceededResponse(
    { remaining: 0, resetAt: NOW },
    10,
    ERROR,
    NOW
  );
  assert.equal(atReset.headers.get("ratelimit-reset"), "1");
  assert.equal(atReset.headers.get("retry-after"), "1");

  const afterReset = rateLimitExceededResponse(
    { remaining: 0, resetAt: NOW - 10_000 },
    10,
    ERROR,
    NOW
  );
  assert.equal(afterReset.headers.get("ratelimit-reset"), "1");
  assert.equal(afterReset.headers.get("retry-after"), "1");

  const belowZero = rateLimitExceededResponse(
    { remaining: -20, resetAt: NOW + 1 },
    10,
    ERROR,
    NOW
  );
  const aboveLimit = rateLimitExceededResponse(
    { remaining: 200, resetAt: NOW + 1 },
    10,
    ERROR,
    NOW
  );
  assert.equal(belowZero.headers.get("ratelimit-remaining"), "0");
  assert.equal(aboveLimit.headers.get("ratelimit-remaining"), "10");

  const deterministicA = rateLimitExceededResponse(
    { remaining: 1, resetAt: NOW + 1_001 },
    2,
    ERROR,
    NOW
  );
  const deterministicB = rateLimitExceededResponse(
    { remaining: 1, resetAt: NOW + 1_001 },
    2,
    ERROR,
    NOW
  );
  assert.deepEqual(
    Object.fromEntries(deterministicA.headers),
    Object.fromEntries(deterministicB.headers)
  );
  assert.equal(deterministicA.headers.get("ratelimit-reset"), "2");

  assert.throws(
    () => rateLimitExceededResponse({ remaining: 0, resetAt: NOW }, 0, ERROR, NOW),
    /rate_limit_response\.limit_invalid/
  );

  console.log("rate-limit response tests passed");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
