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

import { resolveSponsoredMarketplaceVisibility } from "../src/components/appearance-preview-state";
import {
  DESIGN_LAB_ROLES,
  type DesignLabRole,
} from "../src/components/design-lab-role-blueprints";
import {
  getAppDockReviewFrame,
  resolveAppDockReviewSelection,
} from "../src/components/design-lab-review-matrix";
import {
  DOCK_SKIN_REGISTRY,
  type DockSkinKey,
} from "../src/components/dock-skin-catalogue";
import { MARKETPLACE_TEMPLATE_LISTINGS } from "../src/components/marketplace-template-data";
import {
  MARKETPLACE_TEMPLATE_OPTIONS,
  resolveMarketplaceTemplateKey,
  type MarketplaceTemplateKey,
} from "../src/components/marketplace-template-variants";
import {
  PROTOTYPE_DEVICES,
  PROTOTYPE_REVIEW_COMPONENTS,
  PROTOTYPE_TEMPLATE_COMPOSITIONS,
  PROTOTYPE_VARIANTS,
  getPrototypeReviewId,
  type PrototypeDevice,
  type PrototypeVariant,
} from "../src/components/prototype-variants";
import {
  DESIGN_LAB_USER_STORY_MANIFESTS,
} from "../src/components/screen-contracts/design-lab-user-stories";
import { SCREEN_CONTRACT_BY_ROUTE } from "../src/components/demo-experience-registry";
import {
  DESIGN_LAB_STORY_AUDIT_PATH,
  DESIGN_LAB_STORY_RUNTIME_CASES,
  findDesignLabStoryAuditIssues,
} from "./audit-design-lab-user-stories";
import {
  DESIGN_LAB_SAFE_RUNTIME_CONTRACT_FILES,
  fingerprintRepositoryFiles,
  getDesignLabSourceFingerprint,
  getDesignLabSourcePaths,
  getRepositoryHeadSha,
  parseDesignLabSourceFiles,
} from "./design-lab-source-fingerprint";

export const DESIGN_LAB_HYDRATED_WAVE2_AUDIT_PATH =
  "output/demo-route-audit/design-lab-hydrated-wave2.json";
export const DESIGN_LAB_HYDRATED_WAVE2_EVIDENCE_BOUNDARY =
  "Isolated loopback full-access-read-only interaction evidence for the role, Feed-device and Marketplace review routes; not deployed-image identity or production approval.";
export const DESIGN_LAB_HYDRATED_WAVE2_ROUTES = [
  "/design-lab/role-blueprints",
  "/feed/device-preview",
  "/marketplace/design-lab",
] as const;

