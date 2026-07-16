import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  INTERACTIVE_HELP_DEVICE_CLASSES,
  resolveInteractiveHelpPopupLayout,
  type InteractiveHelpDeviceClass,
  type InteractiveHelpViewport,
} from "./interactive-help-layout";
import { PRODUCT_MASTER_EVIDENCE } from "./master-audit-evidence";
import {
  PRODUCT_ONBOARDING_VIEWPORT_SOURCE_EVIDENCE_FILE,
  PRODUCT_ONBOARDING_VIEWPORT_SOURCE_EXPECTED_GAIN,
  PRODUCT_ONBOARDING_VIEWPORT_SOURCE_MASTER_EVIDENCE,
  PRODUCT_ONBOARDING_VIEWPORT_SOURCE_REQUIREMENT_IDS,
  PRODUCT_ONBOARDING_VIEWPORT_SOURCE_SCOPE,
  PRODUCT_ONBOARDING_VIEWPORT_SOURCE_TEST_FILE,
} from "./product-onboarding-viewport-source-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-ONBOARDING-VIEWPORT-SOURCE

const REQUIREMENT_ID = "GLOBAL.RESP.tour" as const;
const REQUIREMENT_TEXT = "Keep onboarding popovers within the viewport." as const;

assert.deepEqual(PRODUCT_ONBOARDING_VIEWPORT_SOURCE_REQUIREMENT_IDS, [
  REQUIREMENT_ID,
]);
assert.equal(PRODUCT_ONBOARDING_VIEWPORT_SOURCE_EXPECTED_GAIN, 1);
const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
  ({ id }) => id === REQUIREMENT_ID,
);
assert.ok(requirement, REQUIREMENT_ID);
assert.equal(requirement.requirement, REQUIREMENT_TEXT);

const record = PRODUCT_ONBOARDING_VIEWPORT_SOURCE_MASTER_EVIDENCE[REQUIREMENT_ID];
assert.equal(record.status, "tested");
assert.deepEqual(record.evidence.slice(0, 2), [
  PRODUCT_ONBOARDING_VIEWPORT_SOURCE_EVIDENCE_FILE,
  PRODUCT_ONBOARDING_VIEWPORT_SOURCE_TEST_FILE,
]);
assert.equal(new Set(record.evidence).size, record.evidence.length);
record.evidence.forEach((path) => assert.equal(existsSync(path), true, path));
assert.deepEqual(PRODUCT_MASTER_EVIDENCE[REQUIREMENT_ID], record);

const evidenceSource = source(PRODUCT_ONBOARDING_VIEWPORT_SOURCE_EVIDENCE_FILE);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);
assert.match(PRODUCT_ONBOARDING_VIEWPORT_SOURCE_SCOPE, /all eight declared device classes/i);
assert.match(PRODUCT_ONBOARDING_VIEWPORT_SOURCE_SCOPE, /Visual Viewport keyboard conditions/i);
assert.match(PRODUCT_ONBOARDING_VIEWPORT_SOURCE_SCOPE, /does not prove browser rendering/i);
assert.match(PRODUCT_ONBOARDING_VIEWPORT_SOURCE_SCOPE, /deployed viewport containment/i);
assert.match(PRODUCT_ONBOARDING_VIEWPORT_SOURCE_SCOPE, /any other global responsive requirement/i);

const viewportCases = [
  { expected: "small-phone", height: 568, width: 320 },
  { expected: "small-phone", height: 640, width: 360 },
  { expected: "large-phone", height: 812, width: 375 },
  { expected: "large-phone", height: 844, width: 390 },
  { expected: "large-phone", height: 932, width: 430 },
  { expected: "foldable", height: 720, width: 540 },
  { expected: "foldable", height: 512, width: 717 },
  { expected: "tablet-portrait", height: 1024, width: 768 },
  { expected: "tablet-landscape", height: 1180, width: 820 },
  { expected: "laptop", height: 768, width: 1024 },
  { expected: "desktop", height: 800, width: 1280 },
  { expected: "desktop", height: 900, width: 1440 },
  { expected: "wide-desktop", height: 1080, width: 1920 },
] as const satisfies readonly {
  expected: InteractiveHelpDeviceClass;
  height: number;
  width: number;
}[];

