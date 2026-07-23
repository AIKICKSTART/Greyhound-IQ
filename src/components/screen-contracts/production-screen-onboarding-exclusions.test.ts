import assert from "node:assert/strict";

import nextConfig from "../../../next.config";
import { SCREEN_CONTRACTS } from "../demo-experience-registry";
import { getOnboardingRouteTour } from "../onboarding-tour-registry";
import {
  PRODUCTION_SCREEN_ONBOARDING_EVIDENCE_TEST,
  PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS,
} from "./production-screen-coverage";

// screen-evidence-test-id: PRODUCTION-SCREEN-ONBOARDING-REDIRECT-EXCLUSIONS

const EXPECTED_EXCLUSIONS = {
  "/listings": {
    redirectSource: "/listings",
    redirectDestination: "/marketplace",
  },
  "/listings/[id]": {
    redirectSource: "/listings/:path*",
    redirectDestination: "/marketplace/:path*",
  },
  "/listings/[id]/edit": {
    redirectSource: "/listings/:path*",
    redirectDestination: "/marketplace/:path*",
  },
  "/listings/new": {
    redirectSource: "/listings/:path*",
    redirectDestination: "/marketplace/:path*",
  },
  "/forum": {
    redirectSource: "/forum",
    redirectDestination: "/groups",
  },
  "/forum/[slug]": {
    redirectSource: "/forum/:path*",
    redirectDestination: "/groups/:path*",
  },
  "/forum/threads/[id]": {
    redirectSource: "/forum/:path*",
    redirectDestination: "/groups/:path*",
  },
  "/messages": {
    redirectSource: "/messages",
    redirectDestination: "/pulse",
  },
  "/messages/[id]": {
    redirectSource: "/messages/:path*",
    redirectDestination: "/pulse/:path*",
  },
  "/messages/friends": {
    redirectSource: "/messages/:path*",
    redirectDestination: "/pulse/:path*",
  },
} as const;

const EXPECTED_REDIRECTS = [
  { source: "/listings", destination: "/marketplace", permanent: true },
  {
    source: "/listings/:path*",
    destination: "/marketplace/:path*",
    permanent: true,
  },
  { source: "/forum", destination: "/groups", permanent: true },
  {
    source: "/forum/:path*",
    destination: "/groups/:path*",
    permanent: true,
  },
  { source: "/messages", destination: "/pulse", permanent: true },
  {
    source: "/messages/:path*",
    destination: "/pulse/:path*",
    permanent: true,
  },
] as const;

assert.deepEqual(
  PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS,
  EXPECTED_EXCLUSIONS,
  "only the ten reviewed permanent legacy redirects may exclude onboarding"
);

async function main() {
  assert.ok(nextConfig.redirects, "next.config.ts must expose redirect rules");
  const redirectRules = await nextConfig.redirects();
  const legacyRedirects = redirectRules
    .filter((redirect) =>
      /^\/(?:listings|forum|messages)(?:$|\/)/.test(redirect.source)
    )
    .map((redirect) => ({
      source: redirect.source,
      destination: redirect.destination,
      permanent:
        "permanent" in redirect ? redirect.permanent : undefined,
    }));

  assert.deepEqual(
    legacyRedirects.toSorted((left, right) =>
      left.source.localeCompare(right.source)
    ),
    [...EXPECTED_REDIRECTS].toSorted((left, right) =>
      left.source.localeCompare(right.source)
    ),
    "onboarding exclusions must remain bound to the exact permanent Next.js redirects"
  );

  const exclusionRoutes = new Set(
    Object.keys(PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS)
  );
  const excludedOnboardingRoutes = SCREEN_CONTRACTS.filter(
    (screen) => screen.coverage.onboarding.status === "excluded"
  ).map((screen) => screen.route);

  assert.deepEqual(
    excludedOnboardingRoutes.toSorted(),
    [...exclusionRoutes].toSorted(),
    "no canonical or non-redirect route may receive onboarding exclusion credit"
  );

  for (const screen of SCREEN_CONTRACTS) {
    if (exclusionRoutes.has(screen.route)) {
      assert.equal(screen.onboardingTourId, undefined);
      assert.deepEqual(screen.coverage.onboarding.evidence, [
        "next.config.ts",
        PRODUCTION_SCREEN_ONBOARDING_EVIDENCE_TEST.path,
      ]);
      continue;
    }

    const onboardingTour = getOnboardingRouteTour(screen.route);
    if (onboardingTour) {
      assert.equal(
        screen.coverage.onboarding.status,
        "tested",
        `${screen.route}: contextual onboarding must remain tested`,
      );
      assert.equal(screen.onboardingTourId, onboardingTour.tourId);
      continue;
    }

    assert.equal(
      screen.coverage.onboarding.status,
      "not-started",
      `${screen.route}: unimplemented canonical onboarding must remain open`,
    );
    assert.equal(screen.onboardingTourId, undefined);
  }

  console.log(
    "Production screen onboarding passed: 10 permanent legacy redirects excluded, 87 contextual routes tested and 0 routes remain not-started",
  );
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
