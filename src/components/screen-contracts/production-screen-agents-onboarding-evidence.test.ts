import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  SCREEN_CONTRACTS,
  SCREEN_CONTRACT_BY_ROUTE,
} from "../demo-experience-registry";
import { buildAgentsOnboardingScenarioUrl } from "../design-lab-scenario-state";
import {
  AGENTS_ONBOARDING_ROUTE_TOURS,
  AGENTS_ONBOARDING_TARGET_IDS,
  AGENTS_ONBOARDING_TOUR_ID,
  getAgentsOnboardingRouteTour,
  resolveAgentsOnboardingPreview,
  resolveAgentsOnboardingTour,
} from "../agents-onboarding-tour-registry";
import {
  getOnboardingRouteTour,
  resolveContextualOnboardingTour,
} from "../onboarding-tour-registry";
import {
  PRODUCTION_SCREEN_AGENTS_ONBOARDING_EVIDENCE_TEST,
  productionScreenCoverage,
} from "./production-screen-coverage";
import {
  PRODUCTION_SCREEN_MEMBER_PERMISSION_CONTRACTS,
  PRODUCTION_SCREEN_MEMBER_STATE_CONTRACTS,
} from "./production-screen-member-access-state-evidence";

// screen-evidence-test-id: PRODUCTION-SCREEN-AGENTS-ONBOARDING

const tour = AGENTS_ONBOARDING_ROUTE_TOURS[0];
const screen = SCREEN_CONTRACT_BY_ROUTE.get("/agents");
const permission = PRODUCTION_SCREEN_MEMBER_PERMISSION_CONTRACTS.find(
  ({ route }) => route === "/agents",
);
const state = PRODUCTION_SCREEN_MEMBER_STATE_CONTRACTS.find(
  ({ route }) => route === "/agents",
);

assert.deepEqual(AGENTS_ONBOARDING_TARGET_IDS, [
  "agents-navigation",
  "agents-page-content",
]);
assert.equal(AGENTS_ONBOARDING_ROUTE_TOURS.length, 1);
assert.equal(tour.route, "/agents");
assert.equal(tour.authentication, "required");
assert.deepEqual(tour.allowedAudiences, ["member", "moderator", "admin"]);
assert.equal(tour.tourId, AGENTS_ONBOARDING_TOUR_ID);
assert.equal(tour.steps.length, 5);
assert.equal(new Set(tour.steps.map(({ id }) => id)).size, 5);
assert.equal(new Set(tour.steps.map(({ body }) => body)).size, 5);
assert.equal(getAgentsOnboardingRouteTour("/agents/"), tour);
assert.equal(getAgentsOnboardingRouteTour("/agents/extra"), undefined);
assert.equal(getOnboardingRouteTour("/agents"), tour);

for (const step of tour.steps) {
  assert.ok(step.title.trim().length > 0, step.id);
  assert.ok(step.body.trim().length > 0, step.id);
  assert.ok(AGENTS_ONBOARDING_TARGET_IDS.includes(step.targetId));
  assert.ok(AGENTS_ONBOARDING_TARGET_IDS.includes(step.fallbackTargetId));
  assert.notEqual(step.targetId, step.fallbackTargetId, step.id);
}