const observedDeviceClasses = new Set<InteractiveHelpDeviceClass>();
for (const testCase of viewportCases) {
  const viewport: InteractiveHelpViewport = {
    height: testCase.height,
    keyboardInset: 0,
    offsetTop: 0,
    width: testCase.width,
  };
  const layout = resolveInteractiveHelpPopupLayout(viewport, null);
  const bounds = popupVerticalBounds(layout);
  observedDeviceClasses.add(layout.deviceClass);
  assert.equal(layout.deviceClass, testCase.expected, `${testCase.width}px`);
  assert.ok(layout.width <= testCase.width - (layout.mobile ? 24 : 40));
  assert.ok(bounds.top >= viewport.offsetTop);
  assert.ok(
    bounds.bottom <=
      viewport.offsetTop + viewport.height - layout.navigationClearance,
  );
}
assert.deepEqual(
  [...observedDeviceClasses].toSorted(),
  [...INTERACTIVE_HELP_DEVICE_CLASSES].toSorted(),
);

const phoneViewport: InteractiveHelpViewport = {
  height: 844,
  keyboardInset: 0,
  offsetTop: 0,
  width: 390,
};
const upperLayout = resolveInteractiveHelpPopupLayout(phoneViewport, "upper");
const lowerLayout = resolveInteractiveHelpPopupLayout(phoneViewport, "lower");
const upperBounds = popupVerticalBounds(upperLayout);
const lowerBounds = popupVerticalBounds(lowerLayout);
assert.equal(upperLayout.scrollBlock, "start");
assert.equal(lowerLayout.scrollBlock, "end");
assert.ok(upperBounds.top >= phoneViewport.offsetTop);
assert.ok(
  lowerBounds.bottom <=
    phoneViewport.offsetTop +
      phoneViewport.height -
      lowerLayout.navigationClearance,
);

const keyboardViewport: InteractiveHelpViewport = {
  height: 360,
  keyboardInset: 420,
  offsetTop: 24,
  width: 390,
};
const keyboardLayout = resolveInteractiveHelpPopupLayout(
  keyboardViewport,
  "upper",
);
assert.equal(keyboardLayout.keyboardOpen, true);
assert.equal(keyboardLayout.navigationClearance, 12);
const keyboardBounds = popupVerticalBounds(keyboardLayout);
assert.ok(
  keyboardBounds.top >= keyboardViewport.offsetTop,
);
assert.ok(
  keyboardBounds.bottom <=
    keyboardViewport.offsetTop + keyboardViewport.height - 12,
);

const interactiveHelp = source("src/components/interactive-help.tsx");
const interactiveHelpStyles = source(
  "src/components/interactive-help.module.css",
);
for (const sourceContract of [
  /window\.visualViewport/,
  /visualViewport\?\.addEventListener\("resize", onChange\)/,
  /visualViewport\?\.addEventListener\("scroll", onChange\)/,
  /popupLayout\.maxHeight/,
  /popupLayout\.top/,
  /popupLayout\.width/,
  /var\(--giq-mobile-dock-clearance\)/,
]) {
  assert.match(interactiveHelp, sourceContract);
}
assert.match(
  interactiveHelpStyles,
  /\.content\s*{[\s\S]*?overscroll-behavior:\s*contain;/,
);

console.log(
  `Product onboarding viewport source evidence passed: ${viewportCases.length} cases across all ${INTERACTIVE_HELP_DEVICE_CLASSES.length} device classes preserve the bounded popover layout contract.`,
);

function source(path: string) {
  return readFileSync(path, "utf8");
}

function popupVerticalBounds(
  layout: ReturnType<typeof resolveInteractiveHelpPopupLayout>,
) {
  if (layout.placement === "above") {
    return { bottom: layout.top, top: layout.top - layout.maxHeight };
  }
  return { bottom: layout.top + layout.maxHeight, top: layout.top };
}
