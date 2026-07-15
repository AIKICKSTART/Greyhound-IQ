import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_RACING_DETAIL_NAVIGATION_EVIDENCE_FILE =
  "src/components/product-racing-detail-navigation-evidence.ts" as const;
export const PRODUCT_RACING_DETAIL_NAVIGATION_TEST_FILE =
  "src/components/product-racing-detail-navigation-evidence.test.ts" as const;

export const PRODUCT_RACING_DETAIL_NAVIGATION_SCOPE =
  "Deterministic source and pure-helper verification that /races/[id] loads a bounded 24-race projection for the current meeting, orders it by race number, time and id, renders previous and next same-origin race links when adjacent races exist, renders explicit non-interactive first/last boundaries, and links back to the current meeting date/state list. This evidence proves current-meeting navigation only. It does not execute a live database query, prove browser rendering, create a meeting-detail route, retain the originating search/filter/scroll context, preserve context across adjacent race links, or establish production readiness.";

export const PRODUCT_RACING_DETAIL_NAVIGATION_REQUIREMENT_IDS = [
  "ROUTE.RACING.previous-next",
] as const;

export type ProductRacingDetailNavigationRequirementId =
  (typeof PRODUCT_RACING_DETAIL_NAVIGATION_REQUIREMENT_IDS)[number];

export const PRODUCT_RACING_DETAIL_NAVIGATION_EXPECTED_GAIN =
  PRODUCT_RACING_DETAIL_NAVIGATION_REQUIREMENT_IDS.length;

type ProductRacingDetailNavigationEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

export const PRODUCT_RACING_DETAIL_NAVIGATION_MASTER_EVIDENCE = {
  "ROUTE.RACING.previous-next": {
    status: "tested",
    evidence: [
      PRODUCT_RACING_DETAIL_NAVIGATION_EVIDENCE_FILE,
      PRODUCT_RACING_DETAIL_NAVIGATION_TEST_FILE,
      "src/lib/race-navigation.ts",
      "src/lib/race-navigation.test.ts",
      "src/lib/queries.ts",
      "src/app/races/[id]/page.tsx",
      "src/components/race-meeting-navigation.tsx",
      "src/components/screen-contracts/production-screen-public-racing-interactions.ts",
      "src/components/screen-contracts/production-screen-public-racing-interactions.test.ts",
    ],
  },
} as const satisfies Readonly<
  Record<
    ProductRacingDetailNavigationRequirementId,
    ProductRacingDetailNavigationEvidenceRecord
  >
>;
