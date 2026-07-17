import assert from "node:assert/strict";

import {
  DEMO_ADMIN_DISPLAY_NAME,
  DEMO_ADMIN_EMAIL,
  isDemoReadMethod,
  isDemoOverlayRequest,
  isFullAccessDemo,
} from "@/lib/demo-access";

assert.equal(DEMO_ADMIN_EMAIL, "admin@greyhoundiq.test");
assert.equal(DEMO_ADMIN_DISPLAY_NAME, "Adele Admin");
assert.equal(
  isFullAccessDemo({ APP_ENV: "demo", DEMO_AUTH_MODE: "full-access" }),
  true
);
assert.equal(
  isFullAccessDemo({ APP_ENV: "production", DEMO_AUTH_MODE: "full-access" }),
  false
);
assert.equal(
  isFullAccessDemo({ APP_ENV: "demo", DEMO_AUTH_MODE: "readonly" }),
  false
);
assert.equal(isFullAccessDemo({}), false);

assert.equal(isDemoReadMethod("GET"), true);
assert.equal(isDemoReadMethod("head"), true);
assert.equal(isDemoReadMethod("OPTIONS"), true);
assert.equal(isDemoReadMethod("POST"), false);
assert.equal(isDemoReadMethod("DELETE"), false);

assert.equal(isDemoOverlayRequest("iframe", null), true);
assert.equal(isDemoOverlayRequest("document", "admin-frames"), true);
assert.equal(isDemoOverlayRequest("document", null), false);

console.log("demo access gate tests passed");
