import type { AdminOnboardingIcon } from "./onboarding-tour-registry";

export const DESIGN_LAB_ONBOARDING_TOUR_ID = "tour:design-lab:v1";
export const DESIGN_LAB_ONBOARDING_TOUR_VERSION = 1;
export const DESIGN_LAB_ONBOARDING_TARGET_IDS = [
  "design-lab-navigation",
  "design-lab-page-content",
  "design-lab-tab-target",
  "design-lab-modal-target",
] as const;

export type DesignLabOnboardingTargetId =
  (typeof DESIGN_LAB_ONBOARDING_TARGET_IDS)[number];
export type DesignLabOnboardingAudience = "admin";
export type DesignLabOnboardingStep = {
  id: string;
  title: string;
  body: string;
  icon: AdminOnboardingIcon;
  targetId: DesignLabOnboardingTargetId;
  fallbackTargetId: DesignLabOnboardingTargetId;
};
export type DesignLabOnboardingRouteTour = {
  route: string;
  pageLabel: string;
  authentication: "optional";
  allowedAudiences: readonly DesignLabOnboardingAudience[];
  tourId: typeof DESIGN_LAB_ONBOARDING_TOUR_ID;
  version: typeof DESIGN_LAB_ONBOARDING_TOUR_VERSION;
  steps: readonly DesignLabOnboardingStep[];
};

type DesignLabOnboardingRouteConfig = {
  route: string;
  pageLabel: string;
  purpose: string;
  navigationBody: string;
  boundaryTitle: string;
  boundaryBody: string;
  reviewTitle: string;
  reviewBody: string;
  continueTitle: string;
  continueBody: string;
};

export const DESIGN_LAB_ONBOARDING_ROUTE_CONFIGS = [
  {
    route: "/design-lab",
    pageLabel: "Design Lab mission control",
    purpose:
      "Review the founder control layer, live registry-derived progress and the available architecture, screen, evidence and operations workspaces.",
    navigationBody:
      "Use only the allowlisted area selector to move between Mission Control modules while preserving unrelated review query state.",
    boundaryTitle: "Mission Control does not approve production",
    boundaryBody:
      "Production access remains flag- and administrator-gated, the isolated demo is synthetic and read-only, and visible evidence never overrides the release evaluator or approval chain.",
    reviewTitle: "Read status from its owning registry",
    reviewBody:
      "Check the active module, evidence scope, blocker owner and validation state before treating a progress metric as complete or assigning follow-up work.",
    continueTitle: "Choose one evidence-backed next action",
    continueBody:
      "Open the owning module or test for the selected blocker. The tour never edits a registry, changes a gate status or promotes a build.",
  },
  {
    route: "/design-lab/demo-experience",
    pageLabel: "Design Lab screen library",
    purpose:
      "Inspect registered screens, fixtures, personas, states and route-safe scenarios inside the synthetic preview workspace.",
    navigationBody:
      "Use the allowlisted route and scenario controls, preserve the selected screen in the URL and return to Mission Control for release decisions.",
    boundaryTitle: "Simulation is not production proof",
    boundaryBody:
      "Preview personas and private records are synthetic, destructive simulation stays disabled, and a rendered screen cannot substitute for browser, provider, security or production evidence.",
    reviewTitle: "Verify the complete screen contract",
    reviewBody:
      "Check route, actor, access, actions, forms, states, fixtures, responsive behavior and test links before recording a scenario as reviewed.",
    continueTitle: "Capture findings against the exact scenario",
    continueBody:
      "Retain the route and allowlisted query state when sharing evidence. The tour never submits a form or mutates the represented product screen.",
  },
  {
    route: "/design-lab/dock-skins",
    pageLabel: "Dock skin catalogue",
    purpose:
      "Compare registered navigation-dock skins, action placement and responsive presentation in a controlled preview.",
    navigationBody:
      "Move between allowlisted skin options and return to the screen library without treating a visual selection as a saved member preference.",
    boundaryTitle: "Catalogue selection is preview-only",
    boundaryBody:
      "The production reviewer gate still applies, no account preference is persisted, and the catalogue cannot change live navigation or role permissions.",
    reviewTitle: "Inspect action and breakpoint integrity",
    reviewBody:
      "Confirm the five persistent destinations, selected state, touch targets, labels and mobile-to-desktop behavior for each skin.",
    continueTitle: "Record the chosen design rationale",
    continueBody:
      "Capture the exact skin and viewport findings for later implementation review. The tour never updates the dock registry.",
  },
  {
    route: "/design-lab/role-blueprints",
    pageLabel: "Role blueprint preview",
    purpose:
      "Review synthetic visitor, member, moderator and founder-control blueprints without assuming or changing a real identity.",
    navigationBody:
      "Switch only among allowlisted role previews and return to Mission Control when evaluating access or navigation ownership.",
    boundaryTitle: "A role preview grants no role",
    boundaryBody:
      "Production access remains administrator-gated, synthetic role state never creates a session, and server-side authorization continues to own every protected operation.",
    reviewTitle: "Compare capabilities and denials",
    reviewBody:
      "Check visible destinations, privilege boundaries, denied actions and responsive layout for each role rather than comparing color or labels alone.",
    continueTitle: "Escalate access gaps as evidence",
    continueBody:
      "Record the exact role, route and expected decision for review. The tour never changes permissions, membership or administrator status.",
  },
  {
    route: "/feed/device-preview",
    pageLabel: "Feed device preview",
    purpose:
      "Review the synthetic feed system across registered mobile, tablet and desktop device frames and explicit preview variants.",
    navigationBody:
      "Use the allowlisted device and variant controls, then return to the screen library or Feed contract without opening a production composer.",
    boundaryTitle: "Device preview cannot publish",
    boundaryBody:
      "The reviewer gate remains authoritative, preview content is synthetic, and the route has no production feed submission path or private conversation dependency.",
    reviewTitle: "Inspect each viewport and state",
    reviewBody:
      "Confirm shell width, safe areas, navigation, cards, sponsored treatment, loading and fallback behavior for the selected device and variant.",
    continueTitle: "Save the exact visual finding",
    continueBody:
      "Capture the device, variant and state in the review URL. The tour never reacts, posts, saves or changes a feed record.",
  },
] as const satisfies readonly DesignLabOnboardingRouteConfig[];

