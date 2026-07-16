import { ADMIN_NAV_ITEMS } from "../app/admin/admin-nav-data";
import {
  AGENTS_ONBOARDING_TOUR_ID,
  getAgentsOnboardingRouteTour,
  resolveAgentsOnboardingPreview,
  resolveAgentsOnboardingTour,
  type AgentsOnboardingAudience,
  type AgentsOnboardingPreview,
  type AgentsOnboardingTargetId,
} from "./agents-onboarding-tour-registry";
import {
  COMMUNITY_ONBOARDING_TOUR_ID,
  getCommunityOnboardingRouteTour,
  resolveCommunityOnboardingPreview,
  resolveCommunityOnboardingTour,
  type CommunityOnboardingPreview,
  type CommunityOnboardingTargetId,
} from "./community-onboarding-tour-registry";
import {
  PUBLIC_ONBOARDING_TOUR_ID,
  getPublicOnboardingRouteTour,
  resolvePublicOnboardingPreview,
  resolvePublicOnboardingTour,
  type PublicOnboardingAudience,
  type PublicOnboardingPreview,
  type PublicOnboardingTargetId,
} from "./public-onboarding-tour-registry";
import {
  MARKETPLACE_ONBOARDING_TOUR_ID,
  getMarketplaceOnboardingRouteTour,
  resolveMarketplaceOnboardingPreview,
  resolveMarketplaceOnboardingTour,
  type MarketplaceOnboardingPreview,
  type MarketplaceOnboardingTargetId,
} from "./marketplace-onboarding-tour-registry";
import {
  DESIGN_LAB_ONBOARDING_TOUR_ID,
  getDesignLabOnboardingRouteTour,
  resolveDesignLabOnboardingPreview,
  resolveDesignLabOnboardingTour,
  type DesignLabOnboardingPreview,
  type DesignLabOnboardingTargetId,
} from "./design-lab-onboarding-tour-registry";
import {
  RACING_ONBOARDING_TOUR_ID,
  getRacingOnboardingRouteTour,
  resolveRacingOnboardingPreview,
  resolveRacingOnboardingTour,
  type RacingOnboardingRouteTour,
  type RacingOnboardingPreview,
  type RacingOnboardingTargetId,
} from "./racing-onboarding-tour-registry";
import {
  isSupportOperatorOnboardingRoute,
  type OnboardingPersona,
} from "./onboarding-persona";

export const ADMINISTRATOR_ONBOARDING_TOUR_ID =
  "tour:administrator:v1";
export const MODERATOR_ONBOARDING_TOUR_ID = "tour:moderator:v1";
export const ADMIN_ONBOARDING_TOUR_VERSION = 1;
export const ACCOUNT_ONBOARDING_TOUR_ID = "tour:account:v1";
export const ACCOUNT_ONBOARDING_TOUR_VERSION = 1;

export const ADMIN_ONBOARDING_TARGET_IDS = [
  "admin-shell",
  "admin-navigation",
  "admin-operator-status",
  "admin-page-header",
  "admin-page-content",
  "admin-page-actions",
] as const;

export type AdminOnboardingTargetId =
  (typeof ADMIN_ONBOARDING_TARGET_IDS)[number];
export const ACCOUNT_ONBOARDING_TARGET_IDS = [
  "account-shell",
  "account-navigation",
  "account-page-content",
] as const;
export type AccountOnboardingTargetId =
  (typeof ACCOUNT_ONBOARDING_TARGET_IDS)[number];
export type OnboardingTargetId =
  | AdminOnboardingTargetId
  | AccountOnboardingTargetId
  | RacingOnboardingTargetId
  | CommunityOnboardingTargetId
  | PublicOnboardingTargetId
  | MarketplaceOnboardingTargetId
  | AgentsOnboardingTargetId
  | DesignLabOnboardingTargetId;
export type AdminOnboardingRole = "moderator" | "admin";
export type AdminOnboardingIcon =
  | "sparkles"
  | "navigation"
  | "user"
  | "layout"
  | "shield";

