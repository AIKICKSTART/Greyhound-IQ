import type {
  CoverageClaim,
  EvidenceRef,
  FamilyScreenManifest,
  NonEmpty,
} from "./types";
import { ADMIN_DEVICE_FRAMES } from "../admin-control-centre-frame-lab";
import { DESIGN_LAB_ROLES } from "../design-lab-role-blueprints";
import {
  DOCK_ACTION_REGISTRY,
  DOCK_SKIN_REGISTRY,
} from "../dock-skin-catalogue";
import { DESIGN_LAB_AREAS } from "../design-lab-workspace";
import {
  DESIGN_LAB_SCENARIO_DIMENSIONS,
  DESIGN_LAB_SCENARIO_STATE_REQUIREMENT_VALUES,
} from "../design-lab-scenario-contract";
import { getOnboardingRouteTour } from "../onboarding-tour-registry";
import { MARKETPLACE_TEMPLATE_OPTIONS } from "../marketplace-template-variants";
import {
  PROTOTYPE_DEVICES,
  PROTOTYPE_VARIANTS,
} from "../prototype-variants";
import {
  DESIGN_LAB_SCREEN_PERMISSION_CONTRACTS,
  SCREEN_PERMISSION_EVIDENCE_TEST,
} from "./screen-permission-evidence";
import {
  PRODUCTION_SCREEN_DESIGN_LAB_ONBOARDING_EVIDENCE_TEST,
  PRODUCTION_SCREEN_MARKETPLACE_ONBOARDING_EVIDENCE_TEST,
  productionScreenCoverage,
} from "./production-screen-coverage";

export type DesignLabAcceptanceScenario = {
  given: string;
  when: string;
  then: string;
};

export type DesignLabUserStory = FamilyScreenManifest["userStories"][number] & {
  acceptance: NonEmpty<DesignLabAcceptanceScenario>;
};

export type DesignLabUserStoryManifest = Omit<
  FamilyScreenManifest,
  "userStories"
> & {
  userStories: readonly DesignLabUserStory[];
};

const MANIFEST_PATH =
  "src/components/screen-contracts/design-lab-user-stories.ts";
const TEST_PATH =
  "src/components/screen-contracts/design-lab-user-stories.test.ts";
const TEST_ID = "DL-STORY-MANIFEST";
const RUNTIME_TEST_PATH = "scripts/audit-design-lab-user-stories.test.ts";
const RUNTIME_TEST_ID = "DL-STORY-RUNTIME";
const RUNTIME_EVIDENCE_PATH =
  "output/demo-route-audit/design-lab-user-stories.json";
const HYDRATED_TEST_PATH = "scripts/audit-design-lab-hydrated-stories.test.ts";
const HYDRATED_TEST_ID = "DL-HYDRATED-STORY-RUNTIME";
const HYDRATED_WAVE2_TEST_PATH =
  "scripts/audit-design-lab-hydrated-wave2.test.ts";
const HYDRATED_WAVE2_TEST_ID = "DL-HYDRATED-WAVE2-RUNTIME";
const INVENTORY_TEST_PATH =
  "src/components/screen-contracts/design-lab-screen-inventory.test.ts";
const INVENTORY_TEST_ID = "DL-SCREEN-ATOMIC";
type UserStoryCoverageStatus = "captured" | "tested";

type ManifestAction = FamilyScreenManifest["actions"][number];
type ManifestState = FamilyScreenManifest["states"][number];
type ManifestTest = FamilyScreenManifest["tests"][number];
type DesignLabScreenInventory = Pick<
  FamilyScreenManifest,
  "actions" | "forms" | "states" | "designLab"
> & {
  sourcePaths: NonEmpty<string>;
  tests: NonEmpty<ManifestTest>;
};

function action(
  id: string,
  result: string,
  testIds: readonly string[],
  enforcement: string,
): ManifestAction {
  return { id, result, testIds, enforcement };
}

function state(
  id: string,
  testIds: readonly string[],
  fixtureId?: string,
): ManifestState {
  return { id, testIds, ...(fixtureId ? { fixtureId } : {}) };
}

function fixture(fixtureId: string, href: string) {
  return { fixtureId, href } as const;
}

const COMMON_TESTS = [
  { id: TEST_ID, path: TEST_PATH },
  { id: RUNTIME_TEST_ID, path: RUNTIME_TEST_PATH },
  { id: INVENTORY_TEST_ID, path: INVENTORY_TEST_PATH },
  SCREEN_PERMISSION_EVIDENCE_TEST,
] as const satisfies readonly ManifestTest[];

const HYDRATED_TEST = {
  id: HYDRATED_TEST_ID,
  path: HYDRATED_TEST_PATH,
} as const satisfies ManifestTest;

const HYDRATED_WAVE2_TEST = {
  id: HYDRATED_WAVE2_TEST_ID,
  path: HYDRATED_WAVE2_TEST_PATH,
} as const satisfies ManifestTest;

export const DESIGN_LAB_HYDRATED_INVENTORY_TESTED_ROUTES = [
  "/design-lab",
  "/design-lab/demo-experience",
  "/design-lab/dock-skins",
  "/design-lab/role-blueprints",
  "/feed/device-preview",
  "/marketplace/design-lab",
] as const;