function designLabStepsForRoute(
  config: DesignLabOnboardingRouteConfig,
): readonly DesignLabOnboardingStep[] {
  const id = config.route
    .replaceAll(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return [
    {
      id: `${id}:purpose`,
      title: config.pageLabel,
      body: config.purpose,
      icon: "sparkles",
      targetId: "design-lab-page-content",
      fallbackTargetId: "design-lab-navigation",
    },
    {
      id: `${id}:navigation`,
      title: `Navigate from ${config.pageLabel.toLowerCase()}`,
      body: config.navigationBody,
      icon: "navigation",
      targetId: "design-lab-navigation",
      fallbackTargetId: "design-lab-page-content",
    },
    {
      id: `${id}:boundary`,
      title: config.boundaryTitle,
      body: config.boundaryBody,
      icon: "user",
      targetId: "design-lab-page-content",
      fallbackTargetId: "design-lab-navigation",
    },
    {
      id: `${id}:review`,
      title: config.reviewTitle,
      body: config.reviewBody,
      icon: "layout",
      targetId:
        config.route === "/design-lab"
          ? "design-lab-tab-target"
          : "design-lab-page-content",
      fallbackTargetId: "design-lab-navigation",
    },
    {
      id: `${id}:continue`,
      title: config.continueTitle,
      body: config.continueBody,
      icon: "shield",
      targetId:
        config.route === "/design-lab"
          ? "design-lab-modal-target"
          : "design-lab-page-content",
      fallbackTargetId: "design-lab-navigation",
    },
  ];
}

export const DESIGN_LAB_ONBOARDING_ROUTE_TOURS =
  DESIGN_LAB_ONBOARDING_ROUTE_CONFIGS.map((config) => ({
    route: config.route,
    pageLabel: config.pageLabel,
    authentication: "optional" as const,
    allowedAudiences: ["admin"] as const,
    tourId: DESIGN_LAB_ONBOARDING_TOUR_ID,
    version: DESIGN_LAB_ONBOARDING_TOUR_VERSION,
    steps: designLabStepsForRoute(config),
  })) satisfies readonly DesignLabOnboardingRouteTour[];

const DESIGN_LAB_ONBOARDING_BY_ROUTE = new Map<
  string,
  DesignLabOnboardingRouteTour
>(DESIGN_LAB_ONBOARDING_ROUTE_TOURS.map((tour) => [tour.route, tour]));

export function getDesignLabOnboardingRouteTour(
  route: string | null | undefined,
) {
  if (!route) return undefined;
  const normalized = route.length > 1 ? route.replace(/\/$/, "") : route;
  return DESIGN_LAB_ONBOARDING_BY_ROUTE.get(normalized);
}

export function resolveDesignLabOnboardingTour(
  route: string | null | undefined,
  audience: DesignLabOnboardingAudience | null,
) {
  const tour = getDesignLabOnboardingRouteTour(route);
  if (!tour || !audience || !tour.allowedAudiences.includes(audience)) {
    return null;
  }
  return tour;
}

export type DesignLabOnboardingPreview =
  | {
      status: "available";
      tour: DesignLabOnboardingRouteTour;
      step: DesignLabOnboardingStep;
      stepNumber: number;
      requestedTargetId: DesignLabOnboardingTargetId;
      resolvedTargetId: DesignLabOnboardingTargetId;
      usedFallback: boolean;
    }
  | {
      status: "unavailable";
      message: "This tour is unavailable for the selected audience and route.";
    };

export function resolveDesignLabOnboardingPreview({
  audience,
  route,
  tourId,
  step,
  targetAvailable = true,
}: {
  audience: DesignLabOnboardingAudience | null;
  route: string | null | undefined;
  tourId: string | null | undefined;
  step: string | number | null | undefined;
  targetAvailable?: boolean;
}): DesignLabOnboardingPreview {
  const tour = resolveDesignLabOnboardingTour(route, audience);
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
