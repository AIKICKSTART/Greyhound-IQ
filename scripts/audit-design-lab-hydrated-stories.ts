import { spawn, type ChildProcess } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  DESIGN_LAB_SAFE_RUNTIME_CONTRACT_FILES,
  fingerprintRepositoryFiles,
  getDesignLabSourceFingerprint,
  getDesignLabSourcePaths,
  getRepositoryHeadSha,
  parseDesignLabSourceFiles,
} from "./design-lab-source-fingerprint";
import {
  DESIGN_LAB_STORY_AUDIT_PATH,
  DESIGN_LAB_STORY_RUNTIME_CASES,
  findDesignLabStoryAuditIssues,
} from "./audit-design-lab-user-stories";
import {
  DEMO_SCREEN_FAMILIES,
  SCREEN_CONTRACT_BY_ROUTE,
  SCREEN_CONTRACTS,
  SCREEN_CONTRACT_COVERAGE_AREAS,
} from "../src/components/demo-experience-registry";
import {
  DESIGN_LAB_DATA_STATE_VALUES,
  DESIGN_LAB_ERROR_STATE_VALUES,
  DESIGN_LAB_SCENARIO_DIMENSIONS,
  DESIGN_LAB_SCENARIO_STATE_REQUIREMENT_VALUES,
} from "../src/components/design-lab-scenario-contract";
import { resolveDesignLabScenarioState } from "../src/components/design-lab-scenario-state";

export const DESIGN_LAB_HYDRATED_STORY_AUDIT_PATH =
  "output/demo-route-audit/design-lab-hydrated-stories.json";
export const DESIGN_LAB_HYDRATED_EVIDENCE_BOUNDARY =
  "Isolated loopback full-access-read-only interaction evidence; not cryptographic deployed-image identity.";

export const DESIGN_LAB_COMBINED_ACCEPTANCE_COVERAGE = [
  {
    acceptanceId: "DL.STORY.CONTRACT-WORKSPACE.1",
    httpScenarioIds: ["DL.STORY.CONTRACT-WORKSPACE.1"],
    hydratedScenarioIds: ["DL.STORY.CONTRACT-WORKSPACE.HYDRATED"],
  },
  {
    acceptanceId: "DL.STORY.CONTRACT-WORKSPACE.2",
    httpScenarioIds: ["DL.STORY.CONTRACT-WORKSPACE.2"],
    hydratedScenarioIds: ["DL.STORY.CONTRACT-WORKSPACE.HYDRATED"],
  },
  {
    acceptanceId: "DL.STORY.CONTRACT-WORKSPACE.3",
    httpScenarioIds: ["DL.STORY.CONTRACT-WORKSPACE.3"],
    hydratedScenarioIds: ["DL.STORY.CONTRACT-WORKSPACE.HYDRATED"],
  },
  {
    acceptanceId: "DL.STORY.DEMO-EXPERIENCE.1",
    httpScenarioIds: ["DL.STORY.DEMO-EXPERIENCE.1"],
    hydratedScenarioIds: [],
  },
  {
    acceptanceId: "DL.STORY.DEMO-EXPERIENCE.2",
    httpScenarioIds: ["DL.STORY.DEMO-EXPERIENCE.2"],
    hydratedScenarioIds: ["DL.STORY.DEMO-EXPERIENCE.HYDRATED"],
  },
  {
    acceptanceId: "DL.STORY.DOCK-SKINS.1",
    httpScenarioIds: ["DL.STORY.DOCK-SKINS.1"],
    hydratedScenarioIds: ["DL.STORY.DOCK-SKINS.HYDRATED"],
  },
  {
    acceptanceId: "DL.STORY.DOCK-SKINS.2",
    httpScenarioIds: ["DL.STORY.DOCK-SKINS.2"],
    hydratedScenarioIds: [
      "DL.STORY.DOCK-SKINS.UNSUPPORTED-FALLBACK.HYDRATED",
      "DL.STORY.DOCK-SKINS.MISSING-FALLBACK.HYDRATED",
    ],
  },
] as const;

const WORKSPACE_SAMPLE_CONTRACT = SCREEN_CONTRACT_BY_ROUTE.get("/dogs/[id]");
if (!WORKSPACE_SAMPLE_CONTRACT) {
  throw new Error("The hydrated workspace audit requires the /dogs/[id] screen contract.");
}
const workspaceCoverageKeys = Object.keys(
  WORKSPACE_SAMPLE_CONTRACT.coverage,
).toSorted();
if (
  JSON.stringify(workspaceCoverageKeys) !==
  JSON.stringify([...SCREEN_CONTRACT_COVERAGE_AREAS].toSorted())
) {
  throw new Error(
    "The /dogs/[id] screen contract must expose the exact registry coverage areas.",
  );
}
const WORKSPACE_COMPLETE_COVERAGE_COUNT = SCREEN_CONTRACT_COVERAGE_AREAS.filter(
  (area) =>
    ["verified", "tested", "excluded"].includes(
      WORKSPACE_SAMPLE_CONTRACT.coverage[area].status,
    ),
).length;
const WORKSPACE_COVERAGE_BADGE_TITLES = SCREEN_CONTRACT_COVERAGE_AREAS.map(
  (area) =>
    `${area.replace(/([a-z])([A-Z])/g, "$1 $2")}: ${WORKSPACE_SAMPLE_CONTRACT.coverage[area].status}`,
);
const RACING_SCREEN_ROUTE_COUNT = 10;
if (
  DEMO_SCREEN_FAMILIES.find((family) => family.key === "racing")?.screens
    .length !== RACING_SCREEN_ROUTE_COUNT
) {
  throw new Error(
    `The hydrated family-filter audit expects exactly ${RACING_SCREEN_ROUTE_COUNT} racing routes.`,
  );
}

type HydratedScenarioMode =
  | "workspace-filter"
  | "workspace-scenario-controls"
  | "workspace-default-area-navigation"
  | "workspace-fixture"
  | "workspace-screen-open"
  | "demo-viewports"
  | "demo-registry"
  | "demo-fixture"
  | "demo-registry-return"
  | "demo-admin-open-full"
  | "demo-reload"
  | "dock-interactions"
  | "dock-fixture";

type HydratedStoryCaseDefinition = {
  id: string;
  route:
    | "/design-lab"
    | "/design-lab/demo-experience"
    | "/design-lab/dock-skins";
  requestPath: string;
  mode: HydratedScenarioMode;
  expectedObserved: unknown;
  expectedPopupPaths?: readonly string[];
};

function workspaceFixtureCase(
  id: string,
  requestPath: string,
  activeArea: string,
  heading: string,
): HydratedStoryCaseDefinition {
  return {
    id,
    route: "/design-lab",
    requestPath,
    mode: "workspace-fixture",
    expectedObserved: {
      currentPath: requestPath,
      activeArea,
      heading,
      currentNavigationHref: `/design-lab?area=${activeArea}`,
    },
  };
}

function dockFixtureCase(
  id: string,
  requestPath: string,
  selectedSkin: string,
): HydratedStoryCaseDefinition {
  return {
    id,
    route: "/design-lab/dock-skins",
    requestPath,
    mode: "dock-fixture",
    expectedObserved: {
      currentPath: requestPath,
      selectedSkin,
      selectedSkinKeys: [selectedSkin],
      dockSkin: selectedSkin,
      activeAction: "home",
      activeReadout: "Selected action Home",
    },
  };
}

const SCENARIO_CONTROL_REQUEST_PATH =
  "/design-lab?area=screens&fixture=race-harbour&tier=business&auth=signed-out&permissions=admin&featureFlags=advertising&orientation=landscape&navigation=compact&theme=light&sponsoredDemo=off&state=stale&networkState=slow&errorState=permission-denied&longContent=on&missingImage=on&tour=safety&tourStep=4&reducedMotion=on&highContrast=on";
const SCENARIO_CONTROL_INITIAL_STATE = resolveDesignLabScenarioState(
  new URL(SCENARIO_CONTROL_REQUEST_PATH, "http://localhost").searchParams,
);
const SCENARIO_CONTROL_FINAL_STATE = {
  ...SCENARIO_CONTROL_INITIAL_STATE,
  dataState: DESIGN_LAB_DATA_STATE_VALUES.at(-1)!,
  errorState: DESIGN_LAB_ERROR_STATE_VALUES.at(-1)!,
  networkState: "slow",
};

