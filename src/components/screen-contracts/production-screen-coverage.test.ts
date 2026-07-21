import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  fingerprintRepositoryFiles,
  parseDesignLabSourceFiles,
} from "../../../scripts/design-lab-source-fingerprint";
import { SCREEN_CONTRACTS } from "../demo-experience-registry";
import {
  getAccountOnboardingRouteTour,
  getAdminOnboardingRouteTour,
} from "../onboarding-tour-registry";
import { getCommunityOnboardingRouteTour } from "../community-onboarding-tour-registry";
import { getAgentsOnboardingRouteTour } from "../agents-onboarding-tour-registry";
import { getMarketplaceOnboardingRouteTour } from "../marketplace-onboarding-tour-registry";
import { getPublicOnboardingRouteTour } from "../public-onboarding-tour-registry";
import { getRacingOnboardingRouteTour } from "../racing-onboarding-tour-registry";
import {
  PRODUCTION_SCREEN_ACCOUNT_ONBOARDING_EVIDENCE_TEST,
  PRODUCTION_SCREEN_AGENTS_ONBOARDING_EVIDENCE_TEST,
  PRODUCTION_SCREEN_ADMIN_ONBOARDING_EVIDENCE_TEST,
  PRODUCTION_SCREEN_ACCOUNT_INTERACTION_EVIDENCE_TEST,
  PRODUCTION_SCREEN_ACCOUNT_INTERACTION_ROUTES,
  PRODUCTION_SCREEN_ACTION_EXCLUSION_ROUTES,
  PRODUCTION_SCREEN_COMMUNITY_INTERACTION_EVIDENCE_TEST,
  PRODUCTION_SCREEN_COMMUNITY_INTERACTION_ROUTES,
  PRODUCTION_SCREEN_COMMUNITY_ONBOARDING_EVIDENCE_TEST,
  PRODUCTION_SCREEN_FORM_EXCLUSION_ROUTES,
  PRODUCTION_SCREEN_INTERACTION_CONTRACTS,
  PRODUCTION_SCREEN_MARKETPLACE_INTERACTION_EVIDENCE_TEST,
  PRODUCTION_SCREEN_MARKETPLACE_INTERACTION_ROUTES,
  PRODUCTION_SCREEN_MARKETPLACE_ONBOARDING_EVIDENCE_TEST,
  PRODUCTION_SCREEN_ONBOARDING_EVIDENCE_TEST,
  PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS,
  PRODUCTION_SCREEN_PUBLIC_ONBOARDING_EVIDENCE_TEST,
  PRODUCTION_SCREEN_RACING_ONBOARDING_EVIDENCE_TEST,
} from "./production-screen-coverage";
import {
  PRODUCTION_SCREEN_PUBLIC_RACING_INTERACTION_EVIDENCE_TEST,
  PRODUCTION_SCREEN_PUBLIC_RACING_INTERACTION_ROUTES,
} from "./production-screen-public-racing-interactions";
import {
  PRODUCTION_SCREEN_ADMIN_CORE_INTERACTION_EVIDENCE_TEST,
  PRODUCTION_SCREEN_ADMIN_CORE_INTERACTION_ROUTES,
} from "./production-screen-admin-core-interactions";
import {
  PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_EVIDENCE_TEST,
  PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_ROUTES,
  PRODUCTION_SCREEN_ADMIN_OPERATIONS_SEMANTIC_FORM_COUNTS,
} from "./production-screen-admin-operations-interactions";
import {
  PRODUCTION_SCREEN_ADMIN_MODERATION_INTERACTION_EVIDENCE_TEST,
  PRODUCTION_SCREEN_ADMIN_MODERATION_INTERACTION_ROUTES,
} from "./production-screen-admin-moderation-interactions";
import {
  PRODUCTION_SCREEN_PROFILE_MESSAGING_INTERACTION_EVIDENCE_TEST,
  PRODUCTION_SCREEN_PROFILE_MESSAGING_INTERACTION_ROUTES,
} from "./production-screen-profile-messaging-interactions";
import {
  PRODUCTION_SCREEN_COMMERCE_INTERACTION_EVIDENCE_TEST,
  PRODUCTION_SCREEN_COMMERCE_INTERACTION_ROUTES,
} from "./production-screen-commerce-interactions";
import {
  PRODUCTION_SCREEN_MEMBER_SUPPORT_INTERACTION_EVIDENCE_TEST,
  PRODUCTION_SCREEN_MEMBER_SUPPORT_INTERACTION_ROUTES,
} from "./production-screen-member-support-interactions";
import {
  PRODUCTION_SCREEN_PUBLIC_NAVIGATION_INTERACTION_EVIDENCE_TEST,
  PRODUCTION_SCREEN_PUBLIC_NAVIGATION_INTERACTION_ROUTES,
} from "./production-screen-public-navigation-interactions";
import {
  PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_CONTRACTS,
  PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_EVIDENCE_TEST,
} from "./production-screen-admin-access-state-evidence";
import {
  PRODUCTION_SCREEN_MESSAGING_ACCESS_STATE_EVIDENCE_TEST,
  PRODUCTION_SCREEN_MESSAGING_PERMISSION_CONTRACTS,
  PRODUCTION_SCREEN_MESSAGING_STATE_CONTRACTS,
} from "./production-screen-messaging-access-state-evidence";
import {
  PRODUCTION_SCREEN_MEMBER_ACCESS_STATE_EVIDENCE_TEST,
  PRODUCTION_SCREEN_MEMBER_PERMISSION_CONTRACTS,
  PRODUCTION_SCREEN_MEMBER_STATE_CONTRACTS,
} from "./production-screen-member-access-state-evidence";
import {
  PUBLIC_SCREEN_PERMISSION_CONTRACTS,
  SCREEN_PERMISSION_EVIDENCE_TEST,
} from "./screen-permission-evidence";
import {
  PRODUCTION_SCREEN_STATE_CONTRACTS,
  SCREEN_STATE_EVIDENCE_TEST,
} from "./screen-state-evidence";
import {
  findFormSubmissionSignals,
  findUserActionSignals,
  getLocalSourceClosure,
} from "./screen-contract-source-audit";

