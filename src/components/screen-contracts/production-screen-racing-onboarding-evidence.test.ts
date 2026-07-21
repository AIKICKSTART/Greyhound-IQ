import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  SCREEN_CONTRACTS,
  SCREEN_CONTRACT_BY_ROUTE,
} from "../demo-experience-registry";
import { resolveContextualOnboardingTour } from "../onboarding-tour-registry";
import {
  RACING_ONBOARDING_ROUTE_CONFIGS,
  RACING_ONBOARDING_ROUTE_TOURS,
  RACING_ONBOARDING_TARGET_IDS,
  RACING_ONBOARDING_TOUR_ID,
  getRacingOnboardingRouteTour,
  resolveRacingOnboardingPreview,
  resolveRacingOnboardingTour,
} from "../racing-onboarding-tour-registry";
import {
  buildRacingOnboardingScenarioUrl,
  resolveDesignLabScenarioState,
} from "../design-lab-scenario-state";
import {
  PRODUCTION_SCREEN_RACING_ONBOARDING_EVIDENCE_TEST,
  productionScreenCoverage,
} from "./production-screen-coverage";
import { PUBLIC_SCREEN_PERMISSION_CONTRACTS } from "./screen-permission-evidence";
import { PRODUCTION_SCREEN_STATE_CONTRACTS } from "./screen-state-evidence";

// screen-evidence-test-id: PRODUCTION-SCREEN-RACING-ONBOARDING

const EXPECTED_RACING_ROUTES = [
  "/breeding",
  "/dogs",
  "/dogs/[id]",
  "/meetings/[id]",
  "/races",
  "/races/[id]",
  "/results",
  "/statistics",
  "/tracks",
  "/tracks/[id]",
] as const;

const CONCRETE_ROUTE_BY_PATTERN = {
  "/breeding": "/breeding",
  "/dogs": "/dogs",
  "/dogs/[id]": "/dogs/example-dog",
  "/meetings/[id]": "/meetings/demo-provider-meeting",
  "/races": "/races",
  "/races/[id]": "/races/example-race",
  "/results": "/results",
  "/statistics": "/statistics",
  "/tracks": "/tracks",
  "/tracks/[id]": "/tracks/example-track",
} as const satisfies Record<(typeof EXPECTED_RACING_ROUTES)[number], string>;

const expectedRouteSet = new Set<string>(EXPECTED_RACING_ROUTES);
const sorted = (values: readonly string[]) => [...values].sort();
const racingScreens = SCREEN_CONTRACTS.filter(
  ({ productArea }) => productArea === "Racing intelligence",
);

assert.equal(RACING_ONBOARDING_ROUTE_TOURS.length, 10);
assert.deepEqual(
  sorted(RACING_ONBOARDING_ROUTE_TOURS.map(({ route }) => route)),
  sorted(EXPECTED_RACING_ROUTES),
);
assert.deepEqual(
  sorted(RACING_ONBOARDING_ROUTE_CONFIGS.map(({ route }) => route)),
  sorted(EXPECTED_RACING_ROUTES),
);
assert.deepEqual(
  sorted(racingScreens.map(({ route }) => route)),
  sorted(EXPECTED_RACING_ROUTES),
);
assert.deepEqual(
  sorted(
    PUBLIC_SCREEN_PERMISSION_CONTRACTS.filter(({ route }) =>
      expectedRouteSet.has(route),
    ).map(({ route }) => route),
  ),
  sorted(EXPECTED_RACING_ROUTES),
);
assert.deepEqual(
  sorted(
    PRODUCTION_SCREEN_STATE_CONTRACTS.filter(({ route }) =>
      expectedRouteSet.has(route),
    ).map(({ route }) => route),
  ),
  sorted(EXPECTED_RACING_ROUTES),
);

const dynamicRoutes = [
  ["/dogs/example-dog", "/dogs/[id]"],
  ["/meetings/demo-provider-meeting", "/meetings/[id]"],
  ["/races/example-race", "/races/[id]"],
  ["/tracks/example-track", "/tracks/[id]"],
] as const;
for (const [concreteRoute, routePattern] of dynamicRoutes) {
  assert.equal(
    getRacingOnboardingRouteTour(concreteRoute)?.route,
    routePattern,
    concreteRoute,
  );
}
for (const invalidRoute of [
  "/dogs/example/extra",
  "/meetings/example/extra",
  "/races/example/extra",
  "/tracks/example/extra",
]) {
  assert.equal(getRacingOnboardingRouteTour(invalidRoute), undefined);
}

