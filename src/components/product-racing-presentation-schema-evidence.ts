import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_RACING_PRESENTATION_SCHEMA_EVIDENCE_FILE =
  "src/components/product-racing-presentation-schema-evidence.ts" as const;
export const PRODUCT_RACING_PRESENTATION_SCHEMA_TEST_FILE =
  "src/components/product-racing-presentation-schema-evidence.test.ts" as const;

export const PRODUCT_RACING_PRESENTATION_SCHEMA_SCOPE =
  "Deterministic source verification of a typed, machine-readable presentation schema for all ten registered public racing routes: 25 route-specific presentations plus shared provenance, with column keys, labels, types, nullability, source files, source markers and missing-value behaviour. Focused tests bind the most important table column orders and every presentation marker to current source. This proves the captured production presentation-schema contract only. It does not prove browser rendering, live database contents, provider correctness, visual layout, the broader no-invention requirement, or production readiness.";

export const PRODUCT_RACING_PRESENTATION_SCHEMA_REQUIREMENT_IDS = [
  "RACING.STRUCT.schema",
] as const;

export type ProductRacingPresentationSchemaRequirementId =
  (typeof PRODUCT_RACING_PRESENTATION_SCHEMA_REQUIREMENT_IDS)[number];

export const PRODUCT_RACING_PRESENTATION_SCHEMA_EXPECTED_GAIN =
  PRODUCT_RACING_PRESENTATION_SCHEMA_REQUIREMENT_IDS.length;

type ProductRacingPresentationSchemaEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const EVIDENCE = [
  PRODUCT_RACING_PRESENTATION_SCHEMA_EVIDENCE_FILE,
  PRODUCT_RACING_PRESENTATION_SCHEMA_TEST_FILE,
  "src/components/racing-presentation-schema.ts",
  "src/components/racing-presentation-schema.test.ts",
] as const;

export const PRODUCT_RACING_PRESENTATION_SCHEMA_MASTER_EVIDENCE = {
  "RACING.STRUCT.schema": {
    status: "tested",
    evidence: EVIDENCE,
  },
} as const satisfies Readonly<
  Record<
    ProductRacingPresentationSchemaRequirementId,
    ProductRacingPresentationSchemaEvidenceRecord
  >
>;
