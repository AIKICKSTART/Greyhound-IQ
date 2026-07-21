import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  COMMUNITY_ONBOARDING_ROUTE_CONFIGS,
  COMMUNITY_ONBOARDING_ROUTE_TOURS,
  COMMUNITY_ONBOARDING_TARGET_IDS,
  COMMUNITY_ONBOARDING_TOUR_ID,
  getCommunityOnboardingRouteTour,
  resolveCommunityOnboardingPreview,
  resolveCommunityOnboardingTour,
} from "../community-onboarding-tour-registry";
import {
  SCREEN_CONTRACTS,
  SCREEN_CONTRACT_BY_ROUTE,
} from "../demo-experience-registry";
import {
  buildCommunityOnboardingScenarioUrl,
  resolveDesignLabScenarioState,
} from "../design-lab-scenario-state";
import { resolveContextualOnboardingTour } from "../onboarding-tour-registry";
import {
  PRODUCTION_SCREEN_MESSAGING_PERMISSION_CONTRACTS,
  PRODUCTION_SCREEN_MESSAGING_STATE_CONTRACTS,
} from "./production-screen-messaging-access-state-evidence";
import {
  PRODUCTION_SCREEN_COMMUNITY_ONBOARDING_EVIDENCE_TEST,
  PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS,
  productionScreenCoverage,
} from "./production-screen-coverage";
import { PUBLIC_SCREEN_PERMISSION_CONTRACTS } from "./screen-permission-evidence";
import { PRODUCTION_SCREEN_STATE_CONTRACTS } from "./screen-state-evidence";

// screen-evidence-test-id: PRODUCTION-SCREEN-COMMUNITY-ONBOARDING

const EXPECTED_COMMUNITY_ROUTES = [
  "/discover",
  "/feed",
  "/groups",
  "/groups/[slug]",
  "/groups/threads/[id]",
  "/p/[handle]",
  "/pulse",
  "/pulse/[id]",
  "/pulse/friends",
] as const;

const CONCRETE_ROUTE_BY_PATTERN = {
  "/discover": "/discover",
  "/feed": "/feed",
  "/groups": "/groups",
  "/groups/[slug]": "/groups/general",
  "/groups/threads/[id]": "/groups/threads/example-thread",
  "/p/[handle]": "/p/example-profile",
  "/pulse": "/pulse",
  "/pulse/[id]": "/pulse/example-conversation",
  "/pulse/friends": "/pulse/friends",
} as const satisfies Record<(typeof EXPECTED_COMMUNITY_ROUTES)[number], string>;

const expectedRouteSet = new Set<string>(EXPECTED_COMMUNITY_ROUTES);
const excludedRouteSet = new Set(
  Object.keys(PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS),
);
const sorted = (values: readonly string[]) => [...values].sort();
const canonicalCommunityScreens = SCREEN_CONTRACTS.filter(
  ({ productArea, route }) =>
    productArea === "Community and messaging" && !excludedRouteSet.has(route),
);
const communityPermissionContracts = [
  ...PUBLIC_SCREEN_PERMISSION_CONTRACTS.filter(({ route }) =>
    expectedRouteSet.has(route),
  ),
  ...PRODUCTION_SCREEN_MESSAGING_PERMISSION_CONTRACTS.filter(({ route }) =>
    expectedRouteSet.has(route),
  ),
];
const communityStateContracts = [
  ...PRODUCTION_SCREEN_STATE_CONTRACTS.filter(({ route }) =>
    expectedRouteSet.has(route),
  ),
  ...PRODUCTION_SCREEN_MESSAGING_STATE_CONTRACTS.filter(({ route }) =>
    expectedRouteSet.has(route),
  ),
];

assert.equal(COMMUNITY_ONBOARDING_ROUTE_TOURS.length, 9);
assert.deepEqual(
  sorted(COMMUNITY_ONBOARDING_ROUTE_TOURS.map(({ route }) => route)),
  sorted(EXPECTED_COMMUNITY_ROUTES),
);
assert.deepEqual(
  sorted(COMMUNITY_ONBOARDING_ROUTE_CONFIGS.map(({ route }) => route)),
  sorted(EXPECTED_COMMUNITY_ROUTES),
);
assert.deepEqual(
  sorted(canonicalCommunityScreens.map(({ route }) => route)),
  sorted(EXPECTED_COMMUNITY_ROUTES),
);
assert.deepEqual(
  sorted(communityPermissionContracts.map(({ route }) => route)),
  sorted(EXPECTED_COMMUNITY_ROUTES),
);
assert.deepEqual(
  sorted(communityStateContracts.map(({ route }) => route)),
  sorted(EXPECTED_COMMUNITY_ROUTES),
);

