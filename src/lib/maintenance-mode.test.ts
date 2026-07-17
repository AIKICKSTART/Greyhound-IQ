import assert from "node:assert/strict";

import {
  isMaintenanceBypassPath,
  maintenanceModeResponse,
} from "./maintenance-mode";

async function main() {
  for (const path of [
    "/api/health",
    "/api/health/ready",
    "/api/internal/call-maintenance",
    "/api/webhooks/stripe",
  ]) {
    assert.equal(isMaintenanceBypassPath(path), true, path);
  }
  for (const path of ["/", "/feed", "/api/dogs/search", "/callback"]) {
    assert.equal(isMaintenanceBypassPath(path), false, path);
  }

  const htmlResponse = maintenanceModeResponse(
    new Request("https://greyhoundsiq.com.au/feed", {
      headers: { accept: "text/html", "sec-fetch-dest": "document" },
    }),
  );
  assert.equal(htmlResponse.status, 503);
  assert.equal(htmlResponse.headers.get("cache-control"), "no-store");
  assert.equal(htmlResponse.headers.get("retry-after"), "60");
  assert.equal(htmlResponse.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.match(htmlResponse.headers.get("content-type") ?? "", /^text\/html/);
  const html = await htmlResponse.text();
  assert.match(html, /GreyhoundIQ will be back shortly/);
  assert.match(html, /Try GreyhoundIQ again/);
  assert.doesNotMatch(html, /<script/i);

  const apiResponse = maintenanceModeResponse(
    new Request("https://greyhoundsiq.com.au/api/dogs/search", {
      method: "POST",
      headers: { accept: "application/json" },
    }),
  );
  assert.equal(apiResponse.status, 503);
  assert.equal(apiResponse.headers.get("retry-after"), "60");
  assert.deepEqual(await apiResponse.json(), {
    error: {
      code: "service.maintenance",
      message: "GreyhoundIQ is temporarily unavailable for maintenance",
    },
  });

  console.log("maintenance mode response tests passed");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
