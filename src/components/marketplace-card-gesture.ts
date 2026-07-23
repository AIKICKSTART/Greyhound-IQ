export type MarketplaceCardGesture = "tap" | "save" | "dismiss" | "scroll";

const TAP_TOLERANCE_PX = 8;
const SWIPE_THRESHOLD_PX = 48;

export function resolveMarketplaceCardGesture({
  deltaX,
  deltaY,
}: {
  deltaX: number;
  deltaY: number;
}): MarketplaceCardGesture {
  const horizontalDistance = Math.abs(deltaX);
  const verticalDistance = Math.abs(deltaY);

  if (
    horizontalDistance <= TAP_TOLERANCE_PX &&
    verticalDistance <= TAP_TOLERANCE_PX
  ) {
    return "tap";
  }

  if (
    horizontalDistance >= SWIPE_THRESHOLD_PX &&
    horizontalDistance > verticalDistance
  ) {
    return deltaX > 0 ? "save" : "dismiss";
  }

  return "scroll";
}
