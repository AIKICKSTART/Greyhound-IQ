import type { AdminOnboardingIcon } from "./onboarding-tour-registry";

export const AGENTS_ONBOARDING_TOUR_ID = "tour:agents:v1";
export const AGENTS_ONBOARDING_TOUR_VERSION = 1;
export const AGENTS_ONBOARDING_TARGET_IDS = [
  "agents-navigation",
  "agents-page-content",
] as const;

export type AgentsOnboardingTargetId =
  (typeof AGENTS_ONBOARDING_TARGET_IDS)[number];
export type AgentsOnboardingAudience = "member" | "moderator" | "admin";
export type AgentsOnboardingStep = {
  id: string;
  title: string;
  body: string;
  icon: AdminOnboardingIcon;
  targetId: AgentsOnboardingTargetId;
  fallbackTargetId: AgentsOnboardingTargetId;
};
export type AgentsOnboardingRouteTour = {
  route: "/agents";
  pageLabel: "AI agents";
  authentication: "required";
  allowedAudiences: readonly AgentsOnboardingAudience[];
  tourId: typeof AGENTS_ONBOARDING_TOUR_ID;
  version: typeof AGENTS_ONBOARDING_TOUR_VERSION;
  steps: readonly AgentsOnboardingStep[];
};

export const AGENTS_ONBOARDING_ROUTE_TOUR = {
  route: "/agents",
  pageLabel: "AI agents",
  authentication: "required",
  allowedAudiences: ["member", "moderator", "admin"],
  tourId: AGENTS_ONBOARDING_TOUR_ID,
  version: AGENTS_ONBOARDING_TOUR_VERSION,
  steps: [
    {
      id: "agents:purpose",
      title: "AI agents",
      body: "Review available GreyhoundIQ agent tools, their tier boundary and the signed-in account's own recent run history.",
      icon: "sparkles",
      targetId: "agents-page-content",
      fallbackTargetId: "agents-navigation",
    },
    {
      id: "agents:navigation",
      title: "Keep racing context close",
      body: "Use the shared navigation to return to statistics, racing data, pricing or account controls before choosing an agent workflow.",
      icon: "navigation",
      targetId: "agents-navigation",
      fallbackTargetId: "agents-page-content",
    },
    {
      id: "agents:boundary",
      title: "Runs require identity and allowance",
      body: "Signed-out visitors receive no private run inventory, createAgentRun resolves the current profile, and runAgentForCurrentUser checks the required tier before persistence.",
      icon: "user",
      targetId: "agents-page-content",
      fallbackTargetId: "agents-navigation",
    },
    {
      id: "agents:review",
      title: "Review type, input and prior state",
      body: "Confirm the selected agent type, bounded input and whether the account is tier-gated, empty or populated before starting a generation.",
      icon: "layout",
      targetId: "agents-page-content",
      fallbackTargetId: "agents-navigation",
    },
    {
      id: "agents:continue",
      title: "Run only the intended task",
      body: "Check the account, allowance, agent type and submitted information before execution. The tour never creates, cancels or repeats an agent run.",
      icon: "shield",
      targetId: "agents-page-content",
      fallbackTargetId: "agents-navigation",
    },
  ],
} as const satisfies AgentsOnboardingRouteTour;

export const AGENTS_ONBOARDING_ROUTE_TOURS = [
  AGENTS_ONBOARDING_ROUTE_TOUR,
] as const;

export function getAgentsOnboardingRouteTour(
  route: string | null | undefined,
) {
  if (!route) return undefined;
  const normalized = route.length > 1 ? route.replace(/\/$/, "") : route;
  return normalized === "/agents" ? AGENTS_ONBOARDING_ROUTE_TOUR : undefined;
}

export function resolveAgentsOnboardingTour(
  route: string | null | undefined,
  audience: AgentsOnboardingAudience | null,
) {
  const tour = getAgentsOnboardingRouteTour(route);
  if (!tour || !audience || !tour.allowedAudiences.includes(audience)) {
    return null;
  }
  return tour;
}

export type AgentsOnboardingPreview =
  | {
      status: "available";
      tour: AgentsOnboardingRouteTour;
      step: AgentsOnboardingStep;
      stepNumber: number;
      requestedTargetId: AgentsOnboardingTargetId;
      resolvedTargetId: AgentsOnboardingTargetId;
      usedFallback: boolean;
    }
  | {
      status: "unavailable";
      message: "This tour is unavailable for the selected audience and route.";
    };

export function resolveAgentsOnboardingPreview({
  audience,
  route,
  tourId,
  step,
  targetAvailable = true,
}: {
  audience: AgentsOnboardingAudience | null;
  route: string | null | undefined;
  tourId: string | null | undefined;
  step: string | number | null | undefined;
  targetAvailable?: boolean;
}): AgentsOnboardingPreview {
  const tour = resolveAgentsOnboardingTour(route, audience);
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
