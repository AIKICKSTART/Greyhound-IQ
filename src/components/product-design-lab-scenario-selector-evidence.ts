import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_DESIGN_LAB_SCENARIO_SELECTOR_EVIDENCE_FILE =
  "src/components/product-design-lab-scenario-selector-evidence.ts" as const;
export const PRODUCT_DESIGN_LAB_SCENARIO_SELECTOR_TEST_FILE =
  "src/components/product-design-lab-scenario-selector-evidence.test.ts" as const;

export const PRODUCT_DESIGN_LAB_SCENARIO_SELECTOR_REQUIREMENT_IDS = [
  "DL.SELECT.product-area",
  "DL.SELECT.role",
  "DL.SELECT.device-width",
  "DL.SELECT.dock",
  "DL.SELECT.appearance",
  "DL.SELECT.sponsored",
  "DL.URL.role",
  "DL.URL.device",
  "DL.URL.dock",
] as const;

export const PRODUCT_DESIGN_LAB_EXISTING_ROUTE_SELECTOR_REQUIREMENT_IDS = [
  "DL.SELECT.route",
  "DL.URL.route",
] as const;

export const PRODUCT_DESIGN_LAB_DELEGATED_SELECTOR_URL_REQUIREMENT_IDS = [
  "DL.SELECT.record",
  "DL.SELECT.tier",
  "DL.SELECT.auth",
  "DL.SELECT.permissions",
  "DL.SELECT.feature-flags",
  "DL.SELECT.orientation",
  "DL.SELECT.navigation",
  "DL.SELECT.data-state",
  "DL.SELECT.network-state",
  "DL.SELECT.error-state",
  "DL.SELECT.tour",
  "DL.SELECT.tour-step",
  "DL.SELECT.reduced-motion",
  "DL.SELECT.high-contrast",
  "DL.SELECT.long-content",
  "DL.SELECT.missing-image",
  "DL.SELECT.slow-network",
  "DL.URL.fixture",
  "DL.URL.tier",
  "DL.URL.auth",
  "DL.URL.permissions",
  "DL.URL.orientation",
  "DL.URL.theme",
  "DL.URL.state",
  "DL.URL.tour",
  "DL.URL.tour-step",
  "DL.URL.sponsored-demo",
  "DL.URL.reduced-motion",
  "DL.URL.reproduce",
] as const;

export const PRODUCT_DESIGN_LAB_SCENARIO_SELECTOR_SCOPE =
  "Current-source-bound isolated loopback evidence for the product-area family filter, role selector, exact device frames, dock skins, visual app templates and sponsored-card visibility. It proves role, device and dock URL persistence on the appearance and feed-preview surfaces. The companion scenario-simulator evidence owns and verifies the remaining selector and URL dimensions, including the canonical sponsoredDemo Design Lab query key; this module declares no open selector or URL gap.";

export const PRODUCT_DESIGN_LAB_SCENARIO_SELECTOR_PROOFS = [
  {
    key: "product-area",
    requirementIds: ["DL.SELECT.product-area"],
    audit: "hydrated-stories",
    scenarios: [
      {
        id: "DL.STORY.CONTRACT-WORKSPACE.HYDRATED",
        actionIds: ["DL.ACTION.SCREEN.SEARCH", "DL.ACTION.FAMILY.FILTER"],
      },
    ],
  },
  {
    key: "role",
    requirementIds: ["DL.SELECT.role", "DL.URL.role"],
    audit: "hydrated-wave2",
    scenarios: ["BUSINESS", "TRAINER", "OWNER", "PUNTER"].map((role) => ({
      id: `DL.WAVE2.ROLE.ACTION.ROLE.${role}`,
      actionIds: [`DL.ACTION.ROLE.${role}.SELECT`],
    })),
  },
  {
    key: "device-width",
    requirementIds: ["DL.SELECT.device-width", "DL.URL.device"],
    audit: "hydrated-wave2",
    scenarios: ["DESKTOP", "TABLET", "MOBILE"].map((device) => ({
      id: `DL.WAVE2.FEED.ACTION.DEVICE.${device}`,
      actionIds: [`DL.ACTION.FEED-DEVICE.${device}.SELECT`],
    })),
  },
  {
    key: "dock",
    requirementIds: ["DL.SELECT.dock", "DL.URL.dock"],
    audit: "hydrated-wave2",
    scenarios: ["D1", "D2", "D3", "D4", "D5", "D6"].map((dock) => ({
      id: `DL.WAVE2.FEED.ACTION.DOCK.${dock}`,
      actionIds: [`DL.ACTION.FEED-DOCK.${dock}.SELECT`],
    })),
  },
  {
    key: "appearance",
    requirementIds: ["DL.SELECT.appearance"],
    audit: "hydrated-wave2",
    scenarios: ["A1", "A2", "B1", "B2", "C1", "C2"].map((variant) => ({
      id: `DL.WAVE2.FEED.ACTION.VARIANT.${variant}`,
      actionIds: [`DL.ACTION.FEED-VARIANT.${variant}.SELECT`],
    })),
  },
  {
    key: "sponsored",
    requirementIds: ["DL.SELECT.sponsored"],
    audit: "hydrated-wave2",
    scenarios: ["ON", "OFF"].map((state) => ({
      id: `DL.WAVE2.FEED.SPONSORED.${state}`,
      actionIds: [],
    })),
  },
] as const;

type ScenarioSelectorEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const SHARED_EVIDENCE = [
  PRODUCT_DESIGN_LAB_SCENARIO_SELECTOR_EVIDENCE_FILE,
  PRODUCT_DESIGN_LAB_SCENARIO_SELECTOR_TEST_FILE,
  "src/app/account/appearance/page.tsx",
  "src/components/appearance-preview-state.ts",
  "src/components/appearance-preview-state.test.ts",
  "src/components/screen-contracts/production-screen-account-interactions.test.ts",
  "scripts/audit-design-lab-hydrated-stories.ts",
  "scripts/audit-design-lab-hydrated-wave2.ts",
  "output/demo-route-audit/design-lab-user-stories.json",
  "output/demo-route-audit/design-lab-hydrated-stories.json",
  "output/demo-route-audit/design-lab-hydrated-wave2.json",
] as const;

export const PRODUCT_DESIGN_LAB_SCENARIO_SELECTOR_MASTER_EVIDENCE =
  Object.fromEntries(
    PRODUCT_DESIGN_LAB_SCENARIO_SELECTOR_REQUIREMENT_IDS.map(
      (requirementId) => [
        requirementId,
        { status: "tested" as const, evidence: SHARED_EVIDENCE },
      ],
    ),
  ) as Readonly<Record<string, ScenarioSelectorEvidenceRecord>>;