const dynamicRoutes = [
  ["/groups/general", "/groups/[slug]"],
  ["/groups/threads/example-thread", "/groups/threads/[id]"],
  ["/p/example-profile", "/p/[handle]"],
  ["/pulse/example-conversation", "/pulse/[id]"],
  ["/pulse/friends", "/pulse/friends"],
] as const;
for (const [concreteRoute, routePattern] of dynamicRoutes) {
  assert.equal(
    getCommunityOnboardingRouteTour(concreteRoute)?.route,
    routePattern,
    concreteRoute,
  );
}
for (const invalidRoute of [
  "/forum",
  "/groups/threads",
  "/groups/general/extra",
  "/groups/threads/example/extra",
  "/p/example/extra",
  "/pulse/example/extra",
]) {
  assert.equal(getCommunityOnboardingRouteTour(invalidRoute), undefined);
}
assert.throws(
  () =>
    buildCommunityOnboardingScenarioUrl("/design-lab", {
      route: "/forum",
      step: 1,
    }),
  /design_lab\.community_onboarding_scenario_unavailable/,
);

let designLabStateCount = 0;
const allStepIds = new Set<string>();
const allStepBodies = new Set<string>();
for (const tour of COMMUNITY_ONBOARDING_ROUTE_TOURS) {
  const config = COMMUNITY_ONBOARDING_ROUTE_CONFIGS.find(
    ({ route }) => route === tour.route,
  )!;
  assert.equal(tour.authentication, "optional", tour.route);
  assert.deepEqual(tour.allowedAudiences, ["visitor", "member"], tour.route);
  assert.equal(tour.tourId, COMMUNITY_ONBOARDING_TOUR_ID, tour.route);
  assert.equal(tour.steps.length, 5, tour.route);
  assert.equal(new Set(tour.steps.map(({ id }) => id)).size, 5, tour.route);
  assert.deepEqual(
    tour.steps.map(({ body }) => body),
    [
      config.purpose,
      config.navigationBody,
      config.boundaryBody,
      config.reviewBody,
      config.continueBody,
    ],
    tour.route,
  );
  assert.deepEqual(
    tour.steps.slice(2).map(({ title }) => title),
    [config.boundaryTitle, config.reviewTitle, config.continueTitle],
    tour.route,
  );
  assert.equal(resolveCommunityOnboardingTour(tour.route, null), null);
  assert.equal(
    resolveContextualOnboardingTour(tour.route, {
      authenticated: false,
      role: null,
    }),
    null,
    tour.route,
  );

  for (const audience of ["visitor", "member"] as const) {
    assert.equal(
      resolveCommunityOnboardingTour(tour.route, audience),
      tour,
      `${tour.route}:${audience}`,
    );
    assert.equal(
      resolveContextualOnboardingTour(tour.route, {
        authenticated: audience === "member",
        role: audience,
      }),
      tour,
      `${tour.route}:${audience}:contextual`,
    );

    for (let step = 1; step <= tour.steps.length; step += 1) {
      for (const fallback of [false, true]) {
        const scenarioUrl = buildCommunityOnboardingScenarioUrl(
          "/design-lab?area=screens",
          { audience, fallback, route: tour.route, step },
        );
        const params = new URL(scenarioUrl, "https://greyhoundsiq.invalid")
          .searchParams;
        const scenario = resolveDesignLabScenarioState(params);
        assert.equal(
          scenario.auth,
          audience === "visitor" ? "signed-out" : "signed-in",
          scenarioUrl,
        );
        assert.equal(
          scenario.permissions,
          audience === "visitor" ? "none" : "member",
          scenarioUrl,
        );
        const preview = resolveCommunityOnboardingPreview({
          audience,
          route: params.get("route"),
          tourId: scenario.tour,
          step: scenario.tourStep,
          targetAvailable: scenario.errorState !== "feature-disabled",
        });
        assert.equal(preview.status, "available", scenarioUrl);
        if (preview.status === "available") {
          assert.equal(preview.step.id, tour.steps[step - 1].id, scenarioUrl);
          assert.equal(preview.usedFallback, fallback, scenarioUrl);
        }
        designLabStateCount += 1;
      }
    }
  }

  for (const step of tour.steps) {
    assert.equal(allStepIds.has(step.id), false, step.id);
    assert.equal(allStepBodies.has(step.body), false, step.id);
    allStepIds.add(step.id);
    allStepBodies.add(step.body);
    assert.ok(COMMUNITY_ONBOARDING_TARGET_IDS.includes(step.targetId), step.id);
    assert.ok(
      COMMUNITY_ONBOARDING_TARGET_IDS.includes(step.fallbackTargetId),
      step.id,
    );
  }

  const screen = SCREEN_CONTRACT_BY_ROUTE.get(tour.route)!;
  assert.equal(screen.authentication, "optional", tour.route);
  assert.equal(screen.coverage.onboarding.status, "tested", tour.route);
  assert.equal(screen.onboardingTourId, tour.tourId, tour.route);
  const permissionContract = communityPermissionContracts.find(
    ({ route }) => route === tour.route,
  )!;
  if (tour.route.startsWith("/pulse")) {
    assert.ok(
      permissionContract.permissions.some(
        ({ actor, decision }) =>
          decision === "deny" && /signed-out visitor/i.test(actor),
      ),
      `${tour.route}: signed-out private data denial must remain explicit`,
    );
    assert.ok(
      permissionContract.permissions.some(
        ({ actor, decision }) =>
          decision === "allow" && /authenticated/i.test(actor),
      ),
      `${tour.route}: authenticated owner or participant access must remain explicit`,
    );
  } else {
    assert.ok(
      permissionContract.permissions.some(
        ({ actor, decision }) =>
          decision === "allow" && /signed-out visitor/i.test(actor),
      ),
      `${tour.route}: public viewing must remain explicitly allowed`,
    );
  }

  const coverage = productionScreenCoverage({
    screenId: `screen:${tour.route}`,
    route: tour.route,
    concreteRoute:
      CONCRETE_ROUTE_BY_PATTERN[
        tour.route as keyof typeof CONCRETE_ROUTE_BY_PATTERN
      ],
    sourcePath: screen.sourceFiles[0],
    routeAuditPassed: true,
  });
  assert.equal(coverage.onboarding?.status, "tested", tour.route);
  assert.equal(coverage.onboardingTourId, tour.tourId, tour.route);
  const evidence = JSON.stringify(coverage.onboarding?.evidence);
  assert.match(evidence, /community-onboarding-tour-registry\.ts/);
  assert.match(evidence, /interactive-help\.tsx/);
  assert.match(evidence, /src\\?\/app\\?\/layout\.tsx/);
  assert.match(evidence, /site-header\.tsx/);
  assert.match(evidence, /PRODUCTION-SCREEN-COMMUNITY-ONBOARDING/);
}

