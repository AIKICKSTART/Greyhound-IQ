import assert from "node:assert/strict";

import {
  resolveContextualOnboardingPersona,
  resolveContextualOnboardingPreview,
  resolveContextualOnboardingTour,
} from "./onboarding-tour-registry";
import { SUPPORT_OPERATOR_ONBOARDING_ROUTES } from "./onboarding-persona";
import { RACING_ONBOARDING_ROUTE_TOURS } from "./racing-onboarding-tour-registry";

for (const tour of RACING_ONBOARDING_ROUTE_TOURS) {
  assert.equal(
    resolveContextualOnboardingPersona(tour.route, {
      authenticated: true,
      role: "trainer",
    }),
    "trainer",
    tour.route,
  );
  const resolved = resolveContextualOnboardingTour(tour.route, {
    authenticated: true,
    role: "trainer",
  });
  assert.ok(resolved && "persona" in resolved, tour.route);
  assert.equal(resolved.persona, "trainer", tour.route);
  assert.match(
    resolved?.steps.map(({ body }) => body).join(" ") ?? "",
    /trainer|kennel/i,
    tour.route,
  );
}

for (const route of SUPPORT_OPERATOR_ONBOARDING_ROUTES) {
  for (const role of ["moderator", "admin"] as const) {
    assert.equal(
      resolveContextualOnboardingPersona(route, {
        authenticated: true,
        role,
      }),
      "support-operator",
      `${route}:${role}`,
    );
    const resolved = resolveContextualOnboardingTour(route, {
      authenticated: true,
      role,
    });
    assert.ok(resolved && "persona" in resolved, `${route}:${role}`);
    assert.equal(resolved.persona, "support-operator", `${route}:${role}`);
    assert.match(
      resolved?.steps.map(({ body }) => body).join(" ") ?? "",
      /support|customer/i,
      `${route}:${role}`,
    );
  }
  assert.equal(
    resolveContextualOnboardingTour(route, {
      authenticated: true,
      role: "member",
    }),
    null,
    `${route}:member must fail closed`,
  );
}

for (const [route, role] of [
  ["/statistics", "trainer"],
  ["/admin/support", "moderator"],
] as const) {
  const tour = resolveContextualOnboardingTour(route, {
    authenticated: true,
    role,
  });
  assert.ok(tour);
  const preview = resolveContextualOnboardingPreview({
    authenticated: true,
    role,
    route,
    tourId: tour.tourId,
    step: 3,
  });
  assert.equal(preview.status, "available");
  if (preview.status === "available") {
    assert.ok("persona" in preview.tour);
    assert.ok("persona" in tour);
    assert.equal(preview.tour.persona, tour.persona);
    assert.equal(preview.step, preview.tour.steps[2]);
  }
}

assert.equal(
  resolveContextualOnboardingPersona("/statistics", {
    authenticated: false,
    role: "trainer",
  }),
  null,
);
assert.equal(
  resolveContextualOnboardingPersona("/admin/users", {
    authenticated: true,
    role: "moderator",
  }),
  null,
);

console.log(
  "Onboarding personas passed: 10 trainer routes and 3 moderator/admin support-operator routes personalize guidance without granting access.",
);
