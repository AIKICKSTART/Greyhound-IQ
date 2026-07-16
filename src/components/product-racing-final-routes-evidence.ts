import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_RACING_FINAL_ROUTES_EVIDENCE_FILE =
  "src/components/product-racing-final-routes-evidence.ts" as const;
export const PRODUCT_RACING_FINAL_ROUTES_TEST_FILE =
  "src/components/product-racing-final-routes-evidence.test.ts" as const;

export const PRODUCT_RACING_FINAL_ROUTES_SCOPE =
  "Deterministic source, pure-helper and contract verification that a registered public /meetings/[id] resource loads one bounded stored meeting with its track, races, runner counts, results and playable replay rows; exposes real race-day, track, race and winning-dog navigation; and renders explicit loading, not-found, empty and populated states. It also verifies an exhaustive lineage record for every integer, decimal, percentage and currency column in all 24 numeric presentations from the typed schema for all ten public racing routes, including explicit zero-versus-missing rules and focused no-invention checks for planner tallies, dog prize money and win rate, box bias, breeding strike rate, meeting summaries and track best-time selection. This proves the implemented source and pure-helper contracts only. It does not execute a live database query, prove provider or production data correctness, prove browser rendering, recapture the route audit, or establish production readiness.";

export const PRODUCT_RACING_FINAL_ROUTES_REQUIREMENT_IDS = [
  "ROUTE.RACING.open-meeting",
  "ROUTE.RACING.no-invention",
] as const;

export type ProductRacingFinalRoutesRequirementId =
  (typeof PRODUCT_RACING_FINAL_ROUTES_REQUIREMENT_IDS)[number];

export const PRODUCT_RACING_FINAL_ROUTES_EXPECTED_GAIN =
  PRODUCT_RACING_FINAL_ROUTES_REQUIREMENT_IDS.length;

type ProductRacingFinalRoutesEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const COMMON_EVIDENCE = [
  PRODUCT_RACING_FINAL_ROUTES_EVIDENCE_FILE,
  PRODUCT_RACING_FINAL_ROUTES_TEST_FILE,
] as const;

export const PRODUCT_RACING_FINAL_ROUTES_MASTER_EVIDENCE = {
  "ROUTE.RACING.open-meeting": {
    status: "tested",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/app/meetings/[id]/page.tsx",
      "src/app/meetings/[id]/loading.tsx",
      "src/app/meetings/[id]/not-found.tsx",
      "src/components/meeting-detail-race-card.tsx",
      "src/lib/meeting-presentation.ts",
      "src/lib/meeting-presentation.test.ts",
      "src/lib/queries.ts",
      "src/app/races/page.tsx",
      "src/app/tracks/[id]/page.tsx",
      "src/components/demo-experience-registry.ts",
      "src/components/demo-experience-registry.test.ts",
      "src/components/screen-contracts/screen-permission-evidence.ts",
      "src/components/screen-contracts/screen-permission-evidence.test.ts",
      "src/components/screen-contracts/screen-state-evidence.ts",
      "src/components/screen-contracts/screen-state-evidence.test.ts",
      "src/components/screen-contracts/production-screen-public-racing-interactions.ts",
      "src/components/screen-contracts/production-screen-public-racing-interactions.test.ts",
      "src/components/racing-onboarding-tour-registry.ts",
      "src/components/screen-contracts/production-screen-racing-onboarding-evidence.test.ts",
      "src/components/racing-presentation-schema.ts",
      "src/components/racing-presentation-schema.test.ts",
    ],
  },
  "ROUTE.RACING.no-invention": {
    status: "tested",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/components/racing-statistic-lineage.ts",
      "src/components/racing-statistic-lineage.test.ts",
      "src/components/racing-presentation-schema.ts",
      "src/components/racing-presentation-schema.test.ts",
      "src/lib/dog-statistic-presentation.ts",
      "src/lib/dog-statistic-presentation.test.ts",
      "src/lib/racing-statistics-presentation.ts",
      "src/lib/racing-statistics-presentation.test.ts",
      "src/lib/race-metric.ts",
      "src/lib/race-metric.test.ts",
      "src/lib/meeting-presentation.ts",
      "src/lib/meeting-presentation.test.ts",
      "src/lib/queries.ts",
      "src/app/races/page.tsx",
      "src/app/meetings/[id]/page.tsx",
      "src/app/races/[id]/page.tsx",
      "src/app/dogs/page.tsx",
      "src/components/dog-search.tsx",
      "src/app/dogs/[id]/page.tsx",
      "src/app/results/page.tsx",
      "src/app/statistics/page.tsx",
      "src/app/tracks/page.tsx",
      "src/app/tracks/[id]/page.tsx",
      "src/app/breeding/page.tsx",
    ],
  },
} as const satisfies Readonly<
  Record<
    ProductRacingFinalRoutesRequirementId,
    ProductRacingFinalRoutesEvidenceRecord
  >
>;
