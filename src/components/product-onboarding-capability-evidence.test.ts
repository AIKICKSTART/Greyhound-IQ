import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  AGENTS_ONBOARDING_ROUTE_TOURS,
  AGENTS_ONBOARDING_TARGET_IDS,
} from "./agents-onboarding-tour-registry";
import {
  COMMUNITY_ONBOARDING_ROUTE_TOURS,
  COMMUNITY_ONBOARDING_TARGET_IDS,
} from "./community-onboarding-tour-registry";
import {
  DESIGN_LAB_ONBOARDING_ROUTE_TOURS,
  DESIGN_LAB_ONBOARDING_TARGET_IDS,
} from "./design-lab-onboarding-tour-registry";
import {
  SCREEN_CONTRACTS,
  SCREEN_CONTRACT_CHECKLIST,
} from "./demo-experience-registry";
import {
  DEFAULT_INTERACTIVE_HELP_PROGRESS_STATE,
  buildInteractiveHelpProgressStorageKey,
  parseInteractiveHelpProgressState,
  reduceInteractiveHelpProgressState,
  serializeInteractiveHelpProgressState,
} from "./interactive-help-state";
import {
  MARKETPLACE_ONBOARDING_ROUTE_TOURS,
  MARKETPLACE_ONBOARDING_TARGET_IDS,
} from "./marketplace-onboarding-tour-registry";
import {
  ACCOUNT_ONBOARDING_ROUTE_TOURS,
  ACCOUNT_ONBOARDING_TARGET_IDS,
  ADMIN_ONBOARDING_ROUTE_TOURS,
  ADMIN_ONBOARDING_TARGET_IDS,
  getOnboardingRouteTour,
  resolveContextualOnboardingPersona,
  resolveContextualOnboardingPreview,
  resolveContextualOnboardingTour,
} from "./onboarding-tour-registry";
import { SUPPORT_OPERATOR_ONBOARDING_ROUTES } from "./onboarding-persona";
import {
  PRODUCT_ONBOARDING_ACCESSIBILITY_REQUIREMENT_IDS,
  PRODUCT_ONBOARDING_ACCESS_REQUIREMENT_IDS,
  PRODUCT_ONBOARDING_ADDITIONAL_REQUIREMENT_IDS,
  PRODUCT_ONBOARDING_ANALYTICS_REQUIREMENT_IDS,
  PRODUCT_ONBOARDING_BEHAVIOUR_REQUIREMENT_IDS,
  PRODUCT_ONBOARDING_CAPABILITY_EVIDENCE_FILE,
  PRODUCT_ONBOARDING_CAPABILITY_EVIDENCE_SCOPE,
  PRODUCT_ONBOARDING_CAPABILITY_EXPECTED_GAIN,
  PRODUCT_ONBOARDING_CAPABILITY_MASTER_EVIDENCE,
  PRODUCT_ONBOARDING_CAPABILITY_REQUIREMENT_IDS,
  PRODUCT_ONBOARDING_CAPABILITY_RESIDUAL_GAPS,
  PRODUCT_ONBOARDING_CAPABILITY_TEST_FILE,
  PRODUCT_ONBOARDING_DEVICE_REQUIREMENT_IDS,
  PRODUCT_ONBOARDING_HELP_CENTRE_REQUIREMENT_IDS,
  PRODUCT_ONBOARDING_GUIDANCE_REQUIREMENT_IDS,
  PRODUCT_ONBOARDING_HISTORY_REQUIREMENT_IDS,
  PRODUCT_ONBOARDING_MANAGEMENT_PREVIEW_REQUIREMENT_IDS,
  PRODUCT_ONBOARDING_MOBILE_REQUIREMENT_IDS,
  PRODUCT_ONBOARDING_PERSISTENCE_REQUIREMENT_IDS,
  PRODUCT_ONBOARDING_ROLE_REQUIREMENT_IDS,
  PRODUCT_ONBOARDING_SURFACE_REQUIREMENT_IDS,
  PRODUCT_ONBOARDING_TARGET_REQUIREMENT_IDS,
} from "./product-onboarding-capability-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "./master-audit-requirements";
import { PRODUCT_MASTER_EVIDENCE } from "./master-audit-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PUBLIC_ONBOARDING_ROUTE_TOURS,
  PUBLIC_ONBOARDING_TARGET_IDS,
} from "./public-onboarding-tour-registry";
import {
  RACING_ONBOARDING_ROUTE_TOURS,
  RACING_ONBOARDING_TARGET_IDS,
} from "./racing-onboarding-tour-registry";
import { PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS } from "./screen-contracts/production-screen-coverage";

