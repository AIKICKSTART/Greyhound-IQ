import type { AdminOnboardingIcon } from "./onboarding-tour-registry";

export const MARKETPLACE_ONBOARDING_TOUR_ID = "tour:marketplace:v1";
export const MARKETPLACE_ONBOARDING_TOUR_VERSION = 1;
export const MARKETPLACE_ONBOARDING_TARGET_IDS = [
  "marketplace-navigation",
  "marketplace-page-content",
] as const;

export type MarketplaceOnboardingTargetId =
  (typeof MARKETPLACE_ONBOARDING_TARGET_IDS)[number];
export type MarketplaceOnboardingAudience =
  | "visitor"
  | "member"
  | "moderator"
  | "admin";
export type MarketplaceOnboardingStep = {
  id: string;
  title: string;
  body: string;
  icon: AdminOnboardingIcon;
  targetId: MarketplaceOnboardingTargetId;
  fallbackTargetId: MarketplaceOnboardingTargetId;
};
export type MarketplaceOnboardingRouteTour = {
  route: string;
  pageLabel: string;
  authentication: "optional" | "required";
  allowedAudiences: readonly MarketplaceOnboardingAudience[];
  tourId: typeof MARKETPLACE_ONBOARDING_TOUR_ID;
  version: typeof MARKETPLACE_ONBOARDING_TOUR_VERSION;
  steps: readonly MarketplaceOnboardingStep[];
};

type MarketplaceOnboardingRouteConfig = {
  route: string;
  pageLabel: string;
  authentication?: "optional" | "required";
  allowedAudiences: readonly MarketplaceOnboardingAudience[];
  purpose: string;
  navigationBody: string;
  boundaryTitle: string;
  boundaryBody: string;
  reviewTitle: string;
  reviewBody: string;
  continueTitle: string;
  continueBody: string;
};

const STANDARD_MARKETPLACE_AUDIENCES = [
  "visitor",
  "member",
  "moderator",
  "admin",
] as const satisfies readonly MarketplaceOnboardingAudience[];

