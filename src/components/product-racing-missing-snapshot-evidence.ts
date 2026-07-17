import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_RACING_MISSING_SNAPSHOT_EVIDENCE_FILE =
  "src/components/product-racing-missing-snapshot-evidence.ts" as const;
export const PRODUCT_RACING_MISSING_SNAPSHOT_TEST_FILE =
  "src/components/product-racing-missing-snapshot-evidence.test.ts" as const;

export const PRODUCT_RACING_MISSING_SNAPSHOT_SCOPE =
  "Deterministic pure-helper and source verification that the statistics and breeding screens use typed read-only aggregate rows, replace the transient hard-coded meeting claim with a measured snapshot summary, keep all eight box positions visible, render undefined rates as Not available rather than zero, and show explicit empty states for absent box-bias, trainer, track-record and sire collections. The existing typed racing fixture contract covers complete, partial, missing, zero, delayed, corrected and outage states. This proves the implemented missing-data and typed-fixture/read-only-snapshot presentation contract only. It does not prove live database contents, aggregate refresh success, browser rendering, provider correctness, the broader no-invention requirement, or production readiness.";

export const PRODUCT_RACING_MISSING_SNAPSHOT_REQUIREMENT_IDS = [
  "RACING.STRUCT.missing-data",
  "RACING.STRUCT.typed-snapshot",
] as const;

export type ProductRacingMissingSnapshotRequirementId =
  (typeof PRODUCT_RACING_MISSING_SNAPSHOT_REQUIREMENT_IDS)[number];

export const PRODUCT_RACING_MISSING_SNAPSHOT_EXPECTED_GAIN =
  PRODUCT_RACING_MISSING_SNAPSHOT_REQUIREMENT_IDS.length;

type ProductRacingMissingSnapshotEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const COMMON_EVIDENCE = [
  PRODUCT_RACING_MISSING_SNAPSHOT_EVIDENCE_FILE,
  PRODUCT_RACING_MISSING_SNAPSHOT_TEST_FILE,
  "src/lib/racing-statistics-presentation.ts",
  "src/lib/racing-statistics-presentation.test.ts",
  "src/components/racing-data-empty-state.tsx",
  "src/components/product-racing-fixture-evidence.ts",
  "src/components/product-racing-fixture-evidence.test.ts",
  "src/lib/queries.ts",
  "src/app/statistics/page.tsx",
  "src/app/breeding/page.tsx",
] as const;

export const PRODUCT_RACING_MISSING_SNAPSHOT_MASTER_EVIDENCE = {
  "RACING.STRUCT.missing-data": {
    status: "tested",
    evidence: COMMON_EVIDENCE,
  },
  "RACING.STRUCT.typed-snapshot": {
    status: "tested",
    evidence: COMMON_EVIDENCE,
  },
} as const satisfies Readonly<
  Record<
    ProductRacingMissingSnapshotRequirementId,
    ProductRacingMissingSnapshotEvidenceRecord
  >
>;
