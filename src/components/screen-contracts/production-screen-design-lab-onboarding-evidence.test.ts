import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SCREEN_CONTRACT_BY_ROUTE } from "../demo-experience-registry";
import { buildDesignLabOnboardingScenarioUrl } from "../design-lab-scenario-state";
import {
  DESIGN_LAB_ONBOARDING_ROUTE_CONFIGS,
  DESIGN_LAB_ONBOARDING_ROUTE_TOURS,
  DESIGN_LAB_ONBOARDING_TARGET_IDS,
  DESIGN_LAB_ONBOARDING_TOUR_ID,
  getDesignLabOnboardingRouteTour,
  resolveDesignLabOnboardingPreview,
  resolveDesignLabOnboardingTour,
} from "../design-lab-onboarding-tour-registry";
import {
  getOnboardingRouteTour,
  resolveContextualOnboardingTour,
} from "../onboarding-tour-registry";
import { DESIGN_LAB_USER_STORY_MANIFESTS } from "./design-lab-user-stories";
import {
  PRODUCTION_SCREEN_DESIGN_LAB_ONBOARDING_EVIDENCE_TEST,
  productionScreenCoverage,
} from "./production-screen-coverage";
import { DESIGN_LAB_SCREEN_PERMISSION_CONTRACTS } from "./screen-permission-evidence";

// screen-evidence-test-id: PRODUCTION-SCREEN-DESIGN-LAB-ONBOARDING

const EXPECTED_ROUTES = [
  "/design-lab",
  "/design-lab/demo-experience",
  "/design-lab/dock-skins",
  "/design-lab/role-blueprints",
  "/feed/device-preview",
] as const;
const PAGE_SOURCE_BY_ROUTE = new Map<string, string>([
  ["/design-lab", "src/app/design-lab/page.tsx"],
  [
    "/design-lab/demo-experience",
    "src/app/design-lab/demo-experience/page.tsx",
  ],
  ["/design-lab/dock-skins", "src/app/design-lab/dock-skins/page.tsx"],
  [
    "/design-lab/role-blueprints",
    "src/app/design-lab/role-blueprints/page.tsx",
  ],
  ["/feed/device-preview", "src/app/feed/device-preview/page.tsx"],
]);
const sorted = (values: readonly string[]) => [...values].sort();

assert.deepEqual(DESIGN_LAB_ONBOARDING_TARGET_IDS, [
  "design-lab-navigation",
  "design-lab-page-content",
  "design-lab-tab-target",
  "design-lab-modal-target",
]);
assert.equal(DESIGN_LAB_ONBOARDING_ROUTE_TOURS.length, 5);
assert.deepEqual(
  sorted(DESIGN_LAB_ONBOARDING_ROUTE_TOURS.map(({ route }) => route)),
  sorted(EXPECTED_ROUTES),
);
assert.deepEqual(
  sorted(DESIGN_LAB_ONBOARDING_ROUTE_CONFIGS.map(({ route }) => route)),
  sorted(EXPECTED_ROUTES),
);
for (const invalidRoute of [
  "/design-lab/unknown",
  "/design-lab/demo-experience/extra",
  "/feed/device-preview/extra",
]) {
  assert.equal(getDesignLabOnboardingRouteTour(invalidRoute), undefined);
}

const stepIds = new Set<string>();
const stepBodies = new Set<string>();
let scenarioCount = 0;