// screen-evidence-test-id: PRODUCTION-SCREEN-COVERAGE

const DESIGN_LAB_ROUTES = new Set([
  "/design-lab",
  "/design-lab/demo-experience",
  "/design-lab/dock-skins",
  "/design-lab/role-blueprints",
  "/feed/device-preview",
  "/marketplace/design-lab",
]);
const formExclusions = new Set<string>(PRODUCTION_SCREEN_FORM_EXCLUSION_ROUTES);
const actionExclusions = new Set<string>(
  PRODUCTION_SCREEN_ACTION_EXCLUSION_ROUTES,
);
const accountInteractionRoutes = new Set<string>(
  PRODUCTION_SCREEN_ACCOUNT_INTERACTION_ROUTES,
);
const communityInteractionRoutes = new Set<string>(
  PRODUCTION_SCREEN_COMMUNITY_INTERACTION_ROUTES,
);
const publicRacingInteractionRoutes = new Set<string>(
  PRODUCTION_SCREEN_PUBLIC_RACING_INTERACTION_ROUTES,
);
const adminCoreInteractionRoutes = new Set<string>(
  PRODUCTION_SCREEN_ADMIN_CORE_INTERACTION_ROUTES,
);
const adminOperationsInteractionRoutes = new Set<string>(
  PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_ROUTES,
);
const adminModerationInteractionRoutes = new Set<string>(
  PRODUCTION_SCREEN_ADMIN_MODERATION_INTERACTION_ROUTES,
);
const profileMessagingInteractionRoutes = new Set<string>(
  PRODUCTION_SCREEN_PROFILE_MESSAGING_INTERACTION_ROUTES,
);
const commerceInteractionRoutes = new Set<string>(
  PRODUCTION_SCREEN_COMMERCE_INTERACTION_ROUTES,
);
const memberSupportInteractionRoutes = new Set<string>(
  PRODUCTION_SCREEN_MEMBER_SUPPORT_INTERACTION_ROUTES,
);
const publicNavigationInteractionRoutes = new Set<string>(
  PRODUCTION_SCREEN_PUBLIC_NAVIGATION_INTERACTION_ROUTES,
);
const marketplaceInteractionRoutes = new Set<string>(
  PRODUCTION_SCREEN_MARKETPLACE_INTERACTION_ROUTES,
);
const onboardingRedirectExclusions = new Set(
  Object.keys(PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS),
);
const publicPermissionContractByRoute = new Map<
  string,
  (typeof PUBLIC_SCREEN_PERMISSION_CONTRACTS)[number]
>(
  PUBLIC_SCREEN_PERMISSION_CONTRACTS.map(
    (contract) => [contract.route, contract] as const,
  ),
);
const productionStateContractByRoute = new Map<
  string,
  (typeof PRODUCTION_SCREEN_STATE_CONTRACTS)[number]
