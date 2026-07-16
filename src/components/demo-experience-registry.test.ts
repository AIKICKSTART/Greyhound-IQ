import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  DEMO_SCREEN_COUNT,
  DEMO_SCREEN_FAMILIES,
  DEMO_ROUTE_AUDIT_EXPECTED_ROWS,
  DEMO_ROUTE_AUDIT_EVALUATION,
  DEMO_USER_JOURNEYS,
  SCREEN_CONTRACT_BY_ROUTE,
  SCREEN_CONTRACTS,
  SCREEN_CONTRACT_CHECKLIST,
  SCREEN_CONTRACT_COVERAGE_AREAS,
} from "./demo-experience-registry";
import { getOnboardingRouteTour } from "./onboarding-tour-registry";
import {
  PRODUCTION_SCREEN_ACTION_EXCLUSION_ROUTES,
  PRODUCTION_SCREEN_FORM_EXCLUSION_ROUTES,
  PRODUCTION_SCREEN_INTERACTION_CONTRACTS,
  PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS,
} from "./screen-contracts/production-screen-coverage";
import { PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_CONTRACTS } from "./screen-contracts/production-screen-admin-access-state-evidence";
import {
  PRODUCTION_SCREEN_MESSAGING_PERMISSION_CONTRACTS,
  PRODUCTION_SCREEN_MESSAGING_STATE_CONTRACTS,
} from "./screen-contracts/production-screen-messaging-access-state-evidence";
import {
  PRODUCTION_SCREEN_MEMBER_PERMISSION_CONTRACTS,
  PRODUCTION_SCREEN_MEMBER_STATE_CONTRACTS,
} from "./screen-contracts/production-screen-member-access-state-evidence";
import {
  DESIGN_LAB_SCREEN_PERMISSION_CONTRACTS,
  PUBLIC_SCREEN_PERMISSION_CONTRACTS,
} from "./screen-contracts/screen-permission-evidence";
import { PRODUCTION_SCREEN_STATE_CONTRACTS } from "./screen-contracts/screen-state-evidence";

// screen-evidence-test-id: DL-SCREEN-REGISTRY

const screenMapSource = readFileSync(
  join(__dirname, "demo-experience-screen-map.tsx"),
  "utf8",
);
const routeAuditSource = readFileSync(
  join(__dirname, "../../scripts/audit-demo-routes.ts"),
  "utf8",
);
const registrySource = readFileSync(
  join(__dirname, "demo-experience-registry.ts"),
  "utf8",
);
const contractInspectorSource = readFileSync(
  join(__dirname, "design-lab-contract-inspector-prototype.tsx"),
  "utf8",
);

const screens = DEMO_SCREEN_FAMILIES.flatMap((family) => family.screens);
const productionFormExclusions = new Set<string>(
  PRODUCTION_SCREEN_FORM_EXCLUSION_ROUTES,
);
const productionActionExclusions = new Set<string>(
  PRODUCTION_SCREEN_ACTION_EXCLUSION_ROUTES,
);
const passedRouteAudits = new Set(DEMO_ROUTE_AUDIT_EVALUATION.passedRoutes);
const designLabRoutes = new Set(
  DESIGN_LAB_SCREEN_PERMISSION_CONTRACTS.map(({ route }) => route),
);
const permissionContractByRoute = new Map<
  string,
  | (typeof PUBLIC_SCREEN_PERMISSION_CONTRACTS)[number]
  | (typeof DESIGN_LAB_SCREEN_PERMISSION_CONTRACTS)[number]
  | (typeof PRODUCTION_SCREEN_MESSAGING_PERMISSION_CONTRACTS)[number]
  | (typeof PRODUCTION_SCREEN_MEMBER_PERMISSION_CONTRACTS)[number]
  | (typeof PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_CONTRACTS)[number]
>(
  [
    ...PUBLIC_SCREEN_PERMISSION_CONTRACTS,
    ...DESIGN_LAB_SCREEN_PERMISSION_CONTRACTS,
    ...PRODUCTION_SCREEN_MESSAGING_PERMISSION_CONTRACTS,
    ...PRODUCTION_SCREEN_MEMBER_PERMISSION_CONTRACTS,
    ...PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_CONTRACTS,
  ].map((contract) => [contract.route, contract] as const),
);
const stateContractByRoute = new Map<
  string,
  | (typeof PRODUCTION_SCREEN_STATE_CONTRACTS)[number]
  | (typeof PRODUCTION_SCREEN_MESSAGING_STATE_CONTRACTS)[number]
  | (typeof PRODUCTION_SCREEN_MEMBER_STATE_CONTRACTS)[number]
  | (typeof PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_CONTRACTS)[number]
