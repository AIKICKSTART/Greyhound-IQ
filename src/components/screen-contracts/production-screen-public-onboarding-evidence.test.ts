import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  SCREEN_CONTRACTS,
  SCREEN_CONTRACT_BY_ROUTE,
} from "../demo-experience-registry";
import { buildPublicOnboardingScenarioUrl } from "../design-lab-scenario-state";
import {
  getOnboardingRouteTour,
  resolveContextualOnboardingPreview,
  resolveContextualOnboardingTour,
} from "../onboarding-tour-registry";
import {
  PUBLIC_ONBOARDING_ROUTE_CONFIGS,
  PUBLIC_ONBOARDING_ROUTE_TOURS,
  PUBLIC_ONBOARDING_TARGET_IDS,
  PUBLIC_ONBOARDING_TOUR_ID,
  getPublicOnboardingRouteTour,
  resolvePublicOnboardingPreview,
  resolvePublicOnboardingTour,
  type PublicOnboardingAudience,
} from "../public-onboarding-tour-registry";
import {
  PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS,
  PRODUCTION_SCREEN_PUBLIC_ONBOARDING_EVIDENCE_TEST,
  productionScreenCoverage,
} from "./production-screen-coverage";
import {
  PUBLIC_SCREEN_PERMISSION_CONTRACTS,
  PUBLIC_SIGNED_OUT_MUTATION_DENIAL_CONTRACTS,
} from "./screen-permission-evidence";
import { PRODUCTION_SCREEN_STATE_CONTRACTS } from "./screen-state-evidence";

// screen-evidence-test-id: PRODUCTION-SCREEN-PUBLIC-ONBOARDING

const EXPECTED_PUBLIC_ROUTES = [
  "/",
  "/about",
  "/auth/error",
  "/contact",
  "/pricing",
  "/privacy",
  "/responsible-use",
  "/terms",
] as const;
const PUBLIC_AUDIENCES = [
  "visitor",
  "member",
  "moderator",
  "admin",
] as const satisfies readonly PublicOnboardingAudience[];
const expectedRouteSet = new Set<string>(EXPECTED_PUBLIC_ROUTES);
const sorted = (values: readonly string[]) => [...values].sort();
const publicPermissionContracts = PUBLIC_SCREEN_PERMISSION_CONTRACTS.filter(
  ({ route }) => expectedRouteSet.has(route),
);
const publicStateContracts = PRODUCTION_SCREEN_STATE_CONTRACTS.filter(
  ({ route }) => expectedRouteSet.has(route),
);

assert.deepEqual(PUBLIC_ONBOARDING_TARGET_IDS, [
  "public-home-features",
  "public-home-races",
  "public-home-value",
  "public-navigation",
  "public-page-content",
]);
assert.equal(PUBLIC_ONBOARDING_ROUTE_TOURS.length, 8);
assert.deepEqual(
  sorted(PUBLIC_ONBOARDING_ROUTE_TOURS.map(({ route }) => route)),
  sorted(EXPECTED_PUBLIC_ROUTES),
);
assert.deepEqual(
  sorted(PUBLIC_ONBOARDING_ROUTE_CONFIGS.map(({ route }) => route)),
  sorted(EXPECTED_PUBLIC_ROUTES),
);
assert.deepEqual(
  sorted(publicPermissionContracts.map(({ route }) => route)),
  sorted(EXPECTED_PUBLIC_ROUTES),
);
assert.deepEqual(
  sorted(publicStateContracts.map(({ route }) => route)),
  sorted(EXPECTED_PUBLIC_ROUTES),
);
assert.deepEqual(
  PUBLIC_SIGNED_OUT_MUTATION_DENIAL_CONTRACTS.map(({ route }) => route),
  ["/contact", "/pricing"],
);

assert.equal(getPublicOnboardingRouteTour("/about/")?.route, "/about");
for (const invalidRoute of [
  "/about/more",
  "/account",
  "/admin",
  "/agents",
  "/marketplace",
  "/pulse",
]) {
  assert.equal(getPublicOnboardingRouteTour(invalidRoute), undefined);
}
assert.equal(resolvePublicOnboardingTour("/", null), null);

const stepIds = new Set<string>();
const stepBodies: string[] = [];
let scenarioCount = 0;

