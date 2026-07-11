import assert from "node:assert/strict";

import {
  clampFocalPoint,
  focalPointAfterDrag,
  normalizeRotation,
} from "./media-focal-point-editor";

assert.equal(clampFocalPoint(-1), 0);
assert.equal(clampFocalPoint(0.42), 0.42);
assert.equal(clampFocalPoint(2), 1);
assert.equal(clampFocalPoint(Number.NaN), 0.5);
assert.equal(focalPointAfterDrag(0.5, 50, 200), 0.25);
assert.equal(focalPointAfterDrag(0.5, -50, 200), 0.75);
assert.equal(focalPointAfterDrag(0.5, 50, 0), 0.5);
assert.equal(normalizeRotation(90), 90);
assert.equal(normalizeRotation(-90), 270);
assert.equal(normalizeRotation(450), 90);

console.log("media focal point editor tests passed");