>(
  PRODUCTION_SCREEN_STATE_CONTRACTS.map(
    (contract) => [contract.route, contract] as const,
  ),
);
const adminAccessStateContractByRoute = new Map<
  string,
  (typeof PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_CONTRACTS)[number]
>(
  PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_CONTRACTS.map(
    (contract) => [contract.route, contract] as const,
  ),
);
const messagingPermissionContractByRoute = new Map<
  string,
  (typeof PRODUCTION_SCREEN_MESSAGING_PERMISSION_CONTRACTS)[number]
>(
  PRODUCTION_SCREEN_MESSAGING_PERMISSION_CONTRACTS.map(
    (contract) => [contract.route, contract] as const,
  ),
);
const messagingStateContractByRoute = new Map<
  string,
  (typeof PRODUCTION_SCREEN_MESSAGING_STATE_CONTRACTS)[number]
>(
  PRODUCTION_SCREEN_MESSAGING_STATE_CONTRACTS.map(
    (contract) => [contract.route, contract] as const,
  ),
);
const memberPermissionContractByRoute = new Map<
  string,
  (typeof PRODUCTION_SCREEN_MEMBER_PERMISSION_CONTRACTS)[number]
>(
  PRODUCTION_SCREEN_MEMBER_PERMISSION_CONTRACTS.map(
    (contract) => [contract.route, contract] as const,
  ),
);
const memberStateContractByRoute = new Map<
  string,
  (typeof PRODUCTION_SCREEN_MEMBER_STATE_CONTRACTS)[number]
>(
  PRODUCTION_SCREEN_MEMBER_STATE_CONTRACTS.map(
    (contract) => [contract.route, contract] as const,
  ),
);
const EXPECTED_INTERACTION_INVENTORY = {
  "/races": {
    queryParameters: ["date", "state", "q", "status", "sort"],
    actionIds: [
      "RACES.ACTION.SEARCH",
      "RACES.ACTION.DATE.SELECT",
      "RACES.ACTION.DATE.JUMP",
      "RACES.ACTION.STATE.FILTER",
      "RACES.ACTION.STATUS.FILTER",
      "RACES.ACTION.SORT",
      "RACES.ACTION.RACE.OPEN",
      "RACES.ACTION.TRACK.OPEN",
    ],
    formIds: ["RACES.FORM.SEARCH", "RACES.FORM.DATE-JUMP", "RACES.FORM.SORT"],
  },
  "/results": {
    queryParameters: ["date", "trackId", "sort"],
    actionIds: [
      "RESULTS.ACTION.FILTER",
      "RESULTS.ACTION.CLEAR",
      "RESULTS.ACTION.RACE.OPEN",
      "RESULTS.ACTION.DOG.OPEN",
    ],
    formIds: ["RESULTS.FORM.FILTER"],
  },
  "/tracks": {
    queryParameters: ["state"],
    actionIds: [
      "TRACKS.ACTION.STATE.FILTER",
      "TRACKS.ACTION.TRACK.OPEN",
      "TRACKS.ACTION.RACE.OPEN",
    ],
    formIds: ["TRACKS.FORM.STATE"],
  },
  "/discover": {
    queryParameters: ["q"],
    actionIds: [
      "DISCOVER.ACTION.SEARCH",
      "DISCOVER.ACTION.ACTOR.OPEN",
      "DISCOVER.ACTION.DOG.OPEN",
    ],
    formIds: ["DISCOVER.FORM.SEARCH"],
  },
} as const;
const productionScreens = SCREEN_CONTRACTS.filter(
  (screen) => !DESIGN_LAB_ROUTES.has(screen.route),
);