const DESIGN_LAB_PERMISSION_CONTRACT_BY_ROUTE = new Map<
  string,
  (typeof DESIGN_LAB_SCREEN_PERMISSION_CONTRACTS)[number]
>(
  DESIGN_LAB_SCREEN_PERMISSION_CONTRACTS.map((contract) => [
    contract.route,
    contract,
  ] as const),
);

const WORKSPACE_TESTS = [
  { id: "DL-WORKSPACE-AREA", path: "src/components/design-lab-workspace.test.ts" },
  {
    id: "DL-WORKSPACE-SHELL",
    path: "src/components/design-lab-workspace-shell.test.ts",
  },
  {
    id: "DL-SCREEN-REGISTRY",
    path: "src/components/demo-experience-registry.test.ts",
  },
  {
    id: "DL-SCENARIO-STATE",
    path: "src/components/design-lab-scenario-state.test.ts",
  },
] as const satisfies readonly ManifestTest[];

const ADMIN_FRAME_TEST = {
  id: "DL-ADMIN-FRAME",
  path: "src/components/admin-control-centre-frame-lab.test.ts",
} as const satisfies ManifestTest;

const DOCK_TESTS = [
  {
    id: "DL-DOCK-CATALOGUE",
    path: "src/components/dock-skin-catalogue.test.ts",
  },
  {
    id: "DL-DOCK-VISUAL",
    path: "src/components/dock-skin-visual-contract.test.ts",
  },
] as const satisfies readonly ManifestTest[];

const ROLE_TESTS = [
  {
    id: "DL-ROLE-BLUEPRINT",
    path: "src/components/design-lab-role-blueprints.test.ts",
  },
  {
    id: "DL-PROTOTYPE-REGISTRY",
    path: "src/components/prototype-variants.test.ts",
  },
] as const satisfies readonly ManifestTest[];

const FEED_TESTS = [
  {
    id: "DL-REVIEW-MATRIX",
    path: "src/components/design-lab-review-matrix.test.ts",
  },
  ...ROLE_TESTS.slice(1),
  {
    id: "DL-APPEARANCE-PREVIEW",
    path: "src/components/appearance-preview-state.test.ts",
  },
] as const satisfies readonly ManifestTest[];

const MARKETPLACE_TEST = {
  id: "DL-MARKETPLACE-TEMPLATES",
  path: "src/app/marketplace/design-lab/marketplace-template-catalogue.test.ts",
} as const satisfies ManifestTest;

const scenarioFixtures = [
  fixture(
    "DL-SCENARIO-DOG-ATLAS",
    "/design-lab?area=screens&fixture=dog-atlas",
  ),
  fixture(
    "DL-SCENARIO-RACE-HARBOUR",
    "/design-lab?area=screens&fixture=race-harbour",
  ),
  fixture(
    "DL-SCENARIO-LISTING-STARTER",
    "/design-lab?area=screens&fixture=listing-starter",
  ),
];

const workspaceFixtures = [
  fixture("DL-WORKSPACE-DEFAULT", "/design-lab"),
  ...DESIGN_LAB_AREAS.map((area) =>
    fixture(
      `DL-WORKSPACE-AREA-${area.id.toUpperCase()}`,
      `/design-lab?area=${area.id}`,
    ),
  ),
  fixture("DL-WORKSPACE-FALLBACK", "/design-lab?area=unsupported"),
  ...scenarioFixtures,
];

const scenarioActions = [
  ...DESIGN_LAB_SCENARIO_DIMENSIONS.map((dimension) =>
    action(
      `DL.ACTION.SCENARIO.${dimension.key.toUpperCase()}.SELECT`,
      `Selects the allowlisted ${dimension.label.toLowerCase()} review value and persists ${dimension.queryParam} in the current URL.`,
      [HYDRATED_TEST_ID, "DL-SCENARIO-STATE"],
      "The client-only simulator resolves every value through the static scenario contract and never changes production state.",
    ),
  ),
  action(
    "DL.ACTION.SCENARIO.URL.COPY",
    "Copies the current reproducible Design Lab review URL.",
    [HYDRATED_TEST_ID, "DL-SCENARIO-STATE"],
    "The clipboard action copies window.location.href after allowlisted query-state changes.",
  ),
  action(
    "DL.ACTION.SCENARIO.DESTRUCTIVE.SIMULATE",
    "Shows a local destructive-action result without invoking a server mutation.",
    [HYDRATED_TEST_ID, "DL-SCENARIO-STATE"],
    "The button changes component state only; the hydrated audit rejects any mutating network request.",
  ),
];

const roleSelectionFixtures = DESIGN_LAB_ROLES.flatMap((role) =>
  PROTOTYPE_VARIANTS.map((variant) =>
    fixture(
      `DL-ROLE-${role.key.toUpperCase()}-${variant.key}`,
      `/design-lab/role-blueprints?role=${role.key}&variant=${variant.key}`,
    ),
  ),
);