assert.equal(allStepIds.size, 45);
assert.equal(allStepBodies.size, 45);
assert.equal(designLabStateCount, 180);

const deniedPreview = resolveCommunityOnboardingPreview({
  audience: null,
  route: "/pulse/private-conversation",
  tourId: COMMUNITY_ONBOARDING_TOUR_ID,
  step: 4,
});
assert.equal(deniedPreview.status, "unavailable");
assert.doesNotMatch(
  JSON.stringify(deniedPreview),
  /pulse|conversation|participant|friend/i,
);

const rootLayoutSource = readFileSync("src/app/layout.tsx", "utf8");
const headerSource = readFileSync("src/components/site-header.tsx", "utf8");
const interactiveHelpSource = readFileSync(
  "src/components/interactive-help.tsx",
  "utf8",
);
assert.match(
  rootLayoutSource,
  /data-onboarding-target="[^"]*\bcommunity-page-content\b[^"]*"/,
);
assert.match(rootLayoutSource, /allowAutomaticOpen=\{Boolean\(user\)\}/);
assert.match(rootLayoutSource, /allowContextualAutomaticOpen/);
assert.match(rootLayoutSource, /role=\{user\?\.role \?\? "visitor"\}/);
assert.equal(
  headerSource.match(
    /data-onboarding-target="[^"]*\bcommunity-navigation\b[^"]*"/g,
  )?.length,
  4,
);
assert.match(interactiveHelpSource, /role === "visitor"/);
assert.match(
  interactiveHelpSource,
  /dataset\.onboardingTarget\?\.split\(\/\\s\+\/\)\.includes\(targetId\)/,
);
assert.match(interactiveHelpSource, /getClientRects\(\)\.length > 0/);
assert.match(interactiveHelpSource, /prefers-reduced-motion: reduce/);
assert.match(interactiveHelpSource, /finalFocus=\{resolveFinalFocus\}/);
assert.match(
  interactiveHelpSource,
  /function dismissHelp\(\)[\s\S]*updateInteractiveHelpProgress\(progressStorageKey, "disable"\)[\s\S]*updateInteractiveHelp\("disable"\)/,
);

assert.equal(
  SCREEN_CONTRACTS.filter(
    ({ coverage, route }) =>
      expectedRouteSet.has(route) && coverage.onboarding.status === "tested",
  ).length,
  9,
);
assert.deepEqual(PRODUCTION_SCREEN_COMMUNITY_ONBOARDING_EVIDENCE_TEST, {
  id: "PRODUCTION-SCREEN-COMMUNITY-ONBOARDING",
  path: "src/components/screen-contracts/production-screen-community-onboarding-evidence.test.ts",
});

console.log(
  "Production community onboarding evidence passed: 9 exact optional-auth routes, 45 unique route-specific steps and 180 reproducible visitor/member Design Lab states.",
);