assert.equal(productionScreens.length, 91);
assert.equal(formExclusions.size, 30);
assert.equal(actionExclusions.size, 4);
assert.equal(accountInteractionRoutes.size, 15);
assert.equal(communityInteractionRoutes.size, 7);
assert.equal(publicRacingInteractionRoutes.size, 6);
assert.equal(adminCoreInteractionRoutes.size, 4);
assert.equal(adminOperationsInteractionRoutes.size, 21);
assert.equal(adminModerationInteractionRoutes.size, 4);
assert.equal(profileMessagingInteractionRoutes.size, 4);
assert.equal(commerceInteractionRoutes.size, 6);
assert.equal(memberSupportInteractionRoutes.size, 7);
assert.equal(publicNavigationInteractionRoutes.size, 6);
assert.equal(marketplaceInteractionRoutes.size, 3);
assert.equal(onboardingRedirectExclusions.size, 10);
assert.equal(publicPermissionContractByRoute.size, 33);
assert.equal(productionStateContractByRoute.size, 34);
assert.equal(adminAccessStateContractByRoute.size, 32);
assert.equal(messagingPermissionContractByRoute.size, 6);
assert.equal(messagingStateContractByRoute.size, 5);
assert.equal(memberPermissionContractByRoute.size, 20);
assert.equal(memberStateContractByRoute.size, 20);
assert.deepEqual(
  Object.keys(PRODUCTION_SCREEN_INTERACTION_CONTRACTS),
  [
    ...Object.keys(EXPECTED_INTERACTION_INVENTORY),
    ...PRODUCTION_SCREEN_PUBLIC_RACING_INTERACTION_ROUTES,
    ...PRODUCTION_SCREEN_COMMUNITY_INTERACTION_ROUTES,
    ...PRODUCTION_SCREEN_MARKETPLACE_INTERACTION_ROUTES,
    ...PRODUCTION_SCREEN_ACCOUNT_INTERACTION_ROUTES,
    ...PRODUCTION_SCREEN_ADMIN_CORE_INTERACTION_ROUTES,
    ...PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_ROUTES,
    ...PRODUCTION_SCREEN_ADMIN_MODERATION_INTERACTION_ROUTES,
    ...PRODUCTION_SCREEN_PROFILE_MESSAGING_INTERACTION_ROUTES,
    ...PRODUCTION_SCREEN_COMMERCE_INTERACTION_ROUTES,
    ...PRODUCTION_SCREEN_MEMBER_SUPPORT_INTERACTION_ROUTES,
    ...PRODUCTION_SCREEN_PUBLIC_NAVIGATION_INTERACTION_ROUTES,
  ],
  "only the reviewed public-query, canonical marketplace, and focused account screens may receive interaction completion",
);