let scenarioCount = 0;
for (const audience of tour.allowedAudiences) {
  assert.equal(resolveAgentsOnboardingTour(tour.route, audience), tour);
  assert.equal(
    resolveContextualOnboardingTour(tour.route, {
      authenticated: true,
      role: audience,
    }),
    tour,
  );
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
assert.equal(scenarioCount, 30);
assert.equal(resolveAgentsOnboardingTour("/agents", null), null);
assert.equal(
  resolveContextualOnboardingTour("/agents", {
    authenticated: false,
    role: "visitor",
  }),
  null,
);
assert.throws(
  () =>
    buildAgentsOnboardingScenarioUrl("/design-lab", {
      route: "/agents/extra",
      step: 1,
    }),
  /design_lab\.agents_onboarding_scenario_unavailable/,
);

assert.ok(screen, "agents screen contract missing");
assert.equal(screen.authentication, "required");
assert.equal(screen.productionEnabled, true);
assert.equal(screen.coverage.onboarding.status, "tested");
assert.equal(screen.onboardingTourId, tour.tourId);
assert.ok(permission, "agents permission contract missing");
assert.deepEqual(
  permission.permissions.map(({ decision }) => decision),
  ["deny", "deny", "allow"],
);
assert.ok(state, "agents state contract missing");
assert.equal(state.states.length, 3);

const coverage = productionScreenCoverage({
  screenId: screen.id,
  route: screen.route,
  concreteRoute: screen.concreteRoute,
  sourcePath: screen.sourceFiles[0],
  routeAuditPassed: true,
});
assert.equal(coverage.onboarding?.status, "tested");
assert.equal(coverage.onboardingTourId, tour.tourId);
assert.deepEqual(
  coverage.onboarding?.evidence.map(({ path }) => path),
  [
    "src/components/agents-onboarding-tour-registry.ts",
    "src/components/interactive-help.tsx",
    "src/app/layout.tsx",
    "src/components/site-header.tsx",
    PRODUCTION_SCREEN_AGENTS_ONBOARDING_EVIDENCE_TEST.path,
  ],
);

const actionsSource = readFileSync("src/app/actions.ts", "utf8");
const createStart = actionsSource.indexOf(
  "export async function createAgentRun(formData: FormData)",
);
const createEnd = actionsSource.indexOf(
  "export async function createSupportTicket",
  createStart,
);
const createAgentRunSource = actionsSource.slice(createStart, createEnd);
assert.ok(createStart >= 0 && createEnd > createStart);
assert.match(createAgentRunSource, /requireCurrentUserProfile\(\)/);
assert.match(createAgentRunSource, /agentFormSchema\.parse/);
assert.match(createAgentRunSource, /runAgentForCurrentUser\(current, agentType/);
assert.ok(
  createAgentRunSource.indexOf("requireCurrentUserProfile()") <
    createAgentRunSource.indexOf("agentFormSchema.parse"),
  "agent execution must authenticate before parsing or protected effects",
);

const serviceSource = readFileSync("src/lib/agent-service.ts", "utf8");
const runStart = serviceSource.indexOf(
  "export async function runAgentForCurrentUser(",
);
const runEnd = serviceSource.indexOf("export async function", runStart + 1);
const runSource = serviceSource.slice(
  runStart,
  runEnd === -1 ? undefined : runEnd,
);
assert.match(runSource, /isEmergencyControlActive\(process\.env\.AI_DISABLED\)/);
assert.match(runSource, /assertAgentTier\(current, agentType\);/);
assert.match(runSource, /tx\.agentRun\.create/);
assert.ok(
  runSource.indexOf("assertAgentTier(current, agentType);") <
    runSource.indexOf("tx.agentRun.create"),
  "agent allowance must be enforced before persistence",
);

const rootLayoutSource = readFileSync("src/app/layout.tsx", "utf8");
const headerSource = readFileSync("src/components/site-header.tsx", "utf8");
assert.match(
  rootLayoutSource,
  /data-onboarding-target="[^"]*\bagents-page-content\b[^"]*"/,
);
assert.equal(
  headerSource.match(
    /data-onboarding-target="[^"]*\bagents-navigation\b[^"]*"/g,
  )?.length,
  4,
);
assert.deepEqual(PRODUCTION_SCREEN_AGENTS_ONBOARDING_EVIDENCE_TEST, {
  id: "PRODUCTION-SCREEN-AGENTS-ONBOARDING",
  path: "src/components/screen-contracts/production-screen-agents-onboarding-evidence.test.ts",
});
assert.equal(
  SCREEN_CONTRACTS.filter(
    ({ coverage }) => coverage.onboarding.status === "not-started",
  ).length,
  0,
);

console.log(
  "Production agents onboarding evidence passed: 1 authenticated route, 5 source-backed steps and 30 gated Design Lab states.",
);
