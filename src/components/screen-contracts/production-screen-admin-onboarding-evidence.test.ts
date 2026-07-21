import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { ADMIN_AUTHORIZATION_INVENTORY } from "../../app/admin/admin-authorization-inventory";
import { ADMIN_NAV_ITEMS } from "../../app/admin/admin-nav-data";
import {
  SCREEN_CONTRACTS,
  SCREEN_CONTRACT_BY_ROUTE,
} from "../demo-experience-registry";
import {
  ADMIN_ONBOARDING_ROUTE_TOURS,
  ADMIN_ONBOARDING_TARGET_IDS,
  ADMINISTRATOR_ONBOARDING_TOUR_ID,
  MODERATOR_ONBOARDING_TOUR_ID,
  resolveAdminOnboardingPreview,
  resolveAdminOnboardingTour,
} from "../onboarding-tour-registry";
import {
  buildAdminOnboardingScenarioUrl,
  resolveDesignLabScenarioState,
} from "../design-lab-scenario-state";
import { PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_CONTRACTS } from "./production-screen-admin-access-state-evidence";
import {
  PRODUCTION_SCREEN_ADMIN_ONBOARDING_EVIDENCE_TEST,
  PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS,
  productionScreenCoverage,
} from "./production-screen-coverage";

// screen-evidence-test-id: PRODUCTION-SCREEN-ADMIN-ONBOARDING

const sorted = (values: readonly string[]) => [...values].sort();
const tourRoutes = ADMIN_ONBOARDING_ROUTE_TOURS.map(({ route }) => route);

assert.equal(ADMIN_ONBOARDING_ROUTE_TOURS.length, 32);
assert.deepEqual(
  sorted(tourRoutes),
  sorted(ADMIN_NAV_ITEMS.map(({ href }) => href)),
);
assert.deepEqual(
  sorted(tourRoutes),
  sorted(ADMIN_AUTHORIZATION_INVENTORY.pages.map(({ id }) => id)),
);
assert.deepEqual(
  sorted(tourRoutes),
  sorted(
    PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_CONTRACTS.map(({ route }) => route),
  ),
);
assert.equal(
  ADMIN_ONBOARDING_ROUTE_TOURS.filter(
    ({ minimumRole }) => minimumRole === "admin",
  ).length,
  23,
);
assert.equal(
  ADMIN_ONBOARDING_ROUTE_TOURS.filter(
    ({ minimumRole }) => minimumRole === "moderator",
  ).length,
  9,
);

