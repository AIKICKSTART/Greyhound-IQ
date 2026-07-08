import assert from "node:assert/strict";

import { isAdminRole, isModeratorRole } from "@/lib/auth-roles";
import { assertPaidFeatureAccess, hasTier } from "@/lib/tier-access";

assert.throws(
  () => assertPaidFeatureAccess({ tier: "free" }),
  /payment\.required/
);
assert.doesNotThrow(() => assertPaidFeatureAccess({ tier: "pro" }));
assert.doesNotThrow(() => assertPaidFeatureAccess({ tier: "pro_plus" }));
assert.equal(hasTier("free", "pro"), false);
assert.equal(hasTier("pro", "pro"), true);
assert.equal(isAdminRole("admin"), true);
assert.equal(isAdminRole("moderator"), false);
assert.equal(isAdminRole(null), false);
assert.equal(isModeratorRole("admin"), true);
assert.equal(isModeratorRole("moderator"), true);
assert.equal(isModeratorRole("member"), false);

console.log("auth paid feature access tests passed");