export const MARKETPLACE_ONBOARDING_ROUTE_CONFIGS = [
  {
    route: "/marketplace",
    pageLabel: "Marketplace directory",
    authentication: "optional",
    allowedAudiences: STANDARD_MARKETPLACE_AUDIENCES,
    purpose:
      "Browse current marketplace listings using explicit filters, card media and signed-out, empty, loading or populated states.",
    navigationBody:
      "Use the marketplace navigation to change filters, open one listing, review a seller profile, visit groups or move to the create-listing boundary.",
    boundaryTitle: "Browsing and seller actions are separate",
    boundaryBody:
      "Visitors can inspect public listings; saving, enquiring, creating and owner controls still require server-verified identity, entitlement and object-level authorization.",
    reviewTitle: "Check filters and listing identity",
    reviewBody:
      "Confirm category, query, listing type, price, location and current status before opening a card; an empty result applies only to the active filters.",
    continueTitle: "Open the intended listing",
    continueBody:
      "Verify the title and seller context before continuing. Starting, dismissing or restarting this tour never saves a card or changes a marketplace record.",
  },
  {
    route: "/marketplace/[id]",
    pageLabel: "Marketplace listing detail",
    authentication: "optional",
    allowedAudiences: STANDARD_MARKETPLACE_AUDIENCES,
    purpose:
      "Review one listing's media, description, seller, linked greyhound, status and available buyer or owner actions.",
    navigationBody:
      "Return to the directory to compare listings, open the linked dog or seller when present, and use plan or sign-in links only when an action boundary requires them.",
    boundaryTitle: "Every protected action checks the actor",
    boundaryBody:
      "Save and enquiry actions require an authenticated profile, Pro-gated contact stays entitlement-protected, and renew, sold or withdraw controls require server-verified ownership.",
    reviewTitle: "Validate the listing before contact",
    reviewBody:
      "Check listing identity, category, price, location, media, seller and availability before sending an enquiry or relying on an owner control.",
    continueTitle: "Act on the correct record",
    continueBody:
      "Review the target listing and intended outcome before saving, enquiring, reporting or using an owner action. The tour performs none of those mutations.",
  },
  {
    route: "/marketplace/[id]/edit",
    pageLabel: "Marketplace listing editor",
    authentication: "required",
    allowedAudiences: ["member", "moderator", "admin"],
    purpose:
      "Review one owner-scoped listing editor after the server has enforced authentication, Pro access and listing ownership.",
    navigationBody:
      "Return to the loaded listing without saving, or use the account seller workspace to select another owned record.",
    boundaryTitle: "Editing requires tier and object ownership",
    boundaryBody:
      "The page checks the server-resolved tier and owner-scoped lookup, while PATCH independently validates the body and rechecks ownership before writing.",
    reviewTitle: "Verify the listing and intended changes",
    reviewBody:
      "Check listing identity, status, content, category, price, location, item details and searchable attributes before saving.",
    continueTitle: "Save only the intended owner record",
    continueBody:
      "Confirm the listing identifier and changed fields. Saving an active item returns it to moderator review; the tour performs no mutation.",
  },
  {
    route: "/marketplace/new",
    pageLabel: "Create marketplace listing",
    authentication: "optional",
    allowedAudiences: STANDARD_MARKETPLACE_AUDIENCES,
    purpose:
      "Understand the signed-out, tier-blocked and authenticated editor states before preparing a new marketplace listing.",
    navigationBody:
      "Return to the marketplace to review current examples, open Pricing for an entitlement boundary, or use sign-in before entering seller information.",
    boundaryTitle: "Listing creation is authenticated and entitled",
    boundaryBody:
      "The server resolves the current profile, enforces the required tier, validates listing fields and acknowledgements, and applies ownership and media policy before writing.",
    reviewTitle: "Prepare a complete and accurate listing",
    reviewBody:
      "Verify category, title, description, price, location, linked dog, media and required acknowledgements before submitting the editor.",
    continueTitle: "Submit only when the seller record is ready",
    continueBody:
      "Confirm the account, entitlement and listing details before creation. This tour does not populate, upload or submit a listing.",
  },
  {
    route: "/marketplace/design-lab",
    pageLabel: "Marketplace template lab",
    authentication: "optional",
    allowedAudiences: ["admin"],
    purpose:
      "Review synthetic marketplace-card templates and fallback presentation inside the isolated, read-only Design Lab surface.",
    navigationBody:
      "Move between the six allowlisted templates, return to the Design Lab screen library, or open only the synthetic profile destination supplied by the preview.",
    boundaryTitle: "Preview access is not marketplace authority",
    boundaryBody:
      "Production access remains hidden behind the exact preview flag and administrator check; isolated demo content is synthetic and cannot create, save, enquire about or alter a live listing.",
    reviewTitle: "Compare one template state at a time",
    reviewBody:
      "Confirm the selected template, device and unsupported-template fallback without treating visual review as runtime, entitlement or production evidence.",
    continueTitle: "Record review evidence without mutation",
    continueBody:
      "Use the allowlisted preview selector and capture findings outside the live marketplace workflow. The tour never changes a template registry or listing record.",
  },
] as const satisfies readonly MarketplaceOnboardingRouteConfig[];

