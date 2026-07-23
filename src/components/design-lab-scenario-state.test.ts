import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DESIGN_LAB_DATA_STATE_VALUES,
  DESIGN_LAB_ERROR_STATE_VALUES,
  DESIGN_LAB_SCENARIO_DIMENSIONS,
  DESIGN_LAB_SCENARIO_GROUPS,
  DESIGN_LAB_SCENARIO_STATE_REQUIREMENT_VALUES,
} from "./design-lab-scenario-contract";
import {
  buildAccountOnboardingScenarioUrl,
  buildAgentsOnboardingScenarioUrl,
  buildAdminOnboardingScenarioUrl,
  buildCommunityOnboardingScenarioUrl,
  buildDesignLabScenarioUrl,
  buildDesignLabOnboardingScenarioUrl,
  buildMarketplaceOnboardingScenarioUrl,
  buildPublicOnboardingScenarioUrl,
  buildRacingOnboardingScenarioUrl,
  DEFAULT_DESIGN_LAB_SCENARIO_STATE,
  resolveDesignLabScenarioState,
} from "./design-lab-scenario-state";
import {
  ACCOUNT_ONBOARDING_ROUTE_TOURS,
  ADMIN_ONBOARDING_ROUTE_TOURS,
  resolveAccountOnboardingPreview,
  resolveAdminOnboardingPreview,
} from "./onboarding-tour-registry";
import {
  COMMUNITY_ONBOARDING_ROUTE_TOURS,
  resolveCommunityOnboardingPreview,
} from "./community-onboarding-tour-registry";
import {
  RACING_ONBOARDING_ROUTE_TOURS,
  resolveRacingOnboardingPreview,
} from "./racing-onboarding-tour-registry";
import {
  PUBLIC_ONBOARDING_ROUTE_TOURS,
  resolvePublicOnboardingPreview,
} from "./public-onboarding-tour-registry";
import {
  MARKETPLACE_ONBOARDING_ROUTE_TOURS,
  resolveMarketplaceOnboardingPreview,
} from "./marketplace-onboarding-tour-registry";
import {
  AGENTS_ONBOARDING_ROUTE_TOURS,
  resolveAgentsOnboardingPreview,
} from "./agents-onboarding-tour-registry";
import {
  DESIGN_LAB_ONBOARDING_ROUTE_TOURS,
  resolveDesignLabOnboardingPreview,
} from "./design-lab-onboarding-tour-registry";

// screen-evidence-test-id: DL-SCENARIO-STATE

