import assert from "node:assert/strict";

import { togglePlannedRaceIds } from "./interactive-race-planner-prototype";

assert.deepEqual(togglePlannedRaceIds(["one"], "two"), ["one", "two"]);
assert.deepEqual(togglePlannedRaceIds(["one", "two"], "one"), ["two"]);

console.log("interactive race planner prototype tests passed");
