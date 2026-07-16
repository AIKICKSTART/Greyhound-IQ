import type { AdminOnboardingIcon } from "./onboarding-tour-registry";

export const PUBLIC_ONBOARDING_TOUR_ID = "tour:public-foundations:v1";
export const PUBLIC_ONBOARDING_TOUR_VERSION = 1;
export const PUBLIC_ONBOARDING_TARGET_IDS = [
  "public-navigation",
  "public-page-content",
] as const;

export type PublicOnboardingTargetId =
  (typeof PUBLIC_ONBOARDING_TARGET_IDS)[number];
export type PublicOnboardingAudience =
  | "visitor"
  | "member"
  | "moderator"
  | "admin";
export type PublicOnboardingStep = {
  id: string;
  title: string;
  body: string;
  icon: AdminOnboardingIcon;
  targetId: PublicOnboardingTargetId;
  fallbackTargetId: PublicOnboardingTargetId;
};
export type PublicOnboardingRouteTour = {
  route: string;
  pageLabel: string;
  authentication: "public";
  allowedAudiences: readonly PublicOnboardingAudience[];
  tourId: typeof PUBLIC_ONBOARDING_TOUR_ID;
  version: typeof PUBLIC_ONBOARDING_TOUR_VERSION;
  steps: readonly PublicOnboardingStep[];
};