const completedIds = [...PRODUCT_ONBOARDING_CAPABILITY_REQUIREMENT_IDS];
const completedIdSet = new Set<string>(completedIds);

assert.deepEqual(
  [
    PRODUCT_ONBOARDING_SURFACE_REQUIREMENT_IDS.length,
    PRODUCT_ONBOARDING_BEHAVIOUR_REQUIREMENT_IDS.length,
    PRODUCT_ONBOARDING_HELP_CENTRE_REQUIREMENT_IDS.length,
    PRODUCT_ONBOARDING_PERSISTENCE_REQUIREMENT_IDS.length,
    PRODUCT_ONBOARDING_HISTORY_REQUIREMENT_IDS.length,
    PRODUCT_ONBOARDING_MANAGEMENT_PREVIEW_REQUIREMENT_IDS.length,
    PRODUCT_ONBOARDING_GUIDANCE_REQUIREMENT_IDS.length,
    PRODUCT_ONBOARDING_ROLE_REQUIREMENT_IDS.length,
    PRODUCT_ONBOARDING_ACCESS_REQUIREMENT_IDS.length,
    PRODUCT_ONBOARDING_TARGET_REQUIREMENT_IDS.length,
    PRODUCT_ONBOARDING_DEVICE_REQUIREMENT_IDS.length,
    PRODUCT_ONBOARDING_MOBILE_REQUIREMENT_IDS.length,
    PRODUCT_ONBOARDING_ACCESSIBILITY_REQUIREMENT_IDS.length,
    PRODUCT_ONBOARDING_ANALYTICS_REQUIREMENT_IDS.length,
    PRODUCT_ONBOARDING_ADDITIONAL_REQUIREMENT_IDS.length,
  ],
  [10, 10, 8, 10, 1, 1, 3, 16, 6, 12, 8, 8, 13, 10, 4],
);
assert.equal(completedIds.length, 120);
assert.equal(new Set(completedIds).size, completedIds.length);
assert.equal(PRODUCT_ONBOARDING_CAPABILITY_EXPECTED_GAIN, 120);
assert.deepEqual(
  Object.keys(PRODUCT_ONBOARDING_CAPABILITY_MASTER_EVIDENCE).toSorted(),
  completedIds.toSorted(),
);
assert.match(PRODUCT_ONBOARDING_CAPABILITY_EVIDENCE_SCOPE, /87 canonical route tours/i);
assert.match(PRODUCT_ONBOARDING_CAPABILITY_EVIDENCE_SCOPE, /ten redirect exclusions/i);
assert.match(PRODUCT_ONBOARDING_CAPABILITY_EVIDENCE_SCOPE, /does not prove the final deployed candidate/i);
assert.match(PRODUCT_ONBOARDING_CAPABILITY_EVIDENCE_SCOPE, /cross-device persistence/i);
assert.match(PRODUCT_ONBOARDING_CAPABILITY_EVIDENCE_SCOPE, /searchable help topics/i);
assert.match(PRODUCT_ONBOARDING_CAPABILITY_EVIDENCE_SCOPE, /recently completed tour history/i);
assert.match(PRODUCT_ONBOARDING_CAPABILITY_EVIDENCE_SCOPE, /help-focus intent selection/i);
assert.match(PRODUCT_ONBOARDING_CAPABILITY_EVIDENCE_SCOPE, /safe inline example/i);
assert.match(PRODUCT_ONBOARDING_CAPABILITY_EVIDENCE_SCOPE, /delayed-target attachment/i);
assert.match(PRODUCT_ONBOARDING_CAPABILITY_EVIDENCE_SCOPE, /product area/i);
assert.match(PRODUCT_ONBOARDING_CAPABILITY_EVIDENCE_SCOPE, /server-resolved role/i);
assert.match(PRODUCT_ONBOARDING_CAPABILITY_EVIDENCE_SCOPE, /subscription tier/i);
assert.match(PRODUCT_ONBOARDING_CAPABILITY_EVIDENCE_SCOPE, /never grant access/i);
assert.match(PRODUCT_ONBOARDING_CAPABILITY_EVIDENCE_SCOPE, /deterministic contrast measurement/i);
assert.match(PRODUCT_ONBOARDING_CAPABILITY_EVIDENCE_SCOPE, /eight explicit device-width policies/i);
assert.match(PRODUCT_ONBOARDING_CAPABILITY_EVIDENCE_SCOPE, /Visual Viewport keyboard bounds/i);
assert.match(PRODUCT_ONBOARDING_CAPABILITY_EVIDENCE_SCOPE, /analytics/i);
assert.match(PRODUCT_ONBOARDING_CAPABILITY_EVIDENCE_SCOPE, /16,720-state base Design Lab preview matrix/i);
assert.match(PRODUCT_ONBOARDING_CAPABILITY_EVIDENCE_SCOPE, /1,040 explicit trainer\/support-operator/i);
assert.match(PRODUCT_ONBOARDING_CAPABILITY_EVIDENCE_SCOPE, /one-shot allowlisted non-mutating tab\/dialog reveal/i);
assert.match(PRODUCT_ONBOARDING_CAPABILITY_EVIDENCE_SCOPE, /nine consent-gated analytics events/i);
assert.match(PRODUCT_ONBOARDING_CAPABILITY_EVIDENCE_SCOPE, /512-byte/i);
for (const [gap, explanation] of Object.entries(
  PRODUCT_ONBOARDING_CAPABILITY_RESIDUAL_GAPS,
)) {
  assert.ok(explanation.length > 100, gap);
}

