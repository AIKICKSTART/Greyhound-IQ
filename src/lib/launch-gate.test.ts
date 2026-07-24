import assert from "node:assert/strict";

import {
  createLaunchPreviewToken,
  isLaunchGateBypassPath,
  isLaunchPreviewEmail,
  launchGateResponse,
  resolveLaunchGateState,
  verifyLaunchPreviewToken,
} from "./launch-gate";

async function main() {
  const launchAt = Date.parse("2026-07-25T17:00:00+10:00");
  const beforeLaunch = launchAt - 60_000;
  const secret = "a".repeat(64);

  const active = resolveLaunchGateState(
    {
      LAUNCH_GATE_ENABLED: "true",
      LAUNCH_GATE_END_AT: "2026-07-25T17:00:00+10:00",
    },
    beforeLaunch,
  );
  assert.equal(active.active, true);
  assert.equal(active.configured, true);
  assert.equal(active.launchAt, launchAt);
  assert.equal(active.retryAfterSeconds, 60);
  assert.equal(
    resolveLaunchGateState(
      {
        LAUNCH_GATE_ENABLED: "true",
        LAUNCH_GATE_END_AT: "2026-07-25T17:00:00+10:00",
      },
      launchAt,
    ).active,
    false,
  );
  assert.equal(resolveLaunchGateState({}, beforeLaunch).active, false);
  assert.equal(
    resolveLaunchGateState({ LAUNCH_GATE_ENABLED: "true" }, beforeLaunch)
      .configured,
    false,
  );

  for (const path of [
    "/sign-in",
    "/callback",
    "/launch-preview",
    "/auth/error",
    "/api/health/ready",
    "/api/internal/live-sync",
    "/api/webhooks/stripe",
    "/api/livekit/webhook",
  ]) {
    assert.equal(isLaunchGateBypassPath(path), true, path);
  }
  for (const path of ["/", "/tracks", "/admin", "/api/dogs/search"]) {
    assert.equal(isLaunchGateBypassPath(path), false, path);
  }

  assert.equal(
    isLaunchPreviewEmail(
      "ADMIN@EXAMPLE.COM",
      "owner@example.com, admin@example.com",
    ),
    true,
  );
  assert.equal(
    isLaunchPreviewEmail("other@example.com", "owner@example.com"),
    false,
  );

  const token = createLaunchPreviewToken("Admin@Example.com", secret, launchAt);
  assert.deepEqual(
    verifyLaunchPreviewToken(token, secret, launchAt, beforeLaunch),
    {
      email: "admin@example.com",
      expiresAt: launchAt,
    },
  );
  assert.equal(
    verifyLaunchPreviewToken(`${token}x`, secret, launchAt, beforeLaunch),
    null,
  );
  assert.equal(
    verifyLaunchPreviewToken(token, "b".repeat(64), launchAt, beforeLaunch),
    null,
  );
  assert.equal(
    verifyLaunchPreviewToken(token, secret, launchAt, launchAt),
    null,
  );

  const htmlResponse = launchGateResponse(
    new Request("https://greyhoundsiq.com.au/?preview=denied", {
      headers: { accept: "text/html", "sec-fetch-dest": "document" },
    }),
    active,
    "test-nonce",
    beforeLaunch,
  );
  assert.equal(htmlResponse.status, 200);
  assert.equal(htmlResponse.headers.get("cache-control"), "private, no-store");
  assert.equal(htmlResponse.headers.get("x-robots-tag"), "noindex, nofollow");
  const html = await htmlResponse.text();
  assert.match(html, /5:00 PM AEST/);
  assert.match(html, /Admin preview/);
  assert.match(html, /launch-panther-20260724\.avif/);
  assert.match(html, /launch-panther-mobile-20260724\.webp/);
  assert.match(html, /not approved for pre-launch access/);
  assert.match(html, /nonce="test-nonce"/);
  assert.match(html, new RegExp(`var target = ${launchAt}`));

  const apiResponse = launchGateResponse(
    new Request("https://greyhoundsiq.com.au/api/dogs/search", {
      headers: { accept: "application/json" },
    }),
    active,
    "test-nonce",
    beforeLaunch,
  );
  assert.equal(apiResponse.status, 503);
  assert.equal(apiResponse.headers.get("retry-after"), "60");
  assert.deepEqual(await apiResponse.json(), {
    error: {
      code: "service.launch_pending",
      message: "Greyhounds IQ opens at 5:00 PM AEST on 25 July 2026",
    },
  });

  console.log("launch gate tests passed");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
