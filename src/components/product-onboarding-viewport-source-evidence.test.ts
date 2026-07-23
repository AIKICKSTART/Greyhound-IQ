import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  INTERACTIVE_HELP_DEVICE_CLASSES,
  resolveInteractiveHelpPopupLayout,
  type InteractiveHelpDeviceClass,
  type InteractiveHelpPopupLayout,
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
  { expected: "large-phone", height: 956, width: 440 },
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
    bottomInset: testCase.width < 1024 ? 76 : 0,
    height: testCase.height,
    keyboardInset: 0,
    offsetLeft: 0,
    offsetTop: 0,
    topInset: testCase.width < 1024 ? 72 : 150,
    width: testCase.width,
  };
  const layout = resolveInteractiveHelpPopupLayout(viewport, null);
  observedDeviceClasses.add(layout.deviceClass);
  assert.equal(layout.deviceClass, testCase.expected, `${testCase.width}px`);
  assertPopupFits(viewport, layout);
}
assert.deepEqual(
  [...observedDeviceClasses].toSorted(),
  [...INTERACTIVE_HELP_DEVICE_CLASSES].toSorted(),
);

const phoneViewport: InteractiveHelpViewport = {
  bottomInset: 76,
  height: 844,
  keyboardInset: 0,
  offsetLeft: 0,
  offsetTop: 0,
  topInset: 64,
  width: 390,
};
const upperTarget = {
  bottom: 112,
  height: 40,
  left: 24,
  right: 64,
  top: 72,
  width: 40,
};
const lowerTarget = {
  bottom: 732,
  height: 40,
  left: 326,
  right: 366,
  top: 692,
  width: 40,
};
const upperLayout = resolveInteractiveHelpPopupLayout(
  phoneViewport,
  "upper",
  upperTarget,
);
const lowerLayout = resolveInteractiveHelpPopupLayout(
  phoneViewport,
  "lower",
  lowerTarget,
);
assert.equal(upperLayout.placement, "below");
assert.ok(upperLayout.top >= upperTarget.bottom);
assert.equal(lowerLayout.placement, "above");
assert.ok(
  lowerLayout.top <= lowerTarget.top,
);

const keyboardViewport: InteractiveHelpViewport = {
  bottomInset: 0,
  height: 360,
  keyboardInset: 420,
  offsetLeft: 0,
  offsetTop: 24,
  topInset: 64,
  width: 390,
};
const keyboardLayout = resolveInteractiveHelpPopupLayout(
  keyboardViewport,
  "upper",
);
assert.equal(keyboardLayout.keyboardOpen, true);
assert.equal(keyboardLayout.navigationClearance, 12);
assert.equal(keyboardLayout.placement, "sheet");
assertPopupFits(keyboardViewport, keyboardLayout);

const interactiveHelp = source("src/components/interactive-help.tsx");
const interactiveHelpStyles = source(
  "src/components/interactive-help.module.css",
);
for (const sourceContract of [
  /window\.visualViewport/,
  /visualViewport\?\.addEventListener\("resize", onChange\)/,
  /visualViewport\?\.addEventListener\("scroll", onChange\)/,
  /visualViewport\?\.offsetLeft/,
  /measureInteractiveHelpObstructions/,
  /popupLayout\.maxHeight/,
  /popupLayout\.top/,
  /popupLayout\.width/,
  /var\(--giq-mobile-dock-clearance\)/,
]) {
  assert.match(interactiveHelp, sourceContract);
}
assert.match(
  interactiveHelpStyles,
  /\.body\s*{[\s\S]*?overscroll-behavior:\s*contain;/,
);

console.log(
  `Product onboarding viewport source evidence passed: ${viewportCases.length} cases across all ${INTERACTIVE_HELP_DEVICE_CLASSES.length} device classes preserve the bounded popover layout contract.`,
);

function source(path: string) {
  return readFileSync(path, "utf8");
}

function assertPopupFits(
  viewport: InteractiveHelpViewport,
  layout: InteractiveHelpPopupLayout,
) {
  const compact =
    viewport.width <= 767 || (viewport.height <= 500 && viewport.width <= 1023);
  const margin = compact ? 12 : 20;
  const left = viewport.offsetLeft ?? 0;
  const right = left + viewport.width;
  const top = viewport.offsetTop + (viewport.topInset ?? 0) + margin;
  const bottom =
    viewport.offsetTop +
    viewport.height -
    (viewport.bottomInset ?? 0) -
    margin;
  const popupLeft = layout.transform.startsWith("translate(-50%")
    ? layout.left - layout.width / 2
    : layout.transform === "translateX(-100%)"
      ? layout.left - layout.width
      : layout.left;
  const popupTop =
    layout.transform === "translateY(-100%)" ||
    layout.transform.includes(", -100%)")
      ? layout.top - layout.maxHeight
      : layout.top;
  assert.ok(popupLeft >= left - 0.5);
  assert.ok(popupLeft + layout.width <= right + 0.5);
  assert.ok(popupTop >= top - 0.5);
  assert.ok(popupTop + layout.maxHeight <= bottom + 0.5);
}
