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

export type InteractiveHelpTargetBounds = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

export type InteractiveHelpPlacement =
  "above" | "below" | "left" | "right" | "viewport";

export type InteractiveHelpPopupLayout = {
  deviceClass: InteractiveHelpDeviceClass;
  keyboardOpen: boolean;
  left: number;
  maxHeight: number;
  mobile: boolean;
  navigationClearance: number;
  placement: InteractiveHelpPlacement;
  scrollBlock: ScrollLogicalPosition;
  top: number;
  transform: string;
  width: number;
};

const COMPACT_MAX_WIDTH = 767;
const MOBILE_NAVIGATION_CLEARANCE = 120;
const KEYBOARD_THRESHOLD = 80;
const MIN_POPUP_HEIGHT = 180;
const MAX_POPUP_HEIGHT = 360;
const MAX_POPUP_WIDTH = 360;
const TARGET_GAP = 10;

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
  targetBounds: InteractiveHelpTargetBounds | null = null,
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
  const contentTop = offsetTop + verticalMargin;
  const contentBottom =
    offsetTop + height - navigationClearance - verticalMargin;
  const availableHeight = Math.max(1, contentBottom - contentTop);
  const popupWidth = Math.min(
    MAX_POPUP_WIDTH,
    Math.max(1, width - horizontalMargin * 2),
  );
  const maxHeight = Math.min(MAX_POPUP_HEIGHT, availableHeight);
  const base = {
    deviceClass: classifyInteractiveHelpDevice(width),
    keyboardOpen,
    maxHeight,
    mobile,
    navigationClearance,
    scrollBlock:
      targetSide === "upper"
        ? ("start" as const)
        : targetSide === "lower"
          ? ("end" as const)
          : ("center" as const),
    width: popupWidth,
  };

  if (!targetBounds) {
    return {
      ...base,
      left: width - horizontalMargin,
      placement: "viewport",
      top: contentTop,
      transform: "translateX(-100%)",
    };
  }

  const targetCenterX = targetBounds.left + targetBounds.width / 2;
  const targetCenterY = targetBounds.top + targetBounds.height / 2;
  const roomRight = width - horizontalMargin - targetBounds.right - TARGET_GAP;
  const roomLeft = targetBounds.left - horizontalMargin - TARGET_GAP;
  const roomBelow = contentBottom - targetBounds.bottom - TARGET_GAP;
  const roomAbove = targetBounds.top - contentTop - TARGET_GAP;

  if (!mobile && roomRight >= popupWidth) {
    return {
      ...base,
      left: targetBounds.right + TARGET_GAP,
      placement: "right",
      top: clamp(
        targetCenterY - maxHeight / 2,
        contentTop,
        contentBottom - maxHeight,
      ),
      transform: "none",
    };
  }

  if (!mobile && roomLeft >= popupWidth) {
    return {
      ...base,
      left: targetBounds.left - TARGET_GAP - popupWidth,
      placement: "left",
      top: clamp(
        targetCenterY - maxHeight / 2,
        contentTop,
        contentBottom - maxHeight,
      ),
      transform: "none",
    };
  }

  const horizontalLeft = clamp(
    targetCenterX - popupWidth / 2,
    horizontalMargin,
    width - horizontalMargin - popupWidth,
  );
  if (roomBelow >= MIN_POPUP_HEIGHT || roomBelow >= roomAbove) {
    return {
      ...base,
      left: horizontalLeft,
      maxHeight: Math.max(1, Math.min(maxHeight, roomBelow)),
      placement: "below",
      top: targetBounds.bottom + TARGET_GAP,
      transform: "none",
    };
  }

  return {
    ...base,
    left: horizontalLeft,
    maxHeight: Math.max(1, Math.min(maxHeight, roomAbove)),
    placement: "above",
    top: targetBounds.top - TARGET_GAP,
    transform: "translateY(-100%)",
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

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}
