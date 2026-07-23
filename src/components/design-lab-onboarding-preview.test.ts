import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { AGENTS_ONBOARDING_ROUTE_TOURS } from "./agents-onboarding-tour-registry";
import { COMMUNITY_ONBOARDING_ROUTE_TOURS } from "./community-onboarding-tour-registry";
import {
  DESIGN_LAB_ONBOARDING_ROUTE_TOURS,
} from "./design-lab-onboarding-tour-registry";
import {
  DESIGN_LAB_ONBOARDING_DEVICE_PREVIEWS,
  DESIGN_LAB_ONBOARDING_TARGET_MODES,
  buildDesignLabOnboardingPreviewUrl,
  resolveDesignLabOnboardingDevice,
  resolveDesignLabOnboardingTargetMode,
  validateDesignLabOnboardingDeviceContract,
} from "./design-lab-onboarding-preview";
import { MARKETPLACE_ONBOARDING_ROUTE_TOURS } from "./marketplace-onboarding-tour-registry";
import {
  ACCOUNT_ONBOARDING_ROUTE_TOURS,
  ADMIN_ONBOARDING_ROUTE_TOURS,
  resolveContextualOnboardingPersona,
  resolveContextualOnboardingPreview,
  resolveContextualOnboardingTour,
} from "./onboarding-tour-registry";
import { SUPPORT_OPERATOR_ONBOARDING_ROUTES } from "./onboarding-persona";
import { DESIGN_LAB_SCENARIO_DIMENSIONS } from "./design-lab-scenario-contract";
import { PUBLIC_ONBOARDING_ROUTE_TOURS } from "./public-onboarding-tour-registry";
import { RACING_ONBOARDING_ROUTE_TOURS } from "./racing-onboarding-tour-registry";

const tours = [
  ...ADMIN_ONBOARDING_ROUTE_TOURS,
  ...ACCOUNT_ONBOARDING_ROUTE_TOURS,
  ...RACING_ONBOARDING_ROUTE_TOURS,
  ...COMMUNITY_ONBOARDING_ROUTE_TOURS,
  ...PUBLIC_ONBOARDING_ROUTE_TOURS,
  ...MARKETPLACE_ONBOARDING_ROUTE_TOURS,
  ...AGENTS_ONBOARDING_ROUTE_TOURS,
  ...DESIGN_LAB_ONBOARDING_ROUTE_TOURS,
];
const audiences = [
  { id: "visitor", anonymous: true, authenticated: false, role: "visitor" },
  { id: "member", anonymous: false, authenticated: true, role: "member" },
  { id: "moderator", anonymous: false, authenticated: true, role: "moderator" },
  { id: "administrator", anonymous: false, authenticated: true, role: "admin" },
] as const;

assert.equal(tours.length, 87);
assert.equal(DESIGN_LAB_ONBOARDING_DEVICE_PREVIEWS.length, 8);
assert.equal(DESIGN_LAB_ONBOARDING_TARGET_MODES.length, 2);
assert.equal(validateDesignLabOnboardingDeviceContract(), true);
assert.equal(resolveDesignLabOnboardingDevice("not-allowlisted").id, "small-phone");
assert.equal(resolveDesignLabOnboardingTargetMode(null, "feature-disabled"), "unavailable");
assert.equal(resolveDesignLabOnboardingTargetMode("root", "none"), "available");

const supportedAudienceIds = new Set<string>();
let previewCount = 0;
for (const tour of tours) {
  const supportedAudiences = audiences.filter(
    ({ authenticated, role }) =>
      resolveContextualOnboardingTour(tour.route, { authenticated, role })
        ?.tourId === tour.tourId,
  );
  assert.ok(supportedAudiences.length > 0, tour.route);
  for (const audience of supportedAudiences) {
    supportedAudienceIds.add(audience.id);
    for (let step = 1; step <= tour.steps.length; step += 1) {
      for (const device of DESIGN_LAB_ONBOARDING_DEVICE_PREVIEWS) {
        for (const targetMode of DESIGN_LAB_ONBOARDING_TARGET_MODES) {
          const url = buildDesignLabOnboardingPreviewUrl(
            `https://greyhoundsiq.com.au/design-lab?route=${encodeURIComponent(tour.route)}&tour=${encodeURIComponent(tour.tourId)}&tourStep=${step}`,
            { device: device.id, targetMode: targetMode.id },
          );
          const params = new URL(url, "https://greyhoundsiq.com.au").searchParams;
          assert.equal(params.get("onboardingDevice"), device.id);
          assert.equal(params.get("onboardingTarget"), targetMode.id);
          const preview = resolveContextualOnboardingPreview({
            anonymous: audience.anonymous,
            authenticated: audience.authenticated,
            role: audience.role,
            route: tour.route,
            tourId: tour.tourId,
            step,
            targetAvailable: targetMode.id === "available",
          });
          assert.equal(preview.status, "available", `${tour.route}:${audience.id}`);
          if (preview.status === "available") {
            assert.equal(preview.step.id, tour.steps[step - 1].id);
            assert.equal(preview.usedFallback, targetMode.id === "unavailable");
          }
          previewCount += 1;
        }
      }
    }
  }
}