function marketplaceStepsForRoute(
  config: MarketplaceOnboardingRouteConfig,
): readonly MarketplaceOnboardingStep[] {
  const id = config.route
    .replaceAll(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return [
    {
      id: `${id}:purpose`,
      title: config.pageLabel,
      body: config.purpose,
      icon: "sparkles",
      targetId: "marketplace-page-content",
      fallbackTargetId: "marketplace-navigation",
    },
    {
      id: `${id}:navigation`,
      title: `Navigate from ${config.pageLabel.toLowerCase()}`,
      body: config.navigationBody,
      icon: "navigation",
      targetId: "marketplace-navigation",
      fallbackTargetId: "marketplace-page-content",
    },
    {
      id: `${id}:boundary`,
      title: config.boundaryTitle,
      body: config.boundaryBody,
      icon: "user",
      targetId: "marketplace-page-content",
      fallbackTargetId: "marketplace-navigation",
    },
    {
      id: `${id}:review`,
      title: config.reviewTitle,
      body: config.reviewBody,
      icon: "layout",
      targetId: "marketplace-page-content",
      fallbackTargetId: "marketplace-navigation",
    },
    {
      id: `${id}:continue`,
      title: config.continueTitle,
      body: config.continueBody,
      icon: "shield",
      targetId: "marketplace-page-content",
      fallbackTargetId: "marketplace-navigation",
    },
  ];
}

export const MARKETPLACE_ONBOARDING_ROUTE_TOURS =
  MARKETPLACE_ONBOARDING_ROUTE_CONFIGS.map((config) => ({
    route: config.route,
    pageLabel: config.pageLabel,
    authentication: config.authentication,
    allowedAudiences: config.allowedAudiences,
    tourId: MARKETPLACE_ONBOARDING_TOUR_ID,
    version: MARKETPLACE_ONBOARDING_TOUR_VERSION,
    steps: marketplaceStepsForRoute(config),
  })) satisfies readonly MarketplaceOnboardingRouteTour[];

const MARKETPLACE_ONBOARDING_BY_ROUTE = new Map<
  string,
  MarketplaceOnboardingRouteTour
>(MARKETPLACE_ONBOARDING_ROUTE_TOURS.map((tour) => [tour.route, tour]));

export function getMarketplaceOnboardingRouteTour(
  route: string | null | undefined,
) {
  if (!route) return undefined;
  const normalized = route.length > 1 ? route.replace(/\/$/, "") : route;
  const exact = MARKETPLACE_ONBOARDING_BY_ROUTE.get(normalized);
  if (exact) return exact;
  if (
    /^\/marketplace\/(?!new(?:\/|$)|design-lab(?:\/|$))[^/]+\/edit$/.test(
      normalized,
    )
  ) {
    return MARKETPLACE_ONBOARDING_BY_ROUTE.get("/marketplace/[id]/edit");
  }
  if (
    /^\/marketplace\/(?!new(?:\/|$)|design-lab(?:\/|$))[^/]+$/.test(
      normalized,
    )
  ) {
    return MARKETPLACE_ONBOARDING_BY_ROUTE.get("/marketplace/[id]");
  }
  return undefined;
}

export function resolveMarketplaceOnboardingTour(
  route: string | null | undefined,
  audience: MarketplaceOnboardingAudience | null,
) {
  const tour = getMarketplaceOnboardingRouteTour(route);
  if (!tour || !audience || !tour.allowedAudiences.includes(audience)) {
    return null;
  }
  return tour;
}

export type MarketplaceOnboardingPreview =
  | {
      status: "available";
      tour: MarketplaceOnboardingRouteTour;
      step: MarketplaceOnboardingStep;
      stepNumber: number;
      requestedTargetId: MarketplaceOnboardingTargetId;
      resolvedTargetId: MarketplaceOnboardingTargetId;
      usedFallback: boolean;
    }
  | {
      status: "unavailable";
      message: "This tour is unavailable for the selected audience and route.";
    };

export function resolveMarketplaceOnboardingPreview({
  audience,
  route,
  tourId,
  step,
  targetAvailable = true,
}: {
  audience: MarketplaceOnboardingAudience | null;
  route: string | null | undefined;
  tourId: string | null | undefined;
  step: string | number | null | undefined;
  targetAvailable?: boolean;
}): MarketplaceOnboardingPreview {
  const tour = resolveMarketplaceOnboardingTour(route, audience);
  if (!tour || tour.tourId !== tourId) {
    return {
      status: "unavailable",
      message: "This tour is unavailable for the selected audience and route.",
    };
  }
  const requestedStep = Number(step);
  const stepNumber = Number.isSafeInteger(requestedStep)
    ? Math.min(tour.steps.length, Math.max(1, requestedStep))
    : 1;
  const resolvedStep = tour.steps[stepNumber - 1];
  const usedFallback = !targetAvailable;
  return {
    status: "available",
    tour,
    step: resolvedStep,
    stepNumber,
    requestedTargetId: resolvedStep.targetId,
    resolvedTargetId: usedFallback
      ? resolvedStep.fallbackTargetId
      : resolvedStep.targetId,
    usedFallback,
  };
}