for (const screen of productionScreens) {
  const closure = getLocalSourceClosure(screen.sourceFiles[0]);
  const formSignals = [...closure].flatMap(findFormSubmissionSignals);
  const actionSignals = [...closure].flatMap(findUserActionSignals);
  const interactionContract =
    PRODUCTION_SCREEN_INTERACTION_CONTRACTS[
      screen.route as keyof typeof PRODUCTION_SCREEN_INTERACTION_CONTRACTS
    ];
  const expectedInventory =
    EXPECTED_INTERACTION_INVENTORY[
      screen.route as keyof typeof EXPECTED_INTERACTION_INVENTORY
    ];
  const adminAccessStateContract = adminAccessStateContractByRoute.get(
    screen.route,
  );
  const messagingPermissionContract = messagingPermissionContractByRoute.get(
    screen.route,
  );
  const messagingStateContract = messagingStateContractByRoute.get(
    screen.route,
  );
  const memberPermissionContract = memberPermissionContractByRoute.get(
    screen.route,
  );
  const memberStateContract = memberStateContractByRoute.get(screen.route);
  const permissionContract =
    publicPermissionContractByRoute.get(screen.route) ??
    messagingPermissionContract ??
    adminAccessStateContract ??
    memberPermissionContract;
  const stateContract =
    productionStateContractByRoute.get(screen.route) ??
    messagingStateContract ??
    adminAccessStateContract ??
    memberStateContract;
  const permissionEvidenceTest = messagingPermissionContract
    ? PRODUCTION_SCREEN_MESSAGING_ACCESS_STATE_EVIDENCE_TEST
    : adminAccessStateContract
      ? PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_EVIDENCE_TEST
      : memberPermissionContract
        ? PRODUCTION_SCREEN_MEMBER_ACCESS_STATE_EVIDENCE_TEST
      : SCREEN_PERMISSION_EVIDENCE_TEST;
  const stateEvidenceTest = messagingStateContract
    ? PRODUCTION_SCREEN_MESSAGING_ACCESS_STATE_EVIDENCE_TEST
    : adminAccessStateContract
      ? PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_EVIDENCE_TEST
      : memberStateContract
        ? PRODUCTION_SCREEN_MEMBER_ACCESS_STATE_EVIDENCE_TEST
      : SCREEN_STATE_EVIDENCE_TEST;

  assert.equal(
    formExclusions.has(screen.route),
    formSignals.length === 0,
    `${screen.route}: form exclusion must match its complete import closure\n${formSignals.join("\n")}`,
  );
  assert.equal(
    actionExclusions.has(screen.route),
    actionSignals.length === 0,
    `${screen.route}: action exclusion must match its complete import closure\n${actionSignals.join("\n")}`,
  );
  assert.equal(
    screen.coverage.forms.status,
    formExclusions.has(screen.route)
      ? "excluded"
      : interactionContract
        ? "verified"
        : "not-started",
  );
  assert.equal(
    screen.coverage.actions.status,
    actionExclusions.has(screen.route)
      ? "excluded"
      : interactionContract
        ? "verified"
        : "not-started",
  );
  if (interactionContract) {
    if (expectedInventory) {
      assert.deepEqual(
        interactionContract.queryParameters,
        expectedInventory.queryParameters,
      );
      assert.deepEqual(
        interactionContract.actions.map((action) => action.id),
        expectedInventory.actionIds,
      );
      assert.deepEqual(
        interactionContract.forms.map((form) => form.id),
        expectedInventory.formIds,
      );
    } else {
      assert.equal(
        accountInteractionRoutes.has(screen.route) ||
          communityInteractionRoutes.has(screen.route) ||
          publicRacingInteractionRoutes.has(screen.route) ||
          adminCoreInteractionRoutes.has(screen.route) ||
          adminOperationsInteractionRoutes.has(screen.route) ||
          adminModerationInteractionRoutes.has(screen.route) ||
          profileMessagingInteractionRoutes.has(screen.route) ||
          commerceInteractionRoutes.has(screen.route) ||
          memberSupportInteractionRoutes.has(screen.route) ||
          publicNavigationInteractionRoutes.has(screen.route) ||
          marketplaceInteractionRoutes.has(screen.route),
        true,
        `${screen.route}: unexpected interaction contract`,
      );
    }
    assert.deepEqual(screen.queryParameters, [
      ...interactionContract.queryParameters,
    ]);
    assert.deepEqual(
      screen.primaryActions,
      interactionContract.actions.map((action) => action.id),
    );
    assert.deepEqual(
      screen.forms,
      interactionContract.forms.map(
        (form) => `${form.id} -> ${form.submitsTo}`,
      ),
    );
    const symbolAwareAdminFormCount =
      PRODUCTION_SCREEN_ADMIN_OPERATIONS_SEMANTIC_FORM_COUNTS[
        screen.route as keyof typeof PRODUCTION_SCREEN_ADMIN_OPERATIONS_SEMANTIC_FORM_COUNTS
      ];
    assert.equal(
      symbolAwareAdminFormCount ??
        formSignals.filter((signal) => signal.endsWith(":<form>")).length,
      interactionContract.forms.length,
      `${screen.route}: every semantic page form needs one structured contract`,
    );
    const expectedTestId = accountInteractionRoutes.has(screen.route)
      ? PRODUCTION_SCREEN_ACCOUNT_INTERACTION_EVIDENCE_TEST.id
      : communityInteractionRoutes.has(screen.route)
        ? PRODUCTION_SCREEN_COMMUNITY_INTERACTION_EVIDENCE_TEST.id
        : publicRacingInteractionRoutes.has(screen.route)
          ? PRODUCTION_SCREEN_PUBLIC_RACING_INTERACTION_EVIDENCE_TEST.id
          : adminCoreInteractionRoutes.has(screen.route)
            ? PRODUCTION_SCREEN_ADMIN_CORE_INTERACTION_EVIDENCE_TEST.id
            : adminOperationsInteractionRoutes.has(screen.route)
              ? PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_EVIDENCE_TEST.id
              : adminModerationInteractionRoutes.has(screen.route)
                ? PRODUCTION_SCREEN_ADMIN_MODERATION_INTERACTION_EVIDENCE_TEST.id
                : profileMessagingInteractionRoutes.has(screen.route)
                  ? PRODUCTION_SCREEN_PROFILE_MESSAGING_INTERACTION_EVIDENCE_TEST.id
                  : commerceInteractionRoutes.has(screen.route)
                    ? PRODUCTION_SCREEN_COMMERCE_INTERACTION_EVIDENCE_TEST.id
                    : memberSupportInteractionRoutes.has(screen.route)
                      ? PRODUCTION_SCREEN_MEMBER_SUPPORT_INTERACTION_EVIDENCE_TEST.id
                      : publicNavigationInteractionRoutes.has(screen.route)
                        ? PRODUCTION_SCREEN_PUBLIC_NAVIGATION_INTERACTION_EVIDENCE_TEST.id
                        : marketplaceInteractionRoutes.has(screen.route)
                          ? PRODUCTION_SCREEN_MARKETPLACE_INTERACTION_EVIDENCE_TEST.id
                          : "PRODUCTION-SCREEN-COVERAGE";
    for (const action of interactionContract.actions) {
      assert.ok(action.result.length > 0);
      assert.ok(action.enforcement && action.enforcement.length > 0);
      assert.deepEqual(action.testIds, [expectedTestId]);
    }
    for (const form of interactionContract.forms) {
      assert.match(
        form.submitsTo,
        /^(?:GET \/|POST \/|PATCH \/|SERVER ACTION |CLIENT STATE )/,
      );
      assert.ok(form.schema && form.schema.length > 0);
      assert.deepEqual(form.testIds, [expectedTestId]);
    }
  } else {
    assert.equal(expectedInventory, undefined);
    assert.equal(accountInteractionRoutes.has(screen.route), false);
    assert.equal(communityInteractionRoutes.has(screen.route), false);
    assert.equal(publicRacingInteractionRoutes.has(screen.route), false);
    assert.equal(adminCoreInteractionRoutes.has(screen.route), false);
    assert.equal(adminOperationsInteractionRoutes.has(screen.route), false);
    assert.equal(adminModerationInteractionRoutes.has(screen.route), false);
    assert.equal(profileMessagingInteractionRoutes.has(screen.route), false);
    assert.equal(commerceInteractionRoutes.has(screen.route), false);
    assert.equal(marketplaceInteractionRoutes.has(screen.route), false);
    assert.deepEqual(screen.queryParameters, []);
    assert.deepEqual(screen.primaryActions, []);
    assert.deepEqual(screen.forms, []);
  }
  assert.equal(screen.coverage.designLab.status, "tested");
  assert.deepEqual(screen.designLabFixtureIds, [`DL.DEFAULT:${screen.route}`]);
  assert.equal(screen.concreteRoute.includes("["), false);
  assert.equal(
    screen.coverage.permissions.status,
    permissionContract ? "tested" : "captured",
  );
  assert.deepEqual(
    screen.permissionRules,
    permissionContract?.permissions ?? [],
  );
  if (permissionContract) {
    assert.equal(permissionContract.sourcePath, screen.sourceFiles[0]);
    assert.ok(
      screen.coverage.permissions.evidence.includes(
        permissionEvidenceTest.path,
      ),
    );
    assert.ok(
      permissionContract.permissions.every((permission) =>
        [...permission.testIds].includes(permissionEvidenceTest.id),
      ),
    );
  }
  const expectedStateRules =
    stateContract?.states.map((state) => ({
      id: state.id,
      testIds: state.testIds,
      ...(state.recoveryActionId
        ? { recoveryActionId: state.recoveryActionId }
        : {}),
    })) ?? [];
  assert.equal(
    screen.coverage.states.status,
    stateContract ? "verified" : "captured",
  );
  assert.deepEqual(screen.stateRules, expectedStateRules);
  assert.deepEqual(
    screen.supportedStates,
    stateContract ? stateContract.states.map((state) => state.id) : ["default"],
  );
  assert.equal(
    screen.stateRules.some((state) => "sourceAssertions" in state),
    false,
    `${screen.route}: runtime state rules must exclude source assertion text`,
  );
  if (stateContract) {
    assert.equal(stateContract.sourcePath, screen.sourceFiles[0]);
    assert.ok(screen.coverage.states.evidence.includes(stateEvidenceTest.path));
    assert.ok(
      stateContract.states.every((state) =>
        [...state.testIds].includes(stateEvidenceTest.id),
      ),
    );
  }
  const adminOnboardingTour = getAdminOnboardingRouteTour(screen.route);
  const accountOnboardingTour = getAccountOnboardingRouteTour(screen.route);
  const racingOnboardingTour = getRacingOnboardingRouteTour(screen.route);
  const communityOnboardingTour = getCommunityOnboardingRouteTour(screen.route);
  const publicOnboardingTour = getPublicOnboardingRouteTour(screen.route);
  const marketplaceOnboardingTour = getMarketplaceOnboardingRouteTour(
    screen.route,
  );
  const agentsOnboardingTour = getAgentsOnboardingRouteTour(screen.route);
  const onboardingTour =
    adminOnboardingTour ??
    accountOnboardingTour ??
    racingOnboardingTour ??
    communityOnboardingTour ??
    publicOnboardingTour ??
    marketplaceOnboardingTour ??
    agentsOnboardingTour;
  assert.equal(
    screen.coverage.onboarding.status,
    onboardingRedirectExclusions.has(screen.route)
      ? "excluded"
      : onboardingTour
        ? "tested"
        : "not-started",
  );
  assert.equal(screen.onboardingTourId, onboardingTour?.tourId);
  if (onboardingRedirectExclusions.has(screen.route)) {
    assert.deepEqual(screen.coverage.onboarding.evidence, [
      "next.config.ts",
      PRODUCTION_SCREEN_ONBOARDING_EVIDENCE_TEST.path,
    ]);
  } else if (adminOnboardingTour) {
    assert.deepEqual(screen.coverage.onboarding.evidence, [
      "src/components/onboarding-tour-registry.ts",
      "src/components/interactive-help.tsx",
      PRODUCTION_SCREEN_ADMIN_ONBOARDING_EVIDENCE_TEST.path,
    ]);
  } else if (accountOnboardingTour) {
    assert.deepEqual(screen.coverage.onboarding.evidence, [
      "src/components/onboarding-tour-registry.ts",
      "src/components/interactive-help.tsx",
      "src/app/account/layout.tsx",
      "src/components/site-header.tsx",
      PRODUCTION_SCREEN_ACCOUNT_ONBOARDING_EVIDENCE_TEST.path,
    ]);
  } else if (racingOnboardingTour) {
    assert.deepEqual(screen.coverage.onboarding.evidence, [
      "src/components/racing-onboarding-tour-registry.ts",
      "src/components/interactive-help.tsx",
      "src/app/layout.tsx",
      "src/components/site-header.tsx",
      PRODUCTION_SCREEN_RACING_ONBOARDING_EVIDENCE_TEST.path,
    ]);
  } else if (communityOnboardingTour) {
    assert.deepEqual(screen.coverage.onboarding.evidence, [
      "src/components/community-onboarding-tour-registry.ts",
      "src/components/interactive-help.tsx",
      "src/app/layout.tsx",
      "src/components/site-header.tsx",
      PRODUCTION_SCREEN_COMMUNITY_ONBOARDING_EVIDENCE_TEST.path,
    ]);
  } else if (publicOnboardingTour) {
    assert.deepEqual(screen.coverage.onboarding.evidence, [
      "src/components/public-onboarding-tour-registry.ts",
      "src/components/interactive-help.tsx",
      "src/app/layout.tsx",
      "src/components/site-header.tsx",
      PRODUCTION_SCREEN_PUBLIC_ONBOARDING_EVIDENCE_TEST.path,
    ]);
  } else if (marketplaceOnboardingTour) {
    assert.deepEqual(screen.coverage.onboarding.evidence, [
      "src/components/marketplace-onboarding-tour-registry.ts",
      "src/components/interactive-help.tsx",
      "src/app/layout.tsx",
      "src/components/site-header.tsx",
      PRODUCTION_SCREEN_MARKETPLACE_ONBOARDING_EVIDENCE_TEST.path,
    ]);
  } else if (agentsOnboardingTour) {
    assert.deepEqual(screen.coverage.onboarding.evidence, [
      "src/components/agents-onboarding-tour-registry.ts",
      "src/components/interactive-help.tsx",
      "src/app/layout.tsx",
      "src/components/site-header.tsx",
      PRODUCTION_SCREEN_AGENTS_ONBOARDING_EVIDENCE_TEST.path,
    ]);
  }
}

