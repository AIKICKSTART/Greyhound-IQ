import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_RACING_ZERO_MISSING_EVIDENCE_FILE =
  "src/components/product-racing-zero-missing-evidence.ts" as const;
export const PRODUCT_RACING_ZERO_MISSING_TEST_FILE =
  "src/components/product-racing-zero-missing-evidence.test.ts" as const;

export const PRODUCT_RACING_ZERO_MISSING_SCOPE =
  "Deterministic pure-helper and source verification that measured racing count zero renders as 0, while missing, failed or non-finite aggregate values render as Not available; date-summary and dataset-stat query fallbacks preserve null instead of manufacturing zero; search result-count failure remains null; the race schedule summary declares unavailable totals; and a stored $0 prize is not hidden as if missing. This evidence proves the implemented race explorer aggregate and race-detail prize zero-versus-missing contract only. It does not prove live database success, classify provider sentinel values in required numeric columns, establish provenance for every racing statistic, execute hydrated browser rendering, or close the broader no-invention requirement or production readiness.";

export const PRODUCT_RACING_ZERO_MISSING_REQUIREMENT_IDS = [
  "ROUTE.RACING.zero-vs-missing",
] as const;

export type ProductRacingZeroMissingRequirementId =
  (typeof PRODUCT_RACING_ZERO_MISSING_REQUIREMENT_IDS)[number];

export const PRODUCT_RACING_ZERO_MISSING_EXPECTED_GAIN =
  PRODUCT_RACING_ZERO_MISSING_REQUIREMENT_IDS.length;

type ProductRacingZeroMissingEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const COMMON_EVIDENCE = [
  PRODUCT_RACING_ZERO_MISSING_EVIDENCE_FILE,
  PRODUCT_RACING_ZERO_MISSING_TEST_FILE,
] as const;

export const PRODUCT_RACING_ZERO_MISSING_MASTER_EVIDENCE = {
  "ROUTE.RACING.zero-vs-missing": {
    status: "tested",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/lib/race-metric.ts",
      "src/lib/race-metric.test.ts",
      "src/lib/queries.ts",
      "src/app/races/page.tsx",
      "src/app/races/[id]/page.tsx",
    ],
  },
} as const satisfies Readonly<
  Record<
    ProductRacingZeroMissingRequirementId,
    ProductRacingZeroMissingEvidenceRecord
  >
>;
