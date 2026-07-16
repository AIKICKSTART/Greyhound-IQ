import {
  DESIGN_LAB_ROLES,
  ROLE_REVIEW_FRAMES,
  type RoleReviewFrame,
} from "./design-lab-role-blueprints";
import {
  DOCK_SKIN_REGISTRY,
  isDockSkinKey,
  type DockSkinKey,
} from "./dock-skin-catalogue";
import {
  MARKETPLACE_TEMPLATE_OPTIONS,
  type MarketplaceTemplateKey,
} from "./marketplace-template-variants";
import {
  PROTOTYPE_DEVICES,
  PROTOTYPE_VARIANTS,
  isPrototypeDevice,
  isPrototypeVariant,
  type PrototypeDevice,
  type PrototypeVariant,
} from "./prototype-variants";

type ReviewSearchValue = string | string[] | undefined;

export type AppDockReviewFrameId =
  `APP-${PrototypeVariant}-${DockSkinKey}-${Uppercase<PrototypeDevice>}`;

export type AppDockReviewFrame = {
  id: AppDockReviewFrameId;
  ordinal: number;
  variant: PrototypeVariant;
  dock: DockSkinKey;
  device: PrototypeDevice;
  width: number;
  height: number;
  targetHref: string;
};

export function getAppDockReviewFrameId(
  variant: PrototypeVariant,
  dock: DockSkinKey,
  device: PrototypeDevice
): AppDockReviewFrameId {
  return `APP-${variant}-${dock}-${device.toUpperCase()}` as AppDockReviewFrameId;
}

export function resolveAppDockReviewSelection(searchParams: {
  device?: ReviewSearchValue;
  dock?: ReviewSearchValue;
  variant?: ReviewSearchValue;
}) {
  const first = (value: ReviewSearchValue) =>
    Array.isArray(value) ? value[0] : value;
  const device = first(searchParams.device);
  const dock = first(searchParams.dock);
  const variant = first(searchParams.variant);

  return {
    device: isPrototypeDevice(device) ? device : "mobile",
    dock: isDockSkinKey(dock) ? dock : "D1",
    variant: isPrototypeVariant(variant) ? variant : "A1",
  } as const;
}

export const APP_DOCK_REVIEW_FRAMES: readonly AppDockReviewFrame[] =
  PROTOTYPE_VARIANTS.flatMap((variant, variantIndex) =>
    DOCK_SKIN_REGISTRY.flatMap((dock, dockIndex) =>
      PROTOTYPE_DEVICES.map((device, deviceIndex) => ({
        id: getAppDockReviewFrameId(variant.key, dock.key, device.key),
        ordinal:
          variantIndex * DOCK_SKIN_REGISTRY.length * PROTOTYPE_DEVICES.length +
          dockIndex * PROTOTYPE_DEVICES.length +
          deviceIndex +
          1,
        variant: variant.key,
        dock: dock.key,
        device: device.key,
        width: device.width,
        height: device.height,
        targetHref: `/feed/device-preview?device=${device.key}&variant=${variant.key}&dock=${dock.key}&sponsored=on`,
      }))
    )
  );

export function getAppDockReviewFrame(
  variant: PrototypeVariant,
  dock: DockSkinKey,
  device: PrototypeDevice
) {
  return APP_DOCK_REVIEW_FRAMES.find(
    (frame) =>
      frame.variant === variant && frame.dock === dock && frame.device === device
  )!;
}

export const ROLE_APP_REVIEW_FRAMES: readonly RoleReviewFrame[] =
  ROLE_REVIEW_FRAMES.map((frame) => ({
    ...frame,
    targetHref: `/design-lab/role-blueprints?role=${frame.role}&variant=${frame.variant}`,
  }));

export type MarketplaceReviewFrameId =
  `MARKETPLACE-${MarketplaceTemplateKey}-${Uppercase<PrototypeDevice>}`;

export type MarketplaceReviewFrame = {
  id: MarketplaceReviewFrameId;
  ordinal: number;
  template: MarketplaceTemplateKey;
  device: PrototypeDevice;
  width: number;
  height: number;
  targetHref: string;
};

export function getMarketplaceReviewFrameId(
  template: MarketplaceTemplateKey,
  device: PrototypeDevice
): MarketplaceReviewFrameId {
  return `MARKETPLACE-${template}-${device.toUpperCase()}` as MarketplaceReviewFrameId;
}

export const MARKETPLACE_REVIEW_FRAMES: readonly MarketplaceReviewFrame[] =
  MARKETPLACE_TEMPLATE_OPTIONS.flatMap((template, templateIndex) =>
    PROTOTYPE_DEVICES.map((device, deviceIndex) => ({
      id: getMarketplaceReviewFrameId(template.key, device.key),
      ordinal:
        templateIndex * PROTOTYPE_DEVICES.length + deviceIndex + 1,
      template: template.key,
      device: device.key,
      width: device.width,
      height: device.height,
      targetHref: `/marketplace/design-lab?template=${template.key}`,
    }))
  );

export const DESIGN_LAB_REVIEW_READINESS = {
  registry: "ready",
  screenshots: "captured",
  designApproval: "approved",
} as const;

export const DESIGN_LAB_REVIEW_DECISION = {
  appVariant: "B2",
  dock: "D2",
  marketplaceTemplate: "M1",
  authority: "user-delegated-yolo",
  rationale:
    "The integrated racing workspace keeps planning, race discovery and review in one responsive surface; Gold Pulse gives the persistent dock a clear hierarchy; Grandstand Market provides the strongest public-profile discovery path.",
  evidence: {
    appDock: "output/orchestration/design-captures/app-dock-20260712/manifest.json",
    roles: "output/orchestration/design-captures/roles-20260712/manifest.json",
    marketplace:
      "output/orchestration/design-captures/marketplace-20260712/manifest.json",
  },
} as const;

export const DESIGN_LAB_REVIEW_MATRIX = {
  appDock: APP_DOCK_REVIEW_FRAMES,
  roles: ROLE_APP_REVIEW_FRAMES,
  marketplace: MARKETPLACE_REVIEW_FRAMES,
  readiness: DESIGN_LAB_REVIEW_READINESS,
  decision: DESIGN_LAB_REVIEW_DECISION,
  sourceCounts: {
    variants: PROTOTYPE_VARIANTS.length,
    docks: DOCK_SKIN_REGISTRY.length,
    roles: DESIGN_LAB_ROLES.length,
    marketplaceTemplates: MARKETPLACE_TEMPLATE_OPTIONS.length,
    devices: PROTOTYPE_DEVICES.length,
  },
} as const;