export type AdminOnboardingStep = {
  id: string;
  title: string;
  body: string;
  icon: AdminOnboardingIcon;
  targetId: AdminOnboardingTargetId;
  fallbackTargetId: AdminOnboardingTargetId;
};

export type AdminOnboardingRouteTour = {
  route: string;
  pageLabel: string;
  minimumRole: AdminOnboardingRole;
  allowedRoles: readonly AdminOnboardingRole[];
  tourId:
    | typeof ADMINISTRATOR_ONBOARDING_TOUR_ID
    | typeof MODERATOR_ONBOARDING_TOUR_ID;
  version: typeof ADMIN_ONBOARDING_TOUR_VERSION;
  persona?: OnboardingPersona;
  steps: readonly AdminOnboardingStep[];
};

export type AccountOnboardingStep = Omit<
  AdminOnboardingStep,
  "targetId" | "fallbackTargetId"
> & {
  targetId: AccountOnboardingTargetId;
  fallbackTargetId: AccountOnboardingTargetId;
};

export type AccountOnboardingRouteTour = {
  route: string;
  pageLabel: string;
  authentication: "required";
  tourId: typeof ACCOUNT_ONBOARDING_TOUR_ID;
  version: typeof ACCOUNT_ONBOARDING_TOUR_VERSION;
  steps: readonly AccountOnboardingStep[];
};

type AccountOnboardingRouteConfig = {
  route: string;
  pageLabel: string;
  purpose: string;
  reviewTitle: string;
  reviewBody: string;
};

export const ACCOUNT_ONBOARDING_ROUTE_CONFIGS = [
  {
    route: "/account",
    pageLabel: "Account overview",
    purpose: "Review your identity, membership, privacy and account controls from one signed-in workspace.",
    reviewTitle: "Choose the right account area",
    reviewBody: "Use the overview links to move to profile, billing, security, privacy, notifications, saved items, team or support without changing data from this tour.",
  },
  {
    route: "/account/appearance",
    pageLabel: "Appearance preview",
    purpose: "Review URL-only visual combinations without persisting a production preference.",
    reviewTitle: "Compare presentation safely",
    reviewBody: "Change only the preview controls shown here and verify each visual state before copying a review URL.",
  },
  {
    route: "/account/billing",
    pageLabel: "Billing",
    purpose: "Review your local plan, entitlements, invoices and billing return state.",
    reviewTitle: "Verify billing status before acting",
    reviewBody: "Treat provider return parameters as navigation context only; confirmed subscription and payment records remain authoritative.",
  },
  {
    route: "/account/listings",
    pageLabel: "My marketplace listings",
    purpose: "Review the current account's marketplace records across every lifecycle state.",
    reviewTitle: "Confirm listing ownership and status",
    reviewBody: "Check the selected listing and lifecycle state before opening its detail or owner-only editor.",
  },
  {
    route: "/account/listings/archived",
    pageLabel: "Archived marketplace listings",
    purpose: "Review archived marketplace records owned by the current account.",
    reviewTitle: "Use archived records as history",
    reviewBody: "Confirm status and identity before opening a record; archived items do not expose editing from this view.",
  },
  {
    route: "/account/listings/drafts",
    pageLabel: "Marketplace drafts",
    purpose: "Review draft marketplace records owned by the current account before submission.",
    reviewTitle: "Complete the correct draft",
    reviewBody: "Confirm listing identity and content before opening the owner-only editor or creating another item.",
  },
  {
    route: "/account/notifications",
    pageLabel: "Notifications",
    purpose: "Review account-scoped notifications and recorded communication preferences.",
    reviewTitle: "Manage notification context",
    reviewBody: "Check unread items and preference status, including explicit empty states, before following a notification destination.",
  },
  {
    route: "/account/pages",
    pageLabel: "Managed pages",
    purpose: "Review pages owned by this account and the access boundary for creating another page.",
    reviewTitle: "Open the correct managed page",
    reviewBody: "Confirm the page identity and status before editing; creation and premium boundaries remain enforced by the server.",
  },
  {
    route: "/account/pages/[id]",
    pageLabel: "Managed page editor",
    purpose: "Review one owned page's identity, contact visibility, media and publishing controls.",
    reviewTitle: "Verify ownership and publication state",
    reviewBody: "Confirm the selected page and preview changes before saving, publishing, unpublishing or deleting it.",
  },
  {
    route: "/account/privacy",
    pageLabel: "Privacy",
    purpose: "Review export, consent, terms and marketing records scoped to this account.",
    reviewTitle: "Understand each privacy record",
    reviewBody: "Check the purpose, source and status of each record before requesting an export or changing a preference.",
  },
  {
    route: "/account/profile",
    pageLabel: "Profile studio",
    purpose: "Review and position your public profile and cover media in an authenticated workspace.",
    reviewTitle: "Preview media before saving",
    reviewBody: "Verify crop and positioning changes; current public media remains live until a safe replacement is accepted.",
  },
  {
    route: "/account/saved-listings",
    pageLabel: "Saved marketplace listings",
    purpose: "Review marketplace listings saved by this account with price, location and expiry context.",
    reviewTitle: "Recheck listing status",
    reviewBody: "Open the current listing before acting because availability, price and expiry may have changed since it was saved.",
  },
  {
    route: "/account/security",
    pageLabel: "Security",
    purpose: "Review safe local account fields and the external identity-management handoff.",
    reviewTitle: "Protect the identity boundary",
    reviewBody: "Use the approved identity-provider flow for sensitive changes; tokens, cookies and provider identifiers are never shown here.",
  },
  {
    route: "/account/support",
    pageLabel: "Support",
    purpose: "Review support ticket summaries scoped to this account.",
    reviewTitle: "Continue the correct support request",
    reviewBody: "Check ticket status and created time before opening or creating a request; private message content stays outside the summary.",
  },
  {
    route: "/account/support/[id]",
    pageLabel: "Support ticket conversation",
    purpose: "Review one support conversation owned by the current account.",
    reviewTitle: "Confirm ticket identity and status",
    reviewBody: "Check the category, status, dates and bounded message history before returning to the support index.",
  },
  {
    route: "/account/team",
    pageLabel: "Team memberships",
    purpose: "Review organization memberships linked to this signed-in account.",
    reviewTitle: "Confirm organization context",
    reviewBody: "Verify the organization and membership role before navigating to team administration or asking an owner for changes.",
  },
  {
    route: "/account/usage",
    pageLabel: "Usage",
    purpose: "Review tier limits and account-scoped usage events.",
    reviewTitle: "Interpret usage against the active tier",
    reviewBody: "Compare recent events with the displayed allowance before changing plan or investigating an unexpected limit.",
  },
] as const satisfies readonly AccountOnboardingRouteConfig[];