type Wave2Route = (typeof DESIGN_LAB_HYDRATED_WAVE2_ROUTES)[number];
type Wave2Mode = "role" | "feed" | "marketplace" | "marketplace-profile";
type InventoryCoverage = {
  scenarioId: string;
  route: Wave2Route;
  actionIds: readonly string[];
  stateIds: readonly string[];
  fixtureIds: readonly string[];
};
type TransitionDefinition = {
  selector: string;
  destinationPath: string;
};
type Wave2ScenarioDefinition = {
  id: string;
  route: Wave2Route;
  requestPath: string;
  mode: Wave2Mode;
  transition?: TransitionDefinition;
  expectedObserved: unknown;
  inventoryCoverage: InventoryCoverage;
};
type CdpEvent = { method: string; params?: Record<string, unknown> };
type CdpResult = Record<string, unknown>;
type PendingCommand = {
  resolve: (value: CdpResult) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

const MARKETPLACE_LAYOUT_FAMILIES = {
  M1: "editorial-grandstand",
  M2: "dense-exchange",
  M3: "command-centre",
  M4: "seller-workbench",
  M5: "community-stream",
  M6: "comparison-matrix",
} as const satisfies Record<MarketplaceTemplateKey, string>;

const roleActionAssignments = [
  { kind: "role", key: "business", start: "trainer", variant: "A1" },
  { kind: "role", key: "trainer", start: "business", variant: "A2" },
  { kind: "role", key: "owner", start: "business", variant: "B1" },
  { kind: "role", key: "punter", start: "business", variant: "B2" },
  { kind: "variant", key: "A1", role: "trainer", start: "A2" },
  { kind: "variant", key: "A2", role: "owner", start: "A1" },
  { kind: "variant", key: "B1", role: "punter", start: "A1" },
  { kind: "variant", key: "B2", role: "business", start: "A1" },
  { kind: "variant", key: "C1", role: "business", start: "A1" },
  { kind: "variant", key: "C2", role: "business", start: "A1" },
] as const;

const roleActionScenarios = roleActionAssignments.map((assignment) => {
  const isRole = assignment.kind === "role";
  const role = (isRole ? assignment.key : assignment.role) as DesignLabRole;
  const variant = (isRole ? assignment.variant : assignment.key) as PrototypeVariant;
  const startRole = (isRole ? assignment.start : assignment.role) as DesignLabRole;
  const startVariant = (isRole ? assignment.variant : assignment.start) as PrototypeVariant;
  const destinationPath = rolePath(role, variant);
  const selectorGroup = isRole ? "Choose member role" : "Choose app template";
  const actionId = isRole
    ? `DL.ACTION.ROLE.${role.toUpperCase()}.SELECT`
    : `DL.ACTION.ROLE-VARIANT.${variant}.SELECT`;
  return roleScenario({
    id: `DL.WAVE2.ROLE.ACTION.${isRole ? `ROLE.${role.toUpperCase()}` : `VARIANT.${variant}`}`,
    requestPath: rolePath(startRole, startVariant),
    role,
    variant,
    transition: {
      selector: `[aria-label="${selectorGroup}"] a[href="${destinationPath}"]`,
      destinationPath,
    },
    actionIds: [actionId],
    stateIds: [roleSelectionStateId(role, variant)],
    fixtureIds: [roleSelectionFixtureId(role, variant)],
  });
});

const actionRoleSelections = new Set(
  roleActionScenarios.map((scenario) => scenario.inventoryCoverage.fixtureIds[0]),
);
const roleFixtureScenarios = DESIGN_LAB_ROLES.flatMap((role) =>
  PROTOTYPE_VARIANTS.filter(
    (variant) =>
      !actionRoleSelections.has(roleSelectionFixtureId(role.key, variant.key)),
  ).map((variant) =>
    roleScenario({
      id: `DL.WAVE2.ROLE.FIXTURE.${role.key.toUpperCase()}.${variant.key}`,
      requestPath: rolePath(role.key, variant.key),
      role: role.key,
      variant: variant.key,
      stateIds: [roleSelectionStateId(role.key, variant.key)],
      fixtureIds: [roleSelectionFixtureId(role.key, variant.key)],
    }),
  ),
);

const roleScenarios = [
  roleScenario({
    id: "DL.WAVE2.ROLE.DEFAULT",
    requestPath: "/design-lab/role-blueprints",
    role: "business",
    variant: "A1",
    stateIds: ["DL.STATE.DEFAULT.BUSINESS-A1"],
    fixtureIds: ["DL-ROLE-DEFAULT"],
  }),
  ...roleActionScenarios,
  ...roleFixtureScenarios,
  roleScenario({
    id: "DL.WAVE2.ROLE.FALLBACK",
    requestPath:
      "/design-lab/role-blueprints?role=unsupported&variant=Z9",
    role: "business",
    variant: "A1",
    stateIds: ["DL.STATE.FALLBACK.UNSUPPORTED-SELECTION"],
    fixtureIds: ["DL-ROLE-FALLBACK"],
  }),
];

const feedDeviceActionScenarios = PROTOTYPE_DEVICES.map((device, index) => {
  const start = PROTOTYPE_DEVICES[(index + 1) % PROTOTYPE_DEVICES.length];
  const destinationPath = feedPath(device.key, "A1", "D1", "on");
  return feedScenario({
    id: `DL.WAVE2.FEED.ACTION.DEVICE.${device.key.toUpperCase()}`,
    requestPath: feedPath(start.key, "A1", "D1", "on"),
    device: device.key,
    variant: "A1",
    dock: "D1",
    sponsored: "on",
    transition: {
      selector: `[aria-label="Choose device type"] a[href="${destinationPath}"]`,
      destinationPath,
    },
    actionIds: [`DL.ACTION.FEED-DEVICE.${device.key.toUpperCase()}.SELECT`],
    stateIds: [`DL.STATE.DEVICE-${device.key.toUpperCase()}`],
    fixtureIds: [`DL-FEED-DEVICE-${device.key.toUpperCase()}`],
  });
});

const feedVariantActionScenarios = PROTOTYPE_VARIANTS.map((variant, index) => {
  const start = PROTOTYPE_VARIANTS[(index + 1) % PROTOTYPE_VARIANTS.length];
  const destinationPath = feedPath("mobile", variant.key, "D1", "on");
  return feedScenario({
    id: `DL.WAVE2.FEED.ACTION.VARIANT.${variant.key}`,
    requestPath: feedPath("mobile", start.key, "D1", "on"),
    device: "mobile",
    variant: variant.key,
    dock: "D1",
    sponsored: "on",
    transition: {
      selector: `[aria-label="Choose design version"] a[href="${destinationPath}"]`,
      destinationPath,
    },
    actionIds: [`DL.ACTION.FEED-VARIANT.${variant.key}.SELECT`],
    stateIds: [`DL.STATE.VARIANT-${variant.key}`],
    fixtureIds: [`DL-FEED-VARIANT-${variant.key}`],
  });
});

const feedDockActionScenarios = DOCK_SKIN_REGISTRY.map((dock, index) => {
  const start = DOCK_SKIN_REGISTRY[(index + 1) % DOCK_SKIN_REGISTRY.length];
  const destinationPath = feedPath("mobile", "A1", dock.key, "on");
  return feedScenario({
    id: `DL.WAVE2.FEED.ACTION.DOCK.${dock.key}`,
    requestPath: feedPath("mobile", "A1", start.key, "on"),
    device: "mobile",
    variant: "A1",
    dock: dock.key,
    sponsored: "on",
    transition: {
      selector: `[aria-label="Choose dock skin"] a[href="${destinationPath}"]`,
      destinationPath,
    },
    actionIds: [`DL.ACTION.FEED-DOCK.${dock.key}.SELECT`],
    stateIds: [`DL.STATE.DOCK-${dock.key}`],
    fixtureIds: [`DL-FEED-DOCK-${dock.key}`],
  });
});

const feedScenarios = [
  feedScenario({
    id: "DL.WAVE2.FEED.DEFAULT",
    requestPath: "/feed/device-preview",
    device: "mobile",
    variant: "A1",
    dock: "D1",
    sponsored: "on",
    stateIds: ["DL.STATE.DEFAULT.MOBILE-A1-D1-SPONSORED-ON"],
    fixtureIds: ["DL-FEED-DEFAULT"],
  }),
  ...feedDeviceActionScenarios,
  ...feedVariantActionScenarios,
  ...feedDockActionScenarios,
  feedScenario({
    id: "DL.WAVE2.FEED.SPONSORED.ON",
    requestPath: feedPath("mobile", "A1", "D1", "on"),
    device: "mobile",
    variant: "A1",
    dock: "D1",
    sponsored: "on",
    stateIds: ["DL.STATE.SPONSORED-ON"],
    fixtureIds: ["DL-FEED-SPONSORED-ON"],
  }),
  feedScenario({
    id: "DL.WAVE2.FEED.SPONSORED.OFF",
    requestPath: feedPath("mobile", "A1", "D1", "off"),
    device: "mobile",
    variant: "A1",
    dock: "D1",
    sponsored: "off",
    stateIds: ["DL.STATE.SPONSORED-OFF"],
    fixtureIds: ["DL-FEED-SPONSORED-OFF"],
  }),
  feedScenario({
    id: "DL.WAVE2.FEED.SUPPORTED",
    requestPath: feedPath("tablet", "C2", "D6", "off"),
    device: "tablet",
    variant: "C2",
    dock: "D6",
    sponsored: "off",
    stateIds: ["DL.STATE.SELECTION.SUPPORTED"],
    fixtureIds: ["DL-FEED-SUPPORTED"],
  }),
  feedScenario({
    id: "DL.WAVE2.FEED.FALLBACK",
    requestPath:
      "/feed/device-preview?device=unsupported&variant=Z9&dock=D9&sponsored=unexpected",
    device: "mobile",
    variant: "A1",
    dock: "D1",
    sponsored: "on",
    stateIds: ["DL.STATE.FALLBACK.UNSUPPORTED-SELECTION"],
    fixtureIds: ["DL-FEED-FALLBACK"],
  }),
];

const marketplaceTemplateScenarios = MARKETPLACE_TEMPLATE_OPTIONS.map(
  (template, index) => {
    const start =
      MARKETPLACE_TEMPLATE_OPTIONS[(index + 1) % MARKETPLACE_TEMPLATE_OPTIONS.length];
    const destinationPath = marketplacePath(template.key);
    return marketplaceScenario({
      id: `DL.WAVE2.MARKETPLACE.ACTION.${template.key}`,
      requestPath: marketplacePath(start.key),
      template: template.key,
      transition: {
        selector: `[aria-label="Marketplace page templates"] a[href="${destinationPath}"]`,
        destinationPath,
      },
      actionIds: [`DL.ACTION.MARKETPLACE.${template.key}.SELECT`],
      stateIds: [`DL.STATE.MARKETPLACE.${template.key}`],
      fixtureIds: [`DL-MARKETPLACE-${template.key}`],
    });
  },
);

const featuredProfile = MARKETPLACE_TEMPLATE_LISTINGS[0];
const marketplaceScenarios = [
  marketplaceScenario({
    id: "DL.WAVE2.MARKETPLACE.DEFAULT",
    requestPath: "/marketplace/design-lab",
    template: "M1",
    stateIds: ["DL.STATE.DEFAULT.M1"],
    fixtureIds: ["DL-MARKETPLACE-DEFAULT"],
  }),
  ...marketplaceTemplateScenarios,
  marketplaceScenario({
    id: "DL.WAVE2.MARKETPLACE.FALLBACK",
    requestPath: "/marketplace/design-lab?template=unsupported",
    template: "M1",
    stateIds: ["DL.STATE.FALLBACK.UNSUPPORTED-TEMPLATE"],
    fixtureIds: ["DL-MARKETPLACE-FALLBACK"],
  }),
  marketplaceProfileScenario(),
];

export const DESIGN_LAB_HYDRATED_WAVE2_SCENARIOS = [
  ...roleScenarios,
  ...feedScenarios,
  ...marketplaceScenarios,
] as const satisfies readonly Wave2ScenarioDefinition[];

export const DESIGN_LAB_HYDRATED_WAVE2_INVENTORY_COVERAGE =
  DESIGN_LAB_HYDRATED_WAVE2_SCENARIOS.map(
    (scenario) => scenario.inventoryCoverage,
  ) satisfies readonly InventoryCoverage[];

assertExactInventoryCoverage();

function roleScenario(options: {
  id: string;
  requestPath: string;
  role: DesignLabRole;
  variant: PrototypeVariant;
  transition?: TransitionDefinition;
  actionIds?: readonly string[];
  stateIds: readonly string[];
  fixtureIds: readonly string[];
}): Wave2ScenarioDefinition {
  const view = expectedRoleView(options.requestPath, options.role, options.variant);
  return {
    id: options.id,
    route: "/design-lab/role-blueprints",
    requestPath: options.requestPath,
    mode: "role",
    ...(options.transition ? { transition: options.transition } : {}),
    expectedObserved: options.transition
      ? {
          transition: {
            from: roleTransitionPoint(options.requestPath),
            clickedHref: options.transition.destinationPath,
            to: roleTransitionPoint(
              options.transition.destinationPath,
              options.role,
              options.variant,
            ),
          },
          view: { ...view, currentPath: options.transition.destinationPath },
        }
      : { view },
    inventoryCoverage: coverage(
      options.id,
      "/design-lab/role-blueprints",
      options.actionIds,
      options.stateIds,
      options.fixtureIds,
    ),
  };
}

function feedScenario(options: {
  id: string;
  requestPath: string;
  device: PrototypeDevice;
  variant: PrototypeVariant;
  dock: DockSkinKey;
  sponsored: "on" | "off";
  transition?: TransitionDefinition;
  actionIds?: readonly string[];
  stateIds: readonly string[];
  fixtureIds: readonly string[];
}): Wave2ScenarioDefinition {
  const view = expectedFeedView(
    options.requestPath,
    options.device,
    options.variant,
    options.dock,
    options.sponsored,
  );
  return {
    id: options.id,
    route: "/feed/device-preview",
    requestPath: options.requestPath,
    mode: "feed",
    ...(options.transition ? { transition: options.transition } : {}),
    expectedObserved: options.transition
      ? {
          transition: {
            from: feedTransitionPoint(options.requestPath),
            clickedHref: options.transition.destinationPath,
            to: feedTransitionPoint(
              options.transition.destinationPath,
              options.device,
              options.variant,
              options.dock,
              options.sponsored,
            ),
          },
          view: { ...view, currentPath: options.transition.destinationPath },
        }
      : { view },
    inventoryCoverage: coverage(
      options.id,
      "/feed/device-preview",
      options.actionIds,
      options.stateIds,
      options.fixtureIds,
    ),
  };
}

function marketplaceScenario(options: {
  id: string;
  requestPath: string;
  template: MarketplaceTemplateKey;
  transition?: TransitionDefinition;
  actionIds?: readonly string[];
  stateIds: readonly string[];
  fixtureIds: readonly string[];
}): Wave2ScenarioDefinition {
  const view = expectedMarketplaceView(options.requestPath, options.template);
  return {
    id: options.id,
    route: "/marketplace/design-lab",
    requestPath: options.requestPath,
    mode: "marketplace",
    ...(options.transition ? { transition: options.transition } : {}),
    expectedObserved: options.transition
      ? {
          transition: {
            from: marketplaceTransitionPoint(options.requestPath),
            clickedHref: options.transition.destinationPath,
            to: marketplaceTransitionPoint(
              options.transition.destinationPath,
              options.template,
            ),
          },
          view: { ...view, currentPath: options.transition.destinationPath },
        }
      : { view },
    inventoryCoverage: coverage(
      options.id,
      "/marketplace/design-lab",
      options.actionIds,
      options.stateIds,
      options.fixtureIds,
    ),
  };
}

function marketplaceProfileScenario(): Wave2ScenarioDefinition {
  const id = "DL.WAVE2.MARKETPLACE.ACTION.PROFILE";
  const requestPath = marketplacePath("M1");
  return {
    id,
    route: "/marketplace/design-lab",
    requestPath,
    mode: "marketplace-profile",
    transition: {
      selector: `[data-marketplace-template="M1"] a[href="${featuredProfile.profileHref}"]`,
      destinationPath: featuredProfile.profileHref,
    },
    expectedObserved: {
      transition: {
        from: marketplaceTransitionPoint(requestPath, "M1"),
        clickedHref: featuredProfile.profileHref,
        to: {
          currentPath: featuredProfile.profileHref,
          heading: featuredProfile.name,
        },
      },
    },
    inventoryCoverage: coverage(
      id,
      "/marketplace/design-lab",
      ["DL.ACTION.MARKETPLACE.PROFILE.OPEN"],
      [],
      [],
    ),
  };
}

function coverage(
  scenarioId: string,
  route: Wave2Route,
  actionIds: readonly string[] = [],
  stateIds: readonly string[],
  fixtureIds: readonly string[],
): InventoryCoverage {
  return { scenarioId, route, actionIds, stateIds, fixtureIds };
}

function rolePath(role: DesignLabRole, variant: PrototypeVariant) {
  return `/design-lab/role-blueprints?role=${role}&variant=${variant}`;
}

function roleSelectionFixtureId(
  role: DesignLabRole,
  variant: PrototypeVariant,
) {
  return `DL-ROLE-${role.toUpperCase()}-${variant}`;
}

function roleSelectionStateId(
  role: DesignLabRole,
  variant: PrototypeVariant,
) {
  return `DL.STATE.SELECTION.${role.toUpperCase()}-${variant}`;
}

function feedPath(
  device: PrototypeDevice,
  variant: PrototypeVariant,
  dock: DockSkinKey,
  sponsored: "on" | "off",
) {
  return `/feed/device-preview?device=${device}&variant=${variant}&dock=${dock}&sponsored=${sponsored}`;
}

function marketplacePath(template: MarketplaceTemplateKey) {
  return `/marketplace/design-lab?template=${template}`;
}

function expectedRoleView(
  currentPath: string,
  role: DesignLabRole,
  variant: PrototypeVariant,
) {
  const roleOption = DESIGN_LAB_ROLES.find((option) => option.key === role)!;
  const variantOption = PROTOTYPE_VARIANTS.find(
    (option) => option.key === variant,
  )!;
  return {
    currentPath,
    role,
    variant,
    compositionFamily: PROTOTYPE_TEMPLATE_COMPOSITIONS[variant].family,
    currentRoleHrefs: [rolePath(role, variant)],
    currentVariantHrefs: [rolePath(role, variant)],
    heading: `${roleOption.label} · ${variantOption.label} / ${variantOption.detail}`,
    priorityLabel: `${roleOption.label} priorities`,
  };
}

function expectedFeedView(
  currentPath: string,
  device: PrototypeDevice,
  variant: PrototypeVariant,
  dock: DockSkinKey,
  sponsored: "on" | "off",
) {
  const frame = getAppDockReviewFrame(variant, dock, device);
  const deviceOption = PROTOTYPE_DEVICES.find((option) => option.key === device)!;
  const dockOption = DOCK_SKIN_REGISTRY.find((option) => option.key === dock)!;
  const target = `/feed?variant=${variant}&demo=1&dock=${dock}&sponsored=${sponsored}`;
  const activeHref = feedPath(device, variant, dock, sponsored);
  return {
    currentPath,
    device,
    variant,
    dock,
    sponsored,
    frameId: frame.id,
    dimensions: `${frame.width}x${frame.height}`,
    target,
    shellReviewId: getPrototypeReviewId(variant, device, "SHELL"),
    currentDeviceHrefs: [activeHref],
    currentVariantHrefs: [activeHref],
    currentDockHrefs: [activeHref],
    reviewIds: PROTOTYPE_REVIEW_COMPONENTS.map((component) =>
      getPrototypeReviewId(variant, device, component.key),
    ),
    iframe: {
      src: target,
      title: `${deviceOption.label} version ${variant} with ${dock} ${dockOption.label} dock`,
      width: String(deviceOption.width),
      height: String(deviceOption.height),
    },
  };
}

function expectedMarketplaceView(
  currentPath: string,
  template: MarketplaceTemplateKey,
) {
  const option = MARKETPLACE_TEMPLATE_OPTIONS.find(
    (candidate) => candidate.key === template,
  )!;
  return {
    currentPath,
    template,
    layoutFamily: MARKETPLACE_LAYOUT_FAMILIES[template],
    currentTemplateHrefs: [marketplacePath(template)],
    summary: [option.key, option.label, option.detail],
  };
}

function roleTransitionPoint(
  currentPath: string,
  role?: DesignLabRole,
  variant?: PrototypeVariant,
) {
  const params = new URL(currentPath, "http://greyhoundiq.test").searchParams;
  const resolvedRole = role ??
    (DESIGN_LAB_ROLES.some((option) => option.key === params.get("role"))
      ? (params.get("role") as DesignLabRole)
      : "business");
  const resolvedVariant = variant ??
    (PROTOTYPE_VARIANTS.some((option) => option.key === params.get("variant"))
      ? (params.get("variant") as PrototypeVariant)
      : "A1");
  return { currentPath, role: resolvedRole, variant: resolvedVariant };
}

function feedTransitionPoint(
  currentPath: string,
  device?: PrototypeDevice,
  variant?: PrototypeVariant,
  dock?: DockSkinKey,
  sponsored?: "on" | "off",
) {
  const params = Object.fromEntries(
    new URL(currentPath, "http://greyhoundiq.test").searchParams,
  );
  const resolved = resolveAppDockReviewSelection(params);
  return {
    currentPath,
    device: device ?? resolved.device,
    variant: variant ?? resolved.variant,
    dock: dock ?? resolved.dock,
    sponsored:
      sponsored ?? resolveSponsoredMarketplaceVisibility(params.sponsored),
  };
}

function marketplaceTransitionPoint(
  currentPath: string,
  template?: MarketplaceTemplateKey,
) {
  const selected =
    template ??
    resolveMarketplaceTemplateKey(
      new URL(currentPath, "http://greyhoundiq.test").searchParams.get(
        "template",
      ),
    );
  return { currentPath, template: selected };
}

function assertExactInventoryCoverage() {
  const scenarioIds = DESIGN_LAB_HYDRATED_WAVE2_SCENARIOS.map(
    (scenario) => scenario.id,
  );
  if (new Set(scenarioIds).size !== scenarioIds.length) {
    throw new Error("Wave 2 hydrated scenario IDs must be unique.");
  }
  for (const route of DESIGN_LAB_HYDRATED_WAVE2_ROUTES) {
    const manifest = DESIGN_LAB_USER_STORY_MANIFESTS.find(
      (candidate) => candidate.route === route,
    );
    if (!manifest) throw new Error(`Missing Design Lab manifest for ${route}.`);
    const rows = DESIGN_LAB_HYDRATED_WAVE2_INVENTORY_COVERAGE.filter(
      (row) => row.route === route,
    );
    assertExactIds(
      route,
      "actions",
      rows.flatMap((row) => row.actionIds),
      manifest.actions.map((item) => item.id),
    );
    assertExactIds(
      route,
      "states",
      rows.flatMap((row) => row.stateIds),
      manifest.states.map((item) => item.id),
    );
    assertExactIds(
      route,
      "fixtures",
      rows.flatMap((row) => row.fixtureIds),
      manifest.designLab.map((item) => item.fixtureId),
    );
  }
}

function assertExactIds(
  route: string,
  area: string,
  actual: readonly string[],
  expected: readonly string[],
) {
  if (new Set(actual).size !== actual.length) {
    throw new Error(`${route}/${area}: a wave 2 ID is covered more than once.`);
  }
  if (!canonicalJsonEquals([...actual].toSorted(), [...expected].toSorted())) {
    const actualSet = new Set(actual);
    const expectedSet = new Set(expected);
    const missing = expected.filter((id) => !actualSet.has(id));
    const unexpected = actual.filter((id) => !expectedSet.has(id));
    throw new Error(
      `${route}/${area}: wave 2 coverage is not the exact manifest set; missing=${JSON.stringify(missing)} unexpected=${JSON.stringify(unexpected)}.`,
    );
  }
}

export function findDesignLabHydratedWave2AuditIssues(
  value: unknown,
  binding?: {
    headSha: string;
    sourceSha256: string;
    sourceFileCount: number;
    companionHttpAuditSha256: string;
    now?: number;
  },
) {
  if (!isRecord(value)) return ["Wave 2 hydrated audit must be a JSON object."];
  const issues: string[] = [];
  if (value.schemaVersion !== 1) {
    issues.push("Wave 2 hydrated audit schemaVersion must be 1.");
  }
  if (value.auditKind !== "design-lab-hydrated-wave2") {
    issues.push("Wave 2 hydrated audit kind is invalid.");
  }
  if (
    value.evidenceBoundary !== DESIGN_LAB_HYDRATED_WAVE2_EVIDENCE_BOUNDARY
  ) {
    issues.push("Wave 2 hydrated audit evidence boundary is invalid.");
  }
  if (!isLoopbackBaseUrl(value.baseUrl)) {
    issues.push("Wave 2 hydrated audit baseUrl must be a loopback origin.");
  }
  if (
    !isRecord(value.browser) ||
    typeof value.browser.product !== "string" ||
    !/Chrome\//.test(value.browser.product) ||
    typeof value.browser.protocolVersion !== "string"
  ) {
    issues.push("Wave 2 hydrated audit browser metadata is invalid.");
  }
  const companion = isRecord(value.companionHttpAudit)
    ? value.companionHttpAudit
    : undefined;
  if (
    !companion ||
    companion.path !== DESIGN_LAB_STORY_AUDIT_PATH ||
    companion.auditKind !== "design-lab-user-stories" ||
    typeof companion.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(companion.sha256) ||
    companion.sourceSha256 !== value.sourceSha256 ||
    companion.expectedScenarios !== DESIGN_LAB_STORY_RUNTIME_CASES.length ||
    companion.passedScenarios !== DESIGN_LAB_STORY_RUNTIME_CASES.length
  ) {
    issues.push("Wave 2 hydrated companion HTTP evidence is invalid.");
  }
  if (
    !canonicalJsonEquals(
      value.inventoryCoverage,
      DESIGN_LAB_HYDRATED_WAVE2_INVENTORY_COVERAGE,
    )
  ) {
    issues.push("Wave 2 hydrated inventory coverage map is invalid.");
  }

  const rawResults = Array.isArray(value.results) ? value.results : [];
  const results = rawResults.filter(isRecord);
  if (
    rawResults.length !== DESIGN_LAB_HYDRATED_WAVE2_SCENARIOS.length ||
    results.length !== rawResults.length
  ) {
    issues.push(
      `Wave 2 hydrated audit has ${results.length}/${DESIGN_LAB_HYDRATED_WAVE2_SCENARIOS.length} scenario rows.`,
    );
  }
  for (const scenario of DESIGN_LAB_HYDRATED_WAVE2_SCENARIOS) {
    const matches = results.filter((result) => result.id === scenario.id);
    const result = matches[0];
    if (
      matches.length !== 1 ||
      result?.route !== scenario.route ||
      result?.requestPath !== scenario.requestPath ||
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
      !Array.isArray(result?.runtimeExceptions) ||
      result.runtimeExceptions.length !== 0 ||
      result?.actionGetObserved !== (scenario.transition ? true : null) ||
      !canonicalJsonEquals(result?.observed, scenario.expectedObserved) ||
      !canonicalJsonEquals(
        result?.inventoryCoverage,
        scenario.inventoryCoverage,
      )
    ) {
      issues.push(
        `Wave 2 scenario ${scenario.id} must have one exact passing row.`,
      );
    }
  }
  if (
    value.expectedScenarios !== DESIGN_LAB_HYDRATED_WAVE2_SCENARIOS.length ||
    value.passedScenarios !== DESIGN_LAB_HYDRATED_WAVE2_SCENARIOS.length
  ) {
    issues.push("Wave 2 hydrated audit summary is incomplete.");
  }

  if (binding) {
    if (value.testedCommitSha !== binding.headSha) {
      issues.push("Wave 2 hydrated audit is not bound to the current Git HEAD.");
    }
    if (value.sourceSha256 !== binding.sourceSha256) {
      issues.push("Wave 2 hydrated source digest is stale.");
    }
    if (value.sourceFileCount !== binding.sourceFileCount) {
      issues.push("Wave 2 hydrated source-file count is stale.");
    }
    if (companion?.sha256 !== binding.companionHttpAuditSha256) {
      issues.push("Wave 2 hydrated companion HTTP digest is stale.");
    }
    const generatedAt =
      typeof value.generatedAt === "string"
        ? Date.parse(value.generatedAt)
        : Number.NaN;
    const now = binding.now ?? Date.now();
    if (!Number.isFinite(generatedAt)) {
      issues.push("Wave 2 hydrated generatedAt is invalid.");
    } else if (generatedAt > now + 5 * 60_000) {
      issues.push("Wave 2 hydrated generatedAt is in the future.");
    } else if (now - generatedAt > 24 * 60 * 60_000) {
      issues.push("Wave 2 hydrated evidence is older than 24 hours.");
    }
  }
  return issues;
}

class CdpClient {
  private nextId = 1;
  private pending = new Map<number, PendingCommand>();
  private listeners = new Set<(event: CdpEvent) => void>();

  private constructor(private readonly socket: WebSocket) {
    socket.addEventListener("message", (event) =>
      void this.handleMessage(event.data),
    );
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
      const timeout = setTimeout(
        () => reject(new Error("Chrome DevTools connection timed out.")),
        15_000,
      );
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
      if (message.error) {
        command.reject(
          new Error(message.error.message ?? "Chrome DevTools command failed."),
        );
      } else {
        command.resolve(message.result ?? {});
      }
      return;
    }
    if (!message.method) return;
    const event = { method: message.method, params: message.params };
    for (const listener of this.listeners) listener(event);
  }
}