const feedDimensionFixtures = [
  ...PROTOTYPE_DEVICES.map((device) =>
    fixture(
      `DL-FEED-DEVICE-${device.key.toUpperCase()}`,
      `/feed/device-preview?device=${device.key}&variant=A1&dock=D1&sponsored=on`,
    ),
  ),
  ...PROTOTYPE_VARIANTS.map((variant) =>
    fixture(
      `DL-FEED-VARIANT-${variant.key}`,
      `/feed/device-preview?device=mobile&variant=${variant.key}&dock=D1&sponsored=on`,
    ),
  ),
  ...DOCK_SKIN_REGISTRY.map((dock) =>
    fixture(
      `DL-FEED-DOCK-${dock.key}`,
      `/feed/device-preview?device=mobile&variant=A1&dock=${dock.key}&sponsored=on`,
    ),
  ),
  fixture(
    "DL-FEED-SPONSORED-ON",
    "/feed/device-preview?device=mobile&variant=A1&dock=D1&sponsored=on",
  ),
  fixture(
    "DL-FEED-SPONSORED-OFF",
    "/feed/device-preview?device=mobile&variant=A1&dock=D1&sponsored=off",
  ),
];

export const DESIGN_LAB_SCREEN_INVENTORIES: Readonly<
  Record<string, DesignLabScreenInventory>