for (const tour of DESIGN_LAB_ONBOARDING_ROUTE_TOURS) {
  assert.equal(tour.authentication, "optional", tour.route);
  assert.deepEqual(tour.allowedAudiences, ["admin"], tour.route);
  assert.equal(tour.tourId, DESIGN_LAB_ONBOARDING_TOUR_ID, tour.route);
  assert.equal(tour.steps.length, 5, tour.route);
  assert.equal(getDesignLabOnboardingRouteTour(`${tour.route}/`), tour);
  assert.equal(getOnboardingRouteTour(tour.route), tour);
  assert.equal(resolveDesignLabOnboardingTour(tour.route, "admin"), tour);
  assert.equal(
    resolveContextualOnboardingTour(tour.route, {
      authenticated: true,
      role: "admin",
    }),
    tour,
  );
  for (const denied of [
    { authenticated: false, role: "visitor" },
    { authenticated: true, role: "member" },
    { authenticated: true, role: "moderator" },
  ] as const) {
    assert.equal(
      resolveContextualOnboardingTour(tour.route, denied),
      null,
      `${tour.route}:${denied.role}`,
    );
  }

  for (const step of tour.steps) {
    assert.equal(stepIds.has(step.id), false, step.id);
    assert.equal(stepBodies.has(step.body), false, step.id);
    stepIds.add(step.id);
    stepBodies.add(step.body);
    assert.ok(step.title.trim().length > 0, step.id);
    assert.ok(step.body.trim().length > 0, step.id);
    assert.ok(DESIGN_LAB_ONBOARDING_TARGET_IDS.includes(step.targetId));
    assert.ok(
      DESIGN_LAB_ONBOARDING_TARGET_IDS.includes(step.fallbackTargetId),
    );
    assert.notEqual(step.targetId, step.fallbackTargetId, step.id);
  }

  for (let step = 1; step <= 5; step += 1) {
    for (const fallback of [false, true]) {
      const url = buildDesignLabOnboardingScenarioUrl(
        "https://localhost:3000/design-lab?area=screens",
        { fallback, route: tour.route, step },
      );
      const params = new URL(url, "https://localhost:3000").searchParams;
      assert.equal(params.get("auth"), "signed-in");
      assert.equal(params.get("permissions"), "admin");
      assert.equal(params.get("route"), tour.route);
      assert.equal(params.get("tour"), tour.tourId);
      assert.equal(params.get("tourStep"), String(step));
      const preview = resolveDesignLabOnboardingPreview({
        audience: "admin",
        route: params.get("route"),
        tourId: params.get("tour"),
        step: params.get("tourStep"),
        targetAvailable: !fallback,
      });
      assert.equal(preview.status, "available");
      if (preview.status === "available") {
        assert.equal(preview.step.id, tour.steps[step - 1].id);
        assert.equal(preview.usedFallback, fallback);
      }
      scenarioCount += 1;
    }
  }

  const screen = SCREEN_CONTRACT_BY_ROUTE.get(tour.route);
  assert.ok(screen, `${tour.route}: screen contract missing`);
  assert.equal(screen.productionEnabled, false, tour.route);
  assert.equal(screen.coverage.onboarding.status, "tested", tour.route);
  assert.equal(screen.onboardingTourId, tour.tourId, tour.route);
  const permission = DESIGN_LAB_SCREEN_PERMISSION_CONTRACTS.find(
    ({ route }) => route === tour.route,
  );
  assert.ok(permission, `${tour.route}: permission contract missing`);
  assert.deepEqual(
    permission.permissions.map(({ decision }) => decision),
    ["allow", "deny", "allow", "allow", "deny"],
    tour.route,
  );

  const manifest = DESIGN_LAB_USER_STORY_MANIFESTS.find(
    ({ route }) => route === tour.route,
  );
  assert.ok(manifest, `${tour.route}: Design Lab manifest missing`);
  assert.deepEqual(manifest.onboarding, [
    { tourId: DESIGN_LAB_ONBOARDING_TOUR_ID },
  ]);
  assert.equal(manifest.coverage.onboarding.status, "tested");
  assert.ok(manifest.states.length > 0, tour.route);

  const coverage = productionScreenCoverage({
    screenId: screen.id,
    route: screen.route,
    concreteRoute: screen.concreteRoute,
    sourcePath: screen.sourceFiles[0],
    routeAuditPassed: true,
  });
  assert.equal(coverage.onboarding?.status, "tested", tour.route);
  assert.equal(coverage.onboardingTourId, tour.tourId, tour.route);
  assert.deepEqual(
    coverage.onboarding?.evidence.map(({ path }) => path),
    [
      "src/components/design-lab-onboarding-tour-registry.ts",
      "src/components/interactive-help.tsx",
      "src/app/layout.tsx",
      "src/components/site-header.tsx",
      PRODUCTION_SCREEN_DESIGN_LAB_ONBOARDING_EVIDENCE_TEST.path,
    ],
    tour.route,
  );

  const sourcePath = PAGE_SOURCE_BY_ROUTE.get(tour.route);
  assert.ok(sourcePath, `${tour.route}: page source mapping missing`);
  const pageSource = readFileSync(sourcePath, "utf8");
  assert.match(pageSource, /await requireDesignLabReviewer\(\)/, tour.route);
}

assert.equal(stepIds.size, 25);
assert.equal(stepBodies.size, 25);
assert.equal(scenarioCount, 50);
assert.throws(
  () =>
    buildDesignLabOnboardingScenarioUrl("/design-lab", {
      route: "/design-lab/unknown",
      step: 1,
    }),
  /design_lab\.design_lab_onboarding_scenario_unavailable/,
);

const rootLayoutSource = readFileSync("src/app/layout.tsx", "utf8");
const headerSource = readFileSync("src/components/site-header.tsx", "utf8");
assert.match(
  rootLayoutSource,
  /data-onboarding-target="[^"]*\bdesign-lab-page-content\b[^"]*"/,
);
assert.equal(
  headerSource.match(
    /data-onboarding-target="[^"]*\bdesign-lab-navigation\b[^"]*"/g,
  )?.length,
  4,
);
assert.deepEqual(PRODUCTION_SCREEN_DESIGN_LAB_ONBOARDING_EVIDENCE_TEST, {
  id: "PRODUCTION-SCREEN-DESIGN-LAB-ONBOARDING",
  path: "src/components/screen-contracts/production-screen-design-lab-onboarding-evidence.test.ts",
});

console.log(
  "Production Design Lab onboarding evidence passed: 5 founder-gated routes, 25 unique source-backed steps and 50 reproducible review states.",
);
