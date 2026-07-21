import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  INTERACTIVE_HELP_DEVICE_CLASSES,
  classifyInteractiveHelpDevice,
  isInteractiveHelpTargetOversized,
  isInteractiveHelpTargetWithinUsableViewport,
  resolveInteractiveHelpPopupLayout,
  resolveInteractiveHelpTargetSide,
  type InteractiveHelpDeviceClass,
  type InteractiveHelpPopupLayout,
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
for (const testCase of deviceCases) {
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
  assert.equal(
    classifyInteractiveHelpDevice(testCase.width),
    testCase.expected,
  );
  assertPopupFits(viewport, layout);
  assert.equal(
    layout.placement,
    layout.mobile ? "sheet" : "viewport",
    `${testCase.width}x${testCase.height}`,
  );
}
assert.deepEqual(
  [...observedDeviceClasses].toSorted(),
  [...INTERACTIVE_HELP_DEVICE_CLASSES].toSorted(),
);

const phoneViewport: InteractiveHelpViewport = {
  bottomInset: 76,
  height: 956,
  keyboardInset: 0,
  offsetLeft: 0,
  offsetTop: 0,
  topInset: 72,
  width: 440,
};
const upperTargetLayout = resolveInteractiveHelpPopupLayout(
  phoneViewport,
  "upper",
  {
    bottom: 160,
    height: 48,
    left: 24,
    right: 416,
    top: 112,
    width: 392,
  },
);
const lowerTargetLayout = resolveInteractiveHelpPopupLayout(
  phoneViewport,
  "lower",
  {
    bottom: 828,
    height: 48,
    left: 24,
    right: 416,
    top: 780,
    width: 392,
  },
);
assert.equal(upperTargetLayout.scrollBlock, "start");
assert.equal(lowerTargetLayout.scrollBlock, "end");
assert.equal(upperTargetLayout.placement, "below");
assert.ok(upperTargetLayout.top >= 170);
assert.ok((upperTargetLayout.arrowOffset ?? 0) >= 22);
assert.equal(lowerTargetLayout.placement, "above");
assert.ok(lowerTargetLayout.top <= 770);
assert.equal(lowerTargetLayout.transform, "translateY(-100%)");
assert.ok((lowerTargetLayout.arrowOffset ?? 0) >= 22);
assert.equal(resolveInteractiveHelpTargetSide(phoneViewport, 120), "upper");
assert.equal(resolveInteractiveHelpTargetSide(phoneViewport, 820), "lower");
assertPopupFits(phoneViewport, upperTargetLayout);
assertPopupFits(phoneViewport, lowerTargetLayout);

const hugeHomeTarget = {
  bottom: 13_946,
  height: 14_517,
  left: 0,
  right: 432,
  top: -571,
  width: 432,
};
const hugeHomeLayout = resolveInteractiveHelpPopupLayout(
  phoneViewport,
  "lower",
  hugeHomeTarget,
);
assert.equal(hugeHomeLayout.placement, "sheet");
assert.ok(hugeHomeLayout.maxHeight >= 180);
assert.equal(
  isInteractiveHelpTargetOversized(phoneViewport, hugeHomeTarget),
  true,
);
assert.equal(
  isInteractiveHelpTargetWithinUsableViewport(phoneViewport, hugeHomeTarget),
  false,
);
assertPopupFits(phoneViewport, hugeHomeLayout);

const landscapePhone: InteractiveHelpViewport = {
  bottomInset: 72,
  height: 440,
  keyboardInset: 0,
  offsetLeft: 0,
  offsetTop: 0,
  topInset: 68,
  width: 956,
};
const landscapeLayout = resolveInteractiveHelpPopupLayout(landscapePhone, null);
assert.equal(landscapeLayout.mobile, true);
assert.equal(landscapeLayout.placement, "sheet");
assertPopupFits(landscapePhone, landscapeLayout);

const desktopTargetLayout = resolveInteractiveHelpPopupLayout(
  {
    bottomInset: 72,
    height: 900,
    keyboardInset: 0,
    offsetLeft: 0,
    offsetTop: 0,
    topInset: 150,
    width: 1440,
  },
  "upper",
  {
    bottom: 360,
    height: 60,
    left: 120,
    right: 360,
    top: 300,
    width: 240,
  },
);
assert.equal(desktopTargetLayout.placement, "right");
assert.ok(desktopTargetLayout.left >= 370);
assert.ok((desktopTargetLayout.arrowOffset ?? 0) >= 22);

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
assert.equal(keyboardLayout.placement, "sheet");
assertPopupFits(keyboardViewport, keyboardLayout);

const zoomedViewport: InteractiveHelpViewport = {
  bottomInset: 0,
  height: 620,
  keyboardInset: 0,
  offsetLeft: 110,
  offsetTop: 90,
  topInset: 0,
  width: 360,
};
const zoomedLayout = resolveInteractiveHelpPopupLayout(zoomedViewport, null);
assertPopupFits(zoomedViewport, zoomedLayout);

