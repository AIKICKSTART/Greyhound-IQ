import {
  DESIGN_LAB_SCENARIO_DIMENSIONS,
  type DesignLabScenarioDimension,
  type DesignLabScenarioKey,
} from "./design-lab-scenario-contract";
import {
  getAccountOnboardingRouteTour,
  getAdminOnboardingRouteTour,
  resolveAccountOnboardingPreview,
  resolveAdminOnboardingPreview,
  type AdminOnboardingRole,
} from "./onboarding-tour-registry";
import {
  getCommunityOnboardingRouteTour,
  resolveCommunityOnboardingPreview,
  type CommunityOnboardingAudience,
} from "./community-onboarding-tour-registry";
import {
  getRacingOnboardingRouteTour,
  resolveRacingOnboardingPreview,
  type RacingOnboardingAudience,
} from "./racing-onboarding-tour-registry";
import {
  getPublicOnboardingRouteTour,
  resolvePublicOnboardingPreview,
  type PublicOnboardingAudience,
} from "./public-onboarding-tour-registry";
import {
  getMarketplaceOnboardingRouteTour,
  resolveMarketplaceOnboardingPreview,
  type MarketplaceOnboardingAudience,
} from "./marketplace-onboarding-tour-registry";
import {
  getAgentsOnboardingRouteTour,
  resolveAgentsOnboardingPreview,
  type AgentsOnboardingAudience,
} from "./agents-onboarding-tour-registry";
import {
  getDesignLabOnboardingRouteTour,
  resolveDesignLabOnboardingPreview,
} from "./design-lab-onboarding-tour-registry";
import { removeDesignLabTransientQueries } from "./design-lab-url-state";

export type DesignLabScenarioState = Record<DesignLabScenarioKey, string>;

export type DesignLabSearchParamReader = {
  get(name: string): string | null;
};

const DIMENSION_BY_KEY = new Map(
  DESIGN_LAB_SCENARIO_DIMENSIONS.map((dimension) => [
    dimension.key,
    dimension,
  ]),
);

export const DEFAULT_DESIGN_LAB_SCENARIO_STATE = Object.fromEntries(
  DESIGN_LAB_SCENARIO_DIMENSIONS.map((dimension) => [
    dimension.key,
    dimension.defaultValue,
  ]),
) as DesignLabScenarioState;

export function resolveDesignLabScenarioState(
  searchParams: DesignLabSearchParamReader,
): DesignLabScenarioState {
  return Object.fromEntries(
    DESIGN_LAB_SCENARIO_DIMENSIONS.map((dimension) => [
      dimension.key,
      resolveDimensionValue(
        dimension,
        searchParams.get(dimension.queryParam),
      ),
    ]),
  ) as DesignLabScenarioState;
}

