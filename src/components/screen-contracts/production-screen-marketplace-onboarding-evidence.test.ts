import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  SCREEN_CONTRACTS,
  SCREEN_CONTRACT_BY_ROUTE,
} from "../demo-experience-registry";
import { buildMarketplaceOnboardingScenarioUrl } from "../design-lab-scenario-state";
import {
  MARKETPLACE_ONBOARDING_ROUTE_CONFIGS,
  MARKETPLACE_ONBOARDING_ROUTE_TOURS,
  MARKETPLACE_ONBOARDING_TARGET_IDS,
  MARKETPLACE_ONBOARDING_TOUR_ID,
  getMarketplaceOnboardingRouteTour,
  resolveMarketplaceOnboardingPreview,
  resolveMarketplaceOnboardingTour,
} from "../marketplace-onboarding-tour-registry";
import {
  getOnboardingRouteTour,
  resolveContextualOnboardingTour,
} from "../onboarding-tour-registry";
import { DESIGN_LAB_USER_STORY_MANIFESTS } from "./design-lab-user-stories";
import {
  PRODUCTION_SCREEN_MARKETPLACE_ONBOARDING_EVIDENCE_TEST,
  PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS,
  productionScreenCoverage,
} from "./production-screen-coverage";
import {
  DESIGN_LAB_SCREEN_PERMISSION_CONTRACTS,
  PUBLIC_SCREEN_PERMISSION_CONTRACTS,
} from "./screen-permission-evidence";
import { PRODUCTION_SCREEN_STATE_CONTRACTS } from "./screen-state-evidence";
import {
  PRODUCTION_SCREEN_MEMBER_PERMISSION_CONTRACTS,
  PRODUCTION_SCREEN_MEMBER_STATE_CONTRACTS,
} from "./production-screen-member-access-state-evidence";

// screen-evidence-test-id: PRODUCTION-SCREEN-MARKETPLACE-ONBOARDING

const EXPECTED_MARKETPLACE_ROUTES = [
  "/marketplace",
  "/marketplace/[id]",
  "/marketplace/[id]/edit",
  "/marketplace/new",
  "/marketplace/design-lab",
] as const;
const STANDARD_AUDIENCES = [
  "visitor",
  "member",
  "moderator",
  "admin",
] as const;
const sorted = (values: readonly string[]) => [...values].sort();
const designLabManifest = DESIGN_LAB_USER_STORY_MANIFESTS.find(
  ({ route }) => route === "/marketplace/design-lab",
);

assert.deepEqual(MARKETPLACE_ONBOARDING_TARGET_IDS, [
  "marketplace-navigation",
  "marketplace-page-content",
]);
assert.equal(MARKETPLACE_ONBOARDING_ROUTE_TOURS.length, 5);
assert.deepEqual(
  sorted(MARKETPLACE_ONBOARDING_ROUTE_TOURS.map(({ route }) => route)),
  sorted(EXPECTED_MARKETPLACE_ROUTES),
);
assert.deepEqual(
  sorted(MARKETPLACE_ONBOARDING_ROUTE_CONFIGS.map(({ route }) => route)),
  sorted(EXPECTED_MARKETPLACE_ROUTES),
);
assert.equal(
  getMarketplaceOnboardingRouteTour("/marketplace/example")?.route,
  "/marketplace/[id]",
);
assert.equal(
  getMarketplaceOnboardingRouteTour("/marketplace/example/edit")?.route,
  "/marketplace/[id]/edit",
);
assert.equal(
  getMarketplaceOnboardingRouteTour("/marketplace/new")?.route,
  "/marketplace/new",
);
assert.equal(
  getMarketplaceOnboardingRouteTour("/marketplace/design-lab")?.route,
  "/marketplace/design-lab",
);
for (const invalidRoute of [
  "/marketplace/new/extra",
  "/marketplace/design-lab/extra",
  "/marketplace/example/extra",
  "/listings",
]) {
  assert.equal(getMarketplaceOnboardingRouteTour(invalidRoute), undefined);
}

const stepIds = new Set<string>();
const stepBodies: string[] = [];
let scenarioCount = 0;