>(
  [
    ...PRODUCTION_SCREEN_STATE_CONTRACTS,
    ...PRODUCTION_SCREEN_MESSAGING_STATE_CONTRACTS,
    ...PRODUCTION_SCREEN_MEMBER_STATE_CONTRACTS,
    ...PRODUCTION_SCREEN_ADMIN_ACCESS_STATE_CONTRACTS,
  ].map((contract) => [contract.route, contract] as const),
);
const auditRowsByRoute = new Map(
  DEMO_ROUTE_AUDIT_EXPECTED_ROWS.map((row) => [row.route, row] as const),
);
assert.equal(DEMO_SCREEN_COUNT, 97);
assert.equal(DEMO_SCREEN_COUNT, SCREEN_CONTRACTS.length);
assert.equal(
  new Set(screens.map((screen) => screen.route)).size,
  DEMO_SCREEN_COUNT,
);
assert.equal(
  new Set(SCREEN_CONTRACTS.map((screen) => screen.id)).size,
  DEMO_SCREEN_COUNT,
);
assert.equal(SCREEN_CONTRACT_BY_ROUTE.size, DEMO_SCREEN_COUNT);
assert.equal(DEMO_SCREEN_FAMILIES.length, 8);
assert.equal(DEMO_USER_JOURNEYS.length, 22);
assert.equal(permissionContractByRoute.size, 97);
assert.equal(stateContractByRoute.size, 91);
assert.equal(
  registrySource.match(/export const DEMO_SCREEN_FAMILIES/g)?.length,
  1,
  "the machine-readable screen registry must have one canonical declaration",
);
assert.match(
  registrySource,
  /export const DEMO_ROUTE_AUDIT_EXPECTED_ROWS\s*=\s*DEMO_SCREEN_FAMILIES\.flatMap\(/,
  "route-audit rows must remain derived from the canonical screen registry",
);
assert.match(
  registrySource,
  /export const SCREEN_CONTRACTS: readonly ScreenContract\[\] =\s*DEMO_SCREEN_FAMILIES\.flatMap\(/,
  "screen contracts must remain derived from the canonical screen registry",
);
assert.match(
  registrySource,
  /export const SCREEN_CONTRACT_BY_ROUTE = new Map\(\s*SCREEN_CONTRACTS\.map\(/,
  "the route lookup must remain derived from the screen contracts",
);
assert.deepEqual(
  SCREEN_CONTRACTS.map((screen) => screen.route).toSorted(),
  findPageRoutes(join(__dirname, "../app")).toSorted(),
);
for (const screen of screens) {
  assert.ok(screen.route.startsWith("/"));
  assert.equal((screen.href ?? screen.route).includes("["), false);
}
for (const family of DEMO_SCREEN_FAMILIES) {
  assert.ok(family.userStory.startsWith("As a"));
  assert.ok(family.acceptance.length >= 4);
}
for (const screen of SCREEN_CONTRACTS) {
  const family = DEMO_SCREEN_FAMILIES.find((candidate) =>
    candidate.screens.some(({ route }) => route === screen.route),
  );
  assert.ok(family, `${screen.route} must belong to one screen family`);
  const familyScreen = family.screens.find(
    ({ route }) => route === screen.route,
  );
  assert.ok(familyScreen, `${screen.route} must have a family screen record`);
  assert.equal(screen.id, `screen:${screen.route}`);
  assert.equal(SCREEN_CONTRACT_BY_ROUTE.get(screen.route), screen);
  assert.equal(screen.concreteRoute, familyScreen.href ?? familyScreen.route);
  assert.equal(
    auditRowsByRoute.get(screen.route)?.samplePath,
    screen.concreteRoute,
    `${screen.route} runtime-audit sample must use its concrete route`,
  );
  assert.equal(screen.concreteRoute.includes("["), false);
  assert.equal(
    matchesRoutePattern(screen.route, screen.concreteRoute),
    true,
    `${screen.concreteRoute} must satisfy ${screen.route}`,
  );
  assert.equal(
    screen.routePattern,
    screen.route.includes("[") ? screen.route : undefined,
  );
  assert.deepEqual(screen.dynamicParameters, routeParameters(screen.route));
  assert.ok(screen.title.length > 0);
  assert.equal(screen.productArea, family.label);
  assert.equal(
    screen.description,
    familyScreen.userStory?.outcome ?? family.userStory,
  );
  assert.deepEqual(screen.actors, [
    familyScreen.userStory?.actor ?? family.audience,
  ]);
  assert.ok(screen.actors.length > 0);
  assert.ok(
    ["public", "optional", "required"].includes(screen.authentication),
    `${screen.route} must record an explicit authentication state`,
  );
  assert.ok(screen.roles.length > 0);
  assert.ok(screen.tiers.length > 0);
  assert.ok(screen.entryPoints.length > 0);
  assert.ok(screen.supportedStates.length > 0);
  assert.ok(Array.isArray(screen.designLabFixtureIds));
  if (screen.designLabFixtureIds.length === 0) {
    assert.notEqual(screen.coverage.designLab.status, "verified");
    assert.notEqual(screen.coverage.designLab.status, "tested");
  }
  assert.ok(screen.sourceFiles.length > 0);
  assert.deepEqual(screen.sourceFiles, [
    screen.route === "/"
      ? "src/app/page.tsx"
      : `src/app${screen.route}/page.tsx`,
  ]);
  for (const sourceFile of screen.sourceFiles) {
    assert.ok(existsSync(join(process.cwd(), sourceFile)), sourceFile);
    const source = readFileSync(join(process.cwd(), sourceFile), "utf8");
    const explicitlyNoindex = routeHasStaticNoindex(
      join(process.cwd(), sourceFile),
    );
    assert.equal(
      screen.noindex,
      explicitlyNoindex,
      `${screen.route} noindex must match its page metadata`,
    );
    if (family.key === "design-lab") {
      assert.match(
        source,
        /await requireDesignLabReviewer\(\)/,
        `${screen.route} must retain its production access gate`,
      );
    }
    if (screen.route === "/account/appearance") {
      assert.match(
        source,
        /NODE_ENV === "production"[\s\S]*ENABLE_DEVICE_PREVIEWS !== "true"[\s\S]*notFound\(\)/,
        `${screen.route} must retain its production preview gate`,
      );
    }
  }
  const permissionContract = permissionContractByRoute.get(screen.route);
  assert.deepEqual(
    screen.permissionRules,
    permissionContract?.permissions ?? [],
    `${screen.route}: permission rules must mirror the focused contract`,
  );
  assert.equal(
    screen.coverage.permissions.status,
    permissionContract ? "tested" : "captured",
    `${screen.route}: permission coverage must remain evidence-derived`,
  );
  assert.deepEqual(
    Object.keys(screen.coverage).toSorted(),
    [...SCREEN_CONTRACT_COVERAGE_AREAS].toSorted(),
  );
  assert.equal(
    screen.productionEnabled,
    family.key !== "design-lab" && screen.route !== "/account/appearance",
  );
  if (family.key !== "design-lab") {
    const interactionContract =
      PRODUCTION_SCREEN_INTERACTION_CONTRACTS[
        screen.route as keyof typeof PRODUCTION_SCREEN_INTERACTION_CONTRACTS
      ];
    assert.equal(
      screen.coverage.forms.status,
      productionFormExclusions.has(screen.route)
        ? "excluded"
        : interactionContract
          ? "verified"
          : "not-started",
    );
    assert.equal(
      screen.coverage.actions.status,
      productionActionExclusions.has(screen.route)
        ? "excluded"
        : interactionContract
          ? "verified"
          : "not-started",
    );
    assert.deepEqual(screen.queryParameters, [
      ...(interactionContract?.queryParameters ?? []),
    ]);
    assert.deepEqual(
      screen.primaryActions,
      interactionContract?.actions.map((action) => action.id) ?? [],
    );
    assert.deepEqual(
      screen.forms,
      interactionContract?.forms.map(
        (form) => `${form.id} -> ${form.submitsTo}`,
      ) ?? [],
    );
    assert.equal(
      screen.coverage.designLab.status,
      passedRouteAudits.has(screen.route) ? "tested" : "captured",
    );
    assert.deepEqual(screen.designLabFixtureIds, [
      `DL.DEFAULT:${screen.route}`,
    ]);
    const stateContract = stateContractByRoute.get(screen.route);
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
      stateContract
        ? stateContract.states.map((state) => state.id)
        : ["default"],
    );
    const onboardingTour = getOnboardingRouteTour(screen.route);
    assert.equal(
      screen.coverage.onboarding.status,
      screen.route in PRODUCTION_SCREEN_ONBOARDING_REDIRECT_EXCLUSIONS
        ? "excluded"
        : onboardingTour
          ? "tested"
          : "not-started",
    );
    assert.equal(screen.onboardingTourId, onboardingTour?.tourId);
  }
}
assert.equal(
  SCREEN_CONTRACT_CHECKLIST.length,
  SCREEN_CONTRACT_COVERAGE_AREAS.length,
);
for (const item of SCREEN_CONTRACT_CHECKLIST) {
  assert.equal(item.total, DEMO_SCREEN_COUNT);
  assert.equal(item.completed + item.remaining + item.blocked, item.total);
}
assert.deepEqual(
  Object.fromEntries(
    SCREEN_CONTRACT_CHECKLIST.map((item) => [item.area, item.completed]),
  ),
  {
    route: passedRouteAudits.size,
    userStories: 97,
    actions: 97,
    forms: 97,
    permissions: 97,
    states: 97,
    designLab: new Set([...passedRouteAudits, ...designLabRoutes]).size,
    onboarding: 97,
    tests: 97,
  },
);
assert.match(
  screenMapSource,
  /function Metric[\s\S]*<dt className="text-\[10px\]/,
);
assert.match(screenMapSource, /data-design-lab-audit-checklist/);
assert.match(screenMapSource, /DEMO_SCREEN_FAMILIES\.map\(\(family\) =>/);
assert.match(screenMapSource, /SCREEN_CONTRACT_BY_ROUTE\.get\(/);
assert.match(routeAuditSource, /DEMO_SCREEN_FAMILIES\.flatMap\(\(family\) =>/);
assert.match(contractInspectorSource, /label="Supported states"/);
assert.match(contractInspectorSource, /values=\{contract\.supportedStates\}/);

console.log("demo experience registry tests passed");

function findPageRoutes(directory: string, segments: string[] = []): string[] {
  const routes: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === "api") continue;
      routes.push(
        ...findPageRoutes(join(directory, entry.name), [
          ...segments,
          entry.name,
        ]),
      );
      continue;
    }
    if (entry.name === "page.tsx") {
      routes.push(segments.length === 0 ? "/" : `/${segments.join("/")}`);
    }
  }
  return routes;
}

function routeParameters(route: string) {
  return Array.from(
    route.matchAll(/\[+\.\.\.(\w+)\]|\[(\w+)\]/g),
    (match) => match[1] ?? match[2],
  );
}

function matchesRoutePattern(pattern: string, concreteRoute: string) {
  const patternSegments = pattern.split("/").filter(Boolean);
  const concreteSegments = concreteRoute.split("/").filter(Boolean);

  for (let index = 0; index < patternSegments.length; index += 1) {
    const patternSegment = patternSegments[index];
    if (/^\[\[\.\.\.\w+\]\]$/.test(patternSegment)) return true;
    if (/^\[\.\.\.\w+\]$/.test(patternSegment)) {
      return concreteSegments.length > index;
    }
    const concreteSegment = concreteSegments[index];
    if (!concreteSegment) return false;
    if (/^\[\w+\]$/.test(patternSegment)) continue;
    if (patternSegment !== concreteSegment) return false;
  }

  return concreteSegments.length === patternSegments.length;
}

function routeHasStaticNoindex(
  sourcePath: string,
  visited = new Set<string>(),
): boolean {
  if (visited.has(sourcePath)) return false;
  visited.add(sourcePath);
  const source = readFileSync(sourcePath, "utf8");
  if (
    /export\s+const\s+metadata(?:\s*:\s*[^=]+)?\s*=\s*\{[\s\S]{0,1600}?robots\s*:\s*\{[\s\S]{0,180}?index\s*:\s*false/.test(
      source,
    )
  ) {
    return true;
  }
  const generateMetadataStart = source.indexOf(
    "export async function generateMetadata",
  );
  if (generateMetadataStart >= 0) {
    const generateMetadataEnd = source.indexOf(
      "export default",
      generateMetadataStart,
    );
    const generateMetadataSource = source.slice(
      generateMetadataStart,
      generateMetadataEnd >= 0 ? generateMetadataEnd : source.length,
    );
    const returnedObjects = Array.from(
      generateMetadataSource.matchAll(/\breturn\s*\{([\s\S]*?)\n\s*\};/g),
      (match) => match[1] ?? "",
    );
    if (
      returnedObjects.length > 0 &&
      returnedObjects.every((returnedObject) =>
        /robots\s*:\s*\{[\s\S]{0,180}?index\s*:\s*false/.test(
          returnedObject,
        ),
      )
    ) {
      return true;
    }
  }
  if (!/export\s*\{\s*metadata\s*\}/.test(source)) return false;
  const importedMetadata = source.match(
    /import[\s\S]{0,180}?\bmetadata\b[\s\S]{0,180}?from\s+["']([^"']+)["']/,
  );
  if (!importedMetadata?.[1]?.startsWith(".")) return false;
  const importedPath = join(
    sourcePath.slice(0, Math.max(sourcePath.lastIndexOf("/"), sourcePath.lastIndexOf("\\"))),
    `${importedMetadata[1]}.tsx`,
  );
  return existsSync(importedPath)
    ? routeHasStaticNoindex(importedPath, visited)
    : false;
}
