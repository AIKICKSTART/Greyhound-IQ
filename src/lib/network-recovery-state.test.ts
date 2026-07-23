import assert from "node:assert/strict";

import {
  initialNetworkRecoveryState,
  transitionNetworkRecoveryState,
} from "./network-recovery-state";

assert.equal(initialNetworkRecoveryState(true), "online");
assert.equal(initialNetworkRecoveryState(false), "offline");
assert.equal(transitionNetworkRecoveryState("online", false), "offline");
assert.equal(transitionNetworkRecoveryState("offline", false), "offline");
assert.equal(transitionNetworkRecoveryState("offline", true), "restored");
assert.equal(transitionNetworkRecoveryState("restored", false), "offline");
assert.equal(transitionNetworkRecoveryState("restored", true), "restored");

console.log("network recovery state tests passed");