assert.deepEqual(
  [...supportedAudienceIds].toSorted(),
  ["administrator", "member", "moderator", "visitor"],
);
assert.equal(previewCount, 17_920);

const permissions = DESIGN_LAB_SCENARIO_DIMENSIONS.find(
  ({ key }) => key === "permissions",
);
assert.ok(permissions?.options.some(({ value }) => value === "trainer"));
assert.ok(
  permissions?.options.some(
    ({ value, label }) =>
      value === "moderator" && /support operator/i.test(label),
  ),
);

const personaCases = [
  ...RACING_ONBOARDING_ROUTE_TOURS.map((tour) => ({
    expectedPersona: "trainer" as const,
    role: "trainer",
    tour,
  })),
  ...SUPPORT_OPERATOR_ONBOARDING_ROUTES.map((route) => ({
    expectedPersona: "support-operator" as const,
    role: "moderator",
    tour: ADMIN_ONBOARDING_ROUTE_TOURS.find((tour) => tour.route === route)!,
  })),
];
let personaPreviewCount = 0;
for (const { expectedPersona, role, tour } of personaCases) {
  assert.ok(tour, `${expectedPersona}:tour`);
  assert.equal(
    resolveContextualOnboardingPersona(tour.route, {
      authenticated: true,
      role,
    }),
    expectedPersona,
  );
  for (let step = 1; step <= tour.steps.length; step += 1) {
    for (const device of DESIGN_LAB_ONBOARDING_DEVICE_PREVIEWS) {
      for (const targetMode of DESIGN_LAB_ONBOARDING_TARGET_MODES) {
        const url = buildDesignLabOnboardingPreviewUrl(
          `https://greyhoundsiq.com.au/design-lab?permissions=${role}&route=${encodeURIComponent(tour.route)}&tour=${encodeURIComponent(tour.tourId)}&tourStep=${step}`,
          { device: device.id, targetMode: targetMode.id },
        );
        const params = new URL(url, "https://greyhoundsiq.com.au")
          .searchParams;
        assert.equal(params.get("permissions"), role);
        assert.equal(params.get("onboardingDevice"), device.id);
        assert.equal(params.get("onboardingTarget"), targetMode.id);
        const preview = resolveContextualOnboardingPreview({
          authenticated: true,
          role,
          route: tour.route,
          tourId: tour.tourId,
          step,
          targetAvailable: targetMode.id === "available",
        });
        assert.equal(preview.status, "available", `${tour.route}:${step}`);
        if (preview.status === "available") {
          assert.ok("persona" in preview.tour);
          assert.equal(preview.tour.persona, expectedPersona);
          assert.equal(preview.step, preview.tour.steps[step - 1]);
          assert.equal(preview.usedFallback, targetMode.id === "unavailable");
        }
        personaPreviewCount += 1;
      }
    }
  }
}
assert.equal(personaPreviewCount, 1_040);

const controlsSource = readFileSync(
  "src/components/design-lab-scenario-controls.tsx",
  "utf8",
);
for (const contract of [
  /data-design-lab-onboarding-preview-controls/,
  /data-design-lab-onboarding-control="device"/,
  /data-design-lab-onboarding-control="targetMode"/,
  /data-onboarding-device-width=\{onboardingDevice\.width\}/,
  /data-onboarding-target-mode=\{onboardingTargetMode\}/,
  /targetAvailable: onboardingTargetMode === "available"/,
  /never write tour completion/,
]) {
  assert.match(controlsSource, contract);
}

console.log(
  `Design Lab onboarding preview passed: ${previewCount} base states plus ${personaPreviewCount} explicit trainer/support-operator states across 87 tours.`,
);
