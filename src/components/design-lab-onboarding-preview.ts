import {
  INTERACTIVE_HELP_DEVICE_CLASSES,
  classifyInteractiveHelpDevice,
  type InteractiveHelpDeviceClass,
} from "./interactive-help-layout";

export const DESIGN_LAB_ONBOARDING_DEVICE_QUERY = "onboardingDevice";
export const DESIGN_LAB_ONBOARDING_TARGET_QUERY = "onboardingTarget";

export const DESIGN_LAB_ONBOARDING_DEVICE_PREVIEWS = [
  { id: "small-phone", label: "Small phone", width: 320, height: 568 },
  { id: "large-phone", label: "Large phone", width: 430, height: 932 },
  { id: "foldable", label: "Foldable", width: 540, height: 720 },
  { id: "tablet-portrait", label: "Tablet portrait", width: 768, height: 1024 },
  { id: "tablet-landscape", label: "Tablet landscape", width: 820, height: 1180 },
  { id: "laptop", label: "Laptop", width: 1024, height: 768 },
  { id: "desktop", label: "Desktop", width: 1440, height: 900 },
  { id: "wide-desktop", label: "Wide desktop", width: 1920, height: 1080 },
] as const satisfies readonly {
  id: InteractiveHelpDeviceClass;
  label: string;
  width: number;
  height: number;
}[];

export const DESIGN_LAB_ONBOARDING_TARGET_MODES = [
  {
    id: "available",
    label: "Primary target available",
    description: "Anchor the step to its primary semantic target.",
  },
  {
    id: "unavailable",
    label: "Primary target unavailable",
    description: "Resolve and display the allowlisted safe fallback target.",
  },
] as const;

export type DesignLabOnboardingTargetMode =
  (typeof DESIGN_LAB_ONBOARDING_TARGET_MODES)[number]["id"];

const DEVICE_BY_ID = new Map(
  DESIGN_LAB_ONBOARDING_DEVICE_PREVIEWS.map((device) => [device.id, device]),
);

export function resolveDesignLabOnboardingDevice(value: string | null | undefined) {
  return (
    DEVICE_BY_ID.get(value as InteractiveHelpDeviceClass) ??
    DESIGN_LAB_ONBOARDING_DEVICE_PREVIEWS[0]
  );
}

export function resolveDesignLabOnboardingTargetMode(
  value: string | null | undefined,
  errorState: string,
): DesignLabOnboardingTargetMode {
  if (value === "available" || value === "unavailable") return value;
  return errorState === "feature-disabled" ? "unavailable" : "available";
}

export function buildDesignLabOnboardingPreviewUrl(
  currentHref: string,
  patch: {
    device?: string;
    targetMode?: string;
  },
) {
  const url = new URL(currentHref, "http://design-lab.invalid");
  if (patch.device !== undefined) {
    url.searchParams.set(
      DESIGN_LAB_ONBOARDING_DEVICE_QUERY,
      resolveDesignLabOnboardingDevice(patch.device).id,
    );
  }
  if (patch.targetMode !== undefined) {
    const mode =
      patch.targetMode === "unavailable" ? "unavailable" : "available";
    url.searchParams.set(DESIGN_LAB_ONBOARDING_TARGET_QUERY, mode);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function validateDesignLabOnboardingDeviceContract() {
  return (
    DESIGN_LAB_ONBOARDING_DEVICE_PREVIEWS.length ===
      INTERACTIVE_HELP_DEVICE_CLASSES.length &&
    DESIGN_LAB_ONBOARDING_DEVICE_PREVIEWS.every(
      (device, index) =>
        device.id === INTERACTIVE_HELP_DEVICE_CLASSES[index] &&
        classifyInteractiveHelpDevice(device.width) === device.id,
    )
  );
}
