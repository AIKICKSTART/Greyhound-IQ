import assert from "node:assert/strict";

import {
  ONBOARDING_ANALYTICS_CONSENT_HEADER,
} from "@/components/onboarding-analytics-client";
import {
  ONBOARDING_ANALYTICS_LEGACY_STEP_IDS,
  ONBOARDING_ANALYTICS_LEGACY_TOUR_ID,
  ONBOARDING_ANALYTICS_MAX_BODY_BYTES,
  ONBOARDING_ANALYTICS_SCHEMA_VERSION,
} from "@/components/onboarding-analytics";
import {
  ONBOARDING_ANALYTICS_RATE_LIMIT,
  ONBOARDING_ANALYTICS_RATE_LIMIT_KEY,
  ONBOARDING_ANALYTICS_RATE_LIMIT_WINDOW_MS,
  handleOnboardingAnalyticsPost,
} from "./handler";

const acceptedEvent = {
  schemaVersion: ONBOARDING_ANALYTICS_SCHEMA_VERSION,
  event: "step-viewed",
  tourId: ONBOARDING_ANALYTICS_LEGACY_TOUR_ID,
  stepId: ONBOARDING_ANALYTICS_LEGACY_STEP_IDS[0],
} as const;
const allowedRateLimit = async (
  key: string,
  limit: number,
  windowMs: number,
  options: { failClosed: true },
) => {
  assert.equal(key, ONBOARDING_ANALYTICS_RATE_LIMIT_KEY);
  assert.equal(limit, ONBOARDING_ANALYTICS_RATE_LIMIT);
  assert.equal(windowMs, ONBOARDING_ANALYTICS_RATE_LIMIT_WINDOW_MS);
  assert.deepEqual(options, { failClosed: true });
  return {
    allowed: true,
    remaining: ONBOARDING_ANALYTICS_RATE_LIMIT - 1,
    resetAt: Date.now() + ONBOARDING_ANALYTICS_RATE_LIMIT_WINDOW_MS,
  };
};

async function run() {
const recorded: { event: string; context: Record<string, unknown> }[] = [];
const accepted = await handleOnboardingAnalyticsPost(
  analyticsRequest(JSON.stringify(acceptedEvent)),
  {
    checkLimit: allowedRateLimit,
    record: async (event, context) => {
      recorded.push({ event, context });
    },
  },
);
assert.equal(accepted.status, 204);
assert.equal(accepted.headers.get("cache-control"), "private, no-store");
assert.deepEqual(recorded, [
  {
    event: "onboarding.analytics.recorded",
    context: {
      onboardingEvent: "step-viewed",
      onboardingTour: ONBOARDING_ANALYTICS_LEGACY_TOUR_ID,
      onboardingStep: ONBOARDING_ANALYTICS_LEGACY_STEP_IDS[0],
      productArea: "general",
      schemaVersion: 1,
      targetType: "onboarding-tour",
      targetId: ONBOARDING_ANALYTICS_LEGACY_TOUR_ID,
      outcome: "recorded",
    },
  },
]);
for (const forbiddenKey of [
  "actorId",
  "userId",
  "profileId",
  "tenantId",
  "route",
  "role",
  "tier",
  "email",
  "message",
  "formValue",
  "ip",
  "userAgent",
]) {
  assert.equal(forbiddenKey in recorded[0].context, false, forbiddenKey);
}

const invalidSchema = await handleOnboardingAnalyticsPost(
  analyticsRequest(JSON.stringify({ ...acceptedEvent, message: "private content" })),
  { checkLimit: allowedRateLimit },
);
assert.equal(invalidSchema.status, 400);
assert.equal(recorded.length, 1);

const denied = await handleOnboardingAnalyticsPost(
  analyticsRequest(JSON.stringify(acceptedEvent)),
  {
    checkLimit: async () => ({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    }),
  },
);
assert.equal(denied.status, 429);
assert.equal(denied.headers.get("ratelimit-limit"), String(ONBOARDING_ANALYTICS_RATE_LIMIT));
assert.ok(Number(denied.headers.get("retry-after")) >= 1);

const oversized = await handleOnboardingAnalyticsPost(
  analyticsRequest("x".repeat(ONBOARDING_ANALYTICS_MAX_BODY_BYTES + 1)),
  {
    checkLimit: async () => {
      assert.fail("rate limiter must not run for a declared oversized body");
    },
  },
);
assert.equal(oversized.status, 413);

for (const [name, request, status] of [
  [
    "cross-origin",
    analyticsRequest(JSON.stringify(acceptedEvent), { origin: "https://attacker.invalid" }),
    403,
  ],
  [
    "missing-consent",
    analyticsRequest(JSON.stringify(acceptedEvent), { consent: null }),
    403,
  ],
  [
    "wrong-content-type",
    analyticsRequest(JSON.stringify(acceptedEvent), { contentType: "text/plain" }),
    415,
  ],
  [
    "compressed-body",
    analyticsRequest(JSON.stringify(acceptedEvent), { contentEncoding: "gzip" }),
    415,
  ],
] as const) {
  const response = await handleOnboardingAnalyticsPost(request, {
    checkLimit: allowedRateLimit,
  });
  assert.equal(response.status, status, name);
}

console.log(
  "Onboarding analytics route passed: same-origin consent, 512-byte body, strict schema, fail-closed rate decision and privacy-minimised structured log.",
);
}

void run();

function analyticsRequest(
  body: string,
  options: {
    consent?: "accepted" | null;
    contentEncoding?: string;
    contentType?: string;
    origin?: string;
  } = {},
) {
  const origin = options.origin ?? "https://greyhoundsiq.com.au";
  const headers = new Headers({
    "content-length": String(new TextEncoder().encode(body).byteLength),
    "content-type": options.contentType ?? "application/json",
    origin,
    "sec-fetch-site": "same-origin",
  });
  if (options.consent !== null) {
    headers.set(ONBOARDING_ANALYTICS_CONSENT_HEADER, options.consent ?? "accepted");
  }
  if (options.contentEncoding) {
    headers.set("content-encoding", options.contentEncoding);
  }
  return new Request("https://greyhoundsiq.com.au/api/analytics/onboarding", {
    method: "POST",
    headers,
    body,
  });
}