const racesSource = readFileSync("src/app/races/page.tsx", "utf8");
assert.equal(racesSource.match(/<form action="\/races"/g)?.length, 3);
for (const contract of [
  'name="q"',
  'name="date"',
  'name="sort"',
  "href={dateLink(",
  "detailHref={buildRaceDetailHref(race.id, {",
  "href={`/tracks/${track.id}`}",
  "new URLSearchParams()",
]) {
  assert.ok(racesSource.includes(contract), `/races must preserve ${contract}`);
}

const queriesSource = readFileSync("src/lib/queries.ts", "utf8");
for (const contract of [
  "normaliseRaceSearchParam(filters.q)",
  'states.includes(filters.state ?? "")',
  "normaliseRaceStatusParam(filters.status)",
  "normaliseRaceSortParam(filters.sort, Boolean(searchQuery))",
  "resolveRaceSearchDate(filters.date, searchQuery, defaultDate)",
]) {
  assert.ok(
    queriesSource.includes(contract),
    `race query handling must preserve ${contract}`,
  );
}

const resultsSource = readFileSync("src/app/results/page.tsx", "utf8");
for (const contract of [
  '<form action="/results"',
  'name="sort"',
  'name="date"',
  'name="trackId"',
  'href="/results"',
  "href={raceHref}",
  "<RunnerRow",
  'value === "oldest" || value === "track"',
]) {
  assert.ok(
    resultsSource.includes(contract),
    `/results must preserve ${contract}`,
  );
}
const runnerSource = readFileSync("src/components/runner-row.tsx", "utf8");
assert.ok(runnerSource.includes("href={`/dogs/${dog.id}`}"));

