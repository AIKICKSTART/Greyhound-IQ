import assert from "node:assert/strict";

import { isDogId } from "./dog-id";

assert.equal(isDogId("hist_dog_947667064e6139a50a2763608e238b35"), true);
assert.equal(isDogId("39a43be8-c1c0-4a7b-8114-78f855ad14c6"), true);
assert.equal(isDogId(""), false);
assert.equal(isDogId("../dog"), false);
assert.equal(isDogId("a".repeat(65)), false);

process.stdout.write("dog-id passed\n");
