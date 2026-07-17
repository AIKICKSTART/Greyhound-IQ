import assert from "node:assert/strict";

import {
  DOCK_ACTION_REGISTRY,
  DOCK_SKIN_REGISTRY,
  isDockSkinKey,
} from "./dock-skin-catalogue";

// screen-evidence-test-id: DL-DOCK-CATALOGUE

assert.deepEqual(
  DOCK_ACTION_REGISTRY.map((action) => action.key),
  ["home", "feed", "post", "chat", "menu"]
);

assert.deepEqual(
  DOCK_SKIN_REGISTRY.map((skin) => skin.key),
  ["D1", "D2", "D3", "D4", "D5", "D6"]
);

assert.deepEqual(
  DOCK_SKIN_REGISTRY.map((skin) => skin.label),
  [
    "Carbon Rail",
    "Gold Pulse",
    "Purple Glass",
    "Race Grid",
    "Minimal Chrome",
    "Floating Pods",
  ]
);

assert.deepEqual(
  Object.fromEntries(
    DOCK_SKIN_REGISTRY.map((skin) => [skin.key, skin.recommendedVariant])
  ),
  { D1: "A1", D2: "B2", D3: "C1", D4: "B1", D5: "A2", D6: "C2" }
);

assert.equal(new Set(DOCK_SKIN_REGISTRY.map((skin) => skin.key)).size, 6);
assert.equal(DOCK_SKIN_REGISTRY.every((skin) => skin.detail.length > 20), true);
assert.equal(
  ["D1", "D2", "D3", "D4", "D5", "D6"].every(isDockSkinKey),
  true
);
assert.equal(isDockSkinKey("D7"), false);
assert.equal(isDockSkinKey(null), false);
assert.equal(isDockSkinKey(undefined), false);

console.log("dock skin catalogue contract tests passed");