const tracksSource = readFileSync("src/app/tracks/page.tsx", "utf8");
for (const contract of [
  '<form action="/tracks"',
  'name="state"',
  "href={`/tracks/${track.id}`}",
  "href={`/races/${race.id}`}",
  'const TRACK_STATES = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"]',
  "normaliseTrackState(firstParam(params.state))",
]) {
  assert.ok(
    tracksSource.includes(contract),
    `/tracks must preserve ${contract}`,
  );
}

const discoverSource = readFileSync("src/app/discover/page.tsx", "utf8");
for (const contract of [
  'action="/discover"',
  'method="get"',
  'name="q"',
  "minLength={2}",
  "maxLength={80}",
  "href={`/p/${actor.handle}`}",
  "href={`/dogs/${dog.id}`}",
]) {
  assert.ok(
    discoverSource.includes(contract),
    `/discover must preserve ${contract}`,
  );
}
const discoveryServiceSource = readFileSync(
  "src/lib/social-discovery.ts",
  "utf8",
);
for (const contract of [
  'rawQuery.trim().replace(/\\s+/g, " ").slice(0, 80)',
  "if (query.length < 2) return emptyDiscovery(query)",
  "published: true",
  "isBanned: false",
  "deletionRequestedAt: null",
  "withDbRequestContext(current, read)",
  "withDbAnonymousContext(read)",
]) {
  assert.ok(
    discoveryServiceSource.includes(contract),
    `discovery query handling must preserve ${contract}`,
  );
}

