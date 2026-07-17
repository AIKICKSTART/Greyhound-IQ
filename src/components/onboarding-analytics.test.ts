import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  ONBOARDING_ANALYTICS_EVENT_NAMES,
  ONBOARDING_ANALYTICS_LEGACY_STEP_IDS,
  ONBOARDING_ANALYTICS_LEGACY_TOUR_ID,
  ONBOARDING_ANALYTICS_MAX_BODY_BYTES,
  ONBOARDING_ANALYTICS_SCHEMA_VERSION,
  parseOnboardingAnalyticsEvent,
} from "./onboarding-analytics";
import {
  ONBOARDING_ANALYTICS_CONSENT_HEADER,
  ONBOARDING_ANALYTICS_ENDPOINT,
  queueOnboardingAnalyticsEvent,
} from "./onboarding-analytics-client";

const stepEvent = {
  schemaVersion: ONBOARDING_ANALYTICS_SCHEMA_VERSION,
  event: "step-viewed",
  tourId: ONBOARDING_ANALYTICS_LEGACY_TOUR_ID,
  stepId: ONBOARDING_ANALYTICS_LEGACY_STEP_IDS[0],
} as const;

for (const event of ONBOARDING_ANALYTICS_EVENT_NAMES) {
  const parsed = parseOnboardingAnalyticsEvent({
    schemaVersion: ONBOARDING_ANALYTICS_SCHEMA_VERSION,
    event,
    tourId: ONBOARDING_ANALYTICS_LEGACY_TOUR_ID,
    ...(["step-viewed", "step-skipped"].includes(event)
      ? { stepId: ONBOARDING_ANALYTICS_LEGACY_STEP_IDS[0] }
      : {}),
  });
  assert.equal(parsed?.event, event);
  assert.ok(
    new TextEncoder().encode(JSON.stringify(parsed)).byteLength <=
      ONBOARDING_ANALYTICS_MAX_BODY_BYTES,
  );
}

for (const unsafeValue of [
  { ...stepEvent, route: "/account/private" },
  { ...stepEvent, profileId: "profile-secret" },
  { ...stepEvent, role: "admin" },
  { ...stepEvent, tier: "business" },
  { ...stepEvent, email: "person@example.com" },
  { ...stepEvent, message: "private support content" },
  { ...stepEvent, formValue: "private form content" },
  { ...stepEvent, stepId: "private-free-form-value" },
  { ...stepEvent, tourId: "tour:attacker-controlled:v1" },
  { ...stepEvent, schemaVersion: 2 },
  { ...stepEvent, event: "arbitrary-event" },
  { ...stepEvent, stepId: undefined },
  {
    schemaVersion: ONBOARDING_ANALYTICS_SCHEMA_VERSION,
    event: "tour-completed",
    tourId: ONBOARDING_ANALYTICS_LEGACY_TOUR_ID,
    stepId: ONBOARDING_ANALYTICS_LEGACY_STEP_IDS[0],
  },
]) {
  assert.equal(parseOnboardingAnalyticsEvent(unsafeValue), null);
}

let deliveredBody = "";
assert.equal(
  queueOnboardingAnalyticsEvent(stepEvent, {
    readConsent: () => "declined",
    send: () => assert.fail("declined analytics must not be delivered"),
  }),
  "consent-required",
);
assert.equal(
  queueOnboardingAnalyticsEvent(stepEvent, {
    readConsent: () => "accepted",
    send: (body) => {
      deliveredBody = body;
    },
  }),
  "queued",
);
assert.deepEqual(JSON.parse(deliveredBody), stepEvent);
assert.equal(
  queueOnboardingAnalyticsEvent(stepEvent, {
    readConsent: () => "accepted",
    send: () => {
      throw new Error("transport unavailable");
    },
  }),
  "unavailable",
);
assert.equal(ONBOARDING_ANALYTICS_ENDPOINT, "/api/analytics/onboarding");
assert.equal(ONBOARDING_ANALYTICS_CONSENT_HEADER, "x-greyhoundiq-analytics-consent");
assert.match(
  readFileSync("src/components/cookie-consent.tsx", "utf8"),
  /const STORAGE_KEY = "greyhoundiq\.cookie-consent\.v1";/,
  "analytics consent must remain bound to the user-facing cookie preference",
);

const interactiveHelpSource = readFileSync(
  "src/components/interactive-help.tsx",
  "utf8",
);
assert.match(interactiveHelpSource, /queueOnboardingAnalyticsEvent\(/);
for (const event of ONBOARDING_ANALYTICS_EVENT_NAMES) {
  assert.ok(
    interactiveHelpSource.includes(`event: "${event}"`),
    `${event}: missing interactive-help transition instrumentation`,
  );
}
for (const forbiddenPayloadDimension of [
  "profileId:",
  "route:",
  "role:",
  "tier:",
  "email:",
  "message:",
  "formValue:",
]) {
  assert.equal(
    interactiveHelpSource.includes(
      `queueOnboardingAnalyticsEvent({\n      ${forbiddenPayloadDimension}`,
    ),
    false,
    `analytics call sites must not add ${forbiddenPayloadDimension}`,
  );
}

console.log(
  "Onboarding analytics contract passed: nine allowlisted consent-gated events and no identity, route, tier, role or free-form value fields.",
);