type PublicOnboardingRouteConfig = {
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

export const PUBLIC_ONBOARDING_ROUTE_CONFIGS = [
  {
    route: "/",
    pageLabel: "GreyhoundIQ home",
    purpose:
      "Orient yourself with today's race-card entry point, core racing capabilities and current meeting states.",
    navigationBody:
      "Use the public navigation to reach race cards, results, tracks, greyhounds, community areas, plan information and product help without losing the current page context.",
    boundaryTitle: "Public information is not account authority",
    boundaryBody:
      "The home experience is public; private conversations, account records, operator controls and protected mutations still require their own server-side identity and permission checks.",
    reviewTitle: "Check today's meeting state",
    reviewBody:
      "Distinguish loading, no-meeting, populated and recoverable-error states before opening a track or race, and verify the selected meeting identifier at the destination.",
    continueTitle: "Choose the intended product journey",
    continueBody:
      "Open a race, track, feature or pricing destination deliberately. Starting, dismissing or restarting this tour performs no account or racing-data action.",
  },
  {
    route: "/about",
    pageLabel: "About GreyhoundIQ",
    purpose:
      "Review GreyhoundIQ's Australian racing-intelligence purpose, principles and product context before choosing a next step.",
    navigationBody:
      "Return home for the primary product journey, open Contact for a direct question, or use the public navigation to inspect racing and community capabilities.",
    boundaryTitle: "Product explanation is not a performance promise",
    boundaryBody:
      "About-page statements describe product intent and operating principles; they do not guarantee a race outcome, data availability, subscription entitlement or support resolution.",
    reviewTitle: "Read purpose and principles together",
    reviewBody:
      "Confirm the Australian product scope and responsible-use position before relying on a feature description or sharing the service with another person.",
    continueTitle: "Continue with the right context",
    continueBody:
      "Choose Contact for clarification or a registered public destination for product use. The tour never creates an account, ticket or subscription.",
  },
  {
    route: "/auth/error",
    pageLabel: "Sign-in recovery",
    purpose:
      "Recover from an interrupted authentication callback using allowlisted public guidance and a safe fresh sign-in path.",
    navigationBody:
      "Retry sign-in, open Contact for support, or return home; do not copy callback query values into a different destination or treat them as authentication proof.",
    boundaryTitle: "Recovery context is not a session",
    boundaryBody:
      "Reason and reference values are parsed into allowlisted display states only. They never grant access, forward provider errors or replace a server-verified session.",
    reviewTitle: "Check the displayed recovery state",
    reviewBody:
      "Use the public recovery message and optional safe reference to decide whether to retry or request help without exposing tokens, cookies or provider diagnostics.",
    continueTitle: "Start a clean recovery action",
    continueBody:
      "Use the fixed sign-in, Contact or Home link. Opening this tour does not retry authentication or submit recovery information.",
  },
  {
    route: "/contact",
    pageLabel: "Contact and support",
    purpose:
      "Choose a public contact channel and, when signed in, prepare a support ticket scoped to the authenticated account.",
    navigationBody:
      "Use the header to return to product areas, or move to account support after sign-in when the request concerns an existing private ticket.",
    boundaryTitle: "Ticket submission requires identity",
    boundaryBody:
      "Everyone can view contact information, but createSupportTicket requires the current server-resolved profile before rate limiting or database writes; tour visibility grants no submission access.",
    reviewTitle: "Select the correct support path",
    reviewBody:
      "Check whether the issue is a general question, an account request or a technical problem, then review the subject and message before any authenticated submission.",
    continueTitle: "Share only necessary information",
    continueBody:
      "Avoid secrets, passwords, payment details and access tokens in support content. The tour does not populate or submit the ticket form.",
  },
  {
    route: "/pricing",
    pageLabel: "Plans and pricing",
    purpose:
      "Compare current plan features, billing intervals and explicit checkout-return or billing-first-use states.",
    navigationBody:
      "Return to the product area you are evaluating, open account billing for an existing subscription, or use Contact when a plan requirement is unclear.",
    boundaryTitle: "Viewing a plan does not start checkout",
    boundaryBody:
      "Pricing is public, while checkout requires a server-authenticated profile and redirects signed-out attempts to sign-in before rate limiting or Stripe session creation.",
    reviewTitle: "Verify plan, interval and return state",
    reviewBody:
      "Compare the selected plan and billing interval, distinguish disabled and first-use states, and treat checkout query values as display context rather than payment confirmation.",
    continueTitle: "Start billing only when ready",
    continueBody:
      "Confirm the plan, interval, account and expected charge before using checkout. The tour never creates a billing session or changes an entitlement.",
  },
  {
    route: "/privacy",
    pageLabel: "Privacy policy",
    purpose:
      "Review GreyhoundIQ's public privacy commitments, browser analytics preference controls and contact path for privacy questions.",
    navigationBody:
      "Move to Terms or Responsible Use for adjacent policies, Contact for a question, or account Privacy for authenticated export and preference records.",
    boundaryTitle: "Browser preference and account consent differ",
    boundaryBody:
      "The public cookie controls write only the fixed local browser preference; authenticated account consent, exports and deletion remain protected server-side workflows.",
    reviewTitle: "Read collection, use and control together",
    reviewBody:
      "Check what data category, purpose, retention and user control apply before changing a browser preference or requesting an account-level privacy action.",
    continueTitle: "Use the appropriate privacy control",
    continueBody:
      "Choose the local analytics preference, authenticated account control or Contact path that matches the request. The tour changes none of them.",
  },
  {
    route: "/responsible-use",
    pageLabel: "Responsible use",
    purpose:
      "Understand the limits of racing information and find Australian gambling-support and GreyhoundIQ policy resources.",
    navigationBody:
      "Open the fixed support service, Privacy, Terms or Contact destination, or return to racing intelligence with the responsible-use boundary in mind.",
    boundaryTitle: "Decision support is not certainty",
    boundaryBody:
      "GreyhoundIQ data and analysis cannot guarantee a result or remove financial risk; external help and telephone links remain fixed public resources rather than in-app advice.",
    reviewTitle: "Recognise when to stop and seek help",
    reviewBody:
      "Review the warning signs and available Australian support options before continuing when racing activity is no longer controlled, affordable or recreational.",
    continueTitle: "Choose a safe next action",
    continueBody:
      "Use the published help, policy or contact destination appropriate to the situation. The tour never places a wager, starts a call or sends a message.",
  },
  {
    route: "/terms",
    pageLabel: "Terms of service",
    purpose:
      "Review the public conditions that govern GreyhoundIQ access, acceptable use, subscriptions, content and service limitations.",
    navigationBody:
      "Move to Privacy or Responsible Use for related obligations, Contact for clarification, or return home after reviewing the applicable service conditions.",
    boundaryTitle: "Guidance does not replace the terms",
    boundaryBody:
      "This tour highlights navigation and review context only; the published terms remain the governing text and do not create an entitlement or operator permission.",
    reviewTitle: "Identify the clause relevant to your action",
    reviewBody:
      "Review account, content, payment, acceptable-use and limitation provisions in context before continuing with the related product workflow.",
    continueTitle: "Ask before assuming",
    continueBody:
      "Use the fixed Contact route when a condition is unclear and retain the current published context. The tour does not accept terms or change an account record.",
  },
] as const satisfies readonly PublicOnboardingRouteConfig[];

function publicStepsForRoute(
  config: PublicOnboardingRouteConfig,
): readonly PublicOnboardingStep[] {
  const id =
    config.route
      .replaceAll(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "") || "home";
  return [
    {
      id: `${id}:purpose`,
      title: config.pageLabel,
      body: config.purpose,
      icon: "sparkles",
      targetId: "public-page-content",
      fallbackTargetId: "public-navigation",
    },
    {
      id: `${id}:navigation`,
      title: `Navigate from ${config.pageLabel.toLowerCase()}`,
      body: config.navigationBody,
      icon: "navigation",
      targetId: "public-navigation",
      fallbackTargetId: "public-page-content",
    },
    {
      id: `${id}:boundary`,
      title: config.boundaryTitle,
      body: config.boundaryBody,
      icon: "user",
      targetId: "public-page-content",
      fallbackTargetId: "public-navigation",
    },
    {
      id: `${id}:review`,
      title: config.reviewTitle,
      body: config.reviewBody,
      icon: "layout",
      targetId: "public-page-content",
      fallbackTargetId: "public-navigation",
    },
    {
      id: `${id}:continue`,
      title: config.continueTitle,
      body: config.continueBody,
      icon: "shield",
      targetId: "public-page-content",
      fallbackTargetId: "public-navigation",
    },
  ];
}

export const PUBLIC_ONBOARDING_ROUTE_TOURS =
  PUBLIC_ONBOARDING_ROUTE_CONFIGS.map((config) => ({
    route: config.route,
    pageLabel: config.pageLabel,
    authentication: "public" as const,
    allowedAudiences: ["visitor", "member", "moderator", "admin"] as const,
    tourId: PUBLIC_ONBOARDING_TOUR_ID,
    version: PUBLIC_ONBOARDING_TOUR_VERSION,
    steps: publicStepsForRoute(config),
  })) satisfies readonly PublicOnboardingRouteTour[];

const PUBLIC_ONBOARDING_BY_ROUTE = new Map<string, PublicOnboardingRouteTour>(
  PUBLIC_ONBOARDING_ROUTE_TOURS.map((tour) => [tour.route, tour]),
);

export function getPublicOnboardingRouteTour(
  route: string | null | undefined,
) {
  if (!route) return undefined;
  const normalized = route.length > 1 ? route.replace(/\/$/, "") : route;
  return PUBLIC_ONBOARDING_BY_ROUTE.get(normalized);
}

export function resolvePublicOnboardingTour(
  route: string | null | undefined,
  audience: PublicOnboardingAudience | null,
) {
  const tour = getPublicOnboardingRouteTour(route);
  if (!tour || !audience || !tour.allowedAudiences.includes(audience)) {
    return null;
  }
  return tour;
}

export type PublicOnboardingPreview =
  | {
      status: "available";
      tour: PublicOnboardingRouteTour;
      step: PublicOnboardingStep;
      stepNumber: number;
      requestedTargetId: PublicOnboardingTargetId;
      resolvedTargetId: PublicOnboardingTargetId;
      usedFallback: boolean;
    }
  | {
      status: "unavailable";
      message: "This tour is unavailable for the selected audience and route.";
    };

export function resolvePublicOnboardingPreview({
  audience,
  route,
  tourId,
  step,
  targetAvailable = true,
}: {
  audience: PublicOnboardingAudience | null;
  route: string | null | undefined;
  tourId: string | null | undefined;
  step: string | number | null | undefined;
  targetAvailable?: boolean;
}): PublicOnboardingPreview {
  const tour = resolvePublicOnboardingTour(route, audience);
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
