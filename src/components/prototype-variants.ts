export const PROTOTYPE_VARIANTS = [
  { key: "A1", label: "Command Centre", detail: "Full Hero" },
  { key: "A2", label: "Command Centre", detail: "Compact Hero" },
  { key: "B1", label: "Racing Cockpit", detail: "Split Planner" },
  { key: "B2", label: "Racing Cockpit", detail: "Integrated Planner" },
  { key: "C1", label: "Social Data Hub", detail: "Expanded Feed" },
  { key: "C2", label: "Social Data Hub", detail: "Compact Feed" },
] as const;

export type PrototypeVariant = (typeof PROTOTYPE_VARIANTS)[number]["key"];

type PrototypeTemplateComposition = {
  family: "command" | "cockpit" | "social";
  hero: "full" | "compact" | "split" | "integrated" | "expanded";
  planner: "below" | "split" | "integrated";
  feed: "balanced" | "compact" | "technical" | "workspace" | "expanded" | "dense";
  recommendedDock: "D1" | "D2" | "D3" | "D4" | "D5" | "D6";
};

export const PROTOTYPE_TEMPLATE_COMPOSITIONS = {
  A1: {
    family: "command",
    hero: "full",
    planner: "below",
    feed: "balanced",
    recommendedDock: "D1",
  },
  A2: {
    family: "command",
    hero: "compact",
    planner: "below",
    feed: "compact",
    recommendedDock: "D5",
  },
  B1: {
    family: "cockpit",
    hero: "split",
    planner: "split",
    feed: "technical",
    recommendedDock: "D4",
  },
  B2: {
    family: "cockpit",
    hero: "integrated",
    planner: "integrated",
    feed: "workspace",
    recommendedDock: "D2",
  },
  C1: {
    family: "social",
    hero: "expanded",
    planner: "below",
    feed: "expanded",
    recommendedDock: "D3",
  },
  C2: {
    family: "social",
    hero: "compact",
    planner: "below",
    feed: "dense",
    recommendedDock: "D6",
  },
} as const satisfies Record<PrototypeVariant, PrototypeTemplateComposition>;

export const PROTOTYPE_DEVICES = [
  { key: "desktop", label: "Desktop", width: 1440, height: 1000 },
  { key: "tablet", label: "iPad Pro 11-inch", width: 834, height: 1210 },
  { key: "mobile", label: "iPhone 17", width: 402, height: 874 },
] as const;

export type PrototypeDevice = (typeof PROTOTYPE_DEVICES)[number]["key"];

export type PrototypeReviewFrameId =
  `${PrototypeVariant}-${Uppercase<PrototypeDevice>}-FRAME`;

export type PrototypeReviewFrame = {
  id: PrototypeReviewFrameId;
  ordinal: number;
  variant: PrototypeVariant;
  device: PrototypeDevice;
  width: number;
  height: number;
  targetHref: string;
  previewHref: string;
};

export function getPrototypeReviewFrameId(
  variant: PrototypeVariant,
  device: PrototypeDevice
): PrototypeReviewFrameId {
  return `${variant}-${device.toUpperCase()}-FRAME` as PrototypeReviewFrameId;
}

export const PROTOTYPE_REVIEW_FRAMES: readonly PrototypeReviewFrame[] =
  PROTOTYPE_VARIANTS.flatMap((variant, variantIndex) =>
    PROTOTYPE_DEVICES.map((device, deviceIndex) => ({
      id: getPrototypeReviewFrameId(variant.key, device.key),
      ordinal: variantIndex * PROTOTYPE_DEVICES.length + deviceIndex + 1,
      variant: variant.key,
      device: device.key,
      width: device.width,
      height: device.height,
      targetHref: `/feed?variant=${variant.key}&demo=1`,
      previewHref: `/feed/device-preview?device=${device.key}&variant=${variant.key}`,
    }))
  );

export function getPrototypeReviewFrame(
  variant: PrototypeVariant,
  device: PrototypeDevice
) {
  return PROTOTYPE_REVIEW_FRAMES.find(
    (frame) => frame.variant === variant && frame.device === device
  )!;
}

export function getPrototypeSocialMode(
  variant: PrototypeVariant
): "expanded" | "compact" | null {
  const composition = PROTOTYPE_TEMPLATE_COMPOSITIONS[variant];
  if (composition.family !== "social") return null;
  return composition.feed === "expanded" ? "expanded" : "compact";
}

export function getPrototypePlannerDensity(
  variant: PrototypeVariant
): "standard" | "compact" {
  return variant === "A2" || variant === "C2" ? "compact" : "standard";
}

export const PROTOTYPE_REVIEW_COMPONENTS = [
  { key: "SHELL", label: "App shell" },
  { key: "HEADER", label: "Member header" },
  { key: "RACE-NAV", label: "Race navigation" },
  { key: "RACE-PLANNER", label: "Race planner" },
  { key: "PROFILE", label: "Profile" },
  { key: "FEED-COMPOSER", label: "Feed composer" },
  { key: "FEED", label: "Community feed" },
  { key: "MARKETPLACE", label: "Marketplace showcase" },
  { key: "CHAT", label: "Chat surfaces" },
  { key: "DOCK", label: "Persistent dock" },
] as const;

export type PrototypeReviewComponent =
  (typeof PROTOTYPE_REVIEW_COMPONENTS)[number]["key"];

export function isPrototypeVariant(value: string | undefined): value is PrototypeVariant {
  return PROTOTYPE_VARIANTS.some((variant) => variant.key === value);
}

export function isPrototypeDevice(value: string | undefined): value is PrototypeDevice {
  return PROTOTYPE_DEVICES.some((device) => device.key === value);
}

export function getPrototypeReviewId(
  variant: PrototypeVariant,
  device: PrototypeDevice,
  component: PrototypeReviewComponent
) {
  return `${variant}-${device.toUpperCase()}-${component}`;
}
