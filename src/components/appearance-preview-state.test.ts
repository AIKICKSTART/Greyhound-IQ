import assert from "node:assert/strict";

import {
  getAppearancePreviewQuery,
  resolveAppearancePreviewState,
  resolveSponsoredMarketplaceVisibility,
} from "./appearance-preview-state";

// screen-evidence-test-id: DL-APPEARANCE-PREVIEW

assert.deepEqual(resolveAppearancePreviewState({}), {
  app: "A1",
  dock: "D1",
  market: "M1",
  sponsored: "on",
});

assert.deepEqual(
  resolveAppearancePreviewState({
    app: "C2",
    dock: "D4",
    market: "M6",
    sponsored: "off",
  }),
  { app: "C2", dock: "D4", market: "M6", sponsored: "off" }
);

assert.deepEqual(
  resolveAppearancePreviewState({
    app: "A2",
    dock: "D9",
    market: "M0",
    sponsored: "sometimes",
  }),
  { app: "A2", dock: "D5", market: "M1", sponsored: "on" }
);

assert.deepEqual(
  resolveAppearancePreviewState({
    app: ["B2", "C1"],
    dock: ["D2", "D3"],
    market: ["M4", "M5"],
    sponsored: ["off", "on"],
  }),
  { app: "B2", dock: "D2", market: "M4", sponsored: "off" }
);

assert.equal(
  getAppearancePreviewQuery({
    app: "B1",
    dock: "D4",
    market: "M3",
    sponsored: "off",
  }),
  "app=B1&dock=D4&market=M3&sponsored=off"
);

assert.equal(resolveSponsoredMarketplaceVisibility("off"), "off");
assert.equal(resolveSponsoredMarketplaceVisibility("on"), "on");
assert.equal(resolveSponsoredMarketplaceVisibility("injected"), "on");
assert.equal(resolveSponsoredMarketplaceVisibility(["off", "on"]), "off");

console.log("Appearance preview state tests passed");
