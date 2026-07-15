import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_GLOBAL_DATA_INTEGRITY_EVIDENCE_FILE =
  "src/components/product-global-data-integrity-evidence.ts" as const;
export const PRODUCT_GLOBAL_DATA_INTEGRITY_TEST_FILE =
  "src/components/product-global-data-integrity-evidence.test.ts" as const;

export const PRODUCT_GLOBAL_DATA_INTEGRITY_SCOPE =
  "Deterministic source and pure-helper verification of the public racing data surfaces and local presentation safeguards: every numeric presentation across the ten registered racing routes has stored or planner authority and an explicit missing-data rule; measured zero remains distinct from missing; the shared provider disclosure marks stale and unavailable racing data; conflicting fixture values retain a visible conflict state; every current currency formatter uses the Australian locale; every current date-time formatter explicitly uses Australia/Sydney; the feed rejects stale or superseded response writes; and the two optimistic message paths either reconcile from the accepted server response or roll back their local pending state. This evidence does not prove provider correctness, database freshness, browser rendering, live server conflict arbitration beyond the covered client paths, or production readiness.";

export const PRODUCT_GLOBAL_DATA_INTEGRITY_REQUIREMENT_IDS = [
  "GLOBAL.DATA.missing-zero",
  "GLOBAL.DATA.delayed",
  "GLOBAL.DATA.conflicts",
  "GLOBAL.DATA.statistics",
  "GLOBAL.DATA.currency",
  "GLOBAL.DATA.time",
  "GLOBAL.DATA.refresh-race",
  "GLOBAL.DATA.optimistic",
] as const;

export type ProductGlobalDataIntegrityRequirementId =
  (typeof PRODUCT_GLOBAL_DATA_INTEGRITY_REQUIREMENT_IDS)[number];

type ProductGlobalDataIntegrityEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const EVIDENCE = [
  PRODUCT_GLOBAL_DATA_INTEGRITY_EVIDENCE_FILE,
  PRODUCT_GLOBAL_DATA_INTEGRITY_TEST_FILE,
  "src/components/racing-statistic-lineage.ts",
  "src/components/racing-statistic-lineage.test.ts",
  "src/components/racing-presentation-schema.ts",
  "src/components/racing-presentation-schema.test.ts",
  "src/components/product-racing-fixture-evidence.ts",
  "src/components/product-racing-fixture-evidence.test.ts",
  "src/lib/race-metric.ts",
  "src/lib/race-metric.test.ts",
  "src/lib/racing-data-disclosure.ts",
  "src/lib/racing-data-disclosure.test.ts",
  "src/components/feed-infinite-list.tsx",
  "src/components/hub/hub-conversation-dock.tsx",
  "src/components/instant-message-composer.tsx",
] as const;

function tested(): ProductGlobalDataIntegrityEvidenceRecord {
  return { status: "tested", evidence: EVIDENCE };
}

export const PRODUCT_GLOBAL_DATA_INTEGRITY_MASTER_EVIDENCE = Object.fromEntries(
  PRODUCT_GLOBAL_DATA_INTEGRITY_REQUIREMENT_IDS.map((requirementId) => [
    requirementId,
    tested(),
  ]),
) as Readonly<
  Record<
    ProductGlobalDataIntegrityRequirementId,
    ProductGlobalDataIntegrityEvidenceRecord
  >
>;
