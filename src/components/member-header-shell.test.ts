import assert from "node:assert/strict";

import {
  getMemberSectionLabel,
  nextMemberHeaderState,
} from "./member-header-shell";

assert.deepEqual(
  nextMemberHeaderState({ compact: false, anchorY: 0 }, 10),
  { compact: false, anchorY: 10 }
);

let state = nextMemberHeaderState({ compact: false, anchorY: 0 }, 30);
assert.deepEqual(state, { compact: true, anchorY: 30 });

state = nextMemberHeaderState(state, 52);
assert.deepEqual(state, { compact: true, anchorY: 52 });

state = nextMemberHeaderState(state, 38);
assert.deepEqual(state, { compact: true, anchorY: 52 });

state = nextMemberHeaderState(state, 27);
assert.deepEqual(state, { compact: false, anchorY: 27 });

assert.deepEqual(
  nextMemberHeaderState({ compact: true, anchorY: 80 }, 70, true),
  { compact: false, anchorY: 70 }
);
assert.deepEqual(
  nextMemberHeaderState({ compact: true, anchorY: 80 }, 4),
  { compact: false, anchorY: 4 }
);

assert.equal(getMemberSectionLabel("/"), "Home");
assert.equal(getMemberSectionLabel("/feed"), "Feed");
assert.equal(getMemberSectionLabel("/pulse/friends"), "Chat");
assert.equal(getMemberSectionLabel("/messages/123"), "Chat");
assert.equal(getMemberSectionLabel("/account/security"), "Account");

console.log("member header shell tests passed");