for (const tour of PUBLIC_ONBOARDING_ROUTE_TOURS) {
  assert.equal(tour.authentication, "public", tour.route);
  assert.equal(tour.tourId, PUBLIC_ONBOARDING_TOUR_ID, tour.route);
  assert.deepEqual(tour.allowedAudiences, PUBLIC_AUDIENCES, tour.route);
  assert.equal(tour.steps.length, 5, tour.route);
  assert.equal(getOnboardingRouteTour(tour.route), tour, tour.route);

  for (const step of tour.steps) {
    assert.equal(stepIds.has(step.id), false, step.id);
    stepIds.add(step.id);
    stepBodies.push(step.body);
    assert.ok(step.title.trim().length > 0, step.id);
    assert.ok(step.body.trim().length > 0, step.id);
    assert.ok(PUBLIC_ONBOARDING_TARGET_IDS.includes(step.targetId), step.id);
    assert.ok(
      PUBLIC_ONBOARDING_TARGET_IDS.includes(step.fallbackTargetId),
      step.id,
    );
    assert.notEqual(step.targetId, step.fallbackTargetId, step.id);
  }

  for (const audience of PUBLIC_AUDIENCES) {
    assert.equal(
      resolvePublicOnboardingTour(tour.route, audience),
      tour,
      `${tour.route}:${audience}`,
    );
    const contextual = resolveContextualOnboardingTour(tour.route, {
      authenticated: audience !== "visitor",
      role: audience,
    });
    assert.equal(contextual, tour, `${tour.route}:${audience}:runtime`);

    for (let step = 1; step <= 5; step += 1) {
      for (const fallback of [false, true]) {
        const url = buildPublicOnboardingScenarioUrl(
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
        assert.equal(
          params.get("errorState"),
          fallback ? "feature-disabled" : "none",
        );
        const preview = resolvePublicOnboardingPreview({
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
  assert.equal(screen.productionEnabled, true, tour.route);
  assert.equal(screen.authentication, "public", tour.route);
  assert.equal(screen.coverage.onboarding.status, "tested", tour.route);
  assert.equal(screen.onboardingTourId, tour.tourId, tour.route);
  assert.equal(
    tour.route in PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS,
    false,
  );

  const permissionContract = publicPermissionContracts.find(
    ({ route }) => route === tour.route,
  );
  const stateContract = publicStateContracts.find(
    ({ route }) => route === tour.route,
  );
  assert.ok(permissionContract, `${tour.route}: permission contract missing`);
  assert.ok(stateContract, `${tour.route}: state contract missing`);
  assert.ok(
    permissionContract.permissions.some(
      ({ actor, decision }) =>
        actor === "Signed-out visitor viewing the page" && decision === "allow",
    ),
    `${tour.route}: public view permission missing`,
  );
  assert.ok(stateContract.states.length > 0, `${tour.route}: states missing`);
  assert.equal(screen.coverage.permissions.status, "tested", tour.route);
  assert.equal(screen.coverage.states.status, "verified", tour.route);

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
      "src/components/public-onboarding-tour-registry.ts",
      "src/components/interactive-help.tsx",
      "src/app/layout.tsx",
      "src/components/site-header.tsx",
      PRODUCTION_SCREEN_PUBLIC_ONBOARDING_EVIDENCE_TEST.path,
    ],
    tour.route,
  );
}

assert.equal(stepIds.size, 40);
assert.equal(stepBodies.length, 40);
assert.equal(new Set(stepBodies).size, 40);
assert.equal(scenarioCount, 320);

for (const denial of PUBLIC_SIGNED_OUT_MUTATION_DENIAL_CONTRACTS) {
  const source = readFileSync(denial.sourcePath, "utf8");
  const authenticationIndex = source.indexOf(denial.authenticationCall);
  assert.ok(authenticationIndex >= 0, `${denial.route}: auth call missing`);
  for (const effect of denial.protectedEffects) {
    const effectIndex = source.indexOf(effect, authenticationIndex + 1);
    assert.ok(
      effectIndex > authenticationIndex,
      `${denial.route}: ${effect} must follow authentication`,
    );
  }
}

assert.equal(
  resolveContextualOnboardingTour("/account/security", {
    authenticated: false,
    role: "visitor",
  }),
  null,
);
assert.equal(
  resolveContextualOnboardingTour("/admin/users", {
    authenticated: false,
    role: "visitor",
  }),
  null,
);
assert.equal(
  resolveContextualOnboardingTour("/agents", {
    authenticated: false,
    role: "visitor",
  }),
  null,
);

const visitorPreview = resolveContextualOnboardingPreview({
  anonymous: true,
  authenticated: false,
  role: "none",
  route: "/pricing",
  tourId: PUBLIC_ONBOARDING_TOUR_ID,
  step: 3,
});
assert.equal(visitorPreview.status, "available");
const deniedPreview = resolveContextualOnboardingPreview({
  authenticated: false,
  role: null,
  route: "/auth/error",
  tourId: PUBLIC_ONBOARDING_TOUR_ID,
  step: 3,
});
assert.equal(deniedPreview.status, "unavailable");
assert.doesNotMatch(
  JSON.stringify(deniedPreview),
  /callback|provider|ticket|checkout|reference/i,
);

const rootLayoutSource = readFileSync("src/app/layout.tsx", "utf8");
const homePageSource = readFileSync("src/app/page.tsx", "utf8");
const headerSource = readFileSync("src/components/site-header.tsx", "utf8");
const interactiveHelpSource = readFileSync(
  "src/components/interactive-help.tsx",
  "utf8",
);
assert.match(
  rootLayoutSource,
  /data-onboarding-target="[^"]*\bpublic-page-content\b[^"]*"/,
);
for (const targetId of [
  "public-home-features",
  "public-home-races",
  "public-home-value",
]) {
  assert.match(
    homePageSource,
    new RegExp(`data-onboarding-target=["'][^"']*\\b${targetId}\\b`),
  );
}
assert.match(rootLayoutSource, /allowAutomaticOpen=\{Boolean\(user\)\}/);
assert.match(rootLayoutSource, /allowContextualAutomaticOpen/);
assert.match(rootLayoutSource, /role=\{user\?\.role \?\? "visitor"\}/);
assert.equal(
  headerSource.match(
    /data-onboarding-target="[^"]*\bpublic-navigation\b[^"]*"/g,
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

assert.equal(
  SCREEN_CONTRACTS.filter(
    ({ coverage, route }) =>
      expectedRouteSet.has(route) && coverage.onboarding.status === "tested",
  ).length,
  8,
);
assert.deepEqual(PRODUCTION_SCREEN_PUBLIC_ONBOARDING_EVIDENCE_TEST, {
  id: "PRODUCTION-SCREEN-PUBLIC-ONBOARDING",
  path: "src/components/screen-contracts/production-screen-public-onboarding-evidence.test.ts",
});

console.log(
  "Production public onboarding evidence passed: 8 exact public routes, 40 unique route-specific steps and 320 visitor/member/moderator/admin Design Lab states.",
);