export const DESIGN_LAB_HYDRATED_STORY_CASES: readonly HydratedStoryCaseDefinition[] = [
  {
    id: "DL.STORY.CONTRACT-WORKSPACE.HYDRATED",
    route: "/design-lab",
    requestPath: "/design-lab?area=screens",
    mode: "workspace-filter",
    expectedObserved: {
      initialRouteCount: SCREEN_CONTRACTS.length,
      familyFiltered: {
        query: "",
        family: "racing",
        routeCount: RACING_SCREEN_ROUTE_COUNT,
        familyKeys: ["racing"],
      },
      searchFiltered: {
        query: "/dogs/[id]",
        family: "all",
        routeCount: 1,
        familyKeys: ["racing"],
        routeHrefs: ["/dogs/demo-provider-dog"],
      },
      empty: {
        query: "no-screen-can-match-this",
        family: "all",
        routeCount: 0,
        familyCount: 0,
        status: `Showing 0 of ${SCREEN_CONTRACTS.length} registered screens.`,
      },
      coverageSummary: `${WORKSPACE_COMPLETE_COVERAGE_COUNT}/${SCREEN_CONTRACT_COVERAGE_AREAS.length} complete`,
      coverageBadgeTitles: WORKSPACE_COVERAGE_BADGE_TITLES,
      ribbonVisible: true,
      ribbonReleaseText: "Production locked",
    },
  },
  {
    id: "DL.INVENTORY.WORKSPACE.SCENARIO-CONTROLS.HYDRATED",
    route: "/design-lab",
    requestPath: SCENARIO_CONTROL_REQUEST_PATH,
    mode: "workspace-scenario-controls",
    expectedObserved: {
      controlCount: DESIGN_LAB_SCENARIO_DIMENSIONS.length,
      controlQueryParams: DESIGN_LAB_SCENARIO_DIMENSIONS.map(
        (dimension) => dimension.queryParam,
      ),
      initialValues: SCENARIO_CONTROL_INITIAL_STATE,
      dataStateCoverage: DESIGN_LAB_DATA_STATE_VALUES,
      errorStateCoverage: DESIGN_LAB_ERROR_STATE_VALUES,
      networkStateCoverage: ["online", "offline", "slow"],
      finalValues: SCENARIO_CONTROL_FINAL_STATE,
      preview: {
        dataState: DESIGN_LAB_DATA_STATE_VALUES.at(-1),
        errorState: DESIGN_LAB_ERROR_STATE_VALUES.at(-1),
        networkState: "slow",
        destructiveSimulation: "complete",
      },
      copyButtonPresent: true,
      syntheticBoundaryPresent: true,
      accessBoundaryPresent: true,
    },
  },
  {
    id: "DL.INVENTORY.WORKSPACE.DEFAULT-AREA-NAV.HYDRATED",
    route: "/design-lab",
    requestPath: "/design-lab",
    mode: "workspace-default-area-navigation",
    expectedObserved: {
      initial: {
        currentPath: "/design-lab",
        activeArea: "overview",
        heading: "Overview",
        currentNavigationHref: "/design-lab?area=overview",
      },
      clickedHref: "/design-lab?area=screens",
      currentPath: "/design-lab?area=screens",
      activeArea: "screens",
      heading: "Screen library",
      currentNavigationHref: "/design-lab?area=screens",
    },
  },
  workspaceFixtureCase(
    "DL.INVENTORY.WORKSPACE.AREA-DELIVERY.HYDRATED",
    "/design-lab?area=delivery",
    "delivery",
    "Delivery",
  ),
  workspaceFixtureCase(
    "DL.INVENTORY.WORKSPACE.AREA-ARCHITECTURE.HYDRATED",
    "/design-lab?area=architecture",
    "architecture",
    "Architecture",
  ),
  workspaceFixtureCase(
    "DL.INVENTORY.WORKSPACE.AREA-ADVERTISING.HYDRATED",
    "/design-lab?area=advertising",
    "advertising",
    "Advertising",
  ),
  workspaceFixtureCase(
    "DL.INVENTORY.WORKSPACE.AREA-REQUIREMENTS.HYDRATED",
    "/design-lab?area=requirements",
    "requirements",
    "Final to-do",
  ),
  workspaceFixtureCase(
    "DL.INVENTORY.WORKSPACE.AREA-READINESS.HYDRATED",
    "/design-lab?area=readiness",
    "readiness",
    "Readiness",
  ),
  workspaceFixtureCase(
    "DL.INVENTORY.WORKSPACE.UNSUPPORTED-FALLBACK.HYDRATED",
    "/design-lab?area=unsupported",
    "overview",
    "Overview",
  ),
  {
    id: "DL.INVENTORY.WORKSPACE.SCREEN-OPEN.HYDRATED",
    route: "/design-lab",
    requestPath: "/design-lab?area=screens",
    mode: "workspace-screen-open",
    expectedObserved: {
      clickedHref: "/dogs/demo-provider-dog",
      currentPath: "/dogs/demo-provider-dog",
    },
  },
  {
    id: "DL.STORY.DEMO-EXPERIENCE.HYDRATED",
    route: "/design-lab/demo-experience",
    requestPath: "/design-lab/demo-experience",
    mode: "demo-viewports",
    expectedObserved: {
      adminFramesClickedHref:
        "/design-lab/demo-experience?view=admin-frames",
      currentPath: "/design-lab/demo-experience?view=admin-frames",
      transitions: [
        {
          from: "desktop",
          to: "mobile",
          tabId: "admin-control-centre-mobile-tab",
          tabAriaSelected: "true",
          tabIndex: "0",
          panelLabelledBy: "admin-control-centre-mobile-tab",
          iframeTitle: "Mobile interactive Control Centre",
          iframeSrc: "/admin",
          iframeWidth: "390",
          iframeHeight: "844",
        },
        {
          from: "mobile",
          to: "desktop",
          tabId: "admin-control-centre-desktop-tab",
          tabAriaSelected: "true",
          tabIndex: "0",
          panelLabelledBy: "admin-control-centre-desktop-tab",
          iframeTitle: "Desktop interactive Control Centre",
          iframeSrc: "/admin",
          iframeWidth: "1440",
          iframeHeight: "1000",
        },
        {
          from: "desktop",
          to: "tablet",
          tabId: "admin-control-centre-tablet-tab",
          tabAriaSelected: "true",
          tabIndex: "0",
          panelLabelledBy: "admin-control-centre-tablet-tab",
          iframeTitle: "Tablet interactive Control Centre",
          iframeSrc: "/admin",
          iframeWidth: "834",
          iframeHeight: "1112",
        },
      ],
      selectedViewport: "tablet",
      iframeCount: 1,
      registryHref: "/design-lab/demo-experience",
      openFullHref: "/admin",
      openFullTarget: "_blank",
      reloadHref: "/design-lab/demo-experience?view=admin-frames",
    },
  },
  {
    id: "DL.INVENTORY.DEMO.REGISTRY.HYDRATED",
    route: "/design-lab/demo-experience",
    requestPath: "/design-lab/demo-experience",
    mode: "demo-registry",
    expectedObserved: {
      default: {
        currentPath: "/design-lab/demo-experience",
        activeArea: "screens",
        routeCount: SCREEN_CONTRACTS.length,
      },
      familyFiltered: {
        query: "",
        family: "racing",
        routeCount: RACING_SCREEN_ROUTE_COUNT,
        familyKeys: ["racing"],
      },
      searchFiltered: {
        query: "/dogs/[id]",
        family: "all",
        routeCount: 1,
        routeHrefs: ["/dogs/demo-provider-dog"],
      },
      empty: {
        query: "no-screen-can-match-this",
        family: "all",
        routeCount: 0,
      },
      clickedHref: "/dogs/demo-provider-dog",
      currentPath: "/dogs/demo-provider-dog",
    },
  },
  {
    id: "DL.INVENTORY.DEMO.UNSUPPORTED-FALLBACK.HYDRATED",
    route: "/design-lab/demo-experience",
    requestPath: "/design-lab/demo-experience?view=unsupported",
    mode: "demo-fixture",
    expectedObserved: {
      currentPath: "/design-lab/demo-experience?view=unsupported",
      surface: "registry",
      activeArea: "screens",
      currentNavigationHref: "/design-lab/demo-experience?area=screens",
    },
  },
  {
    id: "DL.INVENTORY.DEMO.REGISTRY-RETURN.HYDRATED",
    route: "/design-lab/demo-experience",
    requestPath: "/design-lab/demo-experience?view=admin-frames",
    mode: "demo-registry-return",
    expectedObserved: {
      clickedHref: "/design-lab/demo-experience",
      currentPath: "/design-lab/demo-experience",
      surface: "registry",
      activeArea: "screens",
    },
  },
  {
    id: "DL.INVENTORY.DEMO.ADMIN-OPEN-FULL.HYDRATED",
    route: "/design-lab/demo-experience",
    requestPath: "/design-lab/demo-experience?view=admin-frames",
    mode: "demo-admin-open-full",
    expectedPopupPaths: ["/admin"],
    expectedObserved: {
      clickedHref: "/admin",
      target: "_blank",
      surfaceRetained: true,
    },
  },
  {
    id: "DL.INVENTORY.DEMO.RELOAD.HYDRATED",
    route: "/design-lab/demo-experience",
    requestPath: "/design-lab/demo-experience?view=admin-frames",
    mode: "demo-reload",
    expectedObserved: {
      clickedHref: "/design-lab/demo-experience?view=admin-frames",
      currentPath: "/design-lab/demo-experience?view=admin-frames",
      reloaded: true,
      surface: "admin-frames",
    },
  },
  {
    id: "DL.STORY.DOCK-SKINS.HYDRATED",
    route: "/design-lab/dock-skins",
    requestPath: "/design-lab/dock-skins?dock=D1",
    mode: "dock-interactions",
    expectedObserved: {
      skinTransitions: [
        { from: "D1", to: "D2" },
        { from: "D2", to: "D1" },
        { from: "D1", to: "D3" },
        { from: "D3", to: "D4" },
        { from: "D4", to: "D5" },
        { from: "D5", to: "D6" },
      ].map((transition) => ({
        ...transition,
        selectedSkin: transition.to,
        ariaPressed: "true",
        dataSelected: "true",
        activeAction: "home",
        activeReadout: "Selected action Home",
      })),
      actionTransitions: [
        { from: "home", to: "feed", activeReadout: "Selected action Feed" },
        { from: "feed", to: "post", activeReadout: "Selected action Post" },
        { from: "post", to: "chat", activeReadout: "Selected action Chat" },
        { from: "chat", to: "menu", activeReadout: "Selected action Menu" },
        { from: "menu", to: "home", activeReadout: "Selected action Home" },
      ].map((transition) => ({
        ...transition,
        activeAction: transition.to,
        ariaPressed: "true",
        dataActive: "true",
      })),
      selectedSkin: "D6",
      selectedSkinKeys: ["D6"],
      dockSkin: "D6",
      actionKeys: ["home", "feed", "post", "chat", "menu"],
      activeAction: "home",
      activeReadout: "Selected action Home",
    },
  },
  dockFixtureCase(
    "DL.STORY.DOCK-SKINS.UNSUPPORTED-FALLBACK.HYDRATED",
    "/design-lab/dock-skins?dock=unsupported",
    "D1",
  ),
  dockFixtureCase(
    "DL.STORY.DOCK-SKINS.MISSING-FALLBACK.HYDRATED",
    "/design-lab/dock-skins",
    "D1",
  ),
  dockFixtureCase(
    "DL.INVENTORY.DOCK.D2.HYDRATED",
    "/design-lab/dock-skins?dock=D2",
    "D2",
  ),
  dockFixtureCase(
    "DL.INVENTORY.DOCK.D3.HYDRATED",
    "/design-lab/dock-skins?dock=D3",
    "D3",
  ),
  dockFixtureCase(
    "DL.INVENTORY.DOCK.D4.HYDRATED",
    "/design-lab/dock-skins?dock=D4",
    "D4",
  ),
  dockFixtureCase(
    "DL.INVENTORY.DOCK.D5.HYDRATED",
    "/design-lab/dock-skins?dock=D5",
    "D5",
  ),
  dockFixtureCase(
    "DL.INVENTORY.DOCK.D6.HYDRATED",
    "/design-lab/dock-skins?dock=D6",
    "D6",
  ),
];