function routeSlug(route: string) {
  return route === "/admin"
    ? "dashboard"
    : route.slice("/admin/".length).replaceAll("/", "-");
}

function stepsForRoute(
  route: string,
  pageLabel: string,
  purpose: string,
): readonly AdminOnboardingStep[] {
  const id = routeSlug(route);
  return [
    {
      id: `${id}:purpose`,
      title: pageLabel,
      body: purpose,
      icon: "sparkles",
      targetId: "admin-page-header",
      fallbackTargetId: "admin-page-content",
    },
    {
      id: `${id}:navigation`,
      title: "Move between operator workspaces",
      body:
        "The control-centre navigation only shows destinations available to your current role.",
      icon: "navigation",
      targetId: "admin-navigation",
      fallbackTargetId: "admin-shell",
    },
    {
      id: `${id}:operator-context`,
      title: "Confirm operator context",
      body:
        "Check the active operator, environment and audited-session indicators before reviewing or changing records.",
      icon: "user",
      targetId: "admin-operator-status",
      fallbackTargetId: "admin-shell",
    },
    {
      id: `${id}:workspace`,
      title: `Review ${pageLabel.toLowerCase()}`,
      body:
        "The main workspace contains the route's records, states and controls. Follow the page guidance before taking an operator action.",
      icon: "layout",
      targetId: "admin-page-content",
      fallbackTargetId: "admin-page-header",
    },
    {
      id: `${id}:safe-action`,
      title: "Act with the least privilege",
      body:
        "Use only controls granted to your role, verify the target and expected result, and leave the audit trail intact.",
      icon: "shield",
      targetId: "admin-page-actions",
      fallbackTargetId: "admin-page-header",
    },
  ];
}

