import assert from "node:assert/strict";

import {
  DESIGN_LAB_ROLES,
  ROLE_REVIEW_FRAMES,
  getRoleReviewFrame,
  getRoleReviewFrameId,
  isDesignLabRole,
} from "./design-lab-role-blueprints";

// screen-evidence-test-id: DL-ROLE-BLUEPRINT

assert.deepEqual(
  DESIGN_LAB_ROLES.map((role) => role.key),
  ["business", "trainer", "owner", "punter"]
);
assert.equal(isDesignLabRole("trainer"), true);
assert.equal(isDesignLabRole("member"), false);
assert.equal(isDesignLabRole(undefined), false);

for (const role of DESIGN_LAB_ROLES) {
  assert.equal(role.priorities.length, 3);
  assert.ok(role.promise.length > 20);
}

assert.equal(ROLE_REVIEW_FRAMES.length, 72);
assert.equal(
  new Set(ROLE_REVIEW_FRAMES.map((frame) => frame.id)).size,
  ROLE_REVIEW_FRAMES.length
);
assert.deepEqual(
  ROLE_REVIEW_FRAMES.map((frame) => frame.ordinal),
  Array.from({ length: 72 }, (_, index) => index + 1)
);

assert.equal(
  getRoleReviewFrameId("owner", "B2", "tablet"),
  "ROLE-OWNER-B2-TABLET"
);
assert.deepEqual(getRoleReviewFrame("punter", "C2", "mobile"), {
  id: "ROLE-PUNTER-C2-MOBILE",
  ordinal: 72,
  role: "punter",
  variant: "C2",
  device: "mobile",
  width: 402,
  height: 874,
  targetHref: "/design-lab/role-blueprints?role=punter&variant=C2",
});

console.log("Design Lab role blueprint registry tests passed");