assert.equal(DESIGN_LAB_SCENARIO_DIMENSIONS.length, 18);
const scenarioSelectActionIds = [
  "DL.ACTION.SCENARIO.FIXTURE.SELECT",
  "DL.ACTION.SCENARIO.TIER.SELECT",
  "DL.ACTION.SCENARIO.AUTH.SELECT",
  "DL.ACTION.SCENARIO.PERMISSIONS.SELECT",
  "DL.ACTION.SCENARIO.FEATUREFLAGS.SELECT",
  "DL.ACTION.SCENARIO.ORIENTATION.SELECT",
  "DL.ACTION.SCENARIO.NAVIGATION.SELECT",
  "DL.ACTION.SCENARIO.THEME.SELECT",
  "DL.ACTION.SCENARIO.SPONSOREDDEMO.SELECT",
  "DL.ACTION.SCENARIO.DATASTATE.SELECT",
  "DL.ACTION.SCENARIO.NETWORKSTATE.SELECT",
  "DL.ACTION.SCENARIO.ERRORSTATE.SELECT",
  "DL.ACTION.SCENARIO.LONGCONTENT.SELECT",
  "DL.ACTION.SCENARIO.MISSINGIMAGE.SELECT",
  "DL.ACTION.SCENARIO.TOUR.SELECT",
  "DL.ACTION.SCENARIO.TOURSTEP.SELECT",
  "DL.ACTION.SCENARIO.REDUCEDMOTION.SELECT",
  "DL.ACTION.SCENARIO.HIGHCONTRAST.SELECT",
] as const;
assert.deepEqual(
  scenarioSelectActionIds,
  DESIGN_LAB_SCENARIO_DIMENSIONS.map(
    ({ key }) => `DL.ACTION.SCENARIO.${key.toUpperCase()}.SELECT`,
  ),
);
assert.equal(
  new Set(DESIGN_LAB_SCENARIO_DIMENSIONS.map(({ key }) => key)).size,
  DESIGN_LAB_SCENARIO_DIMENSIONS.length,
);
assert.equal(
  new Set(DESIGN_LAB_SCENARIO_DIMENSIONS.map(({ queryParam }) => queryParam))
    .size,
  DESIGN_LAB_SCENARIO_DIMENSIONS.length,
);
for (const group of DESIGN_LAB_SCENARIO_GROUPS) {
  assert.ok(
    DESIGN_LAB_SCENARIO_DIMENSIONS.some(
      (dimension) => dimension.group === group.id,
    ),
    group.id,
  );
}
for (const dimension of DESIGN_LAB_SCENARIO_DIMENSIONS) {
  assert.ok(dimension.options.length >= 2, dimension.key);
  assert.equal(
    new Set(dimension.options.map(({ value }) => value)).size,
    dimension.options.length,
    dimension.key,
  );
  assert.ok(
    dimension.options.some(
      ({ value }) => value === dimension.defaultValue,
    ),
    dimension.key,
  );
}

assert.deepEqual(DESIGN_LAB_SCENARIO_STATE_REQUIREMENT_VALUES, [
  "default",
  "initial-loading",
  "background-refresh",
  "skeleton",
  "empty",
  "no-results",
  "partial",
  "stale",
  "delayed",
  "success",
  "optimistic",
  "mutation-pending",
  "mutation-failed",
  "long-text",
  "large-volume",
  "missing-media",
  "broken-media",
  "recoverable-error",
  "permission-denied",
  "auth-required",
  "subscription-required",
  "feature-disabled",
  "private",
  "blocked",
  "deleted",
  "archived",
  "suspended",
  "missing-record",
  "invitation-expired",
  "invitation-invalid",
  "maintenance",
  "unsupported-browser",
  "auth-callback-loading",
  "auth-callback-failure",
  "billing-loading",
  "billing-failure",
  "upload-failure",
  "rate-limit",
  "offline",
]);
assert.equal(DESIGN_LAB_SCENARIO_STATE_REQUIREMENT_VALUES.length, 39);
assert.equal(new Set(DESIGN_LAB_SCENARIO_STATE_REQUIREMENT_VALUES).size, 39);
assert.equal(DESIGN_LAB_DATA_STATE_VALUES.length, 17);
assert.equal(DESIGN_LAB_ERROR_STATE_VALUES.length, 22);

const invalid = new URLSearchParams(
  "fixture=../../private&tier=root&auth=bypass&permissions=owner&state=unknown",
);
assert.deepEqual(
  resolveDesignLabScenarioState(invalid),
  DEFAULT_DESIGN_LAB_SCENARIO_STATE,
);

const selected = Object.fromEntries(
  DESIGN_LAB_SCENARIO_DIMENSIONS.map((dimension) => {
    const lastValue = dimension.options.at(-1)!.value;
    return [
      dimension.key,
      lastValue === dimension.defaultValue
        ? dimension.options[0].value
        : lastValue,
    ];
  }),
);
const selectedUrl = buildDesignLabScenarioUrl(
  "https://localhost:3000/design-lab?area=screens&route=%2Fdogs%2F%5Bid%5D&workQuery=dog&auditQuery=admin#review",
  selected,
);
const selectedParams = new URL(selectedUrl, "https://localhost:3000")
  .searchParams;
