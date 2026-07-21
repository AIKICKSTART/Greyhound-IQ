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
  blocked?: boolean;
  bottomInset?: number;
  height: number;
  keyboardInset: number;
  offsetLeft?: number;
  offsetTop: number;
  topInset?: number;
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
  "above" | "below" | "left" | "right" | "sheet" | "viewport";

export type InteractiveHelpPopupLayout = {
  arrowOffset: number | null;
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

type InteractiveHelpUsableFrame = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

const COMPACT_MAX_WIDTH = 767;
const LANDSCAPE_PHONE_MAX_HEIGHT = 500;
const LANDSCAPE_PHONE_MAX_WIDTH = 1023;
const KEYBOARD_THRESHOLD = 80;
const MIN_POPUP_HEIGHT = 180;
const MAX_POPUP_HEIGHT = 420;
const MAX_POPUP_WIDTH = 400;
const MAX_LANDSCAPE_POPUP_WIDTH = 900;
const TARGET_GAP = 10;
const ARROW_EDGE_CLEARANCE = 22;

export function classifyInteractiveHelpDevice(
  width: number,
): InteractiveHelpDeviceClass {
  if (width <= 360) return "small-phone";
  if (width <= 440) return "large-phone";
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
  const frame = resolveInteractiveHelpUsableFrame(viewport);
  const width = boundedDimension(viewport.width, 320);
  const height = boundedDimension(viewport.height, 320);
  const keyboardInset = Math.max(0, finiteOr(viewport.keyboardInset, 0));
  const mobile =
    width <= COMPACT_MAX_WIDTH ||
    (height <= LANDSCAPE_PHONE_MAX_HEIGHT &&
      width <= LANDSCAPE_PHONE_MAX_WIDTH);
  const compactLandscape =
    mobile && height <= LANDSCAPE_PHONE_MAX_HEIGHT && width > height;
  const keyboardOpen = mobile && keyboardInset >= KEYBOARD_THRESHOLD;
  const horizontalMargin = mobile ? 12 : 20;
  const availableHeight = Math.max(1, frame.height);
  const popupWidth = Math.min(
    compactLandscape ? MAX_LANDSCAPE_POPUP_WIDTH : MAX_POPUP_WIDTH,
    Math.max(1, frame.width - horizontalMargin * 2),
  );
  const maxHeight = Math.min(MAX_POPUP_HEIGHT, availableHeight);
  const base = {
    arrowOffset: null,
    deviceClass: classifyInteractiveHelpDevice(width),
    keyboardOpen,
    maxHeight,
    mobile,
    navigationClearance:
      Math.max(0, finiteOr(viewport.bottomInset, 0)) + (mobile ? 12 : 20),
    scrollBlock:
      targetSide === "upper"
        ? ("start" as const)
        : targetSide === "lower"
          ? ("end" as const)
          : ("center" as const),
    width: popupWidth,
  };

  const fallbackLayout = () =>
    mobile
      ? {
          ...base,
          left: frame.left + frame.width / 2,
          placement: "sheet" as const,
          top: frame.bottom,
          transform: "translate(-50%, -100%)",
        }
      : {
          ...base,
          left: frame.right - horizontalMargin,
          placement: "viewport" as const,
          top: frame.top,
          transform: "translateX(-100%)",
        };

  if (
    !targetBounds ||
    !isFiniteTargetBounds(targetBounds) ||
    isInteractiveHelpTargetOversized(viewport, targetBounds) ||
    !doesInteractiveHelpTargetIntersectUsableViewport(viewport, targetBounds)
  ) {
    return fallbackLayout();
  }

  const targetCenterX = targetBounds.left + targetBounds.width / 2;
  const targetCenterY = targetBounds.top + targetBounds.height / 2;
  const roomRight = frame.right - targetBounds.right - TARGET_GAP;
  const roomLeft = targetBounds.left - frame.left - TARGET_GAP;
  const roomBelow = frame.bottom - targetBounds.bottom - TARGET_GAP;
  const roomAbove = targetBounds.top - frame.top - TARGET_GAP;

  if (!mobile && roomRight >= popupWidth) {
    const top = clamp(
      targetCenterY - maxHeight / 2,
      frame.top,
      frame.bottom - maxHeight,
    );
    return {
      ...base,
      arrowOffset: clamp(
        targetCenterY - top,
        ARROW_EDGE_CLEARANCE,
        maxHeight - ARROW_EDGE_CLEARANCE,
      ),
      left: targetBounds.right + TARGET_GAP,
      placement: "right",
      top,
      transform: "none",
    };
  }

  if (!mobile && roomLeft >= popupWidth) {
    const top = clamp(
      targetCenterY - maxHeight / 2,
      frame.top,
      frame.bottom - maxHeight,
    );
    return {
      ...base,
      arrowOffset: clamp(
        targetCenterY - top,
        ARROW_EDGE_CLEARANCE,
        maxHeight - ARROW_EDGE_CLEARANCE,
      ),
      left: targetBounds.left - TARGET_GAP - popupWidth,
      placement: "left",
      top,
      transform: "none",
    };
  }

  const horizontalLeft = clamp(
    targetCenterX - popupWidth / 2,
    frame.left + horizontalMargin,
    frame.right - horizontalMargin - popupWidth,
  );
  if (roomBelow >= MIN_POPUP_HEIGHT) {
    return {
      ...base,
      arrowOffset: clamp(
        targetCenterX - horizontalLeft,
        ARROW_EDGE_CLEARANCE,
        popupWidth - ARROW_EDGE_CLEARANCE,
      ),
      left: horizontalLeft,
      maxHeight: Math.min(maxHeight, roomBelow),
      placement: "below",
      top: targetBounds.bottom + TARGET_GAP,
      transform: "none",
    };
  }

  if (roomAbove >= MIN_POPUP_HEIGHT) {
    return {
      ...base,
      arrowOffset: clamp(
        targetCenterX - horizontalLeft,
        ARROW_EDGE_CLEARANCE,
        popupWidth - ARROW_EDGE_CLEARANCE,
      ),
      left: horizontalLeft,
      maxHeight: Math.min(maxHeight, roomAbove),
      placement: "above",
      top: targetBounds.top - TARGET_GAP,
      transform: "translateY(-100%)",
    };
  }

  return fallbackLayout();
}

export function resolveInteractiveHelpTargetSide(
  viewport: InteractiveHelpViewport,
  targetCenterY: number,
): Exclude<InteractiveHelpTargetSide, null> {
  const frame = resolveInteractiveHelpUsableFrame(viewport);
  return targetCenterY <= frame.top + frame.height / 2 ? "upper" : "lower";
}

export function isInteractiveHelpTargetOversized(
  viewport: InteractiveHelpViewport,
  targetBounds: InteractiveHelpTargetBounds,
) {
  const frame = resolveInteractiveHelpUsableFrame(viewport);
  return (
    targetBounds.height > frame.height * 0.72 ||
    targetBounds.width > frame.width * 1.05
  );
}

export function isInteractiveHelpTargetWithinUsableViewport(
  viewport: InteractiveHelpViewport,
  targetBounds: InteractiveHelpTargetBounds,
) {
  const frame = resolveInteractiveHelpUsableFrame(viewport);
  return (
    targetBounds.top >= frame.top &&
    targetBounds.bottom <= frame.bottom &&
    targetBounds.left >= frame.left &&
    targetBounds.right <= frame.right
  );
}

function doesInteractiveHelpTargetIntersectUsableViewport(
  viewport: InteractiveHelpViewport,
  targetBounds: InteractiveHelpTargetBounds,
) {
  const frame = resolveInteractiveHelpUsableFrame(viewport);
  return (
    targetBounds.bottom > frame.top &&
    targetBounds.top < frame.bottom &&
    targetBounds.right > frame.left &&
    targetBounds.left < frame.right
  );
}

function resolveInteractiveHelpUsableFrame(
  viewport: InteractiveHelpViewport,
): InteractiveHelpUsableFrame {
  const width = boundedDimension(viewport.width, 320);
  const height = boundedDimension(viewport.height, 320);
  const offsetLeft = Math.max(0, finiteOr(viewport.offsetLeft, 0));
  const offsetTop = Math.max(0, finiteOr(viewport.offsetTop, 0));
  const compact =
    width <= COMPACT_MAX_WIDTH ||
    (height <= LANDSCAPE_PHONE_MAX_HEIGHT &&
      width <= LANDSCAPE_PHONE_MAX_WIDTH);
  const margin = compact ? 12 : 20;
  const topInset = Math.max(0, finiteOr(viewport.topInset, 0));
  const bottomInset = Math.max(0, finiteOr(viewport.bottomInset, 0));
  const left = offsetLeft;
  const right = offsetLeft + width;
  const top = offsetTop + topInset + margin;
  const bottom = Math.max(top + 1, offsetTop + height - bottomInset - margin);
  return {
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
  };
}

function isFiniteTargetBounds(targetBounds: InteractiveHelpTargetBounds) {
  return Object.values(targetBounds).every(Number.isFinite);
}

function boundedDimension(value: number, fallback: number) {
  return Math.max(1, finiteOr(value, fallback));
}

function finiteOr(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? (value as number) : fallback;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}