export const ADMIN_ONBOARDING_ROUTE_TOURS = ADMIN_NAV_ITEMS.map((item) => {
  const minimumRole: AdminOnboardingRole =
    item.minimumRole === "admin" ? "admin" : "moderator";
  const tourId =
    minimumRole === "admin"
      ? ADMINISTRATOR_ONBOARDING_TOUR_ID
      : MODERATOR_ONBOARDING_TOUR_ID;

  return {
    route: item.href,
    pageLabel: item.label,
    minimumRole,
    allowedRoles:
      minimumRole === "admin"
        ? (["admin"] as const)
        : (["moderator", "admin"] as const),
    tourId,
    version: ADMIN_ONBOARDING_TOUR_VERSION,
    steps: stepsForRoute(item.href, item.label, item.blurb),
  };
}) satisfies readonly AdminOnboardingRouteTour[];

const ADMIN_ONBOARDING_BY_ROUTE = new Map(
  ADMIN_ONBOARDING_ROUTE_TOURS.map((tour) => [tour.route, tour]),
);

function accountStepsForRoute(
  config: AccountOnboardingRouteConfig,
): readonly AccountOnboardingStep[] {
  const id = config.route
    .slice("/account".length)
    .replaceAll(/[\[\]/]/g, "-")
    .replace(/^-+|-+$/g, "") || "overview";
  return [
    {
      id: `${id}:purpose`,
      title: config.pageLabel,
      body: config.purpose,
      icon: "sparkles",
      targetId: "account-page-content",
      fallbackTargetId: "account-shell",
    },
    {
      id: `${id}:navigation`,
      title: "Move through your account",
      body: "Open the account menu to reach available account areas and the help controls for this signed-in browser.",
      icon: "navigation",
      targetId: "account-navigation",
      fallbackTargetId: "account-shell",
    },
    {
      id: `${id}:identity-boundary`,
      title: "Keep this account in context",
      body: "Every record and action on this route remains scoped by server-side authentication and ownership checks; tour visibility grants no access.",
      icon: "user",
      targetId: "account-shell",
      fallbackTargetId: "account-page-content",
    },
    {
      id: `${id}:review`,
      title: config.reviewTitle,
      body: config.reviewBody,
      icon: "layout",
      targetId: "account-page-content",
      fallbackTargetId: "account-shell",
    },
    {
      id: `${id}:safe-action`,
      title: "Review before you continue",
      body: "Confirm the current account, target record and expected result before using a page control. You can dismiss or restart this tour without changing account data.",
      icon: "shield",
      targetId: "account-page-content",
      fallbackTargetId: "account-shell",
    },
  ];
}

export const ACCOUNT_ONBOARDING_ROUTE_TOURS =
  ACCOUNT_ONBOARDING_ROUTE_CONFIGS.map((config) => ({
    route: config.route,
    pageLabel: config.pageLabel,
    authentication: "required" as const,
    tourId: ACCOUNT_ONBOARDING_TOUR_ID,
    version: ACCOUNT_ONBOARDING_TOUR_VERSION,
    steps: accountStepsForRoute(config),
  })) satisfies readonly AccountOnboardingRouteTour[];

const ACCOUNT_ONBOARDING_BY_ROUTE = new Map<
  string,
  AccountOnboardingRouteTour
>(
  ACCOUNT_ONBOARDING_ROUTE_TOURS.map((tour) => [tour.route, tour]),
);

export function getAdminOnboardingRouteTour(route: string | null | undefined) {
  if (!route) return undefined;
  const normalized = route.length > 1 ? route.replace(/\/$/, "") : route;
  return ADMIN_ONBOARDING_BY_ROUTE.get(normalized);
}

export function resolveAdminOnboardingTour(
  route: string | null | undefined,
  role: string | null | undefined,
) {
  const tour = getAdminOnboardingRouteTour(route);
  if (!tour || !tour.allowedRoles.some((allowedRole) => allowedRole === role)) {
    return null;
  }
  return tour;
}

