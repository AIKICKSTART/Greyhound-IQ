import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  SCREEN_CONTRACTS,
  SCREEN_CONTRACT_BY_ROUTE,
} from "../demo-experience-registry";
import {
  ACCOUNT_ONBOARDING_ROUTE_CONFIGS,
  ACCOUNT_ONBOARDING_ROUTE_TOURS,
  ACCOUNT_ONBOARDING_TARGET_IDS,
  ACCOUNT_ONBOARDING_TOUR_ID,
  getAccountOnboardingRouteTour,
  resolveAccountOnboardingPreview,
  resolveContextualOnboardingTour,
} from "../onboarding-tour-registry";
import {
  buildAccountOnboardingScenarioUrl,
  resolveDesignLabScenarioState,
} from "../design-lab-scenario-state";
import {
  PRODUCTION_SCREEN_MEMBER_PERMISSION_CONTRACTS,
  PRODUCTION_SCREEN_MEMBER_STATE_CONTRACTS,
} from "./production-screen-member-access-state-evidence";
import {
  PRODUCTION_SCREEN_ACCOUNT_ONBOARDING_EVIDENCE_TEST,
  PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS,
  productionScreenCoverage,
} from "./production-screen-coverage";

// screen-evidence-test-id: PRODUCTION-SCREEN-ACCOUNT-ONBOARDING

const EXPECTED_ACCOUNT_ROUTES = [
  "/account",
  "/account/appearance",
  "/account/billing",
  "/account/listings",
  "/account/listings/archived",
  "/account/listings/drafts",
  "/account/notifications",
  "/account/pages",
  "/account/pages/[id]",
  "/account/privacy",
  "/account/profile",
  "/account/saved-listings",
  "/account/security",
  "/account/support",
  "/account/support/[id]",
  "/account/team",
  "/account/usage",
] as const;
const sorted = (values: readonly string[]) => [...values].sort();
const accountRoutes: string[] = ACCOUNT_ONBOARDING_ROUTE_TOURS.map(
  ({ route }) => route,
);
const accountScreens = SCREEN_CONTRACTS.filter(
  ({ productArea }) => productArea === "Account",
);

assert.equal(ACCOUNT_ONBOARDING_ROUTE_TOURS.length, 17);
assert.deepEqual(sorted(accountRoutes), sorted(EXPECTED_ACCOUNT_ROUTES));
assert.deepEqual(
  sorted(ACCOUNT_ONBOARDING_ROUTE_CONFIGS.map(({ route }) => route)),
  sorted(EXPECTED_ACCOUNT_ROUTES),
);
assert.deepEqual(
  sorted(accountScreens.map(({ route }) => route)),
  sorted(EXPECTED_ACCOUNT_ROUTES),
);
assert.deepEqual(
  sorted(
    PRODUCTION_SCREEN_MEMBER_PERMISSION_CONTRACTS.filter(({ route }) =>
      route.startsWith("/account"),
    ).map(({ route }) => route),
  ),
  sorted(EXPECTED_ACCOUNT_ROUTES),
);
assert.deepEqual(
  sorted(
    PRODUCTION_SCREEN_MEMBER_STATE_CONTRACTS.filter(({ route }) =>
      route.startsWith("/account"),
    ).map(({ route }) => route),
  ),
  sorted(EXPECTED_ACCOUNT_ROUTES),
);

assert.equal(
  getAccountOnboardingRouteTour("/account/pages/example-page")?.route,
  "/account/pages/[id]",
);
assert.equal(
  getAccountOnboardingRouteTour("/account/support/example-ticket")?.route,
  "/account/support/[id]",
);
assert.equal(getAccountOnboardingRouteTour("/account/pages/a/b"), undefined);
assert.equal(getAccountOnboardingRouteTour("/account/security/extra"), undefined);