> = {
  "/design-lab": {
    sourcePaths: [
      "src/app/design-lab/page.tsx",
      "src/components/design-lab-workspace.ts",
      "src/components/design-lab-workspace-shell.tsx",
      "src/components/design-lab-scenario-contract.ts",
      "src/components/design-lab-scenario-controls.tsx",
      "src/components/design-lab-scenario-state.ts",
      "src/components/demo-experience-screen-map.tsx",
    ],
    actions: [
      action(
        "DL.ACTION.AREA.SELECT",
        "Navigates to the selected Design Lab area through a GET-only query link.",
        [INVENTORY_TEST_ID, "DL-WORKSPACE-AREA"],
        "resolveDesignLabArea allowlists the seven area keys and falls back to overview.",
      ),
      action(
        "DL.ACTION.SCREEN.SEARCH",
        "Filters registered screen cards by route or user-story text in client state.",
        [INVENTORY_TEST_ID, "DL-SCREEN-REGISTRY"],
        "DemoExperienceScreenMap owns the local search state; it does not submit data.",
      ),
      action(
        "DL.ACTION.FAMILY.FILTER",
        "Filters the registry to one registered screen family in client state.",
        [INVENTORY_TEST_ID, "DL-SCREEN-REGISTRY"],
        "The select accepts only family keys emitted by DEMO_SCREEN_FAMILIES.",
      ),
      action(
        "DL.ACTION.SCREEN.OPEN",
        "Follows the selected registered screen's concrete GET route.",
        [INVENTORY_TEST_ID, "DL-SCREEN-REGISTRY"],
        "The canonical registry supplies the route or reviewed concrete sample href.",
      ),
      ...scenarioActions,
    ],
    forms: [],
    states: [
      state("DL.STATE.DEFAULT.OVERVIEW", [INVENTORY_TEST_ID, "DL-WORKSPACE-AREA"], "DL-WORKSPACE-DEFAULT"),
      ...DESIGN_LAB_AREAS.map((area) =>
        state(
          `DL.STATE.AREA.${area.id.toUpperCase()}`,
          [INVENTORY_TEST_ID, "DL-WORKSPACE-AREA"],
          `DL-WORKSPACE-AREA-${area.id.toUpperCase()}`,
        ),
      ),
      state("DL.STATE.SCREEN.FILTERED", [INVENTORY_TEST_ID, "DL-SCREEN-REGISTRY"]),
      state("DL.STATE.SCREEN.EMPTY", [INVENTORY_TEST_ID, "DL-SCREEN-REGISTRY"]),
      state("DL.STATE.FALLBACK.UNSUPPORTED-AREA", [INVENTORY_TEST_ID, "DL-WORKSPACE-AREA"], "DL-WORKSPACE-FALLBACK"),
      ...DESIGN_LAB_SCENARIO_STATE_REQUIREMENT_VALUES.map((scenarioState) =>
        state(
          `DL.STATE.SCENARIO.${scenarioState.toUpperCase()}`,
          [HYDRATED_TEST_ID, "DL-SCENARIO-STATE"],
          scenarioState === "offline"
            ? "DL-SCENARIO-DOG-ATLAS"
            : "DL-SCENARIO-RACE-HARBOUR",
        ),
      ),
    ],
    designLab: workspaceFixtures,
    tests: [
      ...COMMON_TESTS,
      PRODUCTION_SCREEN_DESIGN_LAB_ONBOARDING_EVIDENCE_TEST,
      HYDRATED_TEST,
      ...WORKSPACE_TESTS,
    ],
  },
  "/design-lab/demo-experience": {
    sourcePaths: [
      "src/app/design-lab/demo-experience/page.tsx",
      "src/components/admin-control-centre-frame-lab.tsx",
      "src/components/demo-experience-screen-map.tsx",
      "src/components/design-lab-workspace.ts",
    ],
    actions: [
      action("DL.ACTION.REGISTRY.SEARCH", "Filters registered screens by route or story text in client state.", [INVENTORY_TEST_ID, "DL-SCREEN-REGISTRY"], "The default registry owns local search state only."),
      action("DL.ACTION.REGISTRY.FAMILY.FILTER", "Filters the default registry by a registered family key.", [INVENTORY_TEST_ID, "DL-SCREEN-REGISTRY"], "The family select is populated from the canonical registry."),
      action("DL.ACTION.REGISTRY.SCREEN.OPEN", "Follows the selected registered screen's concrete GET route.", [INVENTORY_TEST_ID, "DL-SCREEN-REGISTRY"], "The canonical registry supplies the route or reviewed concrete sample href."),
      action("DL.ACTION.ADMIN-FRAMES.OPEN", "Navigates by GET to the isolated admin-frame review surface.", [INVENTORY_TEST_ID, RUNTIME_TEST_ID], "Only view=admin-frames selects the frame lab; unknown values fall back to the registry."),
      ...ADMIN_DEVICE_FRAMES.map((frame) =>
        action(
          `DL.ACTION.VIEWPORT.${frame.key.toUpperCase()}.SELECT`,
          `Selects the ${frame.label} Control Centre iframe in local component state.`,
          [INVENTORY_TEST_ID, "DL-ADMIN-FRAME"],
          "The allowlisted tab switches one iframe; no server mutation is issued.",
        ),
      ),
      action("DL.ACTION.REGISTRY.RETURN", "Returns by GET to the default screen registry.", [INVENTORY_TEST_ID, "DL-ADMIN-FRAME"], "A fixed internal Link targets /design-lab/demo-experience."),
      action("DL.ACTION.ADMIN.OPEN-FULL", "Opens the protected /admin route in a new tab.", [INVENTORY_TEST_ID, "DL-ADMIN-FRAME"], "Normal /admin authorization remains authoritative."),
      action("DL.ACTION.ADMIN-FRAMES.RELOAD", "Reloads the admin-frame GET route.", [INVENTORY_TEST_ID, "DL-ADMIN-FRAME"], "A fixed same-origin Link reloads view=admin-frames."),
    ],
    forms: [],
    states: [
      state("DL.STATE.REGISTRY.DEFAULT", [INVENTORY_TEST_ID, RUNTIME_TEST_ID], "DL-DEMO-REGISTRY"),
      state("DL.STATE.REGISTRY.FILTERED", [INVENTORY_TEST_ID, "DL-SCREEN-REGISTRY"]),
      state("DL.STATE.REGISTRY.EMPTY", [INVENTORY_TEST_ID, "DL-SCREEN-REGISTRY"]),
      state("DL.STATE.ADMIN-FRAME.DESKTOP", [INVENTORY_TEST_ID, "DL-ADMIN-FRAME"], "DL-DEMO-ADMIN-FRAMES"),
      ...ADMIN_DEVICE_FRAMES.slice(1).map((frame) =>
        state(`DL.STATE.ADMIN-FRAME.${frame.key.toUpperCase()}`, [INVENTORY_TEST_ID, "DL-ADMIN-FRAME"]),
      ),
      state("DL.STATE.FALLBACK.UNSUPPORTED-VIEW", [INVENTORY_TEST_ID, RUNTIME_TEST_ID], "DL-DEMO-FALLBACK"),
    ],
    designLab: [
      fixture("DL-DEMO-REGISTRY", "/design-lab/demo-experience"),
      fixture("DL-DEMO-ADMIN-FRAMES", "/design-lab/demo-experience?view=admin-frames"),
      fixture("DL-DEMO-FALLBACK", "/design-lab/demo-experience?view=unsupported"),
    ],
    tests: [
      ...COMMON_TESTS,
      PRODUCTION_SCREEN_DESIGN_LAB_ONBOARDING_EVIDENCE_TEST,
      HYDRATED_TEST,
      ...WORKSPACE_TESTS.slice(2, 3),
      ADMIN_FRAME_TEST,
    ],
  },
  "/design-lab/dock-skins": {
    sourcePaths: [
      "src/app/design-lab/dock-skins/page.tsx",
      "src/components/dock-skin-catalogue.ts",
      "src/components/dock-skin-catalogue-preview.tsx",
    ],
    actions: [
      ...DOCK_SKIN_REGISTRY.map((skin) =>
        action(`DL.ACTION.DOCK.${skin.key}.SELECT`, `Selects ${skin.key} ${skin.label} and resets the preview action to Home.`, [INVENTORY_TEST_ID, "DL-DOCK-CATALOGUE"], "The allowlisted skin button changes client state only."),
      ),
      ...DOCK_ACTION_REGISTRY.map((dockAction) =>
        action(`DL.ACTION.DOCK-ACTION.${dockAction.key.toUpperCase()}.SELECT`, `Selects the ${dockAction.label} semantic dock action in the preview.`, [INVENTORY_TEST_ID, "DL-DOCK-CATALOGUE", "DL-DOCK-VISUAL"], "The fixed five-action registry changes preview state only."),
      ),
    ],
    forms: [],
    states: [
      state("DL.STATE.DEFAULT.D1", [INVENTORY_TEST_ID, "DL-DOCK-CATALOGUE"], "DL-DOCK-DEFAULT"),
      ...DOCK_SKIN_REGISTRY.map((skin) => state(`DL.STATE.DOCK.${skin.key}`, [INVENTORY_TEST_ID, "DL-DOCK-CATALOGUE"], `DL-DOCK-${skin.key}`)),
      ...DOCK_ACTION_REGISTRY.map((dockAction) => state(`DL.STATE.DOCK-ACTION.${dockAction.key.toUpperCase()}`, [INVENTORY_TEST_ID, "DL-DOCK-VISUAL"])),
      state("DL.STATE.FALLBACK.UNSUPPORTED-DOCK", [INVENTORY_TEST_ID, RUNTIME_TEST_ID], "DL-DOCK-FALLBACK"),
    ],
    designLab: [
      fixture("DL-DOCK-DEFAULT", "/design-lab/dock-skins"),
      ...DOCK_SKIN_REGISTRY.map((skin) => fixture(`DL-DOCK-${skin.key}`, `/design-lab/dock-skins?dock=${skin.key}`)),
      fixture("DL-DOCK-FALLBACK", "/design-lab/dock-skins?dock=unsupported"),
    ],
    tests: [
      ...COMMON_TESTS,
      PRODUCTION_SCREEN_DESIGN_LAB_ONBOARDING_EVIDENCE_TEST,
      HYDRATED_TEST,
      ...DOCK_TESTS,
    ],
  },
  "/design-lab/role-blueprints": {
    sourcePaths: [
      "src/app/design-lab/role-blueprints/page.tsx",
      "src/components/design-lab-role-blueprints.ts",
      "src/components/design-lab-role-blueprint-preview.tsx",
      "src/components/prototype-variants.ts",
    ],
    actions: [
      ...DESIGN_LAB_ROLES.map((role) => action(`DL.ACTION.ROLE.${role.key.toUpperCase()}.SELECT`, `Navigates by GET to the ${role.label} role while preserving the selected template.`, [INVENTORY_TEST_ID, "DL-ROLE-BLUEPRINT"], "isDesignLabRole allowlists the role query value.")),
      ...PROTOTYPE_VARIANTS.map((variant) => action(`DL.ACTION.ROLE-VARIANT.${variant.key}.SELECT`, `Navigates by GET to template ${variant.key} while preserving the selected role.`, [INVENTORY_TEST_ID, "DL-PROTOTYPE-REGISTRY"], "isPrototypeVariant allowlists the variant query value.")),
    ],
    forms: [],
    states: [
      state("DL.STATE.DEFAULT.BUSINESS-A1", [INVENTORY_TEST_ID, "DL-ROLE-BLUEPRINT"], "DL-ROLE-DEFAULT"),
      ...roleSelectionFixtures.map((selection) => state(`DL.STATE.SELECTION.${selection.fixtureId.slice("DL-ROLE-".length)}`, [INVENTORY_TEST_ID, "DL-ROLE-BLUEPRINT", "DL-PROTOTYPE-REGISTRY"], selection.fixtureId)),
      state("DL.STATE.FALLBACK.UNSUPPORTED-SELECTION", [INVENTORY_TEST_ID, RUNTIME_TEST_ID], "DL-ROLE-FALLBACK"),
    ],
    designLab: [
      fixture("DL-ROLE-DEFAULT", "/design-lab/role-blueprints"),
      ...roleSelectionFixtures,
      fixture("DL-ROLE-FALLBACK", "/design-lab/role-blueprints?role=unsupported&variant=Z9"),
    ],
    tests: [
      ...COMMON_TESTS,
      PRODUCTION_SCREEN_DESIGN_LAB_ONBOARDING_EVIDENCE_TEST,
      HYDRATED_WAVE2_TEST,
      ...ROLE_TESTS,
    ],
  },
  "/feed/device-preview": {
    sourcePaths: [
      "src/app/feed/device-preview/page.tsx",
      "src/components/design-lab-review-matrix.ts",
      "src/components/prototype-variants.ts",
      "src/components/dock-skin-catalogue.ts",
      "src/components/appearance-preview-state.ts",
    ],
    actions: [
      ...PROTOTYPE_DEVICES.map((device) => action(`DL.ACTION.FEED-DEVICE.${device.key.toUpperCase()}.SELECT`, `Navigates by GET to the ${device.label} frame while preserving variant, dock, and sponsored values.`, [INVENTORY_TEST_ID, "DL-REVIEW-MATRIX"], "isPrototypeDevice allowlists the device query value.")),
      ...PROTOTYPE_VARIANTS.map((variant) => action(`DL.ACTION.FEED-VARIANT.${variant.key}.SELECT`, `Navigates by GET to Feed variant ${variant.key} while preserving device, dock, and sponsored values.`, [INVENTORY_TEST_ID, "DL-PROTOTYPE-REGISTRY"], "isPrototypeVariant allowlists the variant query value.")),
      ...DOCK_SKIN_REGISTRY.map((dock) => action(`DL.ACTION.FEED-DOCK.${dock.key}.SELECT`, `Navigates by GET to dock ${dock.key} while preserving device, variant, and sponsored values.`, [INVENTORY_TEST_ID, "DL-REVIEW-MATRIX"], "isDockSkinKey allowlists the dock query value.")),
    ],
    forms: [],
    states: [
      state("DL.STATE.DEFAULT.MOBILE-A1-D1-SPONSORED-ON", [INVENTORY_TEST_ID, "DL-REVIEW-MATRIX", "DL-APPEARANCE-PREVIEW"], "DL-FEED-DEFAULT"),
      ...feedDimensionFixtures.map((selection) => state(`DL.STATE.${selection.fixtureId.slice("DL-FEED-".length)}`, [INVENTORY_TEST_ID, "DL-REVIEW-MATRIX", "DL-APPEARANCE-PREVIEW"], selection.fixtureId)),
      state("DL.STATE.SELECTION.SUPPORTED", [INVENTORY_TEST_ID, "DL-REVIEW-MATRIX"], "DL-FEED-SUPPORTED"),
      state("DL.STATE.FALLBACK.UNSUPPORTED-SELECTION", [INVENTORY_TEST_ID, RUNTIME_TEST_ID], "DL-FEED-FALLBACK"),
    ],
    designLab: [
      fixture("DL-FEED-DEFAULT", "/feed/device-preview"),
      ...feedDimensionFixtures,
      fixture("DL-FEED-SUPPORTED", "/feed/device-preview?device=tablet&variant=C2&dock=D6&sponsored=off"),
      fixture("DL-FEED-FALLBACK", "/feed/device-preview?device=unsupported&variant=Z9&dock=D9&sponsored=unexpected"),
    ],
    tests: [
      ...COMMON_TESTS,
      PRODUCTION_SCREEN_DESIGN_LAB_ONBOARDING_EVIDENCE_TEST,
      HYDRATED_WAVE2_TEST,
      ...FEED_TESTS,
    ],
  },
  "/marketplace/design-lab": {
    sourcePaths: [
      "src/app/marketplace/design-lab/page.tsx",
      "src/components/marketplace-template-catalogue.tsx",
      "src/components/marketplace-template-variants.ts",
      "src/components/marketplace-template-data.ts",
    ],
    actions: [
      ...MARKETPLACE_TEMPLATE_OPTIONS.map((template) => action(`DL.ACTION.MARKETPLACE.${template.key}.SELECT`, `Navigates by GET to Marketplace template ${template.key} ${template.label}.`, [INVENTORY_TEST_ID, "DL-MARKETPLACE-TEMPLATES"], "resolveMarketplaceTemplateKey allowlists M1 through M6.")),
      action("DL.ACTION.MARKETPLACE.PROFILE.OPEN", "Follows a representative public-profile link from the isolated review data.", [INVENTORY_TEST_ID, "DL-MARKETPLACE-TEMPLATES"], "Profile hrefs come from the fixed review fixture catalogue; no listing mutation is exposed."),
    ],
    forms: [],
    states: [
      state("DL.STATE.DEFAULT.M1", [INVENTORY_TEST_ID, "DL-MARKETPLACE-TEMPLATES"], "DL-MARKETPLACE-DEFAULT"),
      ...MARKETPLACE_TEMPLATE_OPTIONS.map((template) => state(`DL.STATE.MARKETPLACE.${template.key}`, [INVENTORY_TEST_ID, "DL-MARKETPLACE-TEMPLATES"], `DL-MARKETPLACE-${template.key}`)),
      state("DL.STATE.FALLBACK.UNSUPPORTED-TEMPLATE", [INVENTORY_TEST_ID, RUNTIME_TEST_ID], "DL-MARKETPLACE-FALLBACK"),
    ],
    designLab: [
      fixture("DL-MARKETPLACE-DEFAULT", "/marketplace/design-lab"),
      ...MARKETPLACE_TEMPLATE_OPTIONS.map((template) => fixture(`DL-MARKETPLACE-${template.key}`, `/marketplace/design-lab?template=${template.key}`)),
      fixture("DL-MARKETPLACE-FALLBACK", "/marketplace/design-lab?template=unsupported"),
    ],
    tests: [
      ...COMMON_TESTS,
      PRODUCTION_SCREEN_MARKETPLACE_ONBOARDING_EVIDENCE_TEST,
      HYDRATED_WAVE2_TEST,
      MARKETPLACE_TEST,
      FEED_TESTS[0],
    ],
  },
};

