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
  assert.equal(
    classifyInteractiveHelpDevice(testCase.width),
    testCase.expected,
  );
  assert.ok(layout.width <= testCase.width - (layout.mobile ? 24 : 40));
  assert.ok(layout.top >= 0);
  assert.ok(
    layout.top + layout.maxHeight <=
      testCase.height - layout.navigationClearance,
  );
  assert.equal(layout.placement, "viewport");
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
  {
    bottom: 160,
    height: 48,
    left: 24,
    right: 366,
    top: 112,
    width: 342,
  },
);
const lowerTargetLayout = resolveInteractiveHelpPopupLayout(
  phoneViewport,
  "lower",
  {
    bottom: 748,
    height: 48,
    left: 24,
    right: 366,
    top: 700,
    width: 342,
  },
);
assert.equal(upperTargetLayout.scrollBlock, "start");
assert.equal(lowerTargetLayout.scrollBlock, "end");
assert.equal(upperTargetLayout.placement, "below");
assert.ok(upperTargetLayout.top >= 170);
assert.ok((upperTargetLayout.arrowOffset ?? 0) >= 22);
assert.equal(lowerTargetLayout.placement, "above");
assert.ok(lowerTargetLayout.top <= 690);
assert.equal(lowerTargetLayout.transform, "translateY(-100%)");
assert.ok((lowerTargetLayout.arrowOffset ?? 0) >= 22);
assert.equal(resolveInteractiveHelpTargetSide(phoneViewport, 120), "upper");
assert.equal(resolveInteractiveHelpTargetSide(phoneViewport, 720), "lower");

const desktopTargetLayout = resolveInteractiveHelpPopupLayout(
  { height: 900, keyboardInset: 0, offsetTop: 0, width: 1440 },
  "upper",
  {
    bottom: 260,
    height: 60,
    left: 120,
    right: 360,
    top: 200,
    width: 240,
  },
);
assert.equal(desktopTargetLayout.placement, "right");
assert.ok(desktopTargetLayout.left >= 370);
assert.ok((desktopTargetLayout.arrowOffset ?? 0) >= 22);

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
assert.ok(keyboardLayout.top >= keyboardViewport.offsetTop);
assert.ok(
  keyboardLayout.top + keyboardLayout.maxHeight <=
    keyboardViewport.offsetTop + keyboardViewport.height - 12,
);

for (const sourceContract of [
  /window\.visualViewport/,
  /visualViewport\?\.addEventListener\("resize", onChange\)/,
  /visualViewport\?\.addEventListener\("scroll", onChange\)/,
  /role="dialog"/,
  /aria-modal="false"/,
  /data-help-device=\{popupLayout\.deviceClass\}/,
  /data-help-keyboard=\{popupLayout\.keyboardOpen \? "open" : "closed"\}/,
  /data-help-placement=\{popupLayout\.placement\}/,
  /data-help-ready=\{coachmarkReady \? "true" : "false"\}/,
  /data-help-target-side=\{targetSide \?\? "none"\}/,
  /resolveInteractiveHelpTargetSide/,
  /sameTargetBounds/,
  /window\.addEventListener\("scroll", scheduleResolution, true\)/,
  /window\.removeEventListener\("scroll", scheduleResolution, true\)/,
  /scrollMarginBlockEnd/,
  /var\(--giq-mobile-dock-clearance\)/,
  /popupLayout\.left/,
  /popupLayout\.maxHeight/,
  /popupLayout\.top/,
  /popupLayout\.transform/,
  /popupLayout\.width/,
  /popupLayout\.arrowOffset/,
  /interactiveHelpOwner/,
  /if \(!ownsInteractiveHelp\) return null/,
]) {
  assert.match(source, sourceContract);
}
assert.doesNotMatch(source, /<Sheet|SheetContent|backdrop-blur/);
assert.doesNotMatch(moduleStyles, /sheet-overlay/);
assert.match(moduleStyles, /\.popup[\s\S]*position: fixed/);
assert.match(moduleStyles, /\.popup[\s\S]*pointer-events: auto/);
assert.match(moduleStyles, /\.popup::after[\s\S]*transform: rotate\(45deg\)/);
assert.match(moduleStyles, /\.content[\s\S]*overflow-y: auto/);
assert.match(moduleStyles, /\.content[\s\S]*overscroll-behavior: contain/);
assert.match(moduleStyles, /data-help-ready="false"[\s\S]*visibility: hidden/);
assert.match(
  source,
  /const routeAutoOpen = Boolean\([\s\S]*state\.enabled[\s\S]*routeProgress\.enabled/,
);
assert.match(
  source,
  /function dismissHelp\(\)[\s\S]*updateInteractiveHelpProgress\(progressStorageKey, "disable"\)[\s\S]*updateInteractiveHelp\("disable"\)/,
);
assert.match(
  source,
  /function openHelp\(\)[\s\S]*if \(!state\.enabled\) updateInteractiveHelp\("enable"\)/,
);
assert.doesNotMatch(source, /function useMobileViewport/);
assert.doesNotMatch(source, /Help off|Skip tour|Turn off/);

console.log(
  "Interactive help responsive contract passed: eight device classes, target-adjacent coachmarks with arrows, persistent dismissal and Visual Viewport keyboard bounds.",
);