export type DesignLabHydratedInventoryCoverage = {
  scenarioId: string;
  route: HydratedStoryCaseDefinition["route"];
  actionIds: readonly string[];
  stateIds: readonly string[];
  fixtureIds: readonly string[];
};

export const DESIGN_LAB_HYDRATED_INVENTORY_COVERAGE = [
  {
    scenarioId: "DL.STORY.CONTRACT-WORKSPACE.HYDRATED",
    route: "/design-lab",
    actionIds: ["DL.ACTION.SCREEN.SEARCH", "DL.ACTION.FAMILY.FILTER"],
    stateIds: ["DL.STATE.SCREEN.FILTERED", "DL.STATE.SCREEN.EMPTY"],
    fixtureIds: [],
  },
  {
    scenarioId: "DL.INVENTORY.WORKSPACE.SCENARIO-CONTROLS.HYDRATED",
    route: "/design-lab",
    actionIds: [
      ...DESIGN_LAB_SCENARIO_DIMENSIONS.map(
        (dimension) =>
          `DL.ACTION.SCENARIO.${dimension.key.toUpperCase()}.SELECT`,
      ),
      "DL.ACTION.SCENARIO.URL.COPY",
      "DL.ACTION.SCENARIO.DESTRUCTIVE.SIMULATE",
    ],
    stateIds: DESIGN_LAB_SCENARIO_STATE_REQUIREMENT_VALUES.map(
      (state) => `DL.STATE.SCENARIO.${state.toUpperCase()}`,
    ),
    fixtureIds: [
      "DL-SCENARIO-DOG-ATLAS",
      "DL-SCENARIO-RACE-HARBOUR",
      "DL-SCENARIO-LISTING-STARTER",
    ],
  },
  {
    scenarioId: "DL.INVENTORY.WORKSPACE.DEFAULT-AREA-NAV.HYDRATED",
    route: "/design-lab",
    actionIds: ["DL.ACTION.AREA.SELECT"],
    stateIds: [
      "DL.STATE.DEFAULT.OVERVIEW",
      "DL.STATE.AREA.OVERVIEW",
      "DL.STATE.AREA.SCREENS",
    ],
    fixtureIds: [
      "DL-WORKSPACE-DEFAULT",
      "DL-WORKSPACE-AREA-OVERVIEW",
      "DL-WORKSPACE-AREA-SCREENS",
    ],
  },
  ...[
    ["DELIVERY", "DL.STATE.AREA.DELIVERY", "DL-WORKSPACE-AREA-DELIVERY"],
    ["ARCHITECTURE", "DL.STATE.AREA.ARCHITECTURE", "DL-WORKSPACE-AREA-ARCHITECTURE"],
    ["ADVERTISING", "DL.STATE.AREA.ADVERTISING", "DL-WORKSPACE-AREA-ADVERTISING"],
    ["REQUIREMENTS", "DL.STATE.AREA.REQUIREMENTS", "DL-WORKSPACE-AREA-REQUIREMENTS"],
    ["READINESS", "DL.STATE.AREA.READINESS", "DL-WORKSPACE-AREA-READINESS"],
  ].map(([key, stateId, fixtureId]) => ({
    scenarioId: `DL.INVENTORY.WORKSPACE.AREA-${key}.HYDRATED`,
    route: "/design-lab" as const,
    actionIds: [],
    stateIds: [stateId],
    fixtureIds: [fixtureId],
  })),
  {
    scenarioId: "DL.INVENTORY.WORKSPACE.UNSUPPORTED-FALLBACK.HYDRATED",
    route: "/design-lab",
    actionIds: [],
    stateIds: ["DL.STATE.FALLBACK.UNSUPPORTED-AREA"],
    fixtureIds: ["DL-WORKSPACE-FALLBACK"],
  },
  {
    scenarioId: "DL.INVENTORY.WORKSPACE.SCREEN-OPEN.HYDRATED",
    route: "/design-lab",
    actionIds: ["DL.ACTION.SCREEN.OPEN"],
    stateIds: [],
    fixtureIds: [],
  },
  {
    scenarioId: "DL.STORY.DEMO-EXPERIENCE.HYDRATED",
    route: "/design-lab/demo-experience",
    actionIds: [
      "DL.ACTION.ADMIN-FRAMES.OPEN",
      "DL.ACTION.VIEWPORT.DESKTOP.SELECT",
      "DL.ACTION.VIEWPORT.TABLET.SELECT",
      "DL.ACTION.VIEWPORT.MOBILE.SELECT",
    ],
    stateIds: [
      "DL.STATE.ADMIN-FRAME.DESKTOP",
      "DL.STATE.ADMIN-FRAME.TABLET",
      "DL.STATE.ADMIN-FRAME.MOBILE",
    ],
    fixtureIds: ["DL-DEMO-ADMIN-FRAMES"],
  },
  {
    scenarioId: "DL.INVENTORY.DEMO.REGISTRY.HYDRATED",
    route: "/design-lab/demo-experience",
    actionIds: [
      "DL.ACTION.REGISTRY.SEARCH",
      "DL.ACTION.REGISTRY.FAMILY.FILTER",
      "DL.ACTION.REGISTRY.SCREEN.OPEN",
    ],
    stateIds: [
      "DL.STATE.REGISTRY.DEFAULT",
      "DL.STATE.REGISTRY.FILTERED",
      "DL.STATE.REGISTRY.EMPTY",
    ],
    fixtureIds: ["DL-DEMO-REGISTRY"],
  },
  {
    scenarioId: "DL.INVENTORY.DEMO.UNSUPPORTED-FALLBACK.HYDRATED",
    route: "/design-lab/demo-experience",
    actionIds: [],
    stateIds: ["DL.STATE.FALLBACK.UNSUPPORTED-VIEW"],
    fixtureIds: ["DL-DEMO-FALLBACK"],
  },
  {
    scenarioId: "DL.INVENTORY.DEMO.REGISTRY-RETURN.HYDRATED",
    route: "/design-lab/demo-experience",
    actionIds: ["DL.ACTION.REGISTRY.RETURN"],
    stateIds: [],
    fixtureIds: [],
  },
  {
    scenarioId: "DL.INVENTORY.DEMO.ADMIN-OPEN-FULL.HYDRATED",
    route: "/design-lab/demo-experience",
    actionIds: ["DL.ACTION.ADMIN.OPEN-FULL"],
    stateIds: [],
    fixtureIds: [],
  },
  {
    scenarioId: "DL.INVENTORY.DEMO.RELOAD.HYDRATED",
    route: "/design-lab/demo-experience",
    actionIds: ["DL.ACTION.ADMIN-FRAMES.RELOAD"],
    stateIds: [],
    fixtureIds: [],
  },
  {
    scenarioId: "DL.STORY.DOCK-SKINS.HYDRATED",
    route: "/design-lab/dock-skins",
    actionIds: [
      "DL.ACTION.DOCK.D1.SELECT",
      "DL.ACTION.DOCK.D2.SELECT",
      "DL.ACTION.DOCK.D3.SELECT",
      "DL.ACTION.DOCK.D4.SELECT",
      "DL.ACTION.DOCK.D5.SELECT",
      "DL.ACTION.DOCK.D6.SELECT",
      "DL.ACTION.DOCK-ACTION.HOME.SELECT",
      "DL.ACTION.DOCK-ACTION.FEED.SELECT",
      "DL.ACTION.DOCK-ACTION.POST.SELECT",
      "DL.ACTION.DOCK-ACTION.CHAT.SELECT",
      "DL.ACTION.DOCK-ACTION.MENU.SELECT",
    ],
    stateIds: [
      "DL.STATE.DOCK.D1",
      "DL.STATE.DOCK.D2",
      "DL.STATE.DOCK.D3",
      "DL.STATE.DOCK.D4",
      "DL.STATE.DOCK.D5",
      "DL.STATE.DOCK.D6",
      "DL.STATE.DOCK-ACTION.HOME",
      "DL.STATE.DOCK-ACTION.FEED",
      "DL.STATE.DOCK-ACTION.POST",
      "DL.STATE.DOCK-ACTION.CHAT",
      "DL.STATE.DOCK-ACTION.MENU",
    ],
    fixtureIds: ["DL-DOCK-D1"],
  },
  {
    scenarioId: "DL.STORY.DOCK-SKINS.UNSUPPORTED-FALLBACK.HYDRATED",
    route: "/design-lab/dock-skins",
    actionIds: [],
    stateIds: ["DL.STATE.FALLBACK.UNSUPPORTED-DOCK"],
    fixtureIds: ["DL-DOCK-FALLBACK"],
  },
  {
    scenarioId: "DL.STORY.DOCK-SKINS.MISSING-FALLBACK.HYDRATED",
    route: "/design-lab/dock-skins",
    actionIds: [],
    stateIds: ["DL.STATE.DEFAULT.D1"],
    fixtureIds: ["DL-DOCK-DEFAULT"],
  },
  ...["D2", "D3", "D4", "D5", "D6"].map((skin) => ({
    scenarioId: `DL.INVENTORY.DOCK.${skin}.HYDRATED`,
    route: "/design-lab/dock-skins" as const,
    actionIds: [],
    stateIds: [],
    fixtureIds: [`DL-DOCK-${skin}`],
  })),
] as const satisfies readonly DesignLabHydratedInventoryCoverage[];

