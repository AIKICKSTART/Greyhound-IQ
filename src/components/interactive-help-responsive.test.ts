import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  INTERACTIVE_HELP_DEVICE_CLASSES,
  classifyInteractiveHelpDevice,
  resolveInteractiveHelpPopupLayout,
  resolveInteractiveHelpTargetSide,
  type InteractiveHelpDeviceClass,
  type InteractiveHelpViewport,
} from "./interactive-help-layout";

const source = readFileSync(join(__dirname, "interactive-help.tsx"), "utf8");
const moduleStyles = readFileSync(
  join(__dirname, "interactive-help.module.css"),
  "utf8",
);

const deviceCases = [
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
for (const testCase of deviceCases) {
  const viewport: InteractiveHelpViewport = {
    height: testCase.height,
    keyboardInset: 0,
    offsetTop: 0,
    width: testCase.width,
  };
  const layout = resolveInteractiveHelpPopupLayout(viewport, null);
  observedDeviceClasses.add(layout.deviceClass);
  assert.equal(layout.deviceClass, testCase.expected, `${testCase.width}px`);
  assert.equal(classifyInteractiveHelpDevice(testCase.width), testCase.expected);
  assert.ok(layout.width <= testCase.width - (layout.mobile ? 24 : 40));
  assert.ok(layout.top - layout.maxHeight / 2 >= 0);
  assert.ok(
    layout.top + layout.maxHeight / 2 <=
      testCase.height - layout.navigationClearance,
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
const upperTargetLayout = resolveInteractiveHelpPopupLayout(
  phoneViewport,
  "upper",
);
const lowerTargetLayout = resolveInteractiveHelpPopupLayout(
  phoneViewport,
  "lower",
);
assert.equal(upperTargetLayout.scrollBlock, "start");
assert.equal(lowerTargetLayout.scrollBlock, "end");
assert.ok(upperTargetLayout.top - upperTargetLayout.maxHeight / 2 >= 112);
assert.ok(
  lowerTargetLayout.top + lowerTargetLayout.maxHeight / 2 <=
    phoneViewport.height - lowerTargetLayout.navigationClearance - 112,
);
assert.equal(resolveInteractiveHelpTargetSide(phoneViewport, 120), "upper");
assert.equal(resolveInteractiveHelpTargetSide(phoneViewport, 720), "lower");

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
assert.ok(
  keyboardLayout.top - keyboardLayout.maxHeight / 2 >=
    keyboardViewport.offsetTop,
);
assert.ok(
  keyboardLayout.top + keyboardLayout.maxHeight / 2 <=
    keyboardViewport.offsetTop + keyboardViewport.height - 12,
);

for (const sourceContract of [
  /window\.visualViewport/,
  /visualViewport\?\.addEventListener\("resize", onChange\)/,
  /visualViewport\?\.addEventListener\("scroll", onChange\)/,
  /modal=\{false\}/,
  /data-help-device=\{popupLayout\.deviceClass\}/,
  /data-help-keyboard=\{popupLayout\.keyboardOpen \? "open" : "closed"\}/,
  /data-help-target-side=\{targetSide \?\? "none"\}/,
  /resolveInteractiveHelpTargetSide/,
  /scrollMarginBlockEnd/,
  /var\(--giq-mobile-dock-clearance\)/,
  /popupLayout\.maxHeight/,
  /popupLayout\.top/,
  /popupLayout\.width/,
  /side="bottom"/,
  /sm:hidden/,
  /sm:flex/,
  /interactiveHelpOwner/,
  /if \(!ownsInteractiveHelp\) return null/,
]) {
  assert.match(source, sourceContract);
}
assert.match(
  moduleStyles,
  /\[data-slot="sheet-overlay"\][\s\S]*pointer-events: none/,
);
assert.match(moduleStyles, /\.popup[\s\S]*overscroll-behavior: contain/);
assert.doesNotMatch(source, /function useMobileViewport/);

console.log(
  "Interactive help responsive contract passed: eight device classes, opposite-side target clearance, persistent navigation access and Visual Viewport keyboard bounds.",
);