function coverage(
  route: string,
  pageSource: string,
  status: UserStoryCoverageStatus,
  inventory: DesignLabScreenInventory,
  onboarding: CoverageClaim | undefined,
): FamilyScreenManifest["coverage"] {
  const permissionContract = DESIGN_LAB_PERMISSION_CONTRACT_BY_ROUTE.get(route);
  if (!permissionContract || permissionContract.sourcePath !== pageSource) {
    throw new Error(`Missing Design Lab permission contract for ${route}`);
  }
  const userStoryEvidence = [
    { kind: "source", path: pageSource },
    { kind: "source", path: MANIFEST_PATH },
    { kind: "test", path: TEST_PATH, testId: TEST_ID },
    {
      kind: "test",
      path: RUNTIME_TEST_PATH,
      testId: RUNTIME_TEST_ID,
    },
    ...(inventory.tests.some((test) => test.id === HYDRATED_TEST_ID)
      ? [
          {
            kind: "test" as const,
            path: HYDRATED_TEST_PATH,
            testId: HYDRATED_TEST_ID,
          },
        ]
      : []),
    { kind: "route-audit", path: RUNTIME_EVIDENCE_PATH, route },
  ] as const satisfies NonEmpty<EvidenceRef>;
  const userStories: CoverageClaim =
    status === "tested"
      ? { status: "tested", evidence: userStoryEvidence }
      : { status: "captured", evidence: userStoryEvidence };
  const [firstSourcePath, ...remainingSourcePaths] = inventory.sourcePaths;
  const sourceEvidence: NonEmpty<EvidenceRef> = [
    { kind: "source", path: firstSourcePath },
    ...remainingSourcePaths.map(
      (path): EvidenceRef => ({ kind: "source", path }),
    ),
  ];
  const atomicTestEvidence = {
    kind: "test",
    path: INVENTORY_TEST_PATH,
    testId: INVENTORY_TEST_ID,
  } as const satisfies EvidenceRef;
  const capturedEvidence: NonEmpty<EvidenceRef> = [
    ...sourceEvidence,
    atomicTestEvidence,
    { kind: "route-audit", path: RUNTIME_EVIDENCE_PATH, route },
  ];
  const hydratedInventoryTest = inventory.tests.find(
    (test) =>
      test.id === HYDRATED_TEST_ID || test.id === HYDRATED_WAVE2_TEST_ID,
  );
  const hydratedInventoryTested =
    DESIGN_LAB_HYDRATED_INVENTORY_TESTED_ROUTES.some(
      (testedRoute) => testedRoute === route,
    ) && hydratedInventoryTest !== undefined;
  const inventoryEvidence: NonEmpty<EvidenceRef> = hydratedInventoryTested
    ? [
        ...capturedEvidence,
        {
          kind: "test",
          path: hydratedInventoryTest.path,
          testId: hydratedInventoryTest.id,
        },
      ]
    : capturedEvidence;
  const inventoryCoverage: CoverageClaim = hydratedInventoryTested
    ? { status: "tested", evidence: inventoryEvidence }
    : { status: "captured", evidence: inventoryEvidence };
  const permissionEvidence: NonEmpty<EvidenceRef> = [
    { kind: "source", path: pageSource },
    { kind: "source", path: "src/lib/design-lab-access-policy.ts" },
    { kind: "source", path: "src/lib/design-lab-access.ts" },
    { kind: "source", path: "src/lib/auth.ts" },
    { kind: "source", path: "src/lib/auth-roles.ts" },
    {
      kind: "test",
      path: SCREEN_PERMISSION_EVIDENCE_TEST.path,
      testId: SCREEN_PERMISSION_EVIDENCE_TEST.id,
    },
  ];
  const [firstTest, ...remainingTests] = inventory.tests;
  const testEvidence: NonEmpty<EvidenceRef> = [
    { kind: "test", path: firstTest.path, testId: firstTest.id },
    ...remainingTests.map(
      (test): EvidenceRef => ({
        kind: "test",
        path: test.path,
        testId: test.id,
      }),
    ),
  ];

  return {
    route: { status: "not-started", evidence: [] },
    userStories,
    actions: inventoryCoverage,
    forms: {
      status: "excluded",
      exclusion: {
        kind: "not-applicable",
        owner: "Design Lab screen-contract owner",
        rationale:
          "DL-SCREEN-ATOMIC scans the route page's complete local TS/TSX import closure and found no form or submission path; iframe documents, where present, remain separately owned route contracts.",
      },
      evidence: [...sourceEvidence, atomicTestEvidence],
    },
    permissions: { status: "tested", evidence: permissionEvidence },
    states: inventoryCoverage,
    designLab: inventoryCoverage,
    onboarding: onboarding ?? { status: "not-started", evidence: [] },
    tests: { status: "verified", evidence: testEvidence },
  };
}