assert.equal(
  new Set(productionScreens.flatMap((screen) => screen.designLabFixtureIds))
    .size,
  productionScreens.length,
  "every production screen must own one unique default Design Lab fixture",
);

const routeAudit = JSON.parse(
  readFileSync("output/demo-route-audit/latest.json", "utf8"),
) as {
  sourceSha256?: string;
  sourceFileCount?: number;
  sourceFiles?: unknown;
  results?: Array<{
    route?: string;
    samplePath?: string;
    status?: number;
    demoHeader?: string;
    hasMain?: boolean;
    hasH1?: boolean;
    hasReactStreamError?: boolean;
    errorMarkers?: unknown[];
    passed?: boolean;
  }>;
};
const routeAuditSourceFiles = parseDesignLabSourceFiles(routeAudit);
assert.ok(routeAuditSourceFiles, "route audit must declare canonical source files");
const sourceFingerprint = fingerprintRepositoryFiles(
  process.cwd(),
  routeAuditSourceFiles,
);
assert.equal(routeAudit.sourceSha256, sourceFingerprint.sha256);
assert.equal(routeAudit.sourceFileCount, sourceFingerprint.fileCount);

const routeResults = new Map(
  (routeAudit.results ?? []).map((result) => [result.route, result] as const),
);
for (const screen of productionScreens) {
  const result = routeResults.get(screen.route);
  assert.ok(result, `${screen.route}: missing current-source route evidence`);
  assert.equal(result.samplePath, screen.concreteRoute);
  assert.equal(result.status, 200);
  assert.equal(result.demoHeader, "full-access-read-only");
  assert.equal(result.hasMain, true);
  assert.equal(result.hasH1, true);
  assert.equal(result.hasReactStreamError, false);
  assert.deepEqual(result.errorMarkers, []);
  assert.equal(result.passed, true);
}

console.log(
  "Production screen coverage passed: 80 verified interaction screens, 27 form exclusions, 4 action exclusions, 84 tested permission screens, 84 verified state screens, 75 tested contextual production onboarding routes, 9 redirect exclusions, 84 default Design Lab fixtures",
);
