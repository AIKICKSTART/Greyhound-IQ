export const INTERACTIVE_HELP_DEVICE_CLASSES = [
  "small-phone",
  "large-phone",
  "foldable",
  "tablet-portrait",
  "tablet-landscape",
  "laptop",
  "desktop",
  "wide-desktop",
] as const;

export type InteractiveHelpDeviceClass =
  (typeof INTERACTIVE_HELP_DEVICE_CLASSES)[number];
export type InteractiveHelpTargetSide = "upper" | "lower" | null;

export type InteractiveHelpViewport = {
  height: number;
  keyboardInset: number;
  offsetTop: number;
  width: number;
};

export type InteractiveHelpPopupLayout = {
  deviceClass: InteractiveHelpDeviceClass;
  keyboardOpen: boolean;
  maxHeight: number;
  mobile: boolean;
  navigationClearance: number;
  scrollBlock: ScrollLogicalPosition;
  top: number;
  width: number;
};

const COMPACT_MAX_WIDTH = 767;
const MOBILE_NAVIGATION_CLEARANCE = 120;
const KEYBOARD_THRESHOLD = 80;
const MIN_POPUP_HEIGHT = 240;
const TARGET_CLEARANCE = 112;

export function classifyInteractiveHelpDevice(
  width: number,
): InteractiveHelpDeviceClass {
  if (width <= 360) return "small-phone";
  if (width <= 430) return "large-phone";
  if (width <= COMPACT_MAX_WIDTH) return "foldable";
  if (width <= 819) return "tablet-portrait";
  if (width <= 1023) return "tablet-landscape";
  if (width <= 1279) return "laptop";
  if (width <= 1599) return "desktop";
  return "wide-desktop";
}

export function resolveInteractiveHelpPopupLayout(
  viewport: InteractiveHelpViewport,
  targetSide: InteractiveHelpTargetSide,
): InteractiveHelpPopupLayout {
  const width = boundedDimension(viewport.width, 320);
  const height = boundedDimension(viewport.height, 320);
  const offsetTop = Math.max(0, finiteOr(viewport.offsetTop, 0));
  const keyboardInset = Math.max(0, finiteOr(viewport.keyboardInset, 0));
  const mobile = width <= COMPACT_MAX_WIDTH;
  const keyboardOpen = mobile && keyboardInset >= KEYBOARD_THRESHOLD;
  const horizontalMargin = mobile ? 12 : 20;
  const verticalMargin = mobile ? 12 : 20;
  const navigationClearance = mobile
    ? keyboardOpen
      ? 12
      : MOBILE_NAVIGATION_CLEARANCE
    : 20;
  const unconstrainedHeight = Math.max(
    MIN_POPUP_HEIGHT,
    height - navigationClearance - verticalMargin * 2,
  );
  const targetClearance =
    mobile && targetSide
      ? Math.min(
          TARGET_CLEARANCE,
          Math.max(0, unconstrainedHeight - MIN_POPUP_HEIGHT),
        )
      : 0;
  const contentTop =
    offsetTop +
    verticalMargin +
    (targetSide === "upper" ? targetClearance : 0);
  const contentBottom =
    offsetTop +
    height -
    navigationClearance -
    verticalMargin -
    (targetSide === "lower" ? targetClearance : 0);
  const maxHeight = Math.max(
    Math.min(MIN_POPUP_HEIGHT, unconstrainedHeight),
    contentBottom - contentTop,
  );

  return {
    deviceClass: classifyInteractiveHelpDevice(width),
    keyboardOpen,
    maxHeight,
    mobile,
    navigationClearance,
    scrollBlock:
      targetSide === "upper"
        ? "start"
        : targetSide === "lower"
          ? "end"
          : "center",
    top: contentTop + maxHeight / 2,
    width: Math.max(
      280,
      Math.min(mobile ? width - horizontalMargin * 2 : 560, width - 40),
    ),
  };
}

export function resolveInteractiveHelpTargetSide(
  viewport: InteractiveHelpViewport,
  targetCenterY: number,
): Exclude<InteractiveHelpTargetSide, null> {
  const midpoint =
    Math.max(0, finiteOr(viewport.offsetTop, 0)) +
    boundedDimension(viewport.height, 320) / 2;
  return targetCenterY <= midpoint ? "upper" : "lower";
}

function boundedDimension(value: number, fallback: number) {
  return Math.max(1, finiteOr(value, fallback));
}

function finiteOr(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}
