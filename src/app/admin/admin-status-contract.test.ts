import assert from "node:assert/strict";

import { assertAdminResourceMutation } from "./admin-status-contract";

assert.doesNotThrow(() =>
  assertAdminResourceMutation("paymentRecord", "succeeded", undefined)
);
assert.doesNotThrow(() =>
  assertAdminResourceMutation("retentionPolicy", undefined, false)
);
assert.throws(
  () => assertAdminResourceMutation("paymentRecord", "forged", undefined),
  /admin\.invalid_status/
);
assert.throws(
  () => assertAdminResourceMutation("paymentRecord", undefined, true),
  /admin\.invalid_enabled_resource/
);
assert.throws(
  () => assertAdminResourceMutation("plan", "active", true),
  /admin\.invalid_resource_mutation/
);
assert.throws(
  () => assertAdminResourceMutation("plan", undefined, undefined),
  /admin\.invalid_resource_mutation/
);

console.log("admin status contract tests passed");
