import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_DYNAMIC_ROUTE_MISSING_RECORD_EVIDENCE_FILE =
  "src/components/product-dynamic-route-missing-record-evidence.ts" as const;
export const PRODUCT_DYNAMIC_ROUTE_MISSING_RECORD_TEST_FILE =
  "src/components/product-dynamic-route-missing-record-evidence.test.ts" as const;

export const PRODUCT_DYNAMIC_ROUTE_MISSING_RECORD_SCOPE =
  "Deterministic source-static verification that all 17 registered dynamic screen routes use a tested missing or inaccessible state backed by an ordered source assertion reaching notFound(), and that every route has a concrete bracket-free representative path. The two private messaging aliases deliberately collapse missing and unauthorised records into the same inaccessible response so record existence is not disclosed. This evidence proves safe missing-record handling for the canonical registered dynamic screen inventory only; it does not prove arbitrary API identifiers, browser rendering, deployed behavior, database contents, current route-audit freshness, or production readiness.";

export const PRODUCT_DYNAMIC_ROUTE_MISSING_RECORD_REQUIREMENT_IDS = [
  "GLOBAL.FUNC.missing-record",
] as const;

export type ProductDynamicRouteMissingRecordRequirementId =
  (typeof PRODUCT_DYNAMIC_ROUTE_MISSING_RECORD_REQUIREMENT_IDS)[number];

export const PRODUCT_DYNAMIC_ROUTE_MISSING_RECORD_EXPECTED_GAIN =
  PRODUCT_DYNAMIC_ROUTE_MISSING_RECORD_REQUIREMENT_IDS.length;

type ProductDynamicRouteMissingRecordEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const EVIDENCE = [
  PRODUCT_DYNAMIC_ROUTE_MISSING_RECORD_EVIDENCE_FILE,
  PRODUCT_DYNAMIC_ROUTE_MISSING_RECORD_TEST_FILE,
  "src/components/demo-experience-registry.ts",
  "src/components/screen-contracts/screen-state-evidence.ts",
  "src/components/screen-contracts/production-screen-messaging-access-state-evidence.ts",
  "src/components/screen-contracts/production-screen-member-access-state-evidence.ts",
] as const;

export const PRODUCT_DYNAMIC_ROUTE_MISSING_RECORD_MASTER_EVIDENCE = {
  "GLOBAL.FUNC.missing-record": {
    status: "tested",
    evidence: EVIDENCE,
  },
} as const satisfies Readonly<
  Record<
    ProductDynamicRouteMissingRecordRequirementId,
    ProductDynamicRouteMissingRecordEvidenceRecord
  >
>;