type HydratedStoryCase = (typeof DESIGN_LAB_HYDRATED_STORY_CASES)[number];
type CdpEvent = { method: string; params?: Record<string, unknown> };
type CdpResult = Record<string, unknown>;
type PendingCommand = {
  resolve: (value: CdpResult) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

export function findDesignLabHydratedStoryAuditIssues(
  value: unknown,
  binding?: {
    headSha: string;
    sourceSha256: string;
    sourceFileCount: number;
    companionHttpAuditSha256: string;
    now?: number;
  },
) {
  if (!isRecord(value)) return ["Hydrated story audit must be a JSON object."];
  const issues: string[] = [];
  if (value.schemaVersion !== 1) issues.push("Hydrated story audit schemaVersion must be 1.");
  if (value.auditKind !== "design-lab-hydrated-user-stories") {
    issues.push("Hydrated story audit auditKind is invalid.");
  }
  if (value.evidenceBoundary !== DESIGN_LAB_HYDRATED_EVIDENCE_BOUNDARY) {
    issues.push("Hydrated story audit evidence boundary is invalid.");
  }
  if (!isLoopbackBaseUrl(value.baseUrl)) {
    issues.push("Hydrated story audit baseUrl must be an HTTP(S) loopback origin.");
  }
  if (
    !isRecord(value.browser) ||
    typeof value.browser.product !== "string" ||
    !/Chrome\//.test(value.browser.product) ||
    typeof value.browser.protocolVersion !== "string"
  ) {
    issues.push("Hydrated story audit browser metadata is invalid.");
  }
  const companionHttpAudit = isRecord(value.companionHttpAudit)
    ? value.companionHttpAudit
    : undefined;
  if (
    !companionHttpAudit ||
    companionHttpAudit.path !== DESIGN_LAB_STORY_AUDIT_PATH ||
    companionHttpAudit.auditKind !== "design-lab-user-stories" ||
    typeof companionHttpAudit.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(companionHttpAudit.sha256) ||
    companionHttpAudit.expectedScenarios !== DESIGN_LAB_STORY_RUNTIME_CASES.length ||
    companionHttpAudit.passedScenarios !== DESIGN_LAB_STORY_RUNTIME_CASES.length
  ) {
    issues.push("Hydrated story audit companion HTTP evidence is invalid.");
  }
  if (
    !canonicalJsonEquals(
      value.acceptanceCoverage,
      DESIGN_LAB_COMBINED_ACCEPTANCE_COVERAGE,
    )
  ) {
    issues.push("Hydrated story audit combined acceptance coverage is invalid.");
  }
  if (
    !canonicalJsonEquals(
      value.inventoryCoverage,
      DESIGN_LAB_HYDRATED_INVENTORY_COVERAGE,
    )
  ) {
    issues.push("Hydrated story audit inventory coverage map is invalid.");
  }

  const rawResults = Array.isArray(value.results) ? value.results : [];
  const results = rawResults.filter(isRecord);
  if (
    rawResults.length !== DESIGN_LAB_HYDRATED_STORY_CASES.length ||
    results.length !== rawResults.length
  ) {
    issues.push(
      `Hydrated story audit has ${results.length}/${DESIGN_LAB_HYDRATED_STORY_CASES.length} scenario rows.`,
    );
  }
  for (const expected of DESIGN_LAB_HYDRATED_STORY_CASES) {
    const expectedInventoryCoverage = inventoryCoverageForScenario(expected.id);
    const matches = results.filter((result) => result.id === expected.id);
    const result = matches[0];
    if (
      matches.length !== 1 ||
      result?.route !== expected.route ||
      result?.requestPath !== expected.requestPath ||
      result?.httpStatus !== 200 ||
      result?.requestIdPresent !== true ||
      typeof result?.requestId !== "string" ||
      !/^[a-z0-9-]{8,128}$/i.test(result.requestId) ||
      result?.demoMode !== "full-access-read-only" ||
      result?.passed !== true ||
      !Array.isArray(result?.failures) ||
      result.failures.length !== 0 ||
      !Array.isArray(result?.mutatingRequests) ||
      result.mutatingRequests.length !== 0 ||
      !canonicalJsonEquals(result?.popupPaths, expected.expectedPopupPaths ?? []) ||
      !canonicalJsonEquals(result?.inventoryCoverage, expectedInventoryCoverage) ||
      !canonicalJsonEquals(result?.observed, expected.expectedObserved)
    ) {
      issues.push(`Hydrated story scenario ${expected.id} must have one exact passing row.`);
    }
  }
  if (
    value.expectedScenarios !== DESIGN_LAB_HYDRATED_STORY_CASES.length ||
    value.passedScenarios !== DESIGN_LAB_HYDRATED_STORY_CASES.length
  ) {
    issues.push("Hydrated story audit summary does not match its required inventory.");
  }

  if (binding) {
    if (value.testedCommitSha !== binding.headSha) {
      issues.push("Hydrated story audit is not bound to the current Git HEAD.");
    }
    if (value.sourceSha256 !== binding.sourceSha256) {
      issues.push("Hydrated story audit source digest does not match the current source tree.");
    }
    if (value.sourceFileCount !== binding.sourceFileCount) {
      issues.push("Hydrated story audit source-file count does not match the current source tree.");
    }
    if (companionHttpAudit?.sha256 !== binding.companionHttpAuditSha256) {
      issues.push("Hydrated story audit companion HTTP digest does not match the canonical artifact.");
    }
    const generatedAt =
      typeof value.generatedAt === "string" ? Date.parse(value.generatedAt) : Number.NaN;
    const now = binding.now ?? Date.now();
    if (!Number.isFinite(generatedAt)) {
      issues.push("Hydrated story audit generatedAt is invalid.");
    } else if (generatedAt > now + 5 * 60_000) {
      issues.push("Hydrated story audit generatedAt is in the future.");
    } else if (now - generatedAt > 24 * 60 * 60_000) {
      issues.push("Hydrated story audit evidence is older than 24 hours.");
    }
  }
  return issues;
}

class CdpClient {
  private nextId = 1;
  private pending = new Map<number, PendingCommand>();
  private listeners = new Set<(event: CdpEvent) => void>();

  private constructor(private readonly socket: WebSocket) {
    socket.addEventListener("message", (event) => void this.handleMessage(event.data));
    socket.addEventListener("close", () => {
      for (const command of this.pending.values()) {
        clearTimeout(command.timeout);
        command.reject(new Error("Chrome DevTools connection closed."));
      }
      this.pending.clear();
    });
  }

  static async connect(url: string) {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Chrome DevTools connection timed out.")), 15_000);
      socket.addEventListener("open", () => {
        clearTimeout(timeout);
        resolve();
      });
      socket.addEventListener("error", () => {
        clearTimeout(timeout);
        reject(new Error("Chrome DevTools connection failed."));
      });
    });
    return new CdpClient(socket);
  }

  send(method: string, params: Record<string, unknown> = {}) {
    const id = this.nextId++;
    return new Promise<CdpResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Chrome DevTools command timed out: ${method}`));
      }, 30_000);
      this.pending.set(id, { resolve, reject, timeout });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  onEvent(listener: (event: CdpEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  waitForEvent(method: string, timeoutMs = 30_000) {
    return new Promise<CdpEvent>((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Chrome DevTools event timed out: ${method}`));
      }, timeoutMs);
      const unsubscribe = this.onEvent((event) => {
        if (event.method !== method) return;
        clearTimeout(timeout);
        unsubscribe();
        resolve(event);
      });
    });
  }

  close() {
    this.socket.close();
  }

  private async handleMessage(data: string | ArrayBuffer | Blob) {
    const raw =
      typeof data === "string"
        ? data
        : data instanceof ArrayBuffer
          ? Buffer.from(data).toString("utf8")
          : await data.text();
    const message = JSON.parse(raw) as {
      id?: number;
      result?: CdpResult;
      error?: { message?: string };
      method?: string;
      params?: Record<string, unknown>;
    };
    if (message.id !== undefined) {
      const command = this.pending.get(message.id);
      if (!command) return;
      clearTimeout(command.timeout);
      this.pending.delete(message.id);
      if (message.error) command.reject(new Error(message.error.message ?? "Chrome DevTools command failed."));
      else command.resolve(message.result ?? {});
      return;
    }
    if (!message.method) return;
    const event = { method: message.method, params: message.params };
    for (const listener of this.listeners) listener(event);
  }
}

async function runScenario(client: CdpClient, baseUrl: string, storyCase: HydratedStoryCase) {
  const startedAt = performance.now();
  const requestUrl = new URL(storyCase.requestPath, baseUrl).href;
  const mutatingRequests: Array<{ method: string; url: string }> = [];
  const popupPaths: string[] = [];
  const runtimeExceptions: string[] = [];
  let scenarioStarted = false;
  let documentResponse: { status: number; headers: Record<string, string> } | undefined;
  const unsubscribe = client.onEvent((event) => {
    if (event.method === "Network.requestWillBeSent" && scenarioStarted) {
      const request = isRecord(event.params?.request) ? event.params.request : undefined;
      const method = typeof request?.method === "string" ? request.method : "";
      const url = typeof request?.url === "string" ? request.url : "";
      if (method && !["GET", "HEAD", "OPTIONS"].includes(method)) {
        mutatingRequests.push({ method, url });
      }
    }
    if (event.method === "Page.windowOpen" && scenarioStarted) {
      const url = typeof event.params?.url === "string" ? event.params.url : "";
      if (url) popupPaths.push(pathAndSearch(url, requestUrl));
    }
    if (event.method === "Network.responseReceived") {
      const response = isRecord(event.params?.response) ? event.params.response : undefined;
      if (event.params?.type === "Document" && response?.url === requestUrl) {
        documentResponse = {
          status: typeof response.status === "number" ? response.status : 0,
          headers: normalizeHeaders(response.headers),
        };
      }
    }
    if (event.method === "Runtime.exceptionThrown") {
      const details = isRecord(event.params?.exceptionDetails)
        ? event.params.exceptionDetails
        : undefined;
      runtimeExceptions.push(
        typeof details?.text === "string" ? details.text : "Unhandled browser exception",
      );
    }
  });

  try {
    scenarioStarted = true;
    const loaded = client.waitForEvent("Page.loadEventFired");
    const navigation = await client.send("Page.navigate", { url: requestUrl });
    if (typeof navigation.errorText === "string" && navigation.errorText) {
      throw new Error(`Navigation failed: ${navigation.errorText}`);
    }
    await loaded;
    await waitForExpression(client, scenarioReadyExpression(storyCase));
    await delay(350);
    if (storyCase.mode === "demo-viewports") {
      const adminFramesLoaded = client.waitForEvent("Page.loadEventFired");
      await evaluate(client, scenarioActionExpression(storyCase));
      await adminFramesLoaded;
      await waitForExpression(
        client,
        `Boolean(document.querySelector('[data-admin-frame-lab]') && document.querySelector('#admin-control-centre-desktop-tab') && document.querySelector('#admin-control-centre-frame-panel'))`,
      );
      await delay(350);
      await evaluate(client, demoViewportTransitionsExpression());
    } else {
      await evaluate(client, scenarioActionExpression(storyCase));
    }
    if (storyCase.expectedPopupPaths?.length) {
      await waitForCondition(
        () =>
          canonicalJsonEquals(popupPaths, storyCase.expectedPopupPaths),
        `popup paths ${JSON.stringify(storyCase.expectedPopupPaths)}`,
      );
    }
    await waitForExpression(client, scenarioSettledExpression(storyCase));
    const observed = await evaluate(client, scenarioObservedExpression(storyCase));
    await delay(150);

    const failures: string[] = [];
    if (documentResponse?.status !== 200) failures.push(`HTTP ${documentResponse?.status ?? 0}, expected 200`);
    if (!documentResponse?.headers["x-request-id"]) failures.push("missing X-Request-ID");
    if (documentResponse?.headers["x-greyhoundiq-demo"] !== "full-access-read-only") {
      failures.push("missing full-access-read-only demo boundary");
    }
    if (!canonicalJsonEquals(observed, storyCase.expectedObserved)) {
      failures.push("observed interaction state does not match the exact contract");
    }
    if (
      !canonicalJsonEquals(popupPaths, storyCase.expectedPopupPaths ?? [])
    ) {
      failures.push("popup destinations do not match the exact contract");
    }
    if (mutatingRequests.length > 0) failures.push("interaction issued a mutating request");
    if (runtimeExceptions.length > 0) failures.push(...runtimeExceptions.map((item) => `browser exception: ${item}`));

    return {
      id: storyCase.id,
      route: storyCase.route,
      requestPath: storyCase.requestPath,
      httpStatus: documentResponse?.status ?? 0,
      requestIdPresent: Boolean(documentResponse?.headers["x-request-id"]),
      requestId: documentResponse?.headers["x-request-id"] ?? null,
      demoMode: documentResponse?.headers["x-greyhoundiq-demo"] ?? null,
      durationMs: Math.round(performance.now() - startedAt),
      observed,
      mutatingRequests,
      popupPaths,
      inventoryCoverage: inventoryCoverageForScenario(storyCase.id),
      passed: failures.length === 0,
      failures,
    };
  } finally {
    unsubscribe();
  }
}

