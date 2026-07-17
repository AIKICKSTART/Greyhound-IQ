import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_RACING_STATUS_DISTINCTION_EVIDENCE_FILE =
  "src/components/product-racing-status-distinction-evidence.ts" as const;
export const PRODUCT_RACING_STATUS_DISTINCTION_TEST_FILE =
  "src/components/product-racing-status-distinction-evidence.test.ts" as const;

export const PRODUCT_RACING_STATUS_DISTINCTION_SCOPE =
  "Deterministic pure-helper and source verification that the race explorer selects the stored provider resultStatus, gives explicit abandoned and postponed values precedence over time-based live/upcoming presentation, visibly labels live, upcoming, completed, abandoned, postponed and replay states, suppresses abandoned/postponed/completed races from next-to-go, and publishes Schema.org cancelled/postponed event states on race detail. Elapsed races without results remain Awaiting result instead of being invented as completed. This evidence proves the implemented stored-status presentation contract only. It does not prove that every live provider currently supplies abandoned or postponed values, that production rows contain those values, that provider data is authoritative, live database behavior, hydrated browser styling, or production readiness.";

export const PRODUCT_RACING_STATUS_DISTINCTION_REQUIREMENT_IDS = [
  "ROUTE.RACING.status-distinction",
] as const;

export type ProductRacingStatusDistinctionRequirementId =
  (typeof PRODUCT_RACING_STATUS_DISTINCTION_REQUIREMENT_IDS)[number];

export const PRODUCT_RACING_STATUS_DISTINCTION_EXPECTED_GAIN =
  PRODUCT_RACING_STATUS_DISTINCTION_REQUIREMENT_IDS.length;

type ProductRacingStatusDistinctionEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const COMMON_EVIDENCE = [
  PRODUCT_RACING_STATUS_DISTINCTION_EVIDENCE_FILE,
  PRODUCT_RACING_STATUS_DISTINCTION_TEST_FILE,
] as const;

export const PRODUCT_RACING_STATUS_DISTINCTION_MASTER_EVIDENCE = {
  "ROUTE.RACING.status-distinction": {
    status: "tested",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/lib/race-status.ts",
      "src/lib/race-status.test.ts",
      "src/lib/queries.ts",
      "src/app/races/page.tsx",
      "src/app/races/[id]/page.tsx",
      "src/app/globals.css",
    ],
  },
} as const satisfies Readonly<
  Record<
    ProductRacingStatusDistinctionRequirementId,
    ProductRacingStatusDistinctionEvidenceRecord
  >
>;