export function buildDesignLabScenarioUrl(
  currentHref: string,
  patch: Partial<DesignLabScenarioState>,
) {
  const url = new URL(currentHref, "http://design-lab.invalid");
  removeDesignLabTransientQueries(url.searchParams);

  for (const dimension of DESIGN_LAB_SCENARIO_DIMENSIONS) {
    const candidate = patch[dimension.key];
    if (candidate === undefined) continue;
    url.searchParams.set(
      dimension.queryParam,
      resolveDimensionValue(dimension, candidate),
    );
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export function buildAdminOnboardingScenarioUrl(
  currentHref: string,
  {
    fallback = false,
    role,
    route,
    step,
  }: {
    fallback?: boolean;
    role: AdminOnboardingRole;
    route: string;
    step: number;
  },
) {
  const tour = getAdminOnboardingRouteTour(route);
  const preview = resolveAdminOnboardingPreview({
    route,
    role,
    tourId: tour?.tourId,
    step,
    targetAvailable: !fallback,
  });
  if (preview.status !== "available") {
    throw new Error("design_lab.admin_onboarding_scenario_unavailable");
  }

  const url = new URL(
    buildDesignLabScenarioUrl(currentHref, {
      auth: "signed-in",
      permissions: role,
      tour: preview.tour.tourId,
      tourStep: String(preview.stepNumber),
      errorState: fallback ? "feature-disabled" : "none",
    }),
    "http://design-lab.invalid",
  );
  url.searchParams.set("route", preview.tour.route);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function buildAccountOnboardingScenarioUrl(
  currentHref: string,
  {
    fallback = false,
    permissions = "member",
    route,
    step,
  }: {
    fallback?: boolean;
    permissions?: "member" | "moderator" | "admin";
    route: string;
    step: number;
  },
) {
  const tour = getAccountOnboardingRouteTour(route);
  const preview = resolveAccountOnboardingPreview({
    authenticated: true,
    route,
    tourId: tour?.tourId,
    step,
    targetAvailable: !fallback,
  });
  if (preview.status !== "available") {
    throw new Error("design_lab.account_onboarding_scenario_unavailable");
  }

  const url = new URL(
    buildDesignLabScenarioUrl(currentHref, {
      auth: "signed-in",
      permissions,
      tour: preview.tour.tourId,
      tourStep: String(preview.stepNumber),
      errorState: fallback ? "feature-disabled" : "none",
    }),
    "http://design-lab.invalid",
  );
  url.searchParams.set("route", preview.tour.route);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function buildRacingOnboardingScenarioUrl(
  currentHref: string,
  {
    audience = "visitor",
    fallback = false,
    route,
    step,
  }: {
    audience?: RacingOnboardingAudience;
    fallback?: boolean;
    route: string;
    step: number;
  },
) {
  const tour = getRacingOnboardingRouteTour(route);
  const preview = resolveRacingOnboardingPreview({
    audience,
    route,
    tourId: tour?.tourId,
    step,
    targetAvailable: !fallback,
  });
  if (preview.status !== "available") {
    throw new Error("design_lab.racing_onboarding_scenario_unavailable");
  }

  const url = new URL(
    buildDesignLabScenarioUrl(currentHref, {
      auth: audience === "visitor" ? "signed-out" : "signed-in",
      permissions: audience === "visitor" ? "none" : "member",
      tour: preview.tour.tourId,
      tourStep: String(preview.stepNumber),
      errorState: fallback ? "feature-disabled" : "none",
    }),
    "http://design-lab.invalid",
  );
  url.searchParams.set("route", preview.tour.route);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function buildCommunityOnboardingScenarioUrl(
  currentHref: string,
  {
    audience = "visitor",
    fallback = false,
    route,
    step,
  }: {
    audience?: CommunityOnboardingAudience;
    fallback?: boolean;
    route: string;
    step: number;
  },
) {
  const tour = getCommunityOnboardingRouteTour(route);
  const preview = resolveCommunityOnboardingPreview({
    audience,
    route,
    tourId: tour?.tourId,
    step,
    targetAvailable: !fallback,
  });
  if (preview.status !== "available") {
    throw new Error("design_lab.community_onboarding_scenario_unavailable");
  }

  const url = new URL(
    buildDesignLabScenarioUrl(currentHref, {
      auth: audience === "visitor" ? "signed-out" : "signed-in",
      permissions: audience === "visitor" ? "none" : "member",
      tour: preview.tour.tourId,
      tourStep: String(preview.stepNumber),
      errorState: fallback ? "feature-disabled" : "none",
    }),
    "http://design-lab.invalid",
  );
  url.searchParams.set("route", preview.tour.route);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function buildPublicOnboardingScenarioUrl(
  currentHref: string,
  {
    audience = "visitor",
    fallback = false,
    route,
    step,
  }: {
    audience?: PublicOnboardingAudience;
    fallback?: boolean;
    route: string;
    step: number;
  },
) {
  const tour = getPublicOnboardingRouteTour(route);
  const preview = resolvePublicOnboardingPreview({
    audience,
    route,
    tourId: tour?.tourId,
    step,
    targetAvailable: !fallback,
  });
  if (preview.status !== "available") {
    throw new Error("design_lab.public_onboarding_scenario_unavailable");
  }

  const visitor = audience === "visitor";
  const url = new URL(
    buildDesignLabScenarioUrl(currentHref, {
      auth: visitor ? "signed-out" : "signed-in",
      permissions: visitor ? "none" : audience,
      tour: preview.tour.tourId,
      tourStep: String(preview.stepNumber),
      errorState: fallback ? "feature-disabled" : "none",
    }),
    "http://design-lab.invalid",
  );
  url.searchParams.set("route", preview.tour.route);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function buildMarketplaceOnboardingScenarioUrl(
  currentHref: string,
  {
    audience = "visitor",
    fallback = false,
    route,
    step,
  }: {
    audience?: MarketplaceOnboardingAudience;
    fallback?: boolean;
    route: string;
    step: number;
  },
) {
  const tour = getMarketplaceOnboardingRouteTour(route);
  const preview = resolveMarketplaceOnboardingPreview({
    audience,
    route,
    tourId: tour?.tourId,
    step,
    targetAvailable: !fallback,
  });
  if (preview.status !== "available") {
    throw new Error("design_lab.marketplace_onboarding_scenario_unavailable");
  }

  const visitor = audience === "visitor";
  const url = new URL(
    buildDesignLabScenarioUrl(currentHref, {
      auth: visitor ? "signed-out" : "signed-in",
      permissions: visitor ? "none" : audience,
      tour: preview.tour.tourId,
      tourStep: String(preview.stepNumber),
      errorState: fallback ? "feature-disabled" : "none",
    }),
    "http://design-lab.invalid",
  );
  url.searchParams.set("route", preview.tour.route);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function buildAgentsOnboardingScenarioUrl(
  currentHref: string,
  {
    audience = "member",
    fallback = false,
    route,
    step,
  }: {
    audience?: AgentsOnboardingAudience;
    fallback?: boolean;
    route: string;
    step: number;
  },
) {
  const tour = getAgentsOnboardingRouteTour(route);
  const preview = resolveAgentsOnboardingPreview({
    audience,
    route,
    tourId: tour?.tourId,
    step,
    targetAvailable: !fallback,
  });
  if (preview.status !== "available") {
    throw new Error("design_lab.agents_onboarding_scenario_unavailable");
  }

  const url = new URL(
    buildDesignLabScenarioUrl(currentHref, {
      auth: "signed-in",
      permissions: audience,
      tour: preview.tour.tourId,
      tourStep: String(preview.stepNumber),
      errorState: fallback ? "feature-disabled" : "none",
    }),
    "http://design-lab.invalid",
  );
  url.searchParams.set("route", preview.tour.route);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function buildDesignLabOnboardingScenarioUrl(
  currentHref: string,
  {
    fallback = false,
    route,
    step,
  }: {
    fallback?: boolean;
    route: string;
    step: number;
  },
) {
  const tour = getDesignLabOnboardingRouteTour(route);
  const preview = resolveDesignLabOnboardingPreview({
    audience: "admin",
    route,
    tourId: tour?.tourId,
    step,
    targetAvailable: !fallback,
  });
  if (preview.status !== "available") {
    throw new Error("design_lab.design_lab_onboarding_scenario_unavailable");
  }

  const url = new URL(
    buildDesignLabScenarioUrl(currentHref, {
      auth: "signed-in",
      permissions: "admin",
      tour: preview.tour.tourId,
      tourStep: String(preview.stepNumber),
      errorState: fallback ? "feature-disabled" : "none",
    }),
    "http://design-lab.invalid",
  );
  url.searchParams.set("route", preview.tour.route);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function getDesignLabScenarioOption(
  key: DesignLabScenarioKey,
  value: string,
) {
  const dimension = DIMENSION_BY_KEY.get(key);
  if (!dimension) return undefined;
  return dimension.options.find((option) => option.value === value);
}

function resolveDimensionValue(
  dimension: DesignLabScenarioDimension,
  candidate: string | null,
) {
  return dimension.options.some((option) => option.value === candidate)
    ? candidate!
    : dimension.defaultValue;
}
