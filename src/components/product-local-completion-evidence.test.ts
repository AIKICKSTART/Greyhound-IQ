import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { AGENTS_ONBOARDING_ROUTE_TOURS } from "./agents-onboarding-tour-registry";
import { COMMUNITY_ONBOARDING_ROUTE_TOURS } from "./community-onboarding-tour-registry";
import { DESIGN_LAB_ONBOARDING_ROUTE_TOURS } from "./design-lab-onboarding-tour-registry";
import { MARKETPLACE_ONBOARDING_ROUTE_TOURS } from "./marketplace-onboarding-tour-registry";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "./master-audit-requirements";
import {
  ACCOUNT_ONBOARDING_ROUTE_TOURS,
  ADMIN_ONBOARDING_ROUTE_TOURS,
  resolveContextualOnboardingPreview,
  resolveContextualOnboardingTour,
} from "./onboarding-tour-registry";
import {
  PRODUCT_LOCAL_COMPLETION_EVIDENCE_FILE,
  PRODUCT_LOCAL_COMPLETION_EXPECTED_GAIN,
  PRODUCT_LOCAL_COMPLETION_MASTER_EVIDENCE,
  PRODUCT_LOCAL_COMPLETION_REQUIREMENT_IDS,
  PRODUCT_LOCAL_COMPLETION_SCOPE,
  PRODUCT_LOCAL_COMPLETION_TEST_FILE,
} from "./product-local-completion-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import { PUBLIC_ONBOARDING_ROUTE_TOURS } from "./public-onboarding-tour-registry";
import { RACING_ONBOARDING_ROUTE_TOURS } from "./racing-onboarding-tour-registry";

// screen-evidence-test-id: PRODUCT-LOCAL-COMPLETION-EVIDENCE

const EXPECTED_IDS = [
  "COMPLETE.EVIDENCE.tour-lab-coverage",
  "COMPLETE.EVIDENCE.exclusions",
  "COMPLETE.UNDERSTAND.help",
] as const;

assert.deepEqual(PRODUCT_LOCAL_COMPLETION_REQUIREMENT_IDS, EXPECTED_IDS);
assert.equal(PRODUCT_LOCAL_COMPLETION_EXPECTED_GAIN, 3);
assert.deepEqual(
  Object.keys(PRODUCT_LOCAL_COMPLETION_MASTER_EVIDENCE),
  EXPECTED_IDS,
);

const requirementsById = new Map(
  PRODUCT_MASTER_REQUIREMENTS.map((requirement) => [requirement.id, requirement]),
);
assert.equal(
  requirementsById.get("COMPLETE.EVIDENCE.tour-lab-coverage")?.requirement,
  "Provide evidence that every onboarding tour has Design Lab coverage.",
);
assert.equal(
  requirementsById.get("COMPLETE.EVIDENCE.exclusions")?.requirement,
  "Explicitly justify every remaining exclusion with an owner and reason.",
);
assert.equal(
  requirementsById.get("COMPLETE.UNDERSTAND.help")?.requirement,
  "Ensure every user can understand where to find assistance.",
);

for (const requirementId of EXPECTED_IDS) {
  const evidence = PRODUCT_LOCAL_COMPLETION_MASTER_EVIDENCE[requirementId];
  assert.equal(evidence.status, "tested", requirementId);
  assert.deepEqual(evidence.evidence.slice(0, 2), [
    PRODUCT_LOCAL_COMPLETION_EVIDENCE_FILE,
    PRODUCT_LOCAL_COMPLETION_TEST_FILE,
  ]);
  assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
  evidence.evidence.forEach((path) =>
    assert.equal(existsSync(path), true, `${requirementId}: ${path}`),
  );
}

const allTours = [
  ...ADMIN_ONBOARDING_ROUTE_TOURS,
  ...ACCOUNT_ONBOARDING_ROUTE_TOURS,
  ...RACING_ONBOARDING_ROUTE_TOURS,
  ...COMMUNITY_ONBOARDING_ROUTE_TOURS,
  ...PUBLIC_ONBOARDING_ROUTE_TOURS,
  ...MARKETPLACE_ONBOARDING_ROUTE_TOURS,
  ...AGENTS_ONBOARDING_ROUTE_TOURS,
  ...DESIGN_LAB_ONBOARDING_ROUTE_TOURS,
];
const contexts = [
  { authenticated: false, role: "visitor" },
  { authenticated: true, role: "member" },
  { authenticated: true, role: "moderator" },
  { authenticated: true, role: "admin" },
  { authenticated: true, role: "trainer" },
] as const;