async function main() {
  const repositoryRoot = path.resolve(".");
  const baseUrl = resolveLoopbackBaseUrl(readFlag("--base-url"));
  const outputPath = path.resolve(readFlag("--output") ?? DESIGN_LAB_HYDRATED_STORY_AUDIT_PATH);
  const sourceContract = {
    directFiles: ["scripts/audit-design-lab-hydrated-stories.ts"],
    transitiveImportRoots: [
      ...new Set(DESIGN_LAB_HYDRATED_STORY_CASES.map((item) => item.route)),
    ].flatMap((route) => {
      const contract = SCREEN_CONTRACT_BY_ROUTE.get(route);
      if (!contract) throw new Error(`Missing screen contract for ${route}.`);
      return contract.sourceFiles;
    }),
    fixtures: [],
    schemaFiles: [],
    runtimeContractFiles: DESIGN_LAB_SAFE_RUNTIME_CONTRACT_FILES,
  };
  const sourceFiles = getDesignLabSourcePaths(repositoryRoot, sourceContract);
  const sourceBefore = getDesignLabSourceFingerprint(repositoryRoot, sourceContract);
  const testedCommitSha = getRepositoryHeadSha(repositoryRoot);
  const companionHttpAuditJson = await readFile(
    path.resolve(repositoryRoot, DESIGN_LAB_STORY_AUDIT_PATH),
    "utf8",
  );
  const companionHttpAuditSha256 = createHash("sha256")
    .update(companionHttpAuditJson)
    .digest("hex");
  const companionHttpAudit = JSON.parse(companionHttpAuditJson) as unknown;
  const companionSourceFiles = parseDesignLabSourceFiles(companionHttpAudit);
  if (!companionSourceFiles) {
    throw new Error("Companion HTTP user-story audit source files are missing or invalid.");
  }
  const companionSource = fingerprintRepositoryFiles(
    repositoryRoot,
    companionSourceFiles,
  );
  const companionIssues = findDesignLabStoryAuditIssues(companionHttpAudit, {
    headSha: testedCommitSha,
    sourceSha256: companionSource.sha256,
    sourceFileCount: companionSource.fileCount,
  });
  if (companionIssues.length > 0) {
    throw new Error(
      `Companion HTTP user-story audit is invalid:\n${companionIssues.join("\n")}`,
    );
  }
  if (!isRecord(companionHttpAudit)) {
    throw new Error("Companion HTTP user-story audit must be a JSON object.");
  }
  const chromeExecutable = resolveChromeExecutable();
  const profileDirectory = await mkdtemp(path.join(tmpdir(), "greyhoundiq-cdp-"));
  const port = await reservePort();
  const chrome = spawnChrome(chromeExecutable, profileDirectory, port);

  try {
    const version = await waitForChrome(port, chrome);
    const target = await createTarget(port);
    const client = await CdpClient.connect(target.webSocketDebuggerUrl);
    try {
      await Promise.all([
        client.send("Page.enable"),
        client.send("Runtime.enable"),
        client.send("Network.enable"),
      ]);
      const results = [];
      for (const storyCase of DESIGN_LAB_HYDRATED_STORY_CASES) {
        try {
          results.push(await runScenario(client, baseUrl, storyCase));
        } catch (error) {
          throw new Error(
            `${storyCase.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      const sourceAfter = getDesignLabSourceFingerprint(repositoryRoot, sourceContract);
      if (
        sourceAfter.sha256 !== sourceBefore.sha256 ||
        sourceAfter.fileCount !== sourceBefore.fileCount
      ) {
        throw new Error("Design Lab source changed during the hydrated story audit; discard the run.");
      }
      const report = {
        schemaVersion: 1,
        auditKind: "design-lab-hydrated-user-stories",
        evidenceBoundary: DESIGN_LAB_HYDRATED_EVIDENCE_BOUNDARY,
        generatedAt: new Date().toISOString(),
        baseUrl,
        browser: {
          product: version.Browser,
          protocolVersion: version["Protocol-Version"],
        },
        companionHttpAudit: {
          path: DESIGN_LAB_STORY_AUDIT_PATH,
          auditKind: companionHttpAudit.auditKind,
          sha256: companionHttpAuditSha256,
          sourceSha256: companionHttpAudit.sourceSha256,
          expectedScenarios: companionHttpAudit.expectedScenarios,
          passedScenarios: companionHttpAudit.passedScenarios,
        },
        acceptanceCoverage: DESIGN_LAB_COMBINED_ACCEPTANCE_COVERAGE,
        inventoryCoverage: DESIGN_LAB_HYDRATED_INVENTORY_COVERAGE,
        testedCommitSha,
        sourceSha256: sourceBefore.sha256,
        sourceFileCount: sourceBefore.fileCount,
        sourceFiles,
        expectedScenarios: DESIGN_LAB_HYDRATED_STORY_CASES.length,
        passedScenarios: results.filter((result) => result.passed).length,
        results,
      };
      const issues = findDesignLabHydratedStoryAuditIssues(report, {
        headSha: report.testedCommitSha,
        sourceSha256: sourceBefore.sha256,
        sourceFileCount: sourceBefore.fileCount,
        companionHttpAuditSha256,
      });
      if (issues.length > 0) {
        const failures = results
          .filter((result) => !result.passed)
          .map(
            (result) =>
              `${result.id}: ${result.failures.join("; ")} observed=${JSON.stringify(result.observed)}`,
          );
        throw new Error([...issues, ...failures].join("\n"));
      }

      await mkdir(path.dirname(outputPath), { recursive: true });
      const reportJson = `${JSON.stringify(report, null, 2)}\n`;
      await writeCanonicalReport(outputPath, reportJson);
      console.log(
        `Design Lab hydrated stories: ${report.passedScenarios}/${report.expectedScenarios} scenarios.`,
      );
      console.log(`Evidence SHA-256: ${createHash("sha256").update(reportJson).digest("hex")}`);
      console.log(`Report: ${outputPath}`);
    } finally {
      client.close();
    }
  } finally {
    await stopChrome(chrome);
    await removeChromeProfile(profileDirectory);
  }
}

function scenarioReadyExpression(storyCase: HydratedStoryCase) {
  if (storyCase.mode === "workspace-scenario-controls") {
    return `Boolean(document.querySelector('[data-design-lab-scenario-controls]') && document.querySelectorAll('[data-design-lab-scenario-control]').length === ${DESIGN_LAB_SCENARIO_DIMENSIONS.length} && document.querySelector('[data-design-lab-scenario-preview]'))`;
  }
  if (
    storyCase.mode === "workspace-filter" ||
    storyCase.mode === "workspace-screen-open" ||
    storyCase.mode === "demo-registry"
  ) {
    return `Boolean(document.querySelector('input[placeholder="Search routes or user stories"]') && document.querySelector('select') && document.querySelector('[data-design-lab-status-ribbon]'))`;
  }
  if (
    storyCase.mode === "workspace-default-area-navigation" ||
    storyCase.mode === "workspace-fixture"
  ) {
    return `Boolean(document.querySelector('[data-design-lab-active-area]') && document.querySelector('nav[aria-label="Design Lab sections"] a[aria-current="page"]'))`;
  }
  if (storyCase.mode === "demo-fixture") {
    return `Boolean(document.querySelector('[data-demo-experience-map]') && document.querySelector('[data-design-lab-active-area="screens"]'))`;
  }
  if (storyCase.mode === "demo-viewports") {
    return `Boolean(document.querySelector('[data-demo-experience-map]') && document.querySelector('[data-admin-frames-open][href="/design-lab/demo-experience?view=admin-frames"]'))`;
  }
  if (
    storyCase.mode === "demo-registry-return" ||
    storyCase.mode === "demo-admin-open-full" ||
    storyCase.mode === "demo-reload"
  ) {
    return `Boolean(document.querySelector('[data-admin-frame-lab]') && document.querySelector('#admin-control-centre-desktop-tab') && document.querySelector('#admin-control-centre-frame-panel'))`;
  }
  return `Boolean(document.querySelector('[data-skin="D6"]') && document.querySelector('[data-action="menu"]') && document.querySelector('[data-dock-skin]'))`;
}

function scenarioActionExpression(storyCase: HydratedStoryCase) {
  if (storyCase.mode === "workspace-scenario-controls") {
    return `(() => {
      const waitFor = async (predicate) => {
        const deadline = Date.now() + 10000;
        while (Date.now() < deadline) {
          if (predicate()) return;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        throw new Error('scenario control did not settle');
      };
      const setSelect = (element, value) => {
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(element, value);
        element.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const keysAndParams = ${JSON.stringify(
        DESIGN_LAB_SCENARIO_DIMENSIONS.map((dimension) => [
          dimension.key,
          dimension.queryParam,
        ]),
      )};
      const dataStates = ${JSON.stringify(DESIGN_LAB_DATA_STATE_VALUES)};
      const errorStates = ${JSON.stringify(DESIGN_LAB_ERROR_STATE_VALUES)};
      const networkStates = ['online', 'offline', 'slow'];
      const controls = [...document.querySelectorAll('[data-design-lab-scenario-control]')];
      const controlByKey = new Map(controls.map((control) => [control.getAttribute('data-design-lab-scenario-control'), control]));
      const values = () => Object.fromEntries(keysAndParams.map(([key]) => [key, controlByKey.get(key)?.value ?? null]));
      const urlValues = () => {
        const params = new URLSearchParams(location.search);
        return Object.fromEntries(keysAndParams.map(([key, queryParam]) => [key, params.get(queryParam)]));
      };
      const exercise = async (key, valuesToTest, previewAttribute) => {
        const control = controlByKey.get(key);
        const preview = document.querySelector('[data-design-lab-scenario-preview]');
        const observed = [];
        for (const value of valuesToTest) {
          setSelect(control, value);
          await waitFor(() => control.value === value && preview?.getAttribute(previewAttribute) === value);
          observed.push(value);
        }
        return observed;
      };
      return (async () => {
        const root = document.querySelector('[data-design-lab-scenario-controls]');
        const initialValues = values();
        const dataStateCoverage = await exercise('dataState', dataStates, 'data-fixture-state');
        const errorStateCoverage = await exercise('errorState', errorStates, 'data-error-state');
        const networkStateCoverage = await exercise('networkState', networkStates, 'data-network-state');
        document.querySelector('[data-scenario-simulate-destructive]')?.click();
        await waitFor(() => document.querySelector('[data-design-lab-scenario-preview]')?.getAttribute('data-destructive-simulation') === 'complete');
        const preview = document.querySelector('[data-design-lab-scenario-preview]');
        window.__greyhoundiqHydratedObserved = {
          controlCount: controls.length,
          controlQueryParams: controls.map((control) => control.getAttribute('data-scenario-query-param')),
          initialValues,
          dataStateCoverage,
          errorStateCoverage,
          networkStateCoverage,
          finalValues: urlValues(),
          preview: {
            dataState: preview?.getAttribute('data-fixture-state') ?? null,
            errorState: preview?.getAttribute('data-error-state') ?? null,
            networkState: preview?.getAttribute('data-network-state') ?? null,
            destructiveSimulation: preview?.getAttribute('data-destructive-simulation') ?? null,
          },
          copyButtonPresent: document.querySelector('[data-scenario-copy-url]') !== null,
          syntheticBoundaryPresent: root?.textContent?.includes('allowlisted, synthetic review state') ?? false,
          accessBoundaryPresent: root?.textContent?.includes('grants no access') ?? false,
        };
        return true;
      })();
    })()`;
  }
  if (storyCase.mode === "workspace-filter") {
    return `(() => {
      const waitFor = async (predicate) => {
        const deadline = Date.now() + 10000;
        while (Date.now() < deadline) {
          if (predicate()) return;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        throw new Error('workspace filter did not settle');
      };
      const setValue = (element, prototype, value, event) => {
        Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
        element.dispatchEvent(new Event(event, { bubbles: true }));
      };
      const snapshot = () => {
        const families = [...document.querySelectorAll('section[aria-labelledby^="screen-family-"]')];
        return {
          routeCount: families.flatMap((section) => [...section.querySelectorAll('a[href]')]).length,
          familyKeys: families.map((section) => section.getAttribute('aria-labelledby').replace('screen-family-', '')),
          routeHrefs: families.flatMap((section) => [...section.querySelectorAll('a[href]')].map((link) => link.getAttribute('href'))),
        };
      };
      return (async () => {
        const input = document.querySelector('input[placeholder="Search routes or user stories"]');
        const select = document.querySelector('select');
        const initialRouteCount = snapshot().routeCount;
        setValue(select, HTMLSelectElement.prototype, 'racing', 'change');
        await waitFor(() => snapshot().routeCount === ${RACING_SCREEN_ROUTE_COUNT} && snapshot().familyKeys.length === 1 && snapshot().familyKeys[0] === 'racing');
        const familySnapshot = snapshot();
        setValue(select, HTMLSelectElement.prototype, 'all', 'change');
        await waitFor(() => snapshot().routeCount === initialRouteCount);
        setValue(input, HTMLInputElement.prototype, '/dogs/[id]', 'input');
        await waitFor(() => snapshot().routeCount === 1);
        const searchSnapshot = snapshot();
        const card = document.querySelector('section[aria-labelledby^="screen-family-"] a[href="/dogs/demo-provider-dog"]');
        const coverageSummary = card?.querySelector('code')?.nextElementSibling?.textContent?.replace(/\\s+/g, ' ').trim() ?? null;
        const coverageBadgeTitles = [...(card?.querySelectorAll('[aria-label="Contract coverage"] [title]') ?? [])].map((badge) => badge.getAttribute('title'));
        setValue(input, HTMLInputElement.prototype, 'no-screen-can-match-this', 'input');
        await waitFor(() => snapshot().routeCount === 0);
        const status = document.querySelector('input[placeholder="Search routes or user stories"]')?.closest('.giq-panel')?.querySelector('[aria-live="polite"]')?.textContent?.replace(/\\s+/g, ' ').trim() ?? null;
        const releaseDatum = [...document.querySelectorAll('[data-design-lab-status-ribbon] dl')].find((datum) => datum.querySelector('dt')?.textContent?.trim() === 'Release');
        window.__greyhoundiqHydratedObserved = {
          initialRouteCount,
          familyFiltered: {
            query: '',
            family: 'racing',
            routeCount: familySnapshot.routeCount,
            familyKeys: familySnapshot.familyKeys,
          },
          searchFiltered: {
            query: '/dogs/[id]',
            family: 'all',
            routeCount: searchSnapshot.routeCount,
            familyKeys: searchSnapshot.familyKeys,
            routeHrefs: searchSnapshot.routeHrefs,
          },
          empty: {
            query: input.value,
            family: select.value,
            routeCount: snapshot().routeCount,
            familyCount: document.querySelectorAll('section[aria-labelledby^="screen-family-"]').length,
            status,
          },
          coverageSummary,
          coverageBadgeTitles,
          ribbonVisible: document.querySelector('[data-design-lab-status-ribbon]') !== null,
          ribbonReleaseText: releaseDatum?.querySelector('dd')?.textContent?.replace(/\\s+/g, ' ').trim() ?? null,
        };
        return true;
      })();
    })()`;
  }
  if (storyCase.mode === "workspace-default-area-navigation") {
    return `(() => {
      const link = document.querySelector('nav[aria-label="Design Lab sections"] a[href="/design-lab?area=screens"]');
      const current = document.querySelector('nav[aria-label="Design Lab sections"] a[aria-current="page"]');
      sessionStorage.setItem('greyhoundiq-workspace-area-nav', JSON.stringify({
        initial: {
          currentPath: location.pathname + location.search,
          activeArea: document.querySelector('[data-design-lab-active-area]')?.getAttribute('data-design-lab-active-area') ?? null,
          heading: document.querySelector('#design-lab-area-heading')?.textContent?.trim() ?? null,
          currentNavigationHref: current?.getAttribute('href') ?? null,
        },
        clickedHref: link?.getAttribute('href') ?? null,
      }));
      link.click();
      return true;
    })()`;
  }
  if (storyCase.mode === "workspace-screen-open") {
    return filterAndOpenScreenExpression("greyhoundiq-workspace-screen-open", false);
  }
  if (storyCase.mode === "demo-registry") {
    return filterAndOpenScreenExpression("greyhoundiq-demo-registry", true);
  }
  if (storyCase.mode === "demo-viewports") {
    return `(() => {
      const link = document.querySelector('[data-admin-frames-open][href="/design-lab/demo-experience?view=admin-frames"]');
      sessionStorage.setItem('greyhoundiq-demo-admin-frames-open', link?.getAttribute('href') ?? '');
      link.click();
      return true;
    })()`;
  }
  if (storyCase.mode === "demo-registry-return") {
    return navigationLinkExpression(
      'a[href="/design-lab/demo-experience"]',
      "greyhoundiq-demo-registry-return",
    );
  }
  if (storyCase.mode === "demo-admin-open-full") {
    return `(() => {
      const link = document.querySelector('a[href="/admin"][target="_blank"]');
      window.__greyhoundiqHydratedObserved = {
        clickedHref: link?.getAttribute('href') ?? null,
        target: link?.getAttribute('target') ?? null,
        surfaceRetained: document.querySelector('[data-admin-frame-lab]') !== null,
      };
      link.click();
      return true;
    })()`;
  }
  if (storyCase.mode === "demo-reload") {
    return `(() => {
      const link = document.querySelector('a[href="/design-lab/demo-experience?view=admin-frames"]');
      sessionStorage.setItem('greyhoundiq-demo-reload', JSON.stringify({
        clickedHref: link?.getAttribute('href') ?? null,
        previousTimeOrigin: performance.timeOrigin,
      }));
      link.click();
      return true;
    })()`;
  }
  if (storyCase.mode === "dock-interactions") {
    return `(() => {
      const settle = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const readout = () => {
        const status = document.querySelector('[role="status"][aria-live="polite"]');
        return [status?.querySelector('span')?.textContent, status?.querySelector('strong')?.textContent].filter(Boolean).join(' ');
      };
      return (async () => {
        const skinTransitions = [];
        let previousSkin = document.querySelector('[data-dock-skin]')?.getAttribute('data-dock-skin') ?? null;
        for (const skin of ['D2', 'D1', 'D3', 'D4', 'D5', 'D6']) {
          const button = document.querySelector('[data-skin="' + skin + '"]');
          button.click();
          await settle();
          const dock = document.querySelector('[data-dock-skin]');
          skinTransitions.push({
            from: previousSkin,
            to: skin,
            selectedSkin: dock?.getAttribute('data-dock-skin') ?? null,
            ariaPressed: button?.getAttribute('aria-pressed') ?? null,
            dataSelected: button?.getAttribute('data-selected') ?? null,
            activeAction: dock?.querySelector('[data-action][aria-pressed="true"]')?.getAttribute('data-action') ?? null,
            activeReadout: readout(),
          });
          previousSkin = skin;
        }
        const actionTransitions = [];
        let previousAction = document.querySelector('[data-dock-skin] [data-action][aria-pressed="true"]')?.getAttribute('data-action') ?? null;
        for (const action of ['feed', 'post', 'chat', 'menu', 'home']) {
          const button = document.querySelector('[data-dock-skin] [data-action="' + action + '"]');
          button.click();
          await settle();
          actionTransitions.push({
            from: previousAction,
            to: action,
            activeReadout: readout(),
            activeAction: document.querySelector('[data-dock-skin] [data-action][aria-pressed="true"]')?.getAttribute('data-action') ?? null,
            ariaPressed: button?.getAttribute('aria-pressed') ?? null,
            dataActive: button?.getAttribute('data-active') ?? null,
          });
          previousAction = action;
        }
        const selectedSkinButtons = [...document.querySelectorAll('[data-skin][aria-pressed="true"]')];
        const dock = document.querySelector('[data-dock-skin]');
        window.__greyhoundiqHydratedObserved = {
          skinTransitions,
          actionTransitions,
          selectedSkin: selectedSkinButtons[0]?.getAttribute('data-skin') ?? null,
          selectedSkinKeys: selectedSkinButtons.map((button) => button.getAttribute('data-skin')),
          dockSkin: dock?.getAttribute('data-dock-skin') ?? null,
          actionKeys: [...dock.querySelectorAll('[data-action]')].map((button) => button.getAttribute('data-action')),
          activeAction: dock.querySelector('[data-action][aria-pressed="true"]')?.getAttribute('data-action') ?? null,
          activeReadout: readout(),
        };
        return true;
      })();
    })()`;
  }
  return "true";
}

function demoViewportTransitionsExpression() {
  return `(() => {
    const waitFor = async (predicate) => {
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        if (predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      throw new Error('admin viewport transition did not settle');
    };
    const selectedViewport = () => document.querySelector('[aria-label="Control Centre viewport"] [role="tab"][aria-selected="true"]')?.id?.replace('admin-control-centre-', '').replace('-tab', '') ?? null;
    const snapshot = (from, to) => {
      const tab = document.querySelector('#admin-control-centre-' + to + '-tab');
      const panel = document.querySelector('#admin-control-centre-frame-panel');
      const iframe = panel?.querySelector('iframe');
      return {
        from,
        to,
        tabId: tab?.id ?? null,
        tabAriaSelected: tab?.getAttribute('aria-selected') ?? null,
        tabIndex: tab?.getAttribute('tabindex') ?? null,
        panelLabelledBy: panel?.getAttribute('aria-labelledby') ?? null,
        iframeTitle: iframe?.getAttribute('title') ?? null,
        iframeSrc: iframe?.getAttribute('src') ?? null,
        iframeWidth: iframe?.getAttribute('width') ?? null,
        iframeHeight: iframe?.getAttribute('height') ?? null,
      };
    };
    return (async () => {
      await waitFor(() => selectedViewport() === 'desktop');
      const transitions = [];
      let from = 'desktop';
      for (const to of ['mobile', 'desktop', 'tablet']) {
        document.querySelector('#admin-control-centre-' + to + '-tab').click();
        await waitFor(() => {
          const panel = document.querySelector('#admin-control-centre-frame-panel');
          return selectedViewport() === to && panel?.getAttribute('aria-labelledby') === 'admin-control-centre-' + to + '-tab' && panel?.querySelector('iframe') !== null;
        });
        transitions.push(snapshot(from, to));
        from = to;
      }
      const registry = document.querySelector('a[href="/design-lab/demo-experience"]');
      const openFull = document.querySelector('a[href="/admin"][target="_blank"]');
      const reload = document.querySelector('a[href="/design-lab/demo-experience?view=admin-frames"]');
      window.__greyhoundiqHydratedObserved = {
        adminFramesClickedHref: sessionStorage.getItem('greyhoundiq-demo-admin-frames-open'),
        currentPath: location.pathname + location.search,
        transitions,
        selectedViewport: selectedViewport(),
        iframeCount: document.querySelectorAll('#admin-control-centre-frame-panel iframe').length,
        registryHref: registry?.getAttribute('href') ?? null,
        openFullHref: openFull?.getAttribute('href') ?? null,
        openFullTarget: openFull?.getAttribute('target') ?? null,
        reloadHref: reload?.getAttribute('href') ?? null,
      };
      sessionStorage.removeItem('greyhoundiq-demo-admin-frames-open');
      return true;
    })();
  })()`;
}

function scenarioSettledExpression(storyCase: HydratedStoryCase) {
  if (
    storyCase.mode === "workspace-filter" ||
    storyCase.mode === "workspace-scenario-controls" ||
    storyCase.mode === "demo-viewports" ||
    storyCase.mode === "demo-admin-open-full" ||
    storyCase.mode === "dock-interactions"
  ) {
    return `window.__greyhoundiqHydratedObserved !== undefined`;
  }
  if (storyCase.mode === "workspace-default-area-navigation") {
    return `location.pathname === '/design-lab' && location.search === '?area=screens' && document.querySelector('[data-design-lab-active-area="screens"]') !== null`;
  }
  if (storyCase.mode === "workspace-fixture") {
    return `document.querySelector('[data-design-lab-active-area]') !== null`;
  }
  if (
    storyCase.mode === "workspace-screen-open" ||
    storyCase.mode === "demo-registry"
  ) {
    return `location.pathname === '/dogs/demo-provider-dog' && sessionStorage.getItem('${storyCase.mode === "demo-registry" ? "greyhoundiq-demo-registry" : "greyhoundiq-workspace-screen-open"}') !== null`;
  }
  if (storyCase.mode === "demo-fixture") {
    return `document.querySelector('[data-demo-experience-map] [data-design-lab-active-area="screens"]') !== null`;
  }
  if (storyCase.mode === "demo-registry-return") {
    return `location.pathname === '/design-lab/demo-experience' && !location.search && document.querySelector('[data-demo-experience-map]') !== null`;
  }
  if (storyCase.mode === "demo-reload") {
    return `(() => {
      const stored = JSON.parse(sessionStorage.getItem('greyhoundiq-demo-reload') || 'null');
      return Boolean(stored && stored.previousTimeOrigin !== performance.timeOrigin && document.querySelector('[data-admin-frame-lab]'));
    })()`;
  }
  return `document.querySelector('[data-dock-skin]') !== null`;
}

function scenarioObservedExpression(storyCase: HydratedStoryCase) {
  if (
    storyCase.mode === "workspace-filter" ||
    storyCase.mode === "workspace-scenario-controls" ||
    storyCase.mode === "demo-viewports" ||
    storyCase.mode === "demo-admin-open-full" ||
    storyCase.mode === "dock-interactions"
  ) {
    return "window.__greyhoundiqHydratedObserved";
  }
  if (storyCase.mode === "workspace-default-area-navigation") {
    return `(() => {
      const stored = JSON.parse(sessionStorage.getItem('greyhoundiq-workspace-area-nav') || 'null');
      sessionStorage.removeItem('greyhoundiq-workspace-area-nav');
      const current = document.querySelector('nav[aria-label="Design Lab sections"] a[aria-current="page"]');
      return {
        ...stored,
        currentPath: location.pathname + location.search,
        activeArea: document.querySelector('[data-design-lab-active-area]')?.getAttribute('data-design-lab-active-area') ?? null,
        heading: document.querySelector('#design-lab-area-heading')?.textContent?.trim() ?? null,
        currentNavigationHref: current?.getAttribute('href') ?? null,
      };
    })()`;
  }
  if (storyCase.mode === "workspace-fixture") {
    return `(() => {
      const current = document.querySelector('nav[aria-label="Design Lab sections"] a[aria-current="page"]');
      return {
        currentPath: location.pathname + location.search,
        activeArea: document.querySelector('[data-design-lab-active-area]')?.getAttribute('data-design-lab-active-area') ?? null,
        heading: document.querySelector('#design-lab-area-heading')?.textContent?.trim() ?? null,
        currentNavigationHref: current?.getAttribute('href') ?? null,
      };
    })()`;
  }
  if (storyCase.mode === "workspace-screen-open") {
    return storedNavigationObservedExpression(
      "greyhoundiq-workspace-screen-open",
    );
  }
  if (storyCase.mode === "demo-registry") {
    return storedNavigationObservedExpression("greyhoundiq-demo-registry");
  }
  if (storyCase.mode === "demo-fixture") {
    return `(() => {
      const current = document.querySelector('nav[aria-label="Design Lab sections"] a[aria-current="page"]');
      return {
        currentPath: location.pathname + location.search,
        surface: document.querySelector('[data-demo-experience-map]') ? 'registry' : null,
        activeArea: document.querySelector('[data-design-lab-active-area]')?.getAttribute('data-design-lab-active-area') ?? null,
        currentNavigationHref: current?.getAttribute('href') ?? null,
      };
    })()`;
  }
  if (storyCase.mode === "demo-registry-return") {
    return `(() => {
      const stored = JSON.parse(sessionStorage.getItem('greyhoundiq-demo-registry-return') || 'null');
      sessionStorage.removeItem('greyhoundiq-demo-registry-return');
      return {
        ...stored,
        currentPath: location.pathname + location.search,
        surface: document.querySelector('[data-demo-experience-map]') ? 'registry' : null,
        activeArea: document.querySelector('[data-design-lab-active-area]')?.getAttribute('data-design-lab-active-area') ?? null,
      };
    })()`;
  }
  if (storyCase.mode === "demo-reload") {
    return `(() => {
      const stored = JSON.parse(sessionStorage.getItem('greyhoundiq-demo-reload') || 'null');
      sessionStorage.removeItem('greyhoundiq-demo-reload');
      return {
        clickedHref: stored?.clickedHref ?? null,
        currentPath: location.pathname + location.search,
        reloaded: stored?.previousTimeOrigin !== performance.timeOrigin,
        surface: document.querySelector('[data-admin-frame-lab]') ? 'admin-frames' : null,
      };
    })()`;
  }
  return `(() => {
    const selectedSkinButtons = [...document.querySelectorAll('[data-skin][aria-pressed="true"]')];
    const dock = document.querySelector('[data-dock-skin]');
    const readout = document.querySelector('[role="status"][aria-live="polite"]');
    return {
      currentPath: location.pathname + location.search,
      selectedSkin: selectedSkinButtons[0]?.getAttribute('data-skin') ?? null,
      selectedSkinKeys: selectedSkinButtons.map((button) => button.getAttribute('data-skin')),
      dockSkin: dock?.getAttribute('data-dock-skin') ?? null,
      activeAction: dock?.querySelector('[data-action][aria-pressed="true"]')?.getAttribute('data-action') ?? null,
      activeReadout: [readout?.querySelector('span')?.textContent, readout?.querySelector('strong')?.textContent].filter(Boolean).join(' '),
    };
  })()`;
}

function filterAndOpenScreenExpression(storageKey: string, includeRegistryStates: boolean) {
  return `(() => {
    const waitFor = async (predicate) => {
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        if (predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      throw new Error('screen filter did not settle');
    };
    const setValue = (element, prototype, value, event) => {
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
      element.dispatchEvent(new Event(event, { bubbles: true }));
    };
    const routeCount = () => document.querySelectorAll('section[aria-labelledby^="screen-family-"] a[href]').length;
    const familyKeys = () => [...document.querySelectorAll('section[aria-labelledby^="screen-family-"]')].map((section) => section.getAttribute('aria-labelledby').replace('screen-family-', ''));
    return (async () => {
      const input = document.querySelector('input[placeholder="Search routes or user stories"]');
      const select = document.querySelector('select');
      const stored = ${includeRegistryStates ? `{
        default: {
          currentPath: location.pathname + location.search,
          activeArea: document.querySelector('[data-design-lab-active-area]')?.getAttribute('data-design-lab-active-area') ?? null,
          routeCount: routeCount(),
        },
      }` : "{}"};
      ${includeRegistryStates ? `setValue(select, HTMLSelectElement.prototype, 'racing', 'change');
      await waitFor(() => routeCount() === ${RACING_SCREEN_ROUTE_COUNT} && familyKeys().length === 1 && familyKeys()[0] === 'racing');
      stored.familyFiltered = {
        query: '',
        family: select.value,
        routeCount: routeCount(),
        familyKeys: familyKeys(),
      };
      setValue(select, HTMLSelectElement.prototype, 'all', 'change');
      await waitFor(() => routeCount() === stored.default.routeCount);
      setValue(input, HTMLInputElement.prototype, '/dogs/[id]', 'input');
      await waitFor(() => routeCount() === 1);
      stored.searchFiltered = {
        query: input.value,
        family: select.value,
        routeCount: routeCount(),
        routeHrefs: [...document.querySelectorAll('section[aria-labelledby^="screen-family-"] a[href]')].map((item) => item.getAttribute('href')),
      };
      setValue(input, HTMLInputElement.prototype, 'no-screen-can-match-this', 'input');
      await waitFor(() => routeCount() === 0);
      stored.empty = { query: input.value, family: select.value, routeCount: routeCount() };
      setValue(input, HTMLInputElement.prototype, '/dogs/[id]', 'input');
      await waitFor(() => routeCount() === 1);` : `setValue(select, HTMLSelectElement.prototype, 'racing', 'change');
      setValue(input, HTMLInputElement.prototype, '/dogs/[id]', 'input');
      await waitFor(() => routeCount() === 1);`}
      const link = document.querySelector('section[aria-labelledby="screen-family-racing"] a[href="/dogs/demo-provider-dog"]');
      stored.clickedHref = link?.getAttribute('href') ?? null;
      sessionStorage.setItem('${storageKey}', JSON.stringify(stored));
      link.click();
      return true;
    })();
  })()`;
}

function navigationLinkExpression(selector: string, storageKey: string) {
  return `(() => {
    const link = document.querySelector('${selector}');
    sessionStorage.setItem('${storageKey}', JSON.stringify({ clickedHref: link?.getAttribute('href') ?? null }));
    link.click();
    return true;
  })()`;
}

function storedNavigationObservedExpression(storageKey: string, extra = "") {
  return `(() => {
    const stored = JSON.parse(sessionStorage.getItem('${storageKey}') || 'null');
    sessionStorage.removeItem('${storageKey}');
    return {
      ...stored,
      currentPath: location.pathname + location.search,
      ${extra}
    };
  })()`;
}

async function evaluate(client: CdpClient, expression: string) {
  const response = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) {
    const details = isRecord(response.exceptionDetails)
      ? response.exceptionDetails
      : undefined;
    const exception = isRecord(details?.exception) ? details.exception : undefined;
    const description =
      typeof exception?.description === "string"
        ? exception.description
        : typeof details?.text === "string"
          ? details.text
          : "unknown browser exception";
    throw new Error(`Browser evaluation failed: ${description}`);
  }
  const result = isRecord(response.result) ? response.result : undefined;
  return result?.value;
}

async function waitForExpression(client: CdpClient, expression: string, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(client, expression)) return;
    await delay(100);
  }
  throw new Error(`Hydrated browser condition timed out: ${expression}`);
}

async function waitForCondition(
  predicate: () => boolean,
  description: string,
  timeoutMs = 10_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await delay(50);
  }
  throw new Error(`Hydrated browser condition timed out: ${description}`);
}

function inventoryCoverageForScenario(scenarioId: string) {
  const matches = DESIGN_LAB_HYDRATED_INVENTORY_COVERAGE.filter(
    (coverage) => coverage.scenarioId === scenarioId,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Hydrated scenario ${scenarioId} must have one exact inventory-coverage row.`,
    );
  }
  return matches[0];
}

function pathAndSearch(value: string, baseUrl: string) {
  const url = new URL(value, baseUrl);
  return `${url.pathname}${url.search}`;
}

function resolveLoopbackBaseUrl(raw = "http://localhost:3000") {
  if (!isLoopbackBaseUrl(raw)) {
    throw new Error("--base-url must be an HTTP(S) loopback origin without credentials, path, query or hash.");
  }
  return new URL(raw).origin;
}

function isLoopbackBaseUrl(value: unknown) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function resolveChromeExecutable() {
  const candidates = [
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
    process.env["PROGRAMFILES(X86)"] && path.join(process.env["PROGRAMFILES(X86)"], "Google/Chrome/Application/chrome.exe"),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
  ].filter((candidate): candidate is string => Boolean(candidate));
  const executable = candidates.find(existsSync);
  if (!executable) throw new Error("Google Chrome was not found in a standard Windows installation path.");
  return executable;
}

function spawnChrome(executable: string, profileDirectory: string, port: number) {
  return spawn(
    executable,
    [
      "--headless=new",
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-sync",
      "--no-default-browser-check",
      "--no-first-run",
      `--remote-debugging-port=${port}`,
      "--remote-debugging-address=127.0.0.1",
      `--user-data-dir=${profileDirectory}`,
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: true },
  );
}

async function reservePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to reserve a Chrome DevTools port."));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

async function waitForChrome(port: number, chrome: ChildProcess) {
  const endpoint = `http://127.0.0.1:${port}/json/version`;
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (chrome.exitCode !== null) throw new Error("Google Chrome exited before DevTools became ready.");
    try {
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return (await response.json()) as Record<string, string>;
    } catch {
      // Chrome has not opened the loopback debugger yet.
    }
    await delay(100);
  }
  throw new Error("Google Chrome DevTools endpoint did not become ready.");
}

async function createTarget(port: number) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?about%3Ablank`, {
    method: "PUT",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Unable to create Chrome target: HTTP ${response.status}.`);
  const value = (await response.json()) as Record<string, unknown>;
  if (typeof value.webSocketDebuggerUrl !== "string") {
    throw new Error("Chrome target did not provide a DevTools WebSocket URL.");
  }
  return { webSocketDebuggerUrl: value.webSocketDebuggerUrl };
}

async function stopChrome(chrome: ChildProcess) {
  if (chrome.exitCode !== null) return;
  chrome.kill();
  await Promise.race([
    new Promise<void>((resolve) => chrome.once("exit", () => resolve())),
    delay(5_000),
  ]);
}

async function removeChromeProfile(profileDirectory: string) {
  const [canonicalTempRoot, canonicalProfile] = await Promise.all([
    realpath(tmpdir()),
    realpath(profileDirectory),
  ]);
  const relativeProfile = path.relative(canonicalTempRoot, canonicalProfile);
  if (
    path.dirname(relativeProfile) !== "." ||
    !/^greyhoundiq-cdp-[a-z0-9_-]+$/i.test(path.basename(relativeProfile))
  ) {
    throw new Error("Refusing to recursively remove an unexpected Chrome profile path.");
  }
  await rm(canonicalProfile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}

export async function writeCanonicalReport(outputPath: string, reportJson: string) {
  const outputDirectory = path.dirname(outputPath);
  const temporaryPath = path.join(
    outputDirectory,
    `.${path.basename(outputPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporaryPath, reportJson, { encoding: "utf8", flag: "wx" });
    await rename(temporaryPath, outputPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

function normalizeHeaders(value: unknown) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([key, header]) => [key.toLowerCase(), String(header)]),
  );
}

function readFlag(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function canonicalJsonEquals(left: unknown, right: unknown) {
  return JSON.stringify(canonicalizeJson(left)) === JSON.stringify(canonicalizeJson(right));
}

function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeJson);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalizeJson(value[key])]),
  );
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
