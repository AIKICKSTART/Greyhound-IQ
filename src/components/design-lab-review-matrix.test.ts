import assert from "node:assert/strict";

import { ROLE_REVIEW_FRAMES } from "./design-lab-role-blueprints";
import { DOCK_SKIN_REGISTRY } from "./dock-skin-catalogue";
import {
  APP_DOCK_REVIEW_FRAMES,
  DESIGN_LAB_REVIEW_DECISION,
  DESIGN_LAB_REVIEW_MATRIX,
  DESIGN_LAB_REVIEW_READINESS,
  MARKETPLACE_REVIEW_FRAMES,
  ROLE_APP_REVIEW_FRAMES,
  getAppDockReviewFrame,
  getAppDockReviewFrameId,
  getMarketplaceReviewFrameId,
  resolveAppDockReviewSelection,
} from "./design-lab-review-matrix";
import { MARKETPLACE_TEMPLATE_OPTIONS } from "./marketplace-template-variants";
import { PROTOTYPE_DEVICES, PROTOTYPE_VARIANTS } from "./prototype-variants";

// screen-evidence-test-id: DL-REVIEW-MATRIX

function assertSequence(frames: readonly { id: string; ordinal: number }[]) {
  assert.equal(new Set(frames.map((frame) => frame.id)).size, frames.length);
  assert.deepEqual(
    frames.map((frame) => frame.ordinal),
    Array.from({ length: frames.length }, (_, index) => index + 1)
  );
}

function assertViewportMetadata(
  frames: readonly {
    device: (typeof PROTOTYPE_DEVICES)[number]["key"];
    width: number;
    height: number;
  }[]
) {
  for (const frame of frames) {
    const device = PROTOTYPE_DEVICES.find(
      (candidate) => candidate.key === frame.device
    )!;
    assert.deepEqual(
      { width: frame.width, height: frame.height },
      { width: device.width, height: device.height }
    );
  }
}

assert.equal(
  APP_DOCK_REVIEW_FRAMES.length,
  PROTOTYPE_VARIANTS.length *
    DOCK_SKIN_REGISTRY.length *
    PROTOTYPE_DEVICES.length
);
assert.equal(APP_DOCK_REVIEW_FRAMES.length, 108);
assertSequence(APP_DOCK_REVIEW_FRAMES);
assertViewportMetadata(APP_DOCK_REVIEW_FRAMES);
assert.equal(
  getAppDockReviewFrameId("B2", "D4", "tablet"),
  "APP-B2-D4-TABLET"
);
assert.deepEqual(APP_DOCK_REVIEW_FRAMES.at(0), {
  id: "APP-A1-D1-DESKTOP",
  ordinal: 1,
  variant: "A1",
  dock: "D1",
  device: "desktop",
  width: 1440,
  height: 1000,
  targetHref: "/feed/device-preview?device=desktop&variant=A1&dock=D1&sponsored=on",
});
assert.deepEqual(APP_DOCK_REVIEW_FRAMES.at(-1), {
  id: "APP-C2-D6-MOBILE",
  ordinal: 108,
  variant: "C2",
  dock: "D6",
  device: "mobile",
  width: 402,
  height: 874,
  targetHref: "/feed/device-preview?device=mobile&variant=C2&dock=D6&sponsored=on",
});
for (const frame of APP_DOCK_REVIEW_FRAMES) {
  assert.equal(
    frame.targetHref,
    `/feed/device-preview?device=${frame.device}&variant=${frame.variant}&dock=${frame.dock}&sponsored=on`
  );
}
assert.equal(
  getAppDockReviewFrame("B2", "D4", "tablet").id,
  "APP-B2-D4-TABLET"
);
assert.deepEqual(resolveAppDockReviewSelection({}), {
  device: "mobile",
  dock: "D1",
  variant: "A1",
});
assert.deepEqual(
  resolveAppDockReviewSelection({
    device: ["watch", "desktop"],
    dock: ["D7", "D2"],
    variant: ["Z9", "C2"],
  }),
  { device: "mobile", dock: "D1", variant: "A1" }
);
assert.deepEqual(
  resolveAppDockReviewSelection({
    device: "tablet",
    dock: "D6",
    variant: "C2",
  }),
  { device: "tablet", dock: "D6", variant: "C2" }
);

assert.equal(ROLE_APP_REVIEW_FRAMES.length, ROLE_REVIEW_FRAMES.length);
assert.equal(ROLE_APP_REVIEW_FRAMES.length, 72);
assertSequence(ROLE_APP_REVIEW_FRAMES);
assertViewportMetadata(ROLE_APP_REVIEW_FRAMES);
for (const [index, frame] of ROLE_APP_REVIEW_FRAMES.entries()) {
  const sourceFrame = ROLE_REVIEW_FRAMES[index]!;
  assert.deepEqual(
    { ...frame, targetHref: sourceFrame.targetHref },
    sourceFrame
  );
  assert.equal(
    frame.targetHref,
    `/design-lab/role-blueprints?role=${frame.role}&variant=${frame.variant}`
  );
}

assert.equal(
  MARKETPLACE_REVIEW_FRAMES.length,
  MARKETPLACE_TEMPLATE_OPTIONS.length * PROTOTYPE_DEVICES.length
);
assert.equal(MARKETPLACE_REVIEW_FRAMES.length, 18);
assertSequence(MARKETPLACE_REVIEW_FRAMES);
assertViewportMetadata(MARKETPLACE_REVIEW_FRAMES);
assert.equal(
  getMarketplaceReviewFrameId("M5", "mobile"),
  "MARKETPLACE-M5-MOBILE"
);
for (const frame of MARKETPLACE_REVIEW_FRAMES) {
  assert.equal(
    frame.targetHref,
    `/marketplace/design-lab?template=${frame.template}`
  );
}

assert.equal(DESIGN_LAB_REVIEW_MATRIX.appDock, APP_DOCK_REVIEW_FRAMES);
assert.equal(DESIGN_LAB_REVIEW_MATRIX.roles, ROLE_APP_REVIEW_FRAMES);
assert.equal(
  DESIGN_LAB_REVIEW_MATRIX.marketplace,
  MARKETPLACE_REVIEW_FRAMES
);
assert.deepEqual(DESIGN_LAB_REVIEW_MATRIX.sourceCounts, {
  variants: 6,
  docks: 6,
  roles: 4,
  marketplaceTemplates: 6,
  devices: 3,
});
assert.deepEqual(DESIGN_LAB_REVIEW_READINESS, {
  registry: "ready",
  screenshots: "captured",
  designApproval: "approved",
});
assert.equal(
  DESIGN_LAB_REVIEW_MATRIX.readiness,
  DESIGN_LAB_REVIEW_READINESS
);
assert.deepEqual(DESIGN_LAB_REVIEW_DECISION, {
  appVariant: "B2",
  dock: "D2",
  marketplaceTemplate: "M1",
  authority: "user-delegated-yolo",
  rationale:
    "The integrated racing workspace keeps planning, race discovery and review in one responsive surface; Gold Pulse gives the persistent dock a clear hierarchy; Grandstand Market provides the strongest public-profile discovery path.",
  evidence: {
    appDock: "output/orchestration/design-captures/app-dock-20260712/manifest.json",
    roles: "output/orchestration/design-captures/roles-20260712/manifest.json",
    marketplace:
      "output/orchestration/design-captures/marketplace-20260712/manifest.json",
  },
});
assert.equal(DESIGN_LAB_REVIEW_MATRIX.decision, DESIGN_LAB_REVIEW_DECISION);

console.log("Design Lab review matrix contract tests passed");