const productRequirementIds = new Set(
  PRODUCT_MASTER_REQUIREMENTS.map(({ id }) => id),
);
for (const requirementId of completedIds) {
  assert.equal(productRequirementIds.has(requirementId), true, requirementId);
  const record = PRODUCT_ONBOARDING_CAPABILITY_MASTER_EVIDENCE[requirementId];
  assert.equal(record.status, "tested", requirementId);
  assert.deepEqual(record.evidence.slice(0, 3), [
    PRODUCT_ONBOARDING_CAPABILITY_EVIDENCE_FILE,
    PRODUCT_ONBOARDING_CAPABILITY_TEST_FILE,
    "docs/product/onboarding-map.md",
  ]);
  assert.equal(new Set(record.evidence).size, record.evidence.length);
  assert.equal(
    record.evidence.some((path) => path.startsWith("output/")),
    false,
    `${requirementId}: source batch must not depend on stale browser output`,
  );
  for (const evidencePath of record.evidence) {
    assert.equal(existsSync(evidencePath), true, evidencePath);
  }
  assert.deepEqual(PRODUCT_MASTER_EVIDENCE[requirementId], record);
}

const onboardingRequirements = PRODUCT_MASTER_REQUIREMENTS.filter(({ section }) =>
  section.startsWith("onboarding."),
);
const completedOnboardingIds = completedIds.filter((id) =>
  id.startsWith("ONBOARD."),
);
const intentionallyOpenOnboarding = onboardingRequirements.filter(
  ({ id }) => !completedIdSet.has(id),
);
assert.equal(onboardingRequirements.length, 117);
assert.equal(completedOnboardingIds.length, 117);
assert.equal(intentionallyOpenOnboarding.length, 0);
for (const requirement of intentionallyOpenOnboarding) {
  assert.equal(
    requirement.id in PRODUCT_ONBOARDING_CAPABILITY_MASTER_EVIDENCE,
    false,
    requirement.id,
  );
}
for (const newlyClosedId of [
  "ONBOARD.ROLE.trainer",
  "ONBOARD.ROLE.support",
  "ONBOARD.TARGET.tab",
  "ONBOARD.TARGET.modal",
] as const) {
  assert.equal(completedIdSet.has(newlyClosedId), true, newlyClosedId);
}
for (const requirementId of [
  ...PRODUCT_ONBOARDING_MANAGEMENT_PREVIEW_REQUIREMENT_IDS,
  ...PRODUCT_ONBOARDING_ANALYTICS_REQUIREMENT_IDS,
]) {
  assert.equal(completedIdSet.has(requirementId), true, requirementId);
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
const allTargetIds = [
  ...ADMIN_ONBOARDING_TARGET_IDS,
  ...ACCOUNT_ONBOARDING_TARGET_IDS,
  ...RACING_ONBOARDING_TARGET_IDS,
  ...COMMUNITY_ONBOARDING_TARGET_IDS,
  ...PUBLIC_ONBOARDING_TARGET_IDS,
  ...MARKETPLACE_ONBOARDING_TARGET_IDS,
  ...AGENTS_ONBOARDING_TARGET_IDS,
  ...DESIGN_LAB_ONBOARDING_TARGET_IDS,
];
const allowedTargetIds = new Set<string>(allTargetIds);
assert.equal(allTours.length, 87);
assert.equal(new Set(allTours.map(({ route }) => route)).size, 87);
assert.equal(allTours.every(({ steps }) => steps.length === 5), true);
let totalStepCount = 0;
const scopedStepIds = new Set<string>();
for (const tour of allTours) {
  totalStepCount += tour.steps.length;
  assert.equal(getOnboardingRouteTour(tour.route), tour, tour.route);
  for (const step of tour.steps) {
    scopedStepIds.add(`${tour.tourId}:${tour.route}:${step.id}`);
    assert.equal(allowedTargetIds.has(step.targetId), true, step.id);
    assert.equal(allowedTargetIds.has(step.fallbackTargetId), true, step.id);
    assert.notEqual(step.targetId, step.fallbackTargetId, step.id);
  }
}
assert.equal(totalStepCount, 435);
assert.equal(scopedStepIds.size, 435);

assert.equal(SCREEN_CONTRACTS.length, 97);
assert.equal(
  SCREEN_CONTRACTS.filter(
    ({ coverage }) => coverage.onboarding.status === "tested",
  ).length,
  87,
);
assert.equal(
  SCREEN_CONTRACTS.filter(
    ({ coverage }) => coverage.onboarding.status === "excluded",
  ).length,
  10,
);
assert.equal(
  SCREEN_CONTRACTS.filter(
    ({ coverage }) => coverage.onboarding.status === "not-started",
  ).length,
  0,
);
assert.equal(
  Object.keys(PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS).length,
  10,
);
assert.deepEqual(
  SCREEN_CONTRACT_CHECKLIST.find(({ area }) => area === "onboarding"),
  {
    area: "onboarding",
    completed: 97,
    captured: 0,
    remaining: 0,
    blocked: 0,
    total: 97,
  },
);

const rolePaths = [
  ["/", false, "visitor", "tour:public-foundations:v1"],
  ["/account", true, "member", "tour:account:v1"],
  ["/races", false, "visitor", "tour:racing-intelligence:v1"],
  ["/dogs/example", true, "member", "tour:racing-intelligence:v1"],
  [
    "/meetings/demo-provider-meeting",
    false,
    "visitor",
    "tour:racing-intelligence:v1",
  ],
  ["/breeding", true, "member", "tour:racing-intelligence:v1"],
  ["/marketplace", false, "visitor", "tour:marketplace:v1"],
  ["/marketplace/new", true, "member", "tour:marketplace:v1"],
  ["/feed", true, "member", "tour:community-pulse:v1"],
  ["/account/pages", true, "member", "tour:account:v1"],
  ["/account/team", true, "member", "tour:account:v1"],
  ["/admin/reports", true, "moderator", "tour:moderator:v1"],
  ["/admin/users", true, "admin", "tour:administrator:v1"],
  ["/agents", true, "member", "tour:agents:v1"],
  ["/statistics", true, "trainer", "tour:racing-intelligence:v1"],
  ["/admin/support", true, "moderator", "tour:moderator:v1"],
] as const;
for (const [route, authenticated, role, tourId] of rolePaths) {
  assert.equal(
    resolveContextualOnboardingTour(route, { authenticated, role })?.tourId,
    tourId,
    `${route}:${role}`,
  );
}

for (const tour of RACING_ONBOARDING_ROUTE_TOURS) {
  assert.equal(
    resolveContextualOnboardingPersona(tour.route, {
      authenticated: true,
      role: "trainer",
    }),
    "trainer",
    tour.route,
  );
}
for (const route of SUPPORT_OPERATOR_ONBOARDING_ROUTES) {
  assert.equal(
    resolveContextualOnboardingPersona(route, {
      authenticated: true,
      role: "moderator",
    }),
    "support-operator",
    route,
  );
  assert.equal(
    resolveContextualOnboardingTour(route, {
      authenticated: true,
      role: "member",
    }),
    null,
    `${route}:member must fail closed`,
  );
}
for (const [route, authenticated, role] of [
  ["/admin/users", true, "moderator"],
  ["/agents", false, "visitor"],
  ["/design-lab", true, "member"],
] as const) {
  assert.equal(
    resolveContextualOnboardingTour(route, { authenticated, role }),
    null,
    `${route}:${role}:must fail closed`,
  );
}

for (const [route, authenticated, role, anonymous] of [
  ["/", false, "visitor", true],
  ["/agents", true, "member", false],
  ["/design-lab", true, "admin", false],
  ["/admin/users", true, "admin", false],
] as const) {
  const tour = resolveContextualOnboardingTour(route, { authenticated, role });
  assert.ok(tour, `${route}: fallback tour missing`);
  const preview = resolveContextualOnboardingPreview({
    anonymous,
    authenticated,
    role,
    route,
    tourId: tour.tourId,
    step: 1,
    targetAvailable: false,
  });
  assert.equal(preview.status, "available", route);
  if (preview.status === "available") {
    assert.equal(preview.usedFallback, true, route);
    assert.equal(preview.resolvedTargetId, preview.step.fallbackTargetId, route);
  }
}

let progress = DEFAULT_INTERACTIVE_HELP_PROGRESS_STATE;
progress = reduceInteractiveHelpProgressState(progress, "next");
assert.equal(progress.step, 1);
progress = reduceInteractiveHelpProgressState(progress, "back");
assert.equal(progress.step, 0);
progress = reduceInteractiveHelpProgressState(progress, "dismiss");
assert.equal(progress.dismissed, true);
progress = reduceInteractiveHelpProgressState(progress, "resume");
assert.equal(progress.dismissed, false);
progress = reduceInteractiveHelpProgressState(progress, "restart");
assert.deepEqual(progress, DEFAULT_INTERACTIVE_HELP_PROGRESS_STATE);
progress = reduceInteractiveHelpProgressState(progress, {
  type: "complete",
  completedAt: Date.UTC(2026, 6, 15, 10, 30),
});
assert.equal(progress.completed, true);
assert.equal(progress.completedAt, Date.UTC(2026, 6, 15, 10, 30));
progress = reduceInteractiveHelpProgressState(progress, "disable");
assert.equal(progress.enabled, false);
assert.deepEqual(
  parseInteractiveHelpProgressState(serializeInteractiveHelpProgressState(progress)),
  progress,
);

const profileKey = buildInteractiveHelpProgressStorageKey({
  productArea: "agents",
  profileScope: "profile-a",
  role: "member",
  route: "/agents",
  tier: "free",
  tourId: "tour:agents:v1",
  version: 1,
});
const anonymousKey = buildInteractiveHelpProgressStorageKey({
  productArea: "public",
  role: "visitor",
  route: "/",
  tier: "free",
  tourId: "tour:public-foundations:v1",
  version: 1,
});
assert.match(profileKey, /profile-a/);
assert.match(anonymousKey, /browser/);
for (const changedKey of [
  buildInteractiveHelpProgressStorageKey({
    productArea: "agents",
    profileScope: "profile-b",
    role: "member",
    route: "/agents",
    tier: "free",
    tourId: "tour:agents:v1",
    version: 1,
  }),
  buildInteractiveHelpProgressStorageKey({
    productArea: "account",
    profileScope: "profile-a",
    role: "member",
    route: "/account",
    tier: "free",
    tourId: "tour:account:v1",
    version: 1,
  }),
  buildInteractiveHelpProgressStorageKey({
    productArea: "agents",
    profileScope: "profile-a",
    role: "member",
    route: "/agents",
    tier: "free",
    tourId: "tour:agents:v2",
    version: 2,
  }),
]) {
  assert.notEqual(profileKey, changedKey);
}
for (const changedContextKey of [
  buildInteractiveHelpProgressStorageKey({
    productArea: "account",
    profileScope: "profile-a",
    role: "member",
    route: "/agents",
    tier: "free",
    tourId: "tour:agents:v1",
    version: 1,
  }),
  buildInteractiveHelpProgressStorageKey({
    productArea: "agents",
    profileScope: "profile-a",
    role: "admin",
    route: "/agents",
    tier: "free",
    tourId: "tour:agents:v1",
    version: 1,
  }),
  buildInteractiveHelpProgressStorageKey({
    productArea: "agents",
    profileScope: "profile-a",
    role: "member",
    route: "/agents",
    tier: "premium",
    tourId: "tour:agents:v1",
    version: 1,
  }),
]) {
  assert.notEqual(profileKey, changedContextKey);
}

const helpSource = readFileSync("src/components/interactive-help.tsx", "utf8");
const layoutSource = readFileSync("src/app/layout.tsx", "utf8");
const targetSource = [
  "src/app/layout.tsx",
  "src/app/account/layout.tsx",
  "src/app/admin/layout.tsx",
  "src/app/admin/admin-nav.tsx",
  "src/app/admin/admin-page-header.tsx",
  "src/components/site-header.tsx",
  "src/components/design-lab-onboarding-disclosure-targets.tsx",
]
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");

for (const targetId of allowedTargetIds) {
  assert.match(
    targetSource,
    new RegExp(`data-onboarding-target=["'][^"']*\\b${targetId}\\b`),
    targetId,
  );
}
for (const sourceContract of [
  /allowContextualAutomaticOpen/,
  /onClick=\{openHelp\}/,
  /changeStep\(stepIndex \+ 1\)/,
  /changeStep\(stepIndex - 1\)/,
  /aria-label="Dismiss onboarding help"/,
  /updateInteractiveHelp\("disable"\)/,
  /updateInteractiveHelpProgress\(progressStorageKey, "resume"\)/,
  /completedAt: Date\.now\(\)/,
  /updateInteractiveHelpProgress\(progressStorageKey, "disable"\)/,
  /Restart guided tour/,
  /Skip step/,
  /Reset all tours on this device/,
  /Recently completed/,
  /listRecentlyCompletedInteractiveHelpTours/,
  /Finished tours will appear here with their completion time\./,
  /What do you want help with\?/,
  /Choose a help focus/,
  /updateInteractiveHelpIntent/,
  /parseInteractiveHelpProgressStorageKey\(storageKey\)\?\.profileScope/,
  /href="\/account\/support#help-topics"/,
  /href="\/contact"/,
  /window\.localStorage\.setItem\(storageKey, snapshot\)/,
  /resolveInteractiveHelpProductArea\(routeTour\.tourId\)/,
  /role: role \?\? "visitor"/,
  /tier: tier \?\? "free"/,
  /migrateInteractiveHelpProgressStorageKey\(/,
  /window\.localStorage\.removeItem\(legacyStorageKey\)/,
  /dataset\.onboardingTarget\?\.split\(\/\\s\+\/\)\.includes\(targetId\)/,
  /candidate\.getClientRects\(\)\.length > 0/,
  /scrollIntoView\(/,
  /targetStatus === "fallback"/,
  /targetStatus === "revealing"/,
  /targetStatus === "controller"/,
  /findVisibleOnboardingRevealController/,
  /revealController\.element\.click\(\)/,
  /targetStatus === "missing"/,
  /aria-live="polite"/,
  /aria-label="Tour progress"/,
  /aria-current=\{index === stepIndex \? "step" : undefined\}/,
  /focus-visible:outline-2/,
  /previousFocus\?\.isConnected/,
  /prefers-reduced-motion: reduce/,
  /min-h-11/,
  /styles\.content/,
  /data-help-ready=\{coachmarkReady \? "true" : "false"\}/,
  /resolvedTargetKey === targetResolutionKey/,
  /SERVER_INTERACTIVE_HELP_SNAPSHOT/,
  /popupLayout\.width/,
  /popupLayout\.maxHeight/,
  /popupLayout\.arrowOffset/,
  /window\.visualViewport/,
  /aria-modal="false"/,
  /giq-mobile-dock-clearance/,
]) {
  assert.match(helpSource, sourceContract);
}
assert.match(layoutSource, /tier=\{user\?\.tier \?\? "free"\}/);
assert.doesNotMatch(helpSource, /\bsetTimeout\s*\(|\bsetInterval\s*\(/);
assert.match(layoutSource, /profileScope=\{user\?\.profileId\}/);
assert.match(layoutSource, /allowContextualAutomaticOpen/);

const selectedIdSet = new Set<string>(completedIds);
const currentCompleted = MASTER_AUDIT_REQUIREMENTS.filter(
  isMasterRequirementComplete,
).length;
const withoutThisBatch = MASTER_AUDIT_REQUIREMENTS.map((requirement) =>
  selectedIdSet.has(requirement.id)
    ? { ...requirement, status: "not-started", evidence: [] }
    : requirement,
).filter(isMasterRequirementComplete).length;
assert.equal(
  currentCompleted - withoutThisBatch,
  PRODUCT_ONBOARDING_CAPABILITY_EXPECTED_GAIN,
  "This isolated evidence batch must match its current expected requirement gain",
);

console.log(
  "Product onboarding capability evidence passed: 87 contextual routes, 435 steps, all 117 onboarding capabilities plus 3 route/gate outcomes closed.",
);