export function getAccountOnboardingRouteTour(
  route: string | null | undefined,
) {
  if (!route) return undefined;
  const normalized = route.length > 1 ? route.replace(/\/$/, "") : route;
  const exact = ACCOUNT_ONBOARDING_BY_ROUTE.get(normalized);
  if (exact) return exact;
  if (/^\/account\/pages\/[^/]+$/.test(normalized)) {
    return ACCOUNT_ONBOARDING_BY_ROUTE.get("/account/pages/[id]");
  }
  if (/^\/account\/support\/[^/]+$/.test(normalized)) {
    return ACCOUNT_ONBOARDING_BY_ROUTE.get("/account/support/[id]");
  }
  return undefined;
}

export function resolveAccountOnboardingTour(
  route: string | null | undefined,
  authenticated: boolean,
) {
  if (!authenticated) return null;
  return getAccountOnboardingRouteTour(route) ?? null;
}

export function getOnboardingRouteTour(route: string | null | undefined) {
  return (
    getAdminOnboardingRouteTour(route) ??
    getAccountOnboardingRouteTour(route) ??
    getRacingOnboardingRouteTour(route) ??
    getCommunityOnboardingRouteTour(route) ??
    getPublicOnboardingRouteTour(route) ??
    getMarketplaceOnboardingRouteTour(route) ??
    getAgentsOnboardingRouteTour(route) ??
    getDesignLabOnboardingRouteTour(route)
  );
}

function resolveSharedAudience({
  anonymous = false,
  authenticated,
  role,
}: {
  anonymous?: boolean;
  authenticated: boolean;
  role: string | null | undefined;
}): PublicOnboardingAudience | null {
  if (!authenticated) {
    return anonymous || role === "visitor" ? "visitor" : null;
  }
  if (role === "admin" || role === "moderator") return role;
  return "member";
}

function resolveAuthenticatedAudience({
  authenticated,
  role,
}: {
  authenticated: boolean;
  role: string | null | undefined;
}): AgentsOnboardingAudience | null {
  const audience = resolveSharedAudience({ authenticated, role });
  return audience === "visitor" ? null : audience;
}

export function resolveContextualOnboardingPersona(
  route: string | null | undefined,
  {
    authenticated,
    role,
  }: {
    authenticated: boolean;
    role: string | null | undefined;
  },
): OnboardingPersona | null {
  if (!authenticated) return null;
  if (role === "trainer" && getRacingOnboardingRouteTour(route)) {
    return "trainer";
  }
  if (
    (role === "moderator" || role === "admin") &&
    isSupportOperatorOnboardingRoute(route)
  ) {
    return "support-operator";
  }
  return null;
}

function personalizeTrainerTour(tour: RacingOnboardingRouteTour) {
  return {
    ...tour,
    persona: "trainer" as const,
    steps: tour.steps.map((step) => {
      const suffix = step.id.split(":").at(-1);
      if (suffix === "navigation") {
        return {
          ...step,
          title: "Move through the trainer workflow",
          body: "Use racing navigation to verify dogs, race cards, results, tracks, breeding and statistics while preserving the current trainer, dog and meeting context.",
        };
      }
      if (suffix === "data-context") {
        return {
          ...step,
          title: "Confirm trainer and runner identity",
          body: "Check the registered trainer, greyhound, meeting, race, date and source freshness before interpreting form. Missing data is never inferred as a result or authority.",
        };
      }
      if (suffix === "responsible-use") {
        return {
          ...step,
          title: "Use trainer intelligence responsibly",
          body: "Treat loaded form and statistics as decision support, not certainty. This trainer path never changes a nomination, runner, kennel record or race entry.",
        };
      }
      return {
        ...step,
        body: `${step.body} This trainer path keeps the current kennel and runner identity visible and performs no racing action.`,
      };
    }),
  };
}

