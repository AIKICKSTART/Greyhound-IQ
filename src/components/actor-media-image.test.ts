import assert from "node:assert/strict";

import { actorMediaStyle } from "./actor-media-image";

assert.deepEqual(actorMediaStyle({}), {
  objectPosition: "50% 50%",
  transform: "rotate(0deg) scale(1)",
});
assert.deepEqual(
  actorMediaStyle({ focalX: 0.25, focalY: 0.75, zoom: 1.5, rotation: 90 }),
  {
    objectPosition: "25% 75%",
    transform: "rotate(90deg) scale(1.5)",
  }
);

console.log("actor media image tests passed");