let designLabStateCount = 0;
const allStepIds = new Set<string>();
for (const tour of RACING_ONBOARDING_ROUTE_TOURS) {
  const config = RACING_ONBOARDING_ROUTE_CONFIGS.find(
    ({ route }) => route === tour.route,
  )!;
  assert.equal(tour.authentication, "optional", tour.route);
  assert.deepEqual(tour.allowedAudiences, ["visitor", "member"], tour.route);
  assert.equal(tour.tourId, RACING_ONBOARDING_TOUR_ID, tour.route);
  assert.equal(tour.steps.length, 5, tour.route);
  assert.equal(new Set(tour.steps.map(({ id }) => id)).size, 5, tour.route);
  assert.equal(tour.steps[0].body, config.purpose, tour.route);
  assert.equal(tour.steps[3].title, config.reviewTitle, tour.route);
  assert.equal(tour.steps[3].body, config.reviewBody, tour.route);
  assert.equal(resolveRacingOnboardingTour(tour.route, null), null, tour.route);
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
      resolveRacingOnboardingTour(tour.route, audience),
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
        const scenarioUrl = buildRacingOnboardingScenarioUrl(
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
        const preview = resolveRacingOnboardingPreview({
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
    allStepIds.add(step.id);
    assert.ok(RACING_ONBOARDING_TARGET_IDS.includes(step.targetId), step.id);
    assert.ok(
      RACING_ONBOARDING_TARGET_IDS.includes(step.fallbackTargetId),
      step.id,
    );
  }

  const screen = SCREEN_CONTRACT_BY_ROUTE.get(tour.route)!;
  assert.equal(screen.authentication, "optional", tour.route);
  assert.equal(screen.coverage.onboarding.status, "tested", tour.route);
  assert.equal(screen.onboardingTourId, tour.tourId, tour.route);
  const permissionContract = PUBLIC_SCREEN_PERMISSION_CONTRACTS.find(
    ({ route }) => route === tour.route,
  )!;
  assert.ok(
    permissionContract.permissions.some(
      ({ actor, decision }) =>
        decision === "allow" && /signed-out visitor/i.test(actor),
    ),
    `${tour.route}: signed-out viewing must remain explicitly allowed`,
  );

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
  assert.match(evidence, /racing-onboarding-tour-registry\.ts/);
  assert.match(evidence, /interactive-help\.tsx/);
  assert.match(evidence, /src\\?\/app\\?\/layout\.tsx/);
  assert.match(evidence, /site-header\.tsx/);
  assert.match(evidence, /PRODUCTION-SCREEN-RACING-ONBOARDING/);
}

assert.equal(allStepIds.size, 50);
assert.equal(designLabStateCount, 200);

const deniedPreview = resolveRacingOnboardingPreview({
  audience: null,
  route: "/races/example-race",
  tourId: RACING_ONBOARDING_TOUR_ID,
  step: 4,
});
assert.equal(deniedPreview.status, "unavailable");
assert.doesNotMatch(
  JSON.stringify(deniedPreview),
  /races|runner|settled|result/i,
);

const rootLayoutSource = readFileSync("src/app/layout.tsx", "utf8");
const headerSource = readFileSync("src/components/site-header.tsx", "utf8");
const interactiveHelpSource = readFileSync(
  "src/components/interactive-help.tsx",
  "utf8",
);
assert.match(
  rootLayoutSource,
  /data-onboarding-target="[^"]*\bracing-page-content\b[^"]*"/,
);
assert.match(rootLayoutSource, /allowAutomaticOpen=\{Boolean\(user\)\}/);
assert.match(rootLayoutSource, /allowContextualAutomaticOpen/);
assert.match(rootLayoutSource, /role=\{user\?\.role \?\? "visitor"\}/);
assert.equal(
  headerSource.match(
    /data-onboarding-target="[^"]*\bracing-navigation\b[^"]*"/g,
  )?.length,
  4,
);
assert.match(interactiveHelpSource, /role === "visitor"/);
assert.match(interactiveHelpSource, /authenticated,/);
assert.match(
  interactiveHelpSource,
  /Boolean\(routeTour\) \|\| role !== "visitor"/,
);
assert.match(interactiveHelpSource, /findVisibleOnboardingTarget/);
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
  10,
);
assert.deepEqual(PRODUCTION_SCREEN_RACING_ONBOARDING_EVIDENCE_TEST, {
  id: "PRODUCTION-SCREEN-RACING-ONBOARDING",
  path: "src/components/screen-contracts/production-screen-racing-onboarding-evidence.test.ts",
});

console.log(
  "Production racing onboarding evidence passed: 10 exact optional-auth routes, 50 route-specific steps and 200 reproducible visitor/member Design Lab states.",
);