function personalizeSupportOperatorTour(tour: AdminOnboardingRouteTour) {
  return {
    ...tour,
    persona: "support-operator" as const,
    steps: tour.steps.map((step) => {
      const suffix = step.id.split(":").at(-1);
      if (suffix === "navigation") {
        return {
          ...step,
          title: "Move through support workspaces",
          body: "Use the moderator-visible Support tickets, Feedback and Bug reports workspaces while preserving the selected queue and customer context.",
        };
      }
      if (suffix === "operator-context") {
        return {
          ...step,
          title: "Confirm support-operator context",
          body: "Verify the signed-in moderator or administrator, environment and audited session before reading customer-submitted material. This persona grants no additional access.",
        };
      }
      if (suffix === "workspace") {
        return {
          ...step,
          title: `Triage ${tour.pageLabel.toLowerCase()}`,
          body: "Confirm queue state, record identity, severity and permitted disclosure before escalating or using an available operator control.",
        };
      }
      if (suffix === "safe-action") {
        return {
          ...step,
          title: "Protect the customer and audit trail",
          body: "Use minimum necessary access, never copy secrets into notes, verify the target before any change and preserve the complete support audit trail.",
        };
      }
      return {
        ...step,
        body: `${step.body} This support-operator path is available only through the existing moderator or administrator route authorization.`,
      };
    }),
  };
}

export function resolveContextualOnboardingTour(
  route: string | null | undefined,
  {
    authenticated,
    role,
  }: {
    authenticated: boolean;
    role: string | null | undefined;
  },
) {
  const persona = resolveContextualOnboardingPersona(route, {
    authenticated,
    role,
  });
  const adminTour = resolveAdminOnboardingTour(route, role);
  if (adminTour) {
    return persona === "support-operator"
      ? personalizeSupportOperatorTour(adminTour)
      : adminTour;
  }
  const accountTour = resolveAccountOnboardingTour(route, authenticated);
  if (accountTour) return accountTour;
  const racingTour = resolveRacingOnboardingTour(
    route,
    authenticated ? "member" : role === "visitor" ? "visitor" : null,
  );
  if (racingTour) {
    return persona === "trainer"
      ? personalizeTrainerTour(racingTour)
      : racingTour;
  }
  return (
    resolveCommunityOnboardingTour(
      route,
      authenticated ? "member" : role === "visitor" ? "visitor" : null,
    ) ??
    resolvePublicOnboardingTour(
      route,
      resolveSharedAudience({ authenticated, role }),
    ) ??
    resolveMarketplaceOnboardingTour(
      route,
      resolveSharedAudience({ authenticated, role }),
    ) ??
    resolveAgentsOnboardingTour(
      route,
      resolveAuthenticatedAudience({ authenticated, role }),
    ) ??
    resolveDesignLabOnboardingTour(
      route,
      authenticated && role === "admin" ? "admin" : null,
    )
  );
}

export type AdminOnboardingPreview =
  | {
      status: "available";
      tour: AdminOnboardingRouteTour;
      step: AdminOnboardingStep;
      stepNumber: number;
      requestedTargetId: AdminOnboardingTargetId;
      resolvedTargetId: AdminOnboardingTargetId;
      usedFallback: boolean;
    }
  | {
      status: "unavailable";
      message: "This tour is unavailable for the selected role and route.";
    };

