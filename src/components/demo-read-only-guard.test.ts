import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { isDemoMutationSubmission } from "./demo-read-only-guard";

assert.equal(isDemoMutationSubmission("post", false), true);
assert.equal(isDemoMutationSubmission(" POST ", false), true);
assert.equal(isDemoMutationSubmission(null, true), true);
assert.equal(isDemoMutationSubmission("get", false), false);
assert.equal(isDemoMutationSubmission(null, false), false);

const layoutSource = readFileSync(join(__dirname, "../app/layout.tsx"), "utf8");
const realtimeSource = readFileSync(join(__dirname, "realtime-refresh.tsx"), "utf8");
assert.ok(
  layoutSource.includes('data-demo-read-only={fullAccessDemo ? "true" : undefined}'),
);
assert.ok(
  layoutSource.includes(
    "!suppressDemoOverlays && !fullAccessDemo ? <CookieConsentBanner /> : null",
  ),
);
assert.ok(
  realtimeSource.includes('document.body.dataset.demoReadOnly === "true"'),
);

console.log("demo read-only guard tests passed");