function manifest({
  route,
  pageSource,
  userStories,
  userStoriesStatus = "captured",
}: {
  route: string;
  pageSource: string;
  userStories: readonly DesignLabUserStory[];
  userStoriesStatus?: UserStoryCoverageStatus;
}): DesignLabUserStoryManifest {
  const inventory = DESIGN_LAB_SCREEN_INVENTORIES[route];
  const permissionContract = DESIGN_LAB_PERMISSION_CONTRACT_BY_ROUTE.get(route);
  if (!inventory) {
    throw new Error(`Missing Design Lab screen inventory for ${route}`);
  }
  if (!permissionContract || permissionContract.sourcePath !== pageSource) {
    throw new Error(`Missing Design Lab permission contract for ${route}`);
  }
  const onboardingCoverage = productionScreenCoverage({
    screenId: `screen:${route}`,
    route,
    concreteRoute: route,
    sourcePath: pageSource,
    routeAuditPassed: false,
  }).onboarding;
  const onboardingTour = getOnboardingRouteTour(route);
  if (Boolean(onboardingCoverage) !== Boolean(onboardingTour)) {
    throw new Error(`Design Lab onboarding evidence mismatch for ${route}`);
  }
  return {
    route,
    userStories,
    actions: inventory.actions,
    forms: inventory.forms,
    permissions: permissionContract.permissions,
    states: inventory.states,
    designLab: inventory.designLab,
    onboarding: onboardingTour ? [{ tourId: onboardingTour.tourId }] : [],
    tests: inventory.tests,
    coverage: coverage(
      route,
      pageSource,
      userStoriesStatus,
      inventory,
      onboardingCoverage,
    ),
  };
}

