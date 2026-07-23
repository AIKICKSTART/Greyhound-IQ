import type { AdminOnboardingIcon } from "./onboarding-tour-registry";
import type { OnboardingPersona } from "./onboarding-persona";

export const RACING_ONBOARDING_TOUR_ID = "tour:racing-intelligence:v1";
export const RACING_ONBOARDING_TOUR_VERSION = 1;
export const RACING_ONBOARDING_TARGET_IDS = [
  "racing-navigation",
  "racing-page-content",
] as const;

export type RacingOnboardingTargetId =
  (typeof RACING_ONBOARDING_TARGET_IDS)[number];
export type RacingOnboardingAudience = "visitor" | "member";
export type RacingOnboardingStep = {
  id: string;
  title: string;
  body: string;
  icon: AdminOnboardingIcon;
  targetId: RacingOnboardingTargetId;
  fallbackTargetId: RacingOnboardingTargetId;
};
export type RacingOnboardingRouteTour = {
  route: string;
  pageLabel: string;
  authentication: "optional";
  allowedAudiences: readonly RacingOnboardingAudience[];
  tourId: typeof RACING_ONBOARDING_TOUR_ID;
  version: typeof RACING_ONBOARDING_TOUR_VERSION;
  persona?: OnboardingPersona;
  steps: readonly RacingOnboardingStep[];
};

type RacingOnboardingRouteConfig = {
  route: string;
  pageLabel: string;
  purpose: string;
  reviewTitle: string;
  reviewBody: string;
};

export const RACING_ONBOARDING_ROUTE_CONFIGS = [
  {
    route: "/breeding",
    pageLabel: "Breeding intelligence",
    purpose: "Review current sire-leader context while keeping planned breeding capabilities clearly separated from live data.",
    reviewTitle: "Read the current breeding evidence",
    reviewBody: "Compare the displayed sire results and sample size; planned Phase 2 tools are explanatory and must not be treated as live predictions.",
  },
  {
    route: "/dogs",
    pageLabel: "Greyhound search",
    purpose: "Search the national greyhound index and understand the current dataset tallies.",
    reviewTitle: "Search with a precise identity",
    reviewBody: "Use a bounded name query, confirm the returned dog and open its profile before relying on pedigree, ownership or recent-form details.",
  },
  {
    route: "/dogs/[id]",
    pageLabel: "Greyhound profile",
    purpose: "Review the selected greyhound's identity, ownership status, pedigree and recent form.",
    reviewTitle: "Confirm the dog before analysing form",
    reviewBody: "Check the registered identity and ownership context first, then move through pedigree and dated form records without assuming missing data is a result.",
  },
  {
    route: "/meetings/[id]",
    pageLabel: "Meeting detail",
    purpose: "Review one stored meeting's track, measured summary, racecard, settled results and replay availability without inferred statistics.",
    reviewTitle: "Verify meeting identity and provenance",
    reviewBody: "Confirm venue, date, source and freshness before moving through race links, results or replays; an empty section means that evidence is not stored for this meeting.",
  },
  {
    route: "/races",
    pageLabel: "Race explorer",
    purpose: "Review the race schedule by date, state, status, search and sort context.",
    reviewTitle: "Keep active race filters visible",
    reviewBody: "Confirm the selected date and filters before opening a race; an explicit no-races result applies only to the current view.",
  },
  {
    route: "/races/[id]",
    pageLabel: "Race detail",
    purpose: "Review the selected race's runners, available result and race summary.",
    reviewTitle: "Separate pre-race and settled evidence",
    reviewBody: "Confirm meeting, race number and start context before comparing runners; use settled result fields only when they are explicitly available.",
  },
  {
    route: "/results",
    pageLabel: "Race results",
    purpose: "Review settled race-result rows and the explicit no-results state for the current dataset.",
    reviewTitle: "Verify the settled race identity",
    reviewBody: "Match date, venue and race before reading placings or margins, and do not interpret an empty view as an inferred outcome.",
  },
  {
    route: "/statistics",
    pageLabel: "National statistics",
    purpose: "Review box-win rates, trainer leaders and current track records from the available dataset.",
    reviewTitle: "Interpret rates with their context",
    reviewBody: "Compare category, sample and period before drawing a conclusion; rankings and rates describe the loaded data rather than guarantee a future result.",
  },
  {
    route: "/tracks",
    pageLabel: "Australian tracks",
    purpose: "Review active venues and their current meeting context by selected state.",
    reviewTitle: "Choose the correct venue",
    reviewBody: "Confirm state and track identity before opening recent meetings; a no-tracks state applies to the current filter and dataset.",
  },
  {
    route: "/tracks/[id]",
    pageLabel: "Track profile",
    purpose: "Review the selected venue's meetings, track profile and box-win context.",
    reviewTitle: "Read track context before box data",
    reviewBody: "Confirm venue identity, distance and meeting period before comparing box rates or opening a recent race.",
  },
] as const satisfies readonly RacingOnboardingRouteConfig[];