assert.equal(selectedUrl.startsWith("/design-lab?"), true);
assert.equal(selectedParams.get("area"), "screens");
assert.equal(selectedParams.get("route"), "/dogs/[id]");
assert.equal(selectedParams.has("workQuery"), false);
assert.equal(selectedParams.has("auditQuery"), false);
assert.equal(selectedParams.get("tourStep"), "5");
assert.equal(selectedParams.get("sponsoredDemo"), "off");
assert.equal(selectedParams.get("reducedMotion"), "on");
assert.equal(selectedUrl.endsWith("#review"), true);
assert.deepEqual(resolveDesignLabScenarioState(selectedParams), selected);

const rejectedUrl = buildDesignLabScenarioUrl(
  "https://localhost:3000/design-lab?area=screens",
  { permissions: "admin&area=delivery", dataState: "<script>" },
);
const rejectedParams = new URL(rejectedUrl, "https://localhost:3000")
  .searchParams;
assert.equal(rejectedParams.get("permissions"), "member");
assert.equal(rejectedParams.get("state"), "default");
assert.equal(rejectedParams.get("area"), "screens");

for (const tour of ADMIN_ONBOARDING_ROUTE_TOURS) {
  for (let step = 1; step <= 5; step += 1) {
    for (const fallback of [false, true]) {
      const url = buildAdminOnboardingScenarioUrl(
        "https://localhost:3000/design-lab?area=screens",
        {
          fallback,
          role: tour.minimumRole,
          route: tour.route,
          step,
        },
      );
      const params = new URL(url, "https://localhost:3000").searchParams;
      assert.equal(params.get("route"), tour.route);
      assert.equal(params.get("tour"), tour.tourId);
      assert.equal(params.get("tourStep"), String(step));
      assert.equal(
        params.get("errorState"),
        fallback ? "feature-disabled" : "none",
      );
      const preview = resolveAdminOnboardingPreview({
        route: params.get("route"),
        role: params.get("permissions"),
        tourId: params.get("tour"),
        step: params.get("tourStep"),
        targetAvailable: params.get("errorState") !== "feature-disabled",
      });
      assert.equal(preview.status, "available");
      if (preview.status === "available") {
        assert.equal(preview.step.id, tour.steps[step - 1].id);
        assert.equal(preview.usedFallback, fallback);
      }
    }
  }
}
assert.throws(
  () =>
    buildAdminOnboardingScenarioUrl("/design-lab", {
      role: "moderator",
      route: "/admin/users",
      step: 1,
    }),
  /design_lab\.admin_onboarding_scenario_unavailable/,
);

for (const tour of ACCOUNT_ONBOARDING_ROUTE_TOURS) {
  for (let step = 1; step <= 5; step += 1) {
    for (const fallback of [false, true]) {
      const url = buildAccountOnboardingScenarioUrl(
        "https://localhost:3000/design-lab?area=screens",
        { fallback, route: tour.route, step },
      );
      const params = new URL(url, "https://localhost:3000").searchParams;
      assert.equal(params.get("auth"), "signed-in");
      assert.equal(params.get("permissions"), "member");
      assert.equal(params.get("route"), tour.route);
      assert.equal(params.get("tour"), tour.tourId);
      assert.equal(params.get("tourStep"), String(step));
      const preview = resolveAccountOnboardingPreview({
        authenticated: params.get("auth") === "signed-in",
        route: params.get("route"),
        tourId: params.get("tour"),
        step: params.get("tourStep"),
        targetAvailable: params.get("errorState") !== "feature-disabled",
      });
      assert.equal(preview.status, "available");
      if (preview.status === "available") {
        assert.equal(preview.step.id, tour.steps[step - 1].id);
        assert.equal(preview.usedFallback, fallback);
      }
    }
  }
}
assert.equal(
  resolveAccountOnboardingPreview({
    authenticated: false,
    route: "/account/security",
    tourId: "tour:account:v1",
    step: 1,
  }).status,
  "unavailable",
);

