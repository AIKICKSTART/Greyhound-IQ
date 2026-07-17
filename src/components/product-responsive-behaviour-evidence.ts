import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_RESPONSIVE_BEHAVIOUR_EVIDENCE_FILE =
  "src/components/product-responsive-behaviour-evidence.ts" as const;
export const PRODUCT_RESPONSIVE_BEHAVIOUR_TEST_FILE =
  "src/components/product-responsive-behaviour-evidence.test.ts" as const;

export const PRODUCT_RESPONSIVE_BEHAVIOUR_EVIDENCE_SCOPE =
  "Deterministic source-static verification of the shared responsive product shell: viewport-clamped mobile sheets, dock clearance, contained table and filter scrolling, media aspect constraints, semantic mobile input types, and portrait/landscape tablet rules. It is paired with the current isolated loopback Chrome workspace audit at the required widths. This proves current source controls and the named local browser audit only; it does not prove third-party UI, real-device virtual keyboards, deployed production, or native-app behaviour.";

export const PRODUCT_RESPONSIVE_BEHAVIOUR_REQUIREMENT_IDS = [
  "GLOBAL.RESP.overflow",
  "GLOBAL.RESP.dialogs",
  "GLOBAL.RESP.menus",
  "GLOBAL.RESP.fixed-nav",
  "GLOBAL.RESP.primary-action",
  "GLOBAL.RESP.tables",
  "GLOBAL.RESP.filters",
  "GLOBAL.RESP.media",
  "GLOBAL.RESP.keyboard",
  "GLOBAL.RESP.tablet",
] as const;

type ProductResponsiveBehaviourEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const SHARED_EVIDENCE = [
  PRODUCT_RESPONSIVE_BEHAVIOUR_EVIDENCE_FILE,
  PRODUCT_RESPONSIVE_BEHAVIOUR_TEST_FILE,
  "src/app/globals.css",
  "src/components/mobile-bottom-dock.tsx",
  "src/components/site-header-mobile-navigation.test.ts",
  "src/components/ui/sheet.tsx",
  "src/app/account/privacy/page.tsx",
  "src/app/races/page.tsx",
  "src/app/discover/page.tsx",
  "src/components/listing-card-media-carousel.tsx",
  "src/components/processed-video.tsx",
  "src/components/product-responsive-width-evidence.test.ts",
] as const;

export const PRODUCT_RESPONSIVE_BEHAVIOUR_MASTER_EVIDENCE = Object.fromEntries(
  PRODUCT_RESPONSIVE_BEHAVIOUR_REQUIREMENT_IDS.map((requirementId) => [
    requirementId,
    { status: "tested" as const, evidence: SHARED_EVIDENCE },
  ]),
) as Readonly<Record<string, ProductResponsiveBehaviourEvidenceRecord>>;