for (const tour of ADMIN_ONBOARDING_ROUTE_TOURS) {
  assert.equal(tour.steps.length, 5, tour.route);
  assert.equal(new Set(tour.steps.map(({ id }) => id)).size, 5, tour.route);
  assert.equal(resolveAdminOnboardingTour(tour.route, "member"), null);
  assert.equal(resolveAdminOnboardingTour(tour.route, "admin"), tour);
  assert.equal(
    resolveAdminOnboardingTour(tour.route, "moderator"),
    tour.minimumRole === "moderator" ? tour : null,
  );
  assert.equal(
    tour.tourId,
    tour.minimumRole === "admin"
      ? ADMINISTRATOR_ONBOARDING_TOUR_ID
      : MODERATOR_ONBOARDING_TOUR_ID,
  );

  for (const step of tour.steps) {
    assert.ok(ADMIN_ONBOARDING_TARGET_IDS.includes(step.targetId), step.id);
    assert.ok(
      ADMIN_ONBOARDING_TARGET_IDS.includes(step.fallbackTargetId),
      step.id,
    );
  }

  const authorization = ADMIN_AUTHORIZATION_INVENTORY.pages.find(
    ({ id }) => id === tour.route,
  )!;
  assert.match(
    readFileSync(authorization.sourceFile, "utf8"),
    /AdminPageHeader/,
  );

  for (let step = 1; step <= tour.steps.length; step += 1) {
    for (const fallback of [false, true]) {
      const scenarioUrl = buildAdminOnboardingScenarioUrl(
        "/design-lab?area=screens",
        {
          fallback,
          role: tour.minimumRole,
          route: tour.route,
          step,
        },
      );
      const params = new URL(scenarioUrl, "https://greyhoundsiq.invalid")
        .searchParams;
      const scenario = resolveDesignLabScenarioState(params);
      const preview = resolveAdminOnboardingPreview({
        route: params.get("route"),
        role: scenario.permissions,
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

  const coverage = productionScreenCoverage({
    screenId: `screen:${tour.route}`,
    route: tour.route,
    concreteRoute: tour.route,
    sourcePath: authorization.sourceFile,
    routeAuditPassed: true,
  });
  assert.equal(coverage.onboarding?.status, "tested", tour.route);
  assert.equal(coverage.onboardingTourId, tour.tourId, tour.route);
  const evidence = JSON.stringify(coverage.onboarding?.evidence);
  assert.match(evidence, /onboarding-tour-registry\.ts/);
  assert.match(evidence, /interactive-help\.tsx/);
  assert.match(evidence, /PRODUCTION-SCREEN-ADMIN-ONBOARDING/);

  const screen = SCREEN_CONTRACT_BY_ROUTE.get(tour.route)!;
  assert.equal(screen.coverage.onboarding.status, "tested", tour.route);
  assert.equal(screen.onboardingTourId, tour.tourId, tour.route);
}

const deniedPreview = resolveAdminOnboardingPreview({
  route: "/admin/users",
  role: "moderator",
  tourId: ADMINISTRATOR_ONBOARDING_TOUR_ID,
  step: 1,
});
assert.equal(deniedPreview.status, "unavailable");
assert.doesNotMatch(JSON.stringify(deniedPreview), /users|administrator/i);

const adminLayoutSource = readFileSync("src/app/admin/layout.tsx", "utf8");
const adminNavSource = readFileSync("src/app/admin/admin-nav.tsx", "utf8");
const adminHeaderSource = readFileSync(
  "src/app/admin/admin-page-header.tsx",
  "utf8",
);
const interactiveHelpSource = readFileSync(
  "src/components/interactive-help.tsx",
  "utf8",
);
for (const targetId of [
  "admin-shell",
  "admin-operator-status",
  "admin-page-content",
]) {
  assert.match(
    adminLayoutSource,
    new RegExp(`data-onboarding-target="${targetId}"`),
  );
}
assert.match(adminNavSource, /data-onboarding-target="admin-navigation"/);
assert.match(adminHeaderSource, /data-onboarding-target="admin-page-header"/);
assert.match(adminHeaderSource, /data-onboarding-target="admin-page-actions"/);
assert.match(interactiveHelpSource, /buildInteractiveHelpProgressStorageKey/);
assert.match(interactiveHelpSource, /findVisibleOnboardingTarget/);
assert.match(interactiveHelpSource, /getClientRects\(\)\.length > 0/);
assert.match(interactiveHelpSource, /prefers-reduced-motion: reduce/);
assert.match(interactiveHelpSource, /finalFocus=\{resolveFinalFocus\}/);
assert.match(
  interactiveHelpSource,
  /aria-label="Close and turn off guided help"/,
);
assert.match(
  interactiveHelpSource,
  /function dismissHelp\(\)[\s\S]*updateInteractiveHelpProgress\(progressStorageKey, "disable"\)[\s\S]*updateInteractiveHelp\("disable"\)/,
);

const exclusionRoutes = Object.keys(
  PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS,
);
assert.equal(exclusionRoutes.length, 10);
assert.equal(
  SCREEN_CONTRACTS.filter(
    ({ coverage, route }) =>
      tourRoutes.includes(route) && coverage.onboarding.status === "tested",
  ).length,
  32,
);
assert.equal(
  SCREEN_CONTRACTS.filter(
    ({ coverage }) => coverage.onboarding.status === "excluded",
  ).length,
  10,
);
assert.deepEqual(PRODUCTION_SCREEN_ADMIN_ONBOARDING_EVIDENCE_TEST, {
  id: "PRODUCTION-SCREEN-ADMIN-ONBOARDING",
  path: "src/components/screen-contracts/production-screen-admin-onboarding-evidence.test.ts",
});

console.log(
  "Production admin onboarding evidence passed: 32 exact routes, 23 admin-only, 9 moderator-visible, five role-aware steps and 320 reproducible Design Lab states.",
);
