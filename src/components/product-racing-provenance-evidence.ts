import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_RACING_PROVENANCE_EVIDENCE_FILE =
  "src/components/product-racing-provenance-evidence.ts" as const;
export const PRODUCT_RACING_PROVENANCE_TEST_FILE =
  "src/components/product-racing-provenance-evidence.test.ts" as const;

export const PRODUCT_RACING_PROVENANCE_SCOPE =
  "Deterministic pure-helper and source verification that all ten registered public racing surfaces render loaded provider attribution, the exact latest accepted result time, the exact status-check time, and a current, delayed or unavailable freshness warning through one shared cached component. This proves the public source-and-update disclosure contract only. It does not prove provider authority, scheduler success, live database contents, browser rendering, source completeness, the broader no-invention requirement, or production readiness.";

export const PRODUCT_RACING_PROVENANCE_REQUIREMENT_IDS = [
  "RACING.STRUCT.source-disclosure",
  "RACING.STRUCT.update-disclosure",
] as const;

export type ProductRacingProvenanceRequirementId =
  (typeof PRODUCT_RACING_PROVENANCE_REQUIREMENT_IDS)[number];

export const PRODUCT_RACING_PROVENANCE_EXPECTED_GAIN =
  PRODUCT_RACING_PROVENANCE_REQUIREMENT_IDS.length;

type ProductRacingProvenanceEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const COMMON_EVIDENCE = [
  PRODUCT_RACING_PROVENANCE_EVIDENCE_FILE,
  PRODUCT_RACING_PROVENANCE_TEST_FILE,
  "src/components/racing-data-disclosure.tsx",
  "src/lib/racing-data-disclosure.ts",
  "src/lib/racing-data-disclosure.test.ts",
  "src/lib/live/status.ts",
  "src/app/races/page.tsx",
  "src/app/meetings/[id]/page.tsx",
  "src/app/races/[id]/page.tsx",
  "src/app/dogs/page.tsx",
  "src/app/dogs/[id]/page.tsx",
  "src/app/results/page.tsx",
  "src/app/statistics/page.tsx",
  "src/app/tracks/page.tsx",
  "src/app/tracks/[id]/page.tsx",
  "src/app/breeding/page.tsx",
  "src/app/globals.css",
] as const;

export const PRODUCT_RACING_PROVENANCE_MASTER_EVIDENCE = {
  "RACING.STRUCT.source-disclosure": {
    status: "tested",
    evidence: COMMON_EVIDENCE,
  },
  "RACING.STRUCT.update-disclosure": {
    status: "tested",
    evidence: COMMON_EVIDENCE,
  },
} as const satisfies Readonly<
  Record<
    ProductRacingProvenanceRequirementId,
    ProductRacingProvenanceEvidenceRecord
  >
>;
