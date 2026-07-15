import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_IDEMPOTENCY_SOURCE_EVIDENCE_FILE =
  "src/components/product-idempotency-source-evidence.ts" as const;
export const PRODUCT_IDEMPOTENCY_SOURCE_TEST_FILE =
  "src/components/product-idempotency-source-evidence.test.ts" as const;

export const PRODUCT_IDEMPOTENCY_SOURCE_SCOPE =
  "Deterministic source-static and CI verification over every discovered webhook ingress and every source-visible internal scheduled-task route. Webhooks have registered unique-receipt and fenced-reducer or domain compare-and-set strategies; tasks have distributed locking, overlap rejection and task-specific repeat-safety markers. This proves repository source and fail-closed inventory only; it does not prove deployed scheduler configuration, production concurrency, provider retry behaviour, database isolation at runtime or cross-provider semantic idempotency beyond the registered controls.";

export const PRODUCT_IDEMPOTENCY_SOURCE_REQUIREMENT_IDS = [
  "GLOBAL.DATA.idempotency",
] as const;

export type ProductIdempotencySourceRequirementId =
  (typeof PRODUCT_IDEMPOTENCY_SOURCE_REQUIREMENT_IDS)[number];

export const PRODUCT_IDEMPOTENCY_SOURCE_EXPECTED_GAIN =
  PRODUCT_IDEMPOTENCY_SOURCE_REQUIREMENT_IDS.length;

type ProductIdempotencySourceEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const EVIDENCE = [
  PRODUCT_IDEMPOTENCY_SOURCE_EVIDENCE_FILE,
  PRODUCT_IDEMPOTENCY_SOURCE_TEST_FILE,
  "security/webhook-deduplication-ci-evidence.ts",
  "security/webhook-deduplication-ci-evidence.test.ts",
  "security/scheduled-task-inventory.ts",
  "security/scheduled-task-control-evidence.ts",
  "security/scheduled-task-control-evidence.test.ts",
  "src/lib/scheduled-task-control.ts",
  "src/lib/scheduled-task-policy.ts",
  "prisma/schema.prisma",
] as const;

const TESTED = {
  status: "tested",
  evidence: EVIDENCE,
} as const satisfies ProductIdempotencySourceEvidenceRecord;

export const PRODUCT_IDEMPOTENCY_SOURCE_MASTER_EVIDENCE = {
  "GLOBAL.DATA.idempotency": TESTED,
} as const satisfies Readonly<
  Record<
    ProductIdempotencySourceRequirementId,
    ProductIdempotencySourceEvidenceRecord
  >
>;