assert.equal(allTours.length, 87);
assert.equal(new Set(allTours.map(({ route }) => route)).size, 87);
let previewedSteps = 0;
for (const tour of allTours) {
  const context = contexts.find(
    (candidate) => {
      const resolved = resolveContextualOnboardingTour(tour.route, candidate);
      return resolved?.route === tour.route && resolved.tourId === tour.tourId;
    },
  );
  assert.ok(context, `${tour.route}: no allowed preview audience`);
  for (let step = 1; step <= tour.steps.length; step += 1) {
    const preview = resolveContextualOnboardingPreview({
      anonymous: !context.authenticated,
      authenticated: context.authenticated,
      role: context.role,
      route: tour.route,
      tourId: tour.tourId,
      step,
      targetAvailable: false,
    });
    assert.equal(preview.status, "available", `${tour.route}:${step}`);
    if (preview.status === "available") {
      assert.equal(preview.stepNumber, step, `${tour.route}:${step}`);
      assert.equal(preview.usedFallback, true, `${tour.route}:${step}`);
      assert.equal(
        preview.resolvedTargetId,
        preview.step.fallbackTargetId,
        `${tour.route}:${step}`,
      );
    }
    previewedSteps += 1;
  }
}
assert.equal(previewedSteps, 435);
const scenarioControls = readFileSync(
  "src/components/design-lab-scenario-controls.tsx",
  "utf8",
);
assert.match(scenarioControls, /resolveContextualOnboardingPreview/);
assert.match(scenarioControls, /data-onboarding-preview-device/);
assert.match(scenarioControls, /data-onboarding-preview-target/);

const excludedProductRequirements = MASTER_AUDIT_REQUIREMENTS.filter(
  (requirement) =>
    requirement.prompt === "product" && requirement.status === "excluded",
);
assert.deepEqual(
  excludedProductRequirements,
  [],
  "Any future product exclusion must replace this zero-exclusion proof with explicit owner-and-reason evidence.",
);

const layout = readFileSync("src/app/layout.tsx", "utf8");
const help = readFileSync("src/components/interactive-help.tsx", "utf8");
const header = readFileSync("src/components/site-header.tsx", "utf8");
assert.match(layout, /<InteractiveHelp/);
assert.match(layout, /showFloatingLauncher/);
assert.match(layout, /role=\{user\?\.role \?\? "visitor"\}/);
assert.match(help, /aria-label=\{helpEnabled \? "Open interactive help" : "Turn on interactive help"\}/);
assert.match(help, /<span>\{helpEnabled \? "Help" : "Help off"\}<\/span>/);
assert.match(help, /href="\/account\/support#help-topics"/);
assert.match(help, /href="\/contact"/);
assert.match(header, /<h2>Help &amp; onboarding<\/h2>/);
assert.match(header, /<InteractiveHelpMenuControls profileScope=\{user\.profileId\} \/>/);

assert.match(PRODUCT_LOCAL_COMPLETION_SCOPE, /87 canonical onboarding tours/i);
assert.match(PRODUCT_LOCAL_COMPLETION_SCOPE, /435 steps/i);
assert.match(PRODUCT_LOCAL_COMPLETION_SCOPE, /zero excluded requirements/i);
assert.match(PRODUCT_LOCAL_COMPLETION_SCOPE, /does not prove browser rendering/i);
assert.match(PRODUCT_LOCAL_COMPLETION_SCOPE, /user comprehension/i);
assert.match(PRODUCT_LOCAL_COMPLETION_SCOPE, /open requirements are exclusions/i);
const evidenceSource = readFileSync(
  PRODUCT_LOCAL_COMPLETION_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);

const selectedIds = new Set<string>(EXPECTED_IDS);
const currentCompleted = MASTER_AUDIT_REQUIREMENTS.filter(
  isMasterRequirementComplete,
).length;
const withoutThisBatch = MASTER_AUDIT_REQUIREMENTS.map((requirement) =>
  selectedIds.has(requirement.id)
    ? { ...requirement, status: "not-started", evidence: [] }
    : requirement,
).filter(isMasterRequirementComplete).length;
assert.equal(
  currentCompleted - withoutThisBatch,
  PRODUCT_LOCAL_COMPLETION_EXPECTED_GAIN,
);

console.log(
  "Product local completion evidence passed: 87 tours/435 Design Lab preview steps, zero exclusions, and universal labelled help close exactly 3 local requirements.",
);
