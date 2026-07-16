import type { AdminOnboardingIcon } from "./onboarding-tour-registry";

export const COMMUNITY_ONBOARDING_TOUR_ID = "tour:community-pulse:v1";
export const COMMUNITY_ONBOARDING_TOUR_VERSION = 1;
export const COMMUNITY_ONBOARDING_TARGET_IDS = [
  "community-navigation",
  "community-page-content",
] as const;

export type CommunityOnboardingTargetId =
  (typeof COMMUNITY_ONBOARDING_TARGET_IDS)[number];
export type CommunityOnboardingAudience = "visitor" | "member";
export type CommunityOnboardingStep = {
  id: string;
  title: string;
  body: string;
  icon: AdminOnboardingIcon;
  targetId: CommunityOnboardingTargetId;
  fallbackTargetId: CommunityOnboardingTargetId;
};
export type CommunityOnboardingRouteTour = {
  route: string;
  pageLabel: string;
  authentication: "optional";
  allowedAudiences: readonly CommunityOnboardingAudience[];
  tourId: typeof COMMUNITY_ONBOARDING_TOUR_ID;
  version: typeof COMMUNITY_ONBOARDING_TOUR_VERSION;
  steps: readonly CommunityOnboardingStep[];
};

type CommunityOnboardingRouteConfig = {
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

export const COMMUNITY_ONBOARDING_ROUTE_CONFIGS = [
  {
    route: "/discover",
    pageLabel: "Community directory",
    purpose:
      "Search public people, managed pages, businesses and greyhounds, with explicit initial and no-match states.",
    navigationBody:
      "Move from a grouped directory result to its public profile, then use Feed, Groups or Pulse only when that next journey is appropriate.",
    boundaryTitle: "Public discovery does not grant private access",
    boundaryBody:
      "Directory results are public; connection, follow and private-message actions still require server-verified identity and relationship checks.",
    reviewTitle: "Check the query and result group",
    reviewBody:
      "Confirm the exact search text and whether a result is a person, managed page, business or greyhound before opening it; a no-match state applies only to that query.",
    continueTitle: "Open the intended public identity",
    continueBody:
      "Verify the display name and handle before leaving the directory. The tour never submits a search or relationship action for you.",
  },
  {
    route: "/feed",
    pageLabel: "Community feed",
    purpose:
      "Read the public feed boundary or use the signed-in feed order, composer and identity-aware interaction surface.",
    navigationBody:
      "Use the community navigation to move between Feed, Groups, Discover and Pulse while keeping the current feed order and identity in mind.",
    boundaryTitle: "Reading and interaction are separate",
    boundaryBody:
      "Visitors receive a non-interactive feed. Signed-in reactions, comments, saves, shares and posts remain scoped to the server-resolved identity; managed-page posting requires Pro.",
    reviewTitle: "Confirm feed order and posting identity",
    reviewBody:
      "Check For You or Latest and the selected personal or managed-page identity before interpreting or composing content.",
    continueTitle: "Publish only as the intended actor",
    continueBody:
      "Review the post body, media and identity before submission. Dismissing or restarting this tour never publishes or reacts to content.",
  },
  {
    route: "/groups",
    pageLabel: "Community groups",
    purpose:
      "Browse public community groups and latest threads, including the explicit no-groups state.",
    navigationBody:
      "Choose a group before opening one of its threads, and return to this directory when you need a different community context.",
    boundaryTitle: "Browsing stays public; creation does not",
    boundaryBody:
      "Group and thread summaries are public, while creating a thread requires a server-authenticated member even when a link or form is visible.",
    reviewTitle: "Choose the correct group",
    reviewBody:
      "Check the group name, description and latest-thread context before opening it; an empty directory is an explicit state, not evidence of a hidden group.",
    continueTitle: "Enter one group at a time",
    continueBody:
      "Open the intended group and preserve its slug context before reading or starting a thread. The tour makes no membership or content change.",
  },
  {
    route: "/groups/[slug]",
    pageLabel: "Community group detail",
    purpose:
      "Review one public group's threads or empty state while missing groups resolve to not-found.",
    navigationBody:
      "Return to the Groups directory to change communities, or open a listed thread while retaining this group's identity.",
    boundaryTitle: "Thread creation requires a member",
    boundaryBody:
      "Public browsing remains open, but starting a thread is protected by server-side sign-in checks; an unknown slug returns not-found without exposing internal data.",
    reviewTitle: "Confirm the group and its thread state",
    reviewBody:
      "Verify the group heading and whether threads are populated or explicitly empty before following a thread or considering a new one.",
    continueTitle: "Open or create in the correct group",
    continueBody:
      "Recheck the group slug and intended topic before continuing. This tour does not submit the thread-creation form.",
  },
  {
    route: "/groups/threads/[id]",
    pageLabel: "Community thread",
    purpose:
      "Read one public group thread and its posts with explicit missing, locked and signed-out reply boundaries.",
    navigationBody:
      "Use the group context to return to its thread list, or move back to Groups before switching to a different discussion.",
    boundaryTitle: "Reply access depends on thread and identity",
    boundaryBody:
      "A missing thread resolves to not-found, a locked thread cannot accept replies, and an unlocked reply still requires a server-authenticated member.",
    reviewTitle: "Read the thread state before replying",
    reviewBody:
      "Confirm the thread title, group, post order and locked status before treating the reply control as available.",
    continueTitle: "Reply deliberately and in context",
    continueBody:
      "Review the intended thread and reply body before submission. The tour never posts, edits or unlocks community content.",
  },
  {
    route: "/p/[handle]",
    pageLabel: "Public community profile",
    purpose:
      "Review a public personal or managed-page profile with explicit not-found and signed-out relationship boundaries.",
    navigationBody:
      "Move back to Discover to change identities, or continue to Feed and Pulse only after confirming this profile's handle and type.",
    boundaryTitle: "Public profile does not mean public relationship data",
    boundaryBody:
      "Viewing is public, while connect, follow and chat actions require server-side identity, object and relationship authorization; unknown handles return not-found.",
    reviewTitle: "Verify the handle and profile type",
    reviewBody:
      "Confirm whether the route resolved a personal profile or managed page before reading its content or selecting an available relationship action.",
    continueTitle: "Choose the intended relationship action",
    continueBody:
      "Recheck the profile identity before connecting, following or messaging. Opening or dismissing this tour performs none of those actions.",
  },
  {
    route: "/pulse",
    pageLabel: "Pulse inbox",
    purpose:
      "See the private-messaging sign-in boundary or review the signed-in member's own conversations, unread state and empty inbox.",
    navigationBody:
      "Move between the Pulse inbox, accepted friends and one selected conversation without losing the private-participant context.",
    boundaryTitle: "Private inbox rows require server identity",
    boundaryBody:
      "Signed-out requests receive no private records; signed-in queries are restricted to conversations containing the current server-resolved profile.",
    reviewTitle: "Check inbox identity and unread state",
    reviewBody:
      "Confirm the signed-in profile, participant names and unread indicators before opening a conversation; an empty state applies only to that member.",
    continueTitle: "Open the intended participant thread",
    continueBody:
      "Select the correct participant before entering a private thread. The tour does not mark, create or send a message.",
  },
  {
    route: "/pulse/[id]",
    pageLabel: "Pulse conversation",
    purpose:
      "Review one private participant conversation with explicit signed-out, inaccessible, blocked and empty-message states.",
    navigationBody:
      "Return to the Pulse inbox or accepted friends before changing conversations, and keep the current participant identity visible.",
    boundaryTitle: "Conversation lookup is participant-only",
    boundaryBody:
      "Signed-out requests stop before lookup, non-participants receive not-found, and blocked relationships cannot send messages or start calls.",
    reviewTitle: "Confirm participant and conversation state",
    reviewBody:
      "Verify the other participant, search context, message chronology and blocked status before using message or call controls.",
    continueTitle: "Send or call only the intended participant",
    continueBody:
      "Review the active thread and payload before any private action. The tour never sends, reads, blocks, unblocks or starts a call.",
  },
  {
    route: "/pulse/friends",
    pageLabel: "Pulse friends",
    purpose:
      "See the private sign-in boundary or review the signed-in member's accepted friends and explicit no-friends state.",
    navigationBody:
      "Return to the Pulse inbox for conversations, or open message, voice and video entry points only from the intended friend row.",
    boundaryTitle: "Friend records remain account-scoped",
    boundaryBody:
      "Signed-out requests receive no friend records; signed-in results include only accepted relationships for the current profile, and contact links require a conversation identifier.",
    reviewTitle: "Confirm friend and conversation availability",
    reviewBody:
      "Check the friend identity and whether a conversation identifier exists before treating message or call entry points as available.",
    continueTitle: "Contact the correct accepted friend",
    continueBody:
      "Recheck the selected row before opening a conversation or call. The tour never changes a friendship or starts contact.",
  },
] as const satisfies readonly CommunityOnboardingRouteConfig[];

function communityStepsForRoute(
  config: CommunityOnboardingRouteConfig,
): readonly CommunityOnboardingStep[] {
  const id = config.route
    .replaceAll(/[\[\]/]/g, "-")
    .replace(/^-+|-+$/g, "");
  return [
    {
      id: `${id}:purpose`,
      title: config.pageLabel,
      body: config.purpose,
      icon: "sparkles",
      targetId: "community-page-content",
      fallbackTargetId: "community-navigation",
    },
    {
      id: `${id}:navigation`,
      title: `Navigate from ${config.pageLabel.toLowerCase()}`,
      body: config.navigationBody,
      icon: "navigation",
      targetId: "community-navigation",
      fallbackTargetId: "community-page-content",
    },
    {
      id: `${id}:boundary`,
      title: config.boundaryTitle,
      body: config.boundaryBody,
      icon: "user",
      targetId: "community-page-content",
      fallbackTargetId: "community-navigation",
    },
    {
      id: `${id}:review`,
      title: config.reviewTitle,
      body: config.reviewBody,
      icon: "layout",
      targetId: "community-page-content",
      fallbackTargetId: "community-navigation",
    },
    {
      id: `${id}:continue`,
      title: config.continueTitle,
      body: config.continueBody,
      icon: "shield",
      targetId: "community-page-content",
      fallbackTargetId: "community-navigation",
    },
  ];
}

export const COMMUNITY_ONBOARDING_ROUTE_TOURS =
  COMMUNITY_ONBOARDING_ROUTE_CONFIGS.map((config) => ({
    route: config.route,
    pageLabel: config.pageLabel,
    authentication: "optional" as const,
    allowedAudiences: ["visitor", "member"] as const,
    tourId: COMMUNITY_ONBOARDING_TOUR_ID,
    version: COMMUNITY_ONBOARDING_TOUR_VERSION,
    steps: communityStepsForRoute(config),
  })) satisfies readonly CommunityOnboardingRouteTour[];

const COMMUNITY_ONBOARDING_BY_ROUTE = new Map<
  string,
  CommunityOnboardingRouteTour
>(COMMUNITY_ONBOARDING_ROUTE_TOURS.map((tour) => [tour.route, tour]));

export function getCommunityOnboardingRouteTour(
  route: string | null | undefined,
) {
  if (!route) return undefined;
  const normalized = route.length > 1 ? route.replace(/\/$/, "") : route;
  const exact = COMMUNITY_ONBOARDING_BY_ROUTE.get(normalized);
  if (exact) return exact;
  for (const [pattern, expression] of [
    ["/groups/threads/[id]", /^\/groups\/threads\/[^/]+$/],
    ["/groups/[slug]", /^\/groups\/(?!threads(?:\/|$))[^/]+$/],
    ["/p/[handle]", /^\/p\/[^/]+$/],
    ["/pulse/[id]", /^\/pulse\/[^/]+$/],
  ] as const) {
    if (expression.test(normalized)) {
      return COMMUNITY_ONBOARDING_BY_ROUTE.get(pattern);
    }
  }
  return undefined;
}

export function resolveCommunityOnboardingTour(
  route: string | null | undefined,
  audience: CommunityOnboardingAudience | null,
) {
  const tour = getCommunityOnboardingRouteTour(route);
  if (!tour || !audience || !tour.allowedAudiences.includes(audience)) {
    return null;
  }
  return tour;
}

export type CommunityOnboardingPreview =
  | {
      status: "available";
      tour: CommunityOnboardingRouteTour;
      step: CommunityOnboardingStep;
      stepNumber: number;
      requestedTargetId: CommunityOnboardingTargetId;
      resolvedTargetId: CommunityOnboardingTargetId;
      usedFallback: boolean;
    }
  | {
      status: "unavailable";
      message: "This tour is unavailable for the selected audience and route.";
    };

export function resolveCommunityOnboardingPreview({
  audience,
  route,
  tourId,
  step,
  targetAvailable = true,
}: {
  audience: CommunityOnboardingAudience | null;
  route: string | null | undefined;
  tourId: string | null | undefined;
  step: string | number | null | undefined;
  targetAvailable?: boolean;
}): CommunityOnboardingPreview {
  const tour = resolveCommunityOnboardingTour(route, audience);
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