for (const tour of ACCOUNT_ONBOARDING_ROUTE_TOURS) {
  assert.equal(tour.authentication, "required", tour.route);
  assert.equal(tour.tourId, ACCOUNT_ONBOARDING_TOUR_ID, tour.route);
  assert.equal(tour.steps.length, 5, tour.route);
  assert.equal(new Set(tour.steps.map(({ id }) => id)).size, 5, tour.route);
  assert.equal(
    resolveContextualOnboardingTour(tour.route, {
      authenticated: false,
      role: null,
    }),
    null,
    tour.route,
  );
  for (const role of ["member", "moderator", "admin"]) {
    assert.equal(
      resolveContextualOnboardingTour(tour.route, {
        authenticated: true,
        role,
      }),
      tour,
      `${tour.route}:${role}`,
    );
  }
  for (const step of tour.steps) {
    assert.ok(ACCOUNT_ONBOARDING_TARGET_IDS.includes(step.targetId), step.id);
    assert.ok(
      ACCOUNT_ONBOARDING_TARGET_IDS.includes(step.fallbackTargetId),
      step.id,
    );
  }

  for (let step = 1; step <= tour.steps.length; step += 1) {
    for (const fallback of [false, true]) {
      const scenarioUrl = buildAccountOnboardingScenarioUrl(
        "/design-lab?area=screens",
        { fallback, route: tour.route, step },
      );
      const params = new URL(scenarioUrl, "https://greyhoundsiq.invalid")
        .searchParams;
      const scenario = resolveDesignLabScenarioState(params);
      const preview = resolveAccountOnboardingPreview({
        authenticated:
          scenario.auth === "signed-in" && scenario.permissions !== "none",
        route: params.get("route"),
        tourId: scenario.tour,
        step: scenario.tourStep,
        targetAvailable: scenario.errorState !== "feature-disabled",
      });
      assert.equal(preview.status, "available", scenarioUrl);
      if (preview.status === "available") {
        assert.equal(preview.step.id, tour.steps[step - 1].id);
        assert.equal(preview.usedFallback, fallback);
      }
    }
  }

  const screen = SCREEN_CONTRACT_BY_ROUTE.get(tour.route)!;
  assert.equal(screen.authentication, "required", tour.route);
  assert.equal(screen.coverage.onboarding.status, "tested", tour.route);
  assert.equal(screen.onboardingTourId, tour.tourId, tour.route);
  const permissionContract = PRODUCTION_SCREEN_MEMBER_PERMISSION_CONTRACTS.find(
    ({ route }) => route === tour.route,
  )!;
  assert.ok(
    permissionContract.permissions.some(
      ({ actor, decision }) =>
        decision === "deny" && /signed-out|unauthenticated/i.test(actor),
    ),
    `${tour.route}: signed-out denial must remain registered`,
  );

  const coverage = productionScreenCoverage({
    screenId: `screen:${tour.route}`,
    route: tour.route,
    concreteRoute:
      tour.route === "/account/pages/[id]"
        ? "/account/pages/example-page"
        : tour.route === "/account/support/[id]"
          ? "/account/support/example-ticket"
          : tour.route,
    sourcePath: screen.sourceFiles[0],
    routeAuditPassed: true,
  });
  assert.equal(coverage.onboarding?.status, "tested", tour.route);
  assert.equal(coverage.onboardingTourId, tour.tourId, tour.route);
  const evidence = JSON.stringify(coverage.onboarding?.evidence);
  assert.match(evidence, /onboarding-tour-registry\.ts/);
  assert.match(evidence, /interactive-help\.tsx/);
  assert.match(evidence, /account\\?\/layout\.tsx/);
  assert.match(evidence, /site-header\.tsx/);
  assert.match(evidence, /PRODUCTION-SCREEN-ACCOUNT-ONBOARDING/);
}

const deniedPreview = resolveAccountOnboardingPreview({
  authenticated: false,
  route: "/account/security",
  tourId: ACCOUNT_ONBOARDING_TOUR_ID,
  step: 1,
});
assert.equal(deniedPreview.status, "unavailable");
assert.doesNotMatch(JSON.stringify(deniedPreview), /security|WorkOS|token/i);

const accountLayoutSource = readFileSync("src/app/account/layout.tsx", "utf8");
const headerSource = readFileSync("src/components/site-header.tsx", "utf8");
const interactiveHelpSource = readFileSync(
  "src/components/interactive-help.tsx",
  "utf8",
);
assert.match(accountLayoutSource, /data-onboarding-target="account-shell"/);
assert.match(
  accountLayoutSource,
  /data-onboarding-target="account-page-content"/,
);
assert.equal(
  headerSource.match(/data-onboarding-target="account-navigation"/g)?.length,
  3,
);
assert.match(interactiveHelpSource, /resolveContextualOnboardingTour/);
assert.match(interactiveHelpSource, /findVisibleOnboardingTarget/);
assert.match(interactiveHelpSource, /getClientRects\(\)\.length > 0/);
assert.match(interactiveHelpSource, /prefers-reduced-motion: reduce/);
assert.match(interactiveHelpSource, /finalFocus=\{restoreFocusRef\}/);
assert.match(
  interactiveHelpSource,
  /function dismissHelp\(\)[\s\S]*updateInteractiveHelpProgress\(progressStorageKey, "disable"\)[\s\S]*updateInteractiveHelp\("disable"\)/,
);

assert.equal(
  SCREEN_CONTRACTS.filter(
    ({ coverage, route }) =>
      accountRoutes.includes(route) && coverage.onboarding.status === "tested",
  ).length,
  17,
);
assert.equal(
  SCREEN_CONTRACTS.filter(
    ({ coverage }) => coverage.onboarding.status === "excluded",
  ).length,
  Object.keys(PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS).length,
);
assert.deepEqual(PRODUCTION_SCREEN_ACCOUNT_ONBOARDING_EVIDENCE_TEST, {
  id: "PRODUCTION-SCREEN-ACCOUNT-ONBOARDING",
  path: "src/components/screen-contracts/production-screen-account-onboarding-evidence.test.ts",
});

console.log(
  "Production account onboarding evidence passed: 17 exact authenticated routes, five contextual steps and 170 reproducible Design Lab states.",
);