async function runScenario(
  client: CdpClient,
  baseUrl: string,
  scenario: Wave2ScenarioDefinition,
) {
  const startedAt = performance.now();
  const requestUrl = new URL(scenario.requestPath, baseUrl).href;
  const mutatingRequests: Array<{ method: string; url: string }> = [];
  const runtimeExceptions: string[] = [];
  let scenarioStarted = false;
  let actionPhase = false;
  let actionGetObserved = false;
  let documentResponse:
    | { status: number; headers: Record<string, string> }
    | undefined;
  const unsubscribe = client.onEvent((event) => {
    if (event.method === "Network.requestWillBeSent" && scenarioStarted) {
      const request = isRecord(event.params?.request)
        ? event.params.request
        : undefined;
      const method = typeof request?.method === "string" ? request.method : "";
      const url = typeof request?.url === "string" ? request.url : "";
      if (method && !["GET", "HEAD", "OPTIONS"].includes(method)) {
        mutatingRequests.push({ method, url });
      }
      if (
        actionPhase &&
        method === "GET" &&
        scenario.transition &&
        requestMatchesDestination(url, scenario.transition.destinationPath)
      ) {
        actionGetObserved = true;
      }
    }
    if (event.method === "Network.responseReceived") {
      const response = isRecord(event.params?.response)
        ? event.params.response
        : undefined;
      if (
        event.params?.type === "Document" &&
        response?.url === requestUrl
      ) {
        documentResponse = {
          status: typeof response.status === "number" ? response.status : 0,
          headers: normalizeHeaders(response.headers),
        };
      }
    }
    if (event.method === "Runtime.exceptionThrown" && scenarioStarted) {
      const details = isRecord(event.params?.exceptionDetails)
        ? event.params.exceptionDetails
        : undefined;
      const exception = isRecord(details?.exception)
        ? details.exception
        : undefined;
      runtimeExceptions.push(
        typeof exception?.description === "string"
          ? exception.description
          : typeof details?.text === "string"
            ? details.text
            : "Unhandled browser exception",
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
    await waitForExpression(client, readyExpression(scenario.mode));
    await delay(350);

    let observed: unknown;
    if (scenario.transition) {
      const from = await evaluate(
        client,
        transitionPointExpression(
          resolveWave2TransitionPointMode(scenario.mode, "from"),
        ),
      );
      actionPhase = true;
      const clickedHref = await evaluate(
        client,
        clickExpression(scenario.transition.selector),
      );
      await waitForExpression(
        client,
        destinationReadyExpression(
          scenario.mode,
          scenario.transition.destinationPath,
        ),
      );
      await delay(200);
      const to = await evaluate(
        client,
        transitionPointExpression(
          resolveWave2TransitionPointMode(scenario.mode, "to"),
        ),
      );
      actionPhase = false;
      observed =
        scenario.mode === "marketplace-profile"
          ? { transition: { from, clickedHref, to } }
          : {
              transition: { from, clickedHref, to },
              view: await evaluate(client, viewExpression(scenario.mode)),
            };
    } else {
      observed = { view: await evaluate(client, viewExpression(scenario.mode)) };
    }
    await delay(100);

    const failures: string[] = [];
    if (documentResponse?.status !== 200) {
      failures.push(`HTTP ${documentResponse?.status ?? 0}, expected 200`);
    }
    if (!documentResponse?.headers["x-request-id"]) {
      failures.push("missing X-Request-ID");
    }
    if (
      documentResponse?.headers["x-greyhoundiq-demo"] !==
      "full-access-read-only"
    ) {
      failures.push("missing full-access-read-only demo boundary");
    }
    if (!canonicalJsonEquals(observed, scenario.expectedObserved)) {
      failures.push("observed transition state does not match the exact contract");
    }
    if (scenario.transition && !actionGetObserved) {
      failures.push("user transition did not issue a matching GET request");
    }
    if (mutatingRequests.length > 0) {
      failures.push("scenario issued a mutating request");
    }
    if (runtimeExceptions.length > 0) {
      failures.push("scenario raised a browser exception");
    }

    return {
      id: scenario.id,
      route: scenario.route,
      requestPath: scenario.requestPath,
      httpStatus: documentResponse?.status ?? 0,
      requestIdPresent: Boolean(documentResponse?.headers["x-request-id"]),
      requestId: documentResponse?.headers["x-request-id"] ?? null,
      demoMode: documentResponse?.headers["x-greyhoundiq-demo"] ?? null,
      durationMs: Math.round(performance.now() - startedAt),
      observed,
      actionGetObserved: scenario.transition ? actionGetObserved : null,
      mutatingRequests,
      runtimeExceptions,
      inventoryCoverage: scenario.inventoryCoverage,
      passed: failures.length === 0,
      failures,
    };
  } finally {
    actionPhase = false;
    scenarioStarted = false;
    unsubscribe();
  }
}

function readyExpression(mode: Wave2Mode) {
  if (mode === "role") {
    return `Boolean(document.querySelector('[data-role-blueprint-lab]') && document.querySelector('[aria-label="Choose member role"] a[aria-current="page"]') && document.querySelector('[aria-label="Choose app template"] a[aria-current="page"]'))`;
  }
  if (mode === "feed") {
    return `Boolean(document.querySelector('[data-device-preview]') && document.querySelector('[data-review-frame-id] iframe') && document.querySelector('[aria-label="Choose device type"] a[aria-current="page"]') && document.querySelector('[aria-label="Choose design version"] a[aria-current="page"]') && document.querySelector('[aria-label="Choose dock skin"] a[aria-current="page"]'))`;
  }
  return `Boolean(document.querySelector('[data-marketplace-template]') && document.querySelector('[aria-label="Marketplace page templates"] a[aria-current="page"]'))`;
}

function destinationReadyExpression(mode: Wave2Mode, destinationPath: string) {
  const pathLiteral = JSON.stringify(destinationPath);
  if (mode === "marketplace-profile") {
    return `(location.pathname + location.search === ${pathLiteral} && Boolean(document.querySelector('h1')))`;
  }
  return `(location.pathname + location.search === ${pathLiteral} && ${readyExpression(mode)})`;
}

function clickExpression(selector: string) {
  return `(() => {
    const link = document.querySelector(${JSON.stringify(selector)});
    if (!(link instanceof HTMLAnchorElement)) throw new Error('wave 2 action link is missing');
    const href = link.getAttribute('href');
    link.click();
    return href;
  })()`;
}

export function resolveWave2TransitionPointMode(
  mode: Wave2Mode,
  phase: "from" | "to",
): Wave2Mode {
  return mode === "marketplace-profile" && phase === "from"
    ? "marketplace"
    : mode;
}

function transitionPointExpression(mode: Wave2Mode) {
  if (mode === "role") {
    return `(() => {
      const root = document.querySelector('[data-role-blueprint-lab]');
      return {
        currentPath: location.pathname + location.search,
        role: root?.getAttribute('data-role-blueprint') ?? null,
        variant: root?.getAttribute('data-app-template') ?? null,
      };
    })()`;
  }
  if (mode === "feed") {
    return `(() => {
      const frame = document.querySelector('[data-review-frame-id]');
      return {
        currentPath: location.pathname + location.search,
        device: frame?.getAttribute('data-review-device') ?? null,
        variant: frame?.getAttribute('data-review-variant') ?? null,
        dock: frame?.getAttribute('data-review-dock') ?? null,
        sponsored: frame?.getAttribute('data-sponsored-marketplace') ?? null,
      };
    })()`;
  }
  if (mode === "marketplace-profile") {
    return `(() => ({
      currentPath: location.pathname + location.search,
      heading: document.querySelector('h1')?.textContent?.replace(/\\s+/g, ' ').trim() ?? null,
    }))()`;
  }
  return `(() => ({
    currentPath: location.pathname + location.search,
    template: document.querySelector('[data-marketplace-template]')?.getAttribute('data-marketplace-template') ?? null,
  }))()`;
}

function viewExpression(mode: Wave2Mode) {
  if (mode === "role") {
    return `(() => {
      const root = document.querySelector('[data-role-blueprint-lab]');
      return {
        currentPath: location.pathname + location.search,
        role: root?.getAttribute('data-role-blueprint') ?? null,
        variant: root?.getAttribute('data-app-template') ?? null,
        compositionFamily: root?.getAttribute('data-composition-family') ?? null,
        currentRoleHrefs: [...document.querySelectorAll('[aria-label="Choose member role"] a[aria-current="page"]')].map((link) => link.getAttribute('href')),
        currentVariantHrefs: [...document.querySelectorAll('[aria-label="Choose app template"] a[aria-current="page"]')].map((link) => link.getAttribute('href')),
        heading: document.querySelector('#blueprint-preview-title')?.textContent?.replace(/\\s+/g, ' ').trim() ?? null,
        priorityLabel: document.querySelector('[aria-label$=" priorities"]')?.getAttribute('aria-label') ?? null,
      };
    })()`;
  }
  if (mode === "feed") {
    return `(() => {
      const frame = document.querySelector('[data-review-frame-id]');
      const iframe = frame?.querySelector('iframe');
      return {
        currentPath: location.pathname + location.search,
        device: frame?.getAttribute('data-review-device') ?? null,
        variant: frame?.getAttribute('data-review-variant') ?? null,
        dock: frame?.getAttribute('data-review-dock') ?? null,
        sponsored: frame?.getAttribute('data-sponsored-marketplace') ?? null,
        frameId: frame?.getAttribute('data-review-frame-id') ?? null,
        dimensions: frame?.getAttribute('data-review-dimensions') ?? null,
        target: frame?.getAttribute('data-review-target') ?? null,
        shellReviewId: frame?.getAttribute('data-review-id') ?? null,
        currentDeviceHrefs: [...document.querySelectorAll('[aria-label="Choose device type"] a[aria-current="page"]')].map((link) => link.getAttribute('href')),
        currentVariantHrefs: [...document.querySelectorAll('[aria-label="Choose design version"] a[aria-current="page"]')].map((link) => link.getAttribute('href')),
        currentDockHrefs: [...document.querySelectorAll('[aria-label="Choose dock skin"] a[aria-current="page"]')].map((link) => link.getAttribute('href')),
        reviewIds: [...document.querySelectorAll('[data-review-summary] [data-review-id]')].map((item) => item.getAttribute('data-review-id')),
        iframe: {
          src: iframe?.getAttribute('src') ?? null,
          title: iframe?.getAttribute('title') ?? null,
          width: iframe?.getAttribute('width') ?? null,
          height: iframe?.getAttribute('height') ?? null,
        },
      };
    })()`;
  }
  return `(() => {
    const template = document.querySelector('[data-marketplace-template]');
    const summary = document.querySelector('[aria-live="polite"]');
    return {
      currentPath: location.pathname + location.search,
      template: template?.getAttribute('data-marketplace-template') ?? null,
      layoutFamily: template?.getAttribute('data-layout-family') ?? null,
      currentTemplateHrefs: [...document.querySelectorAll('[aria-label="Marketplace page templates"] a[aria-current="page"]')].map((link) => link.getAttribute('href')),
      summary: [...(summary?.children ?? [])].map((item) => item.textContent?.replace(/\\s+/g, ' ').trim() ?? null),
    };
  })()`;
}

async function main() {
  const repositoryRoot = path.resolve(".");
  const baseUrl = resolveLoopbackBaseUrl(readFlag("--base-url"));
  const outputPath = path.resolve(
    readFlag("--output") ?? DESIGN_LAB_HYDRATED_WAVE2_AUDIT_PATH,
  );
  const sourceContract = {
    directFiles: ["scripts/audit-design-lab-hydrated-wave2.ts"],
    transitiveImportRoots: DESIGN_LAB_HYDRATED_WAVE2_ROUTES.flatMap((route) => {
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
  const companionJson = await readFile(
    path.resolve(repositoryRoot, DESIGN_LAB_STORY_AUDIT_PATH),
    "utf8",
  );
  const companionSha256 = createHash("sha256")
    .update(companionJson)
    .digest("hex");
  const companion = JSON.parse(companionJson) as unknown;
  const companionSourceFiles = parseDesignLabSourceFiles(companion);
  if (!companionSourceFiles) {
    throw new Error("Companion HTTP audit source files are missing or invalid.");
  }
  const companionSource = fingerprintRepositoryFiles(
    repositoryRoot,
    companionSourceFiles,
  );
  const companionTestedCommitSha =
    isRecord(companion) && typeof companion.testedCommitSha === "string"
      ? companion.testedCommitSha
      : "";
  const companionIssues = findDesignLabStoryAuditIssues(companion, {
    headSha: companionTestedCommitSha,
    sourceSha256: companionSource.sha256,
    sourceFileCount: companionSource.fileCount,
  });
  if (companionIssues.length > 0) {
    throw new Error(
      `Companion HTTP audit is invalid:\n${companionIssues.join("\n")}`,
    );
  }
  if (!isRecord(companion)) {
    throw new Error("Companion HTTP audit must be an object.");
  }

  const chromeExecutable = resolveChromeExecutable();
  const profileDirectory = await mkdtemp(
    path.join(tmpdir(), "greyhoundiq-wave2-cdp-"),
  );
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
      await client.send("Network.setCacheDisabled", { cacheDisabled: true });
      const results = [];
      for (const scenario of DESIGN_LAB_HYDRATED_WAVE2_SCENARIOS) {
        try {
          results.push(await runScenario(client, baseUrl, scenario));
        } catch (error) {
          throw new Error(
            `${scenario.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      const sourceAfter = getDesignLabSourceFingerprint(repositoryRoot, sourceContract);
      if (!canonicalJsonEquals(sourceAfter, sourceBefore)) {
        throw new Error(
          "Design Lab source changed during wave 2; discard the run.",
        );
      }
      const report = {
        schemaVersion: 1,
        auditKind: "design-lab-hydrated-wave2",
        evidenceBoundary: DESIGN_LAB_HYDRATED_WAVE2_EVIDENCE_BOUNDARY,
        generatedAt: new Date().toISOString(),
        baseUrl,
        browser: {
          product: version.Browser,
          protocolVersion: version["Protocol-Version"],
        },
        companionHttpAudit: {
          path: DESIGN_LAB_STORY_AUDIT_PATH,
          auditKind: companion.auditKind,
          sha256: companionSha256,
          sourceSha256: companion.sourceSha256,
          expectedScenarios: companion.expectedScenarios,
          passedScenarios: companion.passedScenarios,
        },
        inventoryCoverage: DESIGN_LAB_HYDRATED_WAVE2_INVENTORY_COVERAGE,
        testedCommitSha,
        sourceSha256: sourceBefore.sha256,
        sourceFileCount: sourceBefore.fileCount,
        sourceFiles,
        expectedScenarios: DESIGN_LAB_HYDRATED_WAVE2_SCENARIOS.length,
        passedScenarios: results.filter((result) => result.passed).length,
        results,
      };
      const issues = findDesignLabHydratedWave2AuditIssues(report, {
        headSha: testedCommitSha,
        sourceSha256: sourceBefore.sha256,
        sourceFileCount: sourceBefore.fileCount,
        companionHttpAuditSha256: companionSha256,
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
      await writeWave2ReportAtomically(outputPath, reportJson);
      console.log(
        `Design Lab hydrated wave 2: ${report.passedScenarios}/${report.expectedScenarios} scenarios.`,
      );
      console.log(
        `Evidence SHA-256: ${createHash("sha256").update(reportJson).digest("hex")}`,
      );
      console.log(`Report: ${outputPath}`);
    } finally {
      client.close();
    }
  } finally {
    await stopChrome(chrome);
    await removeChromeProfile(profileDirectory);
  }
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

async function waitForExpression(
  client: CdpClient,
  expression: string,
  timeoutMs = 25_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(client, expression)) return;
    await delay(100);
  }
  throw new Error(`Browser condition timed out: ${expression}`);
}

function requestMatchesDestination(requestUrl: string, destinationPath: string) {
  try {
    const actual = new URL(requestUrl);
    const expected = new URL(destinationPath, actual.origin);
    if (actual.pathname !== expected.pathname) return false;
    return [...expected.searchParams].every(
      ([key, value]) => actual.searchParams.get(key) === value,
    );
  } catch {
    return false;
  }
}

export async function writeWave2ReportAtomically(
  outputPath: string,
  reportJson: string,
) {
  const temporaryPath = path.join(
    path.dirname(outputPath),
    `.${path.basename(outputPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporaryPath, reportJson, { encoding: "utf8", flag: "wx" });
    await rename(temporaryPath, outputPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

export function canonicalJsonEquals(left: unknown, right: unknown) {
  return (
    JSON.stringify(canonicalizeJson(left)) ===
    JSON.stringify(canonicalizeJson(right))
  );
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

function normalizeHeaders(value: unknown) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([key, header]) => [
      key.toLowerCase(),
      String(header),
    ]),
  );
}

function resolveLoopbackBaseUrl(raw = "http://localhost:3000") {
  if (!isLoopbackBaseUrl(raw)) {
    throw new Error(
      "--base-url must be an HTTP(S) loopback origin without credentials, path, query or hash.",
    );
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
    process.env.PROGRAMFILES &&
      path.join(
        process.env.PROGRAMFILES,
        "Google/Chrome/Application/chrome.exe",
      ),
    process.env["PROGRAMFILES(X86)"] &&
      path.join(
        process.env["PROGRAMFILES(X86)"],
        "Google/Chrome/Application/chrome.exe",
      ),
    process.env.LOCALAPPDATA &&
      path.join(
        process.env.LOCALAPPDATA,
        "Google/Chrome/Application/chrome.exe",
      ),
  ].filter((candidate): candidate is string => Boolean(candidate));
  const executable = candidates.find(existsSync);
  if (!executable) {
    throw new Error("Google Chrome was not found in a standard Windows path.");
  }
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
      server.close((error) =>
        error ? reject(error) : resolve(address.port),
      );
    });
  });
}

async function waitForChrome(port: number, chrome: ChildProcess) {
  const endpoint = `http://127.0.0.1:${port}/json/version`;
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (chrome.exitCode !== null) {
      throw new Error("Google Chrome exited before DevTools became ready.");
    }
    try {
      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok) {
        return (await response.json()) as Record<string, string>;
      }
    } catch {
      // Chrome has not opened the loopback debugger yet.
    }
    await delay(100);
  }
  throw new Error("Google Chrome DevTools endpoint did not become ready.");
}

async function createTarget(port: number) {
  const response = await fetch(
    `http://127.0.0.1:${port}/json/new?about%3Ablank`,
    { method: "PUT", signal: AbortSignal.timeout(5_000) },
  );
  if (!response.ok) {
    throw new Error(`Unable to create Chrome target: HTTP ${response.status}.`);
  }
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
    !/^greyhoundiq-wave2-cdp-[a-z0-9_-]+$/i.test(
      path.basename(relativeProfile),
    )
  ) {
    throw new Error("Refusing to remove an unexpected Chrome profile path.");
  }
  await rm(canonicalProfile, {
    recursive: true,
    force: true,
    maxRetries: 3,
    retryDelay: 100,
  });
}

function readFlag(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