for (const tour of RACING_ONBOARDING_ROUTE_TOURS) {
  for (const audience of ["visitor", "member"] as const) {
    for (let step = 1; step <= 5; step += 1) {
      for (const fallback of [false, true]) {
        const url = buildRacingOnboardingScenarioUrl(
          "https://localhost:3000/design-lab?area=screens",
          { audience, fallback, route: tour.route, step },
        );
        const params = new URL(url, "https://localhost:3000").searchParams;
        assert.equal(
          params.get("auth"),
          audience === "visitor" ? "signed-out" : "signed-in",
        );
        assert.equal(params.get("route"), tour.route);
        assert.equal(params.get("tour"), tour.tourId);
        assert.equal(params.get("tourStep"), String(step));
        const preview = resolveRacingOnboardingPreview({
          audience,
          route: params.get("route"),
          tourId: params.get("tour"),
          step: params.get("tourStep"),
          targetAvailable: params.get("errorState") !== "feature-disabled",
        });
        assert.equal(preview.status, "available");
        if (preview.status === "available") {
          assert.equal(preview.step.id, tour.steps[step - 1].id);
          assert.equal(preview.usedFallback, fallback);
        }
      }
    }
  }
}

for (const tour of COMMUNITY_ONBOARDING_ROUTE_TOURS) {
  for (const audience of ["visitor", "member"] as const) {
    for (let step = 1; step <= 5; step += 1) {
      for (const fallback of [false, true]) {
        const url = buildCommunityOnboardingScenarioUrl(
          "https://localhost:3000/design-lab?area=screens",
          { audience, fallback, route: tour.route, step },
        );
        const params = new URL(url, "https://localhost:3000").searchParams;
        assert.equal(
          params.get("auth"),
          audience === "visitor" ? "signed-out" : "signed-in",
        );
        assert.equal(
          params.get("permissions"),
          audience === "visitor" ? "none" : "member",
        );
        assert.equal(params.get("route"), tour.route);
        assert.equal(params.get("tour"), tour.tourId);
        assert.equal(params.get("tourStep"), String(step));
        const preview = resolveCommunityOnboardingPreview({
          audience,
          route: params.get("route"),
          tourId: params.get("tour"),
          step: params.get("tourStep"),
          targetAvailable: params.get("errorState") !== "feature-disabled",
        });
        assert.equal(preview.status, "available");
        if (preview.status === "available") {
          assert.equal(preview.step.id, tour.steps[step - 1].id);
          assert.equal(preview.usedFallback, fallback);
        }
      }
    }
  }
}

for (const tour of PUBLIC_ONBOARDING_ROUTE_TOURS) {
  for (const audience of [
    "visitor",
    "member",
    "moderator",
    "admin",
  ] as const) {
    for (let step = 1; step <= 5; step += 1) {
      for (const fallback of [false, true]) {
        const url = buildPublicOnboardingScenarioUrl(
          "https://localhost:3000/design-lab?area=screens",
          { audience, fallback, route: tour.route, step },
        );
        const params = new URL(url, "https://localhost:3000").searchParams;
        assert.equal(
          params.get("auth"),
          audience === "visitor" ? "signed-out" : "signed-in",
        );
        assert.equal(
          params.get("permissions"),
          audience === "visitor" ? "none" : audience,
        );
        assert.equal(params.get("route"), tour.route);
        assert.equal(params.get("tour"), tour.tourId);
        assert.equal(params.get("tourStep"), String(step));
        const preview = resolvePublicOnboardingPreview({
          audience,
          route: params.get("route"),
          tourId: params.get("tour"),
          step: params.get("tourStep"),
          targetAvailable: params.get("errorState") !== "feature-disabled",
        });
        assert.equal(preview.status, "available");
        if (preview.status === "available") {
          assert.equal(preview.step.id, tour.steps[step - 1].id);
          assert.equal(preview.usedFallback, fallback);
        }
      }
    }
  }
}

