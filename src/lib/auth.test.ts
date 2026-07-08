import assert from "node:assert/strict";

import { isAdminRole, isModeratorRole } from "@/lib/auth-roles";
import { authLookupWhere } from "@/lib/auth-sync";
import { assertPaidFeatureAccess, hasTier } from "@/lib/tier-access";

// Unverified email must NOT fall back to email matching (account-takeover guard).
assert.deepEqual(authLookupWhere("wos_1", "a@b.com", false), {
  workosUserId: "wos_1",
});
// Verified or unknown keeps the email fallback for legacy account linking.
assert.deepEqual(authLookupWhere("wos_1", "a@b.com", true), {
  OR: [{ workosUserId: "wos_1" }, { email: "a@b.com" }],
});
assert.deepEqual(authLookupWhere("wos_1", "a@b.com"), {
  OR: [{ workosUserId: "wos_1" }, { email: "a@b.com" }],
});

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