for (const sourceContract of [
  /window\.visualViewport/,
  /visualViewport\?\.offsetLeft/,
  /visualViewport\?\.addEventListener\("resize", onChange\)/,
  /visualViewport\?\.addEventListener\("scroll", onChange\)/,
  /mutationObserver\.observe\(document\.body/,
  /document\.addEventListener\("scroll", onChange, true\)/,
  /document\.removeEventListener\("scroll", onChange, true\)/,
  /measureInteractiveHelpObstructions/,
  /data-viewport-obstruction/,
  /!viewport\.blocked/,
  /blocked \? 1 : 0/,
  /!explicitObstruction && bounds\.height > height \* 0\.45/,
  /DialogPrimitive\.Root/,
  /modal="trap-focus"/,
  /DialogPrimitive\.Close/,
  /Close and turn off guided help/,
  /DialogPrimitive\.Popup/,
  /data-help-device=\{popupLayout\.deviceClass\}/,
  /data-help-keyboard=\{popupLayout\.keyboardOpen \? "open" : "closed"\}/,
  /data-help-placement=\{popupLayout\.placement\}/,
  /data-help-ready=\{coachmarkReady \? "true" : "false"\}/,
  /data-help-target-side=\{targetSide \?\? "none"\}/,
  /resolveInteractiveHelpTargetSide/,
  /isInteractiveHelpTargetOversized/,
  /isInteractiveHelpTargetWithinUsableViewport/,
  /ResizeObserver/,
  /window\.addEventListener\("scroll", scheduleResolution, true\)/,
  /window\.removeEventListener\("scroll", scheduleResolution, true\)/,
  /scrollMarginBlockEnd/,
  /restoreScrollRef/,
  /window\.scrollTo/,
  /popupLayout\.left/,
  /popupLayout\.maxHeight/,
  /popupLayout\.top/,
  /popupLayout\.transform/,
  /popupLayout\.width/,
  /popupLayout\.arrowOffset/,
  /interactiveHelpOwner/,
  /if \(!ownsInteractiveHelp\) return null/,
  /Skip tour/,
]) {
  assert.match(source, sourceContract);
}
assert.doesNotMatch(source, /<Sheet|SheetContent/);
assert.doesNotMatch(moduleStyles, /sheet-overlay/);
assert.match(moduleStyles, /data-help-placement="sheet"/);
assert.match(moduleStyles, /\.popup[\s\S]*position: fixed/);
assert.match(moduleStyles, /\.popup[\s\S]*pointer-events: auto/);
assert.match(moduleStyles, /\.popup::after[\s\S]*transform: rotate\(45deg\)/);
assert.match(moduleStyles, /\.content[\s\S]*overflow: hidden/);
assert.match(moduleStyles, /\.body[\s\S]*overflow-x: hidden/);
assert.match(moduleStyles, /\.body[\s\S]*overflow-y: auto/);
assert.match(moduleStyles, /\.body[\s\S]*overscroll-behavior: contain/);
assert.match(moduleStyles, /env\(safe-area-inset-top/);
assert.doesNotMatch(
  moduleStyles,
  /data-help-ready="false"[\s\S]*visibility:\s*hidden/,
);
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
  /function skipTour\(\)[\s\S]*event: "step-skipped"[\s\S]*dismissHelp\(\)/,
);
assert.match(
  source,
  /function openHelp\(\)[\s\S]*if \(!state\.enabled\) updateInteractiveHelp\("enable"\)/,
);
assert.doesNotMatch(source, /function useMobileViewport/);

console.log(
  "Interactive help responsive contract passed: all target breakpoints, iPhone 16 Pro Max portrait/landscape, zoom offsets, keyboard bounds, dynamic chrome clearance and oversized-target bottom sheets.",
);

function assertPopupFits(
  viewport: InteractiveHelpViewport,
  layout: InteractiveHelpPopupLayout,
) {
  const compact =
    viewport.width <= 767 || (viewport.height <= 500 && viewport.width <= 1023);
  const margin = compact ? 12 : 20;
  const frameLeft = viewport.offsetLeft ?? 0;
  const frameRight = frameLeft + viewport.width;
  const frameTop = viewport.offsetTop + (viewport.topInset ?? 0) + margin;
  const frameBottom =
    viewport.offsetTop + viewport.height - (viewport.bottomInset ?? 0) - margin;
  const actualLeft = layout.transform.startsWith("translate(-50%")
    ? layout.left - layout.width / 2
    : layout.transform === "translateX(-100%)"
      ? layout.left - layout.width
      : layout.left;
  const actualTop =
    layout.transform === "translateY(-100%)" ||
    layout.transform.includes(", -100%)")
      ? layout.top - layout.maxHeight
      : layout.top;
  assert.ok(actualLeft >= frameLeft - 0.5, `left ${actualLeft}`);
  assert.ok(
    actualLeft + layout.width <= frameRight + 0.5,
    `right ${actualLeft + layout.width}`,
  );
  assert.ok(actualTop >= frameTop - 0.5, `top ${actualTop}`);
  assert.ok(
    actualTop + layout.maxHeight <= frameBottom + 0.5,
    `bottom ${actualTop + layout.maxHeight}`,
  );
}
