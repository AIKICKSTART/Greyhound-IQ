import assert from "node:assert/strict";

import {
  DEFAULT_MESSENGER_LAYOUT,
  MESSENGER_LAYOUTS,
  messengerLayoutSchema,
  normalizeMessengerLayout,
} from "./messenger-layout";

assert.deepEqual(MESSENGER_LAYOUTS, ["dual", "adaptive", "compact"]);
assert.equal(DEFAULT_MESSENGER_LAYOUT, "dual");

for (const layout of MESSENGER_LAYOUTS) {
  assert.equal(messengerLayoutSchema.parse(layout), layout);
  assert.equal(normalizeMessengerLayout(layout), layout);
}

assert.equal(normalizeMessengerLayout("admin"), DEFAULT_MESSENGER_LAYOUT);
assert.equal(normalizeMessengerLayout({ layout: "compact" }), DEFAULT_MESSENGER_LAYOUT);
assert.equal(messengerLayoutSchema.safeParse("dual<script>").success, false);

console.log("messenger layout tests passed");