export const DESIGN_LAB_USER_STORY_MANIFESTS: readonly DesignLabUserStoryManifest[] =
  [
    manifest({
      route: "/design-lab",
      pageSource: "src/app/design-lab/page.tsx",
      userStoriesStatus: "tested",
      userStories: [
        {
          id: "DL.STORY.CONTRACT-WORKSPACE",
          actor: "Authorised Design Lab reviewer",
          outcome:
            "Inspect every registered screen family, filter its routes, and see fail-closed delivery and release evidence without using production data.",
          acceptance: [
            {
              given:
                "The reviewer has Design Lab access in an approved local or preview environment.",
              when: "They open /design-lab, choose the shareable Screen library module, and filter by family.",
              then: "Only matching registered routes remain, each route retains its contract status and evidence summary, and the canonical gate stays visible in the mission-control ribbon.",
            },
            {
              given: "At least one required production check is incomplete.",
              when: "The reviewer reads the delivery and release sections.",
              then: "The incomplete work is visible and production promotion remains locked.",
            },
            {
              given:
                "The Screen library contains registered routes whose route or user-story text may match the reviewer's query.",
              when:
                "The reviewer enters search text in the Screen library search control.",
              then:
                "Only matching registered routes remain; a query with no matches renders the zero-result count, and the canonical gate remains visible.",
            },
          ],
        },
      ],
    }),
    manifest({
      route: "/design-lab/demo-experience",
      pageSource: "src/app/design-lab/demo-experience/page.tsx",
      userStoriesStatus: "tested",
      userStories: [
        {
          id: "DL.STORY.DEMO-EXPERIENCE",
          actor: "Authorised experience reviewer",
          outcome:
            "Review the complete route and user-story registry, then switch to one interactive Control Centre device shell without duplicating protected backend work.",
          acceptance: [
            {
              given: "The route has no view query parameter.",
              when: "The reviewer opens /design-lab/demo-experience.",
              then: "The searchable screen registry is shown as the default review surface.",
            },
            {
              given: "The reviewer requests view=admin-frames.",
              when: "They select a supported Control Centre viewport.",
              then: "Exactly one live protected shell is presented with a route back to the screen registry.",
            },
          ],
        },
      ],
    }),
    manifest({
      route: "/design-lab/dock-skins",
      pageSource: "src/app/design-lab/dock-skins/page.tsx",
      userStoriesStatus: "tested",
      userStories: [
        {
          id: "DL.STORY.DOCK-SKINS",
          actor: "Mobile navigation reviewer",
          outcome:
            "Compare dock skins D1 through D6 against the same five-action contract and observe the selected action without changing production navigation.",
          acceptance: [
            {
              given: "The dock query parameter names a supported skin.",
              when: "The reviewer opens the catalogue and selects any skin or dock action.",
              then: "The preview reflects that skin and action while the five semantic destinations remain unchanged.",
            },
            {
              given: "The dock query parameter is missing or unsupported.",
              when: "The catalogue loads.",
              then: "D1 is selected safely and no production dock setting is mutated.",
            },
          ],
        },
      ],
    }),
    manifest({
      route: "/design-lab/role-blueprints",
      pageSource: "src/app/design-lab/role-blueprints/page.tsx",
      userStoriesStatus: "tested",
      userStories: [
        {
          id: "DL.STORY.ROLE-BLUEPRINTS",
          actor: "Role-experience reviewer",
          outcome:
            "Compare Business, Trainer, Owner, and Punter priorities across app templates A1 through C2 with the selected role and template preserved in the URL.",
          acceptance: [
            {
              given:
                "The role and variant query parameters name supported options.",
              when: "The reviewer switches either selector.",
              then: "The matching role priorities and template composition are rendered and the other selection is preserved.",
            },
            {
              given: "Either query parameter is missing or unsupported.",
              when: "The reviewer loads the role blueprint route.",
              then: "The preview falls back to the Business role and A1 template without an error.",
            },
          ],
        },
      ],
    }),
    manifest({
      route: "/feed/device-preview",
      pageSource: "src/app/feed/device-preview/page.tsx",
      userStoriesStatus: "tested",
      userStories: [
        {
          id: "DL.STORY.FEED-DEVICE-PREVIEW",
          actor: "Responsive Feed reviewer",
          outcome:
            "Reproduce a Feed review frame by device, app variant, dock skin, and sponsored-Marketplace visibility, with stable component IDs and dimensions for recording.",
          acceptance: [
            {
              given:
                "A supported device, variant, dock, and sponsored state are selected.",
              when: "The reviewer changes one selector.",
              then: "The URL preserves the other selections and the iframe target receives the resolved review combination.",
            },
            {
              given: "The selected review combination is rendered.",
              when: "The reviewer inspects the recording summary and frame.",
              then: "The frame exposes its stable review ID, target, dimensions, and sponsored visibility without production persistence.",
            },
          ],
        },
      ],
    }),
    manifest({
      route: "/marketplace/design-lab",
      pageSource: "src/app/marketplace/design-lab/page.tsx",
      userStoriesStatus: "tested",
      userStories: [
        {
          id: "DL.STORY.MARKETPLACE-TEMPLATES",
          actor: "Marketplace experience reviewer",
          outcome:
            "Compare Marketplace templates M1 through M6 using isolated review fixtures and follow their representative profile links without creating or changing a listing.",
          acceptance: [
            {
              given: "The template query parameter names M1 through M6.",
              when: "The reviewer switches templates.",
              then: "Exactly the selected layout family is rendered and its route is reproducible from the URL.",
            },
            {
              given: "The template query parameter is missing or unsupported.",
              when: "The reviewer loads the Marketplace template catalogue.",
              then: "The default template is rendered from isolated review data with no production persistence path.",
            },
          ],
        },
      ],
    }),
  ] as const;