for (const tour of MARKETPLACE_ONBOARDING_ROUTE_TOURS) {
  for (const audience of tour.allowedAudiences) {
    for (let step = 1; step <= 5; step += 1) {
      for (const fallback of [false, true]) {
        const url = buildMarketplaceOnboardingScenarioUrl(
          "https://localhost:3000/design-lab?area=screens",
          { audience, fallback, route: tour.route, step },
        );
        const params = new URL(url, "https://localhost:3000").searchParams;
        assert.equal(
          params.get("auth"),
          audience === "visitor" ? "signed-out" : "signed-in",
        );
        assert.equal(
          params.get("permissions"),
          audience === "visitor" ? "none" : audience,
        );
        assert.equal(params.get("route"), tour.route);
        assert.equal(params.get("tour"), tour.tourId);
        assert.equal(params.get("tourStep"), String(step));
        const preview = resolveMarketplaceOnboardingPreview({
          audience,
          route: params.get("route"),
          tourId: params.get("tour"),
          step: params.get("tourStep"),
          targetAvailable: params.get("errorState") !== "feature-disabled",
        });
        assert.equal(preview.status, "available");
        if (preview.status === "available") {
          assert.equal(preview.step.id, tour.steps[step - 1].id);
          assert.equal(preview.usedFallback, fallback);
        }
      }
    }
  }
}

for (const tour of AGENTS_ONBOARDING_ROUTE_TOURS) {
  for (const audience of tour.allowedAudiences) {
    for (let step = 1; step <= 5; step += 1) {
      for (const fallback of [false, true]) {
        const url = buildAgentsOnboardingScenarioUrl(
          "https://localhost:3000/design-lab?area=screens",
          { audience, fallback, route: tour.route, step },
        );
        const params = new URL(url, "https://localhost:3000").searchParams;
        assert.equal(params.get("auth"), "signed-in");
        assert.equal(params.get("permissions"), audience);
        assert.equal(params.get("route"), tour.route);
        assert.equal(params.get("tour"), tour.tourId);
        assert.equal(params.get("tourStep"), String(step));
        const preview = resolveAgentsOnboardingPreview({
          audience,
          route: params.get("route"),
          tourId: params.get("tour"),
          step: params.get("tourStep"),
          targetAvailable: params.get("errorState") !== "feature-disabled",
        });
        assert.equal(preview.status, "available");
        if (preview.status === "available") {
          assert.equal(preview.step.id, tour.steps[step - 1].id);
          assert.equal(preview.usedFallback, fallback);
        }
      }
    }
  }
}

for (const tour of DESIGN_LAB_ONBOARDING_ROUTE_TOURS) {
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
        targetAvailable: params.get("errorState") !== "feature-disabled",
      });
      assert.equal(preview.status, "available");
      if (preview.status === "available") {
        assert.equal(preview.step.id, tour.steps[step - 1].id);
        assert.equal(preview.usedFallback, fallback);
      }
    }
  }
}

const componentSource = readFileSync(
  "src/components/design-lab-scenario-controls.tsx",
  "utf8",
);
assert.match(componentSource, /data-design-lab-scenario-controls/);
assert.match(componentSource, /data-design-lab-scenario-control/);
assert.match(componentSource, /data-action-contract/);
for (const actionId of scenarioSelectActionIds) {
  assert.ok(componentSource.includes(actionId), actionId);
}
assert.match(componentSource, /data-scenario-copy-url/);
assert.match(componentSource, /data-scenario-simulate-destructive/);
assert.match(componentSource, /window\.history\.pushState/);
assert.match(componentSource, /navigator\.clipboard\.writeText/);
assert.doesNotMatch(componentSource, /\bfetch\s*\(/);
assert.doesNotMatch(componentSource, /<form\b/i);
assert.doesNotMatch(componentSource, /^["']use server["'];?$/m);

console.log(
  "Design Lab scenario state passed: 18 allowlisted controls, 39 rendered state values and 1,360 reproducible contextual onboarding states.",
);