function racingStepsForRoute(
  config: RacingOnboardingRouteConfig,
): readonly RacingOnboardingStep[] {
  const id = config.route
    .replaceAll(/[\[\]/]/g, "-")
    .replace(/^-+|-+$/g, "");
  return [
    {
      id: `${id}:purpose`,
      title: config.pageLabel,
      body: config.purpose,
      icon: "sparkles",
      targetId: "racing-page-content",
      fallbackTargetId: "racing-navigation",
    },
    {
      id: `${id}:navigation`,
      title: "Move through racing intelligence",
      body: "Use the racing navigation to move between race cards, results, tracks, greyhounds, breeding and statistics without losing the current page context.",
      icon: "navigation",
      targetId: "racing-navigation",
      fallbackTargetId: "racing-page-content",
    },
    {
      id: `${id}:data-context`,
      title: "Check data context first",
      body: "Confirm dates, filters, record identity and explicit empty or unavailable states before interpreting racing information.",
      icon: "user",
      targetId: "racing-page-content",
      fallbackTargetId: "racing-navigation",
    },
    {
      id: `${id}:review`,
      title: config.reviewTitle,
      body: config.reviewBody,
      icon: "layout",
      targetId: "racing-page-content",
      fallbackTargetId: "racing-navigation",
    },
    {
      id: `${id}:responsible-use`,
      title: "Use racing information responsibly",
      body: "Treat data and analysis as decision support, not certainty. You can dismiss or restart this tour without changing a filter, record or account.",
      icon: "shield",
      targetId: "racing-page-content",
      fallbackTargetId: "racing-navigation",
    },
  ];
}

export const RACING_ONBOARDING_ROUTE_TOURS =
  RACING_ONBOARDING_ROUTE_CONFIGS.map((config) => ({
    route: config.route,
    pageLabel: config.pageLabel,
    authentication: "optional" as const,
    allowedAudiences: ["visitor", "member"] as const,
    tourId: RACING_ONBOARDING_TOUR_ID,
    version: RACING_ONBOARDING_TOUR_VERSION,
    steps: racingStepsForRoute(config),
  })) satisfies readonly RacingOnboardingRouteTour[];

const RACING_ONBOARDING_BY_ROUTE = new Map<
  string,
  RacingOnboardingRouteTour
>(RACING_ONBOARDING_ROUTE_TOURS.map((tour) => [tour.route, tour]));

export function getRacingOnboardingRouteTour(
  route: string | null | undefined,
) {
  if (!route) return undefined;
  const normalized = route.length > 1 ? route.replace(/\/$/, "") : route;
  const exact = RACING_ONBOARDING_BY_ROUTE.get(normalized);
  if (exact) return exact;
  for (const [pattern, expression] of [
    ["/dogs/[id]", /^\/dogs\/[^/]+$/],
    ["/meetings/[id]", /^\/meetings\/[^/]+$/],
    ["/races/[id]", /^\/races\/[^/]+$/],
    ["/tracks/[id]", /^\/tracks\/[^/]+$/],
  ] as const) {
    if (expression.test(normalized)) {
      return RACING_ONBOARDING_BY_ROUTE.get(pattern);
    }
  }
  return undefined;
}

export function resolveRacingOnboardingTour(
  route: string | null | undefined,
  audience: RacingOnboardingAudience | null,
) {
  const tour = getRacingOnboardingRouteTour(route);
  if (!tour || !audience || !tour.allowedAudiences.includes(audience)) {
    return null;
  }
  return tour;
}

export type RacingOnboardingPreview =
  | {
      status: "available";
      tour: RacingOnboardingRouteTour;
      step: RacingOnboardingStep;
      stepNumber: number;
      requestedTargetId: RacingOnboardingTargetId;
      resolvedTargetId: RacingOnboardingTargetId;
      usedFallback: boolean;
    }
  | {
      status: "unavailable";
      message: "This tour is unavailable for the selected audience and route.";
    };

export function resolveRacingOnboardingPreview({
  audience,
  route,
  tourId,
  step,
  targetAvailable = true,
}: {
  audience: RacingOnboardingAudience | null;
  route: string | null | undefined;
  tourId: string | null | undefined;
  step: string | number | null | undefined;
  targetAvailable?: boolean;
}): RacingOnboardingPreview {
  const tour = resolveRacingOnboardingTour(route, audience);
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