for (const tour of MARKETPLACE_ONBOARDING_ROUTE_TOURS) {
  const designLabRoute = tour.route === "/marketplace/design-lab";
  const editorRoute = tour.route === "/marketplace/[id]/edit";
  assert.equal(tour.authentication, editorRoute ? "required" : "optional", tour.route);
  assert.equal(tour.tourId, MARKETPLACE_ONBOARDING_TOUR_ID, tour.route);
  assert.deepEqual(
    tour.allowedAudiences,
    designLabRoute
      ? ["admin"]
      : editorRoute
        ? ["member", "moderator", "admin"]
        : STANDARD_AUDIENCES,
    tour.route,
  );
  assert.equal(tour.steps.length, 5, tour.route);
  assert.equal(getOnboardingRouteTour(tour.route), tour, tour.route);
  assert.equal(
    tour.route in PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS,
    false,
  );

  for (const step of tour.steps) {
    assert.equal(stepIds.has(step.id), false, step.id);
    stepIds.add(step.id);
    stepBodies.push(step.body);
    assert.ok(step.title.trim().length > 0, step.id);
    assert.ok(step.body.trim().length > 0, step.id);
    assert.ok(MARKETPLACE_ONBOARDING_TARGET_IDS.includes(step.targetId));
    assert.ok(
      MARKETPLACE_ONBOARDING_TARGET_IDS.includes(step.fallbackTargetId),
    );
    assert.notEqual(step.targetId, step.fallbackTargetId, step.id);
  }

  for (const audience of tour.allowedAudiences) {
    assert.equal(
      resolveMarketplaceOnboardingTour(tour.route, audience),
      tour,
      `${tour.route}:${audience}`,
    );
    assert.equal(
      resolveContextualOnboardingTour(tour.route, {
        authenticated: audience !== "visitor",
        role: audience,
      }),
      tour,
      `${tour.route}:${audience}:runtime`,
    );
    for (let step = 1; step <= 5; step += 1) {
      for (const fallback of [false, true]) {
        const url = buildMarketplaceOnboardingScenarioUrl(
          "https://localhost:3000/design-lab?area=screens",
          { audience, fallback, route: tour.route, step },
        );
        const params = new URL(url, "https://localhost:3000").searchParams;
        assert.equal(params.get("route"), tour.route);
        assert.equal(params.get("tour"), tour.tourId);
        assert.equal(params.get("tourStep"), String(step));
        assert.equal(
          params.get("auth"),
          audience === "visitor" ? "signed-out" : "signed-in",
        );
        assert.equal(
          params.get("permissions"),
          audience === "visitor" ? "none" : audience,
        );
        const preview = resolveMarketplaceOnboardingPreview({
          audience,
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
  }

  const screen = SCREEN_CONTRACT_BY_ROUTE.get(tour.route);
  assert.ok(screen, `${tour.route}: missing screen contract`);
  assert.equal(screen.authentication, editorRoute ? "required" : "optional", tour.route);
  assert.equal(screen.productionEnabled, !designLabRoute, tour.route);
  assert.equal(screen.coverage.onboarding.status, "tested", tour.route);
  assert.equal(screen.onboardingTourId, tour.tourId, tour.route);

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
      "src/components/marketplace-onboarding-tour-registry.ts",
      "src/components/interactive-help.tsx",
      "src/app/layout.tsx",
      "src/components/site-header.tsx",
      PRODUCTION_SCREEN_MARKETPLACE_ONBOARDING_EVIDENCE_TEST.path,
    ],
    tour.route,
  );

  if (designLabRoute) {
    const permission = DESIGN_LAB_SCREEN_PERMISSION_CONTRACTS.find(
      ({ route }) => route === tour.route,
    );
    assert.ok(permission, `${tour.route}: Design Lab permission missing`);
    assert.deepEqual(
      permission.permissions.map(({ decision }) => decision),
      ["allow", "deny", "allow", "allow", "deny"],
    );
    assert.ok(designLabManifest, "marketplace Design Lab manifest missing");
    assert.deepEqual(designLabManifest.onboarding, [
      { tourId: MARKETPLACE_ONBOARDING_TOUR_ID },
    ]);
    assert.equal(designLabManifest.coverage.onboarding.status, "tested");
    assert.ok(designLabManifest.states.length > 0);
  } else if (editorRoute) {
    const permission = PRODUCTION_SCREEN_MEMBER_PERMISSION_CONTRACTS.find(
      ({ route }) => route === tour.route,
    );
    const state = PRODUCTION_SCREEN_MEMBER_STATE_CONTRACTS.find(
      ({ route }) => route === tour.route,
    );
    assert.ok(permission, `${tour.route}: editor permission missing`);
    assert.ok(
      permission.permissions.some(
        ({ actor, decision }) =>
          actor === "Signed-out visitor requesting the listing editor" &&
          decision === "deny",
      ),
    );
    assert.ok(state, `${tour.route}: editor state contract missing`);
    assert.ok(state.states.length > 0);
  } else {
    const permission = PUBLIC_SCREEN_PERMISSION_CONTRACTS.find(
      ({ route }) => route === tour.route,
    );
    const state = PRODUCTION_SCREEN_STATE_CONTRACTS.find(
      ({ route }) => route === tour.route,
    );
    assert.ok(permission, `${tour.route}: public permission missing`);
    assert.ok(
      permission.permissions.some(
        ({ actor, decision }) =>
          actor === "Signed-out visitor viewing the page" &&
          decision === "allow",
      ),
    );
    assert.ok(state, `${tour.route}: state contract missing`);
    assert.ok(state.states.length > 0);
  }
}

assert.equal(stepIds.size, 25);
assert.equal(stepBodies.length, 25);
assert.equal(new Set(stepBodies).size, 25);
assert.equal(scenarioCount, 160);

assert.equal(
  resolveMarketplaceOnboardingTour("/marketplace/design-lab", "visitor"),
  null,
);
assert.equal(
  resolveMarketplaceOnboardingTour("/marketplace/design-lab", "member"),
  null,
);
assert.throws(
  () =>
    buildMarketplaceOnboardingScenarioUrl("/design-lab", {
      audience: "visitor",
      route: "/marketplace/design-lab",
      step: 1,
    }),
  /design_lab\.marketplace_onboarding_scenario_unavailable/,
);

const createListingSource = readFileSync("src/app/actions.ts", "utf8");
const createListingStart = createListingSource.indexOf(
  "export async function createListing(formData: FormData)",
);
const createListingEnd = createListingSource.indexOf(
  "export async function updateListing",
  createListingStart,
);
const createListingFunction = createListingSource.slice(
  createListingStart,
  createListingEnd,
);
assert.match(createListingFunction, /requireCurrentUserProfile\(\)/);
assert.match(createListingFunction, /listingSchema\.parse\(/);
assert.match(createListingFunction, /createListingForCurrentUser\(current,/);
assert.ok(
  createListingFunction.indexOf("requireCurrentUserProfile()") <
    createListingFunction.indexOf("listingSchema.parse("),
  "listing creation must authenticate before parsing or protected effects",
);

const designLabPageSource = readFileSync(
  "src/app/marketplace/design-lab/page.tsx",
  "utf8",
);
assert.match(designLabPageSource, /await requireDesignLabReviewer\(\)/);
assert.doesNotMatch(designLabPageSource, /createListing|saveListing|enquiry/i);

const rootLayoutSource = readFileSync("src/app/layout.tsx", "utf8");
const headerSource = readFileSync("src/components/site-header.tsx", "utf8");
const interactiveHelpSource = readFileSync(
  "src/components/interactive-help.tsx",
  "utf8",
);
assert.match(
  rootLayoutSource,
  /data-onboarding-target="[^"]*\bmarketplace-page-content\b[^"]*"/,
);
assert.equal(
  headerSource.match(
    /data-onboarding-target="[^"]*\bmarketplace-navigation\b[^"]*"/g,
  )?.length,
  4,
);
assert.match(
  interactiveHelpSource,
  /dataset\.onboardingTarget\?\.split\(\/\\s\+\/\)\.includes\(targetId\)/,
);
assert.match(interactiveHelpSource, /getClientRects\(\)\.length > 0/);
assert.match(interactiveHelpSource, /prefers-reduced-motion: reduce/);

assert.equal(
  SCREEN_CONTRACTS.filter(
    ({ coverage }) => coverage.onboarding.status === "tested",
  ).length,
  87,
);
assert.equal(
  SCREEN_CONTRACTS.filter(
    ({ coverage }) => coverage.onboarding.status === "not-started",
  ).length,
  0,
);
assert.equal(
  SCREEN_CONTRACTS.filter(
    ({ coverage }) => coverage.onboarding.status === "excluded",
  ).length,
  10,
);
assert.deepEqual(PRODUCTION_SCREEN_MARKETPLACE_ONBOARDING_EVIDENCE_TEST, {
  id: "PRODUCTION-SCREEN-MARKETPLACE-ONBOARDING",
  path: "src/components/screen-contracts/production-screen-marketplace-onboarding-evidence.test.ts",
});

console.log(
  "Production marketplace onboarding evidence passed: 5 exact routes, 25 unique route-specific steps and 160 gated Design Lab states; onboarding is 97/97 complete.",
);
