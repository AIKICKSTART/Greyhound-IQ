import assert from "node:assert/strict";

import {
  PROTOTYPE_DEVICES,
  PROTOTYPE_REVIEW_COMPONENTS,
  PROTOTYPE_REVIEW_FRAMES,
  PROTOTYPE_TEMPLATE_COMPOSITIONS,
  PROTOTYPE_VARIANTS,
  getPrototypePlannerDensity,
  getPrototypeReviewFrame,
  getPrototypeReviewFrameId,
  getPrototypeReviewId,
  getPrototypeSocialMode,
  isPrototypeDevice,
  isPrototypeVariant,
} from "./prototype-variants";

// screen-evidence-test-id: DL-PROTOTYPE-REGISTRY

assert.deepEqual(
  PROTOTYPE_VARIANTS.map((variant) => variant.key),
  ["A1", "A2", "B1", "B2", "C1", "C2"]
);
assert.equal(isPrototypeVariant("B2"), true);
assert.equal(isPrototypeVariant("A"), false);
assert.equal(isPrototypeVariant(undefined), false);

assert.deepEqual(PROTOTYPE_TEMPLATE_COMPOSITIONS, {
  A1: {
    family: "command",
    hero: "full",
    planner: "below",
    feed: "balanced",
    recommendedDock: "D1",
  },
  A2: {
    family: "command",
    hero: "compact",
    planner: "below",
    feed: "compact",
    recommendedDock: "D5",
  },
  B1: {
    family: "cockpit",
    hero: "split",
    planner: "split",
    feed: "technical",
    recommendedDock: "D4",
  },
  B2: {
    family: "cockpit",
    hero: "integrated",
    planner: "integrated",
    feed: "workspace",
    recommendedDock: "D2",
  },
  C1: {
    family: "social",
    hero: "expanded",
    planner: "below",
    feed: "expanded",
    recommendedDock: "D3",
  },
  C2: {
    family: "social",
    hero: "compact",
    planner: "below",
    feed: "dense",
    recommendedDock: "D6",
  },
});

assert.deepEqual(
  PROTOTYPE_DEVICES.map((device) => device.key),
  ["desktop", "tablet", "mobile"]
);
assert.equal(isPrototypeDevice("tablet"), true);
assert.equal(isPrototypeDevice("watch"), false);
assert.equal(isPrototypeDevice(undefined), false);

assert.deepEqual(
  PROTOTYPE_VARIANTS.map((variant) => getPrototypeSocialMode(variant.key)),
  [null, null, null, null, "expanded", "compact"]
);
assert.deepEqual(
  PROTOTYPE_VARIANTS.map((variant) => getPrototypePlannerDensity(variant.key)),
  ["standard", "compact", "standard", "standard", "standard", "compact"]
);

assert.equal(PROTOTYPE_REVIEW_FRAMES.length, 18);
assert.equal(
  new Set(PROTOTYPE_REVIEW_FRAMES.map((frame) => frame.id)).size,
  PROTOTYPE_REVIEW_FRAMES.length
);
assert.deepEqual(
  PROTOTYPE_REVIEW_FRAMES.map((frame) => frame.ordinal),
  Array.from({ length: 18 }, (_, index) => index + 1)
);
assert.deepEqual(getPrototypeReviewFrame("C1", "tablet"), {
  id: "C1-TABLET-FRAME",
  ordinal: 14,
  variant: "C1",
  device: "tablet",
  width: 834,
  height: 1210,
  targetHref: "/feed?variant=C1&demo=1",
  previewHref: "/feed/device-preview?device=tablet&variant=C1",
});
assert.equal(
  getPrototypeReviewFrameId("C2", "mobile"),
  "C2-MOBILE-FRAME"
);

assert.deepEqual(PROTOTYPE_REVIEW_COMPONENTS, [
  { key: "SHELL", label: "App shell" },
  { key: "HEADER", label: "Member header" },
  { key: "RACE-NAV", label: "Race navigation" },
  { key: "RACE-PLANNER", label: "Race planner" },
  { key: "PROFILE", label: "Profile" },
  { key: "FEED-COMPOSER", label: "Feed composer" },
  { key: "FEED", label: "Community feed" },
  { key: "MARKETPLACE", label: "Marketplace showcase" },
  { key: "CHAT", label: "Chat surfaces" },
  { key: "DOCK", label: "Persistent dock" },
]);

const reviewCombinations = PROTOTYPE_VARIANTS.flatMap((variant) =>
  PROTOTYPE_DEVICES.map((device) => `${variant.key}-${device.key}`)
);
assert.equal(reviewCombinations.length, 18);
assert.equal(new Set(reviewCombinations).size, 18);

assert.equal(
  getPrototypeReviewId("A1", "mobile", "RACE-NAV"),
  "A1-MOBILE-RACE-NAV"
);

const reviewIds = PROTOTYPE_VARIANTS.flatMap((variant) =>
  PROTOTYPE_DEVICES.flatMap((device) =>
    PROTOTYPE_REVIEW_COMPONENTS.map((component) =>
      getPrototypeReviewId(variant.key, device.key, component.key)
    )
  )
);
assert.equal(
  new Set(reviewIds).size,
  PROTOTYPE_VARIANTS.length *
    PROTOTYPE_DEVICES.length *
    PROTOTYPE_REVIEW_COMPONENTS.length
);

console.log("prototype review registry tests passed");