export function resolveAdminOnboardingPreview({
  route,
  role,
  tourId,
  step,
  targetAvailable = true,
}: {
  route: string | null | undefined;
  role: string | null | undefined;
  tourId: string | null | undefined;
  step: string | number | null | undefined;
  targetAvailable?: boolean;
}): AdminOnboardingPreview {
  const tour = resolveAdminOnboardingTour(route, role);
  if (!tour || tour.tourId !== tourId) {
    return {
      status: "unavailable",
      message: "This tour is unavailable for the selected role and route.",
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

export type AccountOnboardingPreview =
  | {
      status: "available";
      tour: AccountOnboardingRouteTour;
      step: AccountOnboardingStep;
      stepNumber: number;
      requestedTargetId: AccountOnboardingTargetId;
      resolvedTargetId: AccountOnboardingTargetId;
      usedFallback: boolean;
    }
  | {
      status: "unavailable";
      message: "This tour is unavailable for the selected identity and route.";
    };

export function resolveAccountOnboardingPreview({
  authenticated,
  route,
  tourId,
  step,
  targetAvailable = true,
}: {
  authenticated: boolean;
  route: string | null | undefined;
  tourId: string | null | undefined;
  step: string | number | null | undefined;
  targetAvailable?: boolean;
}): AccountOnboardingPreview {
  const tour = resolveAccountOnboardingTour(route, authenticated);
  if (!tour || tour.tourId !== tourId) {
    return {
      status: "unavailable",
      message: "This tour is unavailable for the selected identity and route.",
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

export function resolveContextualOnboardingPreview({
  anonymous = false,
  authenticated,
  role,
  route,
  tourId,
  step,
  targetAvailable = true,
}: {
  anonymous?: boolean;
  authenticated: boolean;
  role: string | null | undefined;
  route: string | null | undefined;
  tourId: string | null | undefined;
  step: string | number | null | undefined;
  targetAvailable?: boolean;
}):
  | AdminOnboardingPreview
  | AccountOnboardingPreview
  | RacingOnboardingPreview
  | CommunityOnboardingPreview
  | PublicOnboardingPreview
  | MarketplaceOnboardingPreview
  | AgentsOnboardingPreview
  | DesignLabOnboardingPreview {
  const persona = resolveContextualOnboardingPersona(route, {
    authenticated,
    role,
  });
  if (tourId === RACING_ONBOARDING_TOUR_ID) {
    const preview = resolveRacingOnboardingPreview({
      audience: authenticated ? "member" : anonymous ? "visitor" : null,
      route,
      tourId,
      step,
      targetAvailable,
    });
    if (preview.status !== "available" || persona !== "trainer") {
      return preview;
    }
    const tour = personalizeTrainerTour(preview.tour);
    return {
      ...preview,
      tour,
      step: tour.steps[preview.stepNumber - 1],
    };
  }
  if (tourId === COMMUNITY_ONBOARDING_TOUR_ID) {
    return resolveCommunityOnboardingPreview({
      audience: authenticated ? "member" : anonymous ? "visitor" : null,
      route,
      tourId,
      step,
      targetAvailable,
    });
  }
  if (tourId === PUBLIC_ONBOARDING_TOUR_ID) {
    return resolvePublicOnboardingPreview({
      audience: resolveSharedAudience({ anonymous, authenticated, role }),
      route,
      tourId,
      step,
      targetAvailable,
    });
  }
  if (tourId === MARKETPLACE_ONBOARDING_TOUR_ID) {
    return resolveMarketplaceOnboardingPreview({
      audience: resolveSharedAudience({ anonymous, authenticated, role }),
      route,
      tourId,
      step,
      targetAvailable,
    });
  }
  if (tourId === AGENTS_ONBOARDING_TOUR_ID) {
    return resolveAgentsOnboardingPreview({
      audience: resolveAuthenticatedAudience({ authenticated, role }),
      route,
      tourId,
      step,
      targetAvailable,
    });
  }
  if (tourId === DESIGN_LAB_ONBOARDING_TOUR_ID) {
    return resolveDesignLabOnboardingPreview({
      audience: authenticated && role === "admin" ? "admin" : null,
      route,
      tourId,
      step,
      targetAvailable,
    });
  }
  if (!authenticated) {
    return {
      status: "unavailable",
      message: "This tour is unavailable for the selected identity and route.",
    };
  }
  if (tourId === ACCOUNT_ONBOARDING_TOUR_ID) {
    return resolveAccountOnboardingPreview({
      authenticated,
      route,
      tourId,
      step,
      targetAvailable,
    });
  }
  const preview = resolveAdminOnboardingPreview({
    route,
    role,
    tourId,
    step,
    targetAvailable,
  });
  if (preview.status !== "available" || persona !== "support-operator") {
    return preview;
  }
  const tour = personalizeSupportOperatorTour(preview.tour);
  return {
    ...preview,
    tour,
    step: tour.steps[preview.stepNumber - 1],
  };
}

export function onboardingScrollBehavior(reducedMotion: boolean) {
  return reducedMotion ? ("auto" as const) : ("smooth" as const);
}
