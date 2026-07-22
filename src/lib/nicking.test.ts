import assert from "node:assert/strict";

import { nickVerdict } from "./nicking";

// Beats both parents -> over.
assert.equal(nickVerdict(40, 20, 30), "over");
// Below both -> under.
assert.equal(nickVerdict(10, 20, 30), "under");
// Between the two -> mixed.
assert.equal(nickVerdict(25, 20, 30), "mixed");
// One baseline available and beaten -> over.
assert.equal(nickVerdict(40, null, 30), "over");
// No cross strike -> no verdict.
assert.equal(nickVerdict(null, 20, 30), null);
// No baselines -> no verdict.
assert.equal(nickVerdict(40, null, null), null);

console.log("nicking passed");
