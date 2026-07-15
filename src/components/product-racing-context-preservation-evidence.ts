import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_RACING_CONTEXT_PRESERVATION_EVIDENCE_FILE =
  "src/components/product-racing-context-preservation-evidence.ts" as const;
export const PRODUCT_RACING_CONTEXT_PRESERVATION_TEST_FILE =
  "src/components/product-racing-context-preservation-evidence.test.ts" as const;

export const PRODUCT_RACING_CONTEXT_PRESERVATION_SCOPE =
  "Deterministic source and pure-helper verification that every /races detail destination carries the server-normalised date, Australian state, bounded query, status, sort and source meeting id; /races/[id] validates those fields, preserves them across previous/next links, and returns to the same filtered list with a meeting anchor that restores the relevant scroll section. No arbitrary return URL is accepted. This evidence proves same-origin URL context construction and meeting-anchor restoration only. It does not prove pixel-identical scroll position, browser history or focus restoration, live database results, hydrated browser behavior, or production readiness.";

export const PRODUCT_RACING_CONTEXT_PRESERVATION_REQUIREMENT_IDS = [
  "ROUTE.RACING.return-context",
  "ROUTE.RACING.preserve-context",
] as const;

export type ProductRacingContextPreservationRequirementId =
  (typeof PRODUCT_RACING_CONTEXT_PRESERVATION_REQUIREMENT_IDS)[number];

export const PRODUCT_RACING_CONTEXT_PRESERVATION_EXPECTED_GAIN =
  PRODUCT_RACING_CONTEXT_PRESERVATION_REQUIREMENT_IDS.length;

type ProductRacingContextPreservationEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const COMMON_EVIDENCE = [
  PRODUCT_RACING_CONTEXT_PRESERVATION_EVIDENCE_FILE,
  PRODUCT_RACING_CONTEXT_PRESERVATION_TEST_FILE,
] as const;

export const PRODUCT_RACING_CONTEXT_PRESERVATION_MASTER_EVIDENCE = {
  "ROUTE.RACING.return-context": {
    status: "tested",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/lib/race-navigation.ts",
      "src/lib/race-navigation.test.ts",
      "src/app/races/page.tsx",
      "src/app/races/[id]/page.tsx",
      "src/components/race-meeting-navigation.tsx",
      "src/components/screen-contracts/production-screen-public-racing-interactions.ts",
      "src/components/screen-contracts/production-screen-public-racing-interactions.test.ts",
    ],
  },
  "ROUTE.RACING.preserve-context": {
    status: "tested",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/lib/race-navigation.ts",
      "src/lib/race-navigation.test.ts",
      "src/app/races/page.tsx",
      "src/app/races/[id]/page.tsx",
      "src/components/race-meeting-navigation.tsx",
      "src/components/screen-contracts/production-screen-public-racing-interactions.ts",
      "src/components/screen-contracts/production-screen-public-racing-interactions.test.ts",
    ],
  },
} as const satisfies Readonly<
  Record<
    ProductRacingContextPreservationRequirementId,
    ProductRacingContextPreservationEvidenceRecord
  >
>;
