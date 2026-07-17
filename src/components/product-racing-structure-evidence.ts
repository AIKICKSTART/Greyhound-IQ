import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_RACING_STRUCTURE_EVIDENCE_FILE =
  "src/components/product-racing-structure-evidence.ts" as const;
export const PRODUCT_RACING_STRUCTURE_TEST_FILE =
  "src/components/product-racing-structure-evidence.test.ts" as const;

export const PRODUCT_RACING_STRUCTURE_EVIDENCE_SCOPE =
  "Deterministic source-static verification of implemented public racing presentations, query bindings, layouts, interactions and focused contracts. This module itself does not prove browser rendering, production data availability, provider-authoritative live status, freshness, provenance, or route-audit parity. Separate focused evidence verifies the presentation schema, source/update disclosure and missing-data/typed-snapshot presentation without claiming provider authority or live data. The visible live state is a scheduled-time 20-minute heuristic, and responsible-use closure means a globally reachable notice and footer path rather than an inline notice on every racing screen.";

export const PRODUCT_RACING_STRUCTURE_REQUIREMENT_IDS = [
  "RACING.STRUCT.hero",
  "RACING.STRUCT.todays-races",
  "RACING.STRUCT.meeting-cards",
  "RACING.STRUCT.race-cards",
  "RACING.STRUCT.live",
  "RACING.STRUCT.upcoming",
  "RACING.STRUCT.resulted",
  "RACING.STRUCT.replay",
  "RACING.STRUCT.date-navigation",
  "RACING.STRUCT.state-filters",
  "RACING.STRUCT.status-filters",
  "RACING.STRUCT.sort",
  "RACING.STRUCT.search",
  "RACING.STRUCT.track-groupings",
  "RACING.STRUCT.runner-counts",
  "RACING.STRUCT.result-counts",
  "RACING.STRUCT.video-counts",
  "RACING.STRUCT.dog-profiles",
  "RACING.STRUCT.track-profiles",
  "RACING.STRUCT.race-details",
  "RACING.STRUCT.results",
  "RACING.STRUCT.breeding",
  "RACING.STRUCT.statistics",
  "RACING.STRUCT.box-win-rate",
  "RACING.STRUCT.trainer-leaderboards",
  "RACING.STRUCT.track-records",
  "RACING.STRUCT.responsible-use",
  "RACING.STRUCT.layout",
] as const;

export type ProductRacingStructureRequirementId =
  (typeof PRODUCT_RACING_STRUCTURE_REQUIREMENT_IDS)[number];

export const PRODUCT_RACING_STRUCTURE_OPEN_REQUIREMENT_IDS = [] as const;

export type ProductRacingStructureOpenRequirementId =
  (typeof PRODUCT_RACING_STRUCTURE_OPEN_REQUIREMENT_IDS)[number];

export const PRODUCT_RACING_STRUCTURE_OPEN_GAPS = {} as const satisfies Readonly<
  Record<ProductRacingStructureOpenRequirementId, string>
>;

export const PRODUCT_RACING_STRUCTURE_FOCUSED_CONTRACT_FILES = [
  "src/components/screen-contracts/production-screen-public-racing-interactions.test.ts",
  "src/components/screen-contracts/production-screen-public-navigation-interactions.test.ts",
  "src/components/screen-contracts/screen-state-evidence.test.ts",
  "src/app/responsible-use/responsible-use-contract.test.ts",
  "src/components/json-ld.test.ts",
  "src/components/meeting-card.test.ts",
  "src/app/races/races-side-rail-contract.test.ts",
] as const;

export const PRODUCT_RACING_STRUCTURE_EXPECTED_GAIN =
  PRODUCT_RACING_STRUCTURE_REQUIREMENT_IDS.length;

export type ProductRacingStructureEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const COMMON_EVIDENCE = [
  PRODUCT_RACING_STRUCTURE_EVIDENCE_FILE,
  PRODUCT_RACING_STRUCTURE_TEST_FILE,
] as const;

function tested(
  ...evidence: readonly string[]
): ProductRacingStructureEvidenceRecord {
  return { status: "tested", evidence: [...COMMON_EVIDENCE, ...evidence] };
}

const RACE_EXPLORER_EVIDENCE = [
  "src/app/races/page.tsx",
  "src/lib/queries.ts",
  "src/components/screen-contracts/production-screen-coverage.ts",
  "src/components/screen-contracts/screen-state-evidence.test.ts",
  "src/app/races/races-side-rail-contract.test.ts",
] as const;

const STATISTICS_EVIDENCE = [
  "src/app/statistics/page.tsx",
  "src/lib/queries.ts",
  "src/lib/live/sync.ts",
  "prisma/migrations/20260710123000_add_statistics_matviews/migration.sql",
  "prisma/migrations/20260710132000_add_trainer_performance_matview/migration.sql",
] as const;

export const PRODUCT_RACING_STRUCTURE_MASTER_EVIDENCE = {
  "RACING.STRUCT.hero": tested(
    "src/components/page-hero.tsx",
    "src/components/home-hero.tsx",
    "src/app/breeding/page.tsx",
    "src/components/screen-contracts/production-screen-public-navigation-interactions.test.ts",
  ),
  "RACING.STRUCT.todays-races": tested(
    "src/app/page.tsx",
    "src/lib/queries.ts",
    "src/components/screen-contracts/screen-state-evidence.test.ts",
    "src/components/screen-contracts/production-screen-public-navigation-interactions.test.ts",
  ),
  "RACING.STRUCT.meeting-cards": tested(
    "src/app/page.tsx",
    "src/components/meeting-card.tsx",
    "src/components/meeting-card.test.ts",
  ),
  "RACING.STRUCT.race-cards": tested(...RACE_EXPLORER_EVIDENCE),
  "RACING.STRUCT.live": tested(
    ...RACE_EXPLORER_EVIDENCE,
    "src/components/meeting-card.tsx",
  ),
  "RACING.STRUCT.upcoming": tested(...RACE_EXPLORER_EVIDENCE),
  "RACING.STRUCT.resulted": tested(...RACE_EXPLORER_EVIDENCE),
  "RACING.STRUCT.replay": tested(
    ...RACE_EXPLORER_EVIDENCE,
    "src/app/races/[id]/page.tsx",
    "src/components/screen-contracts/production-screen-public-racing-interactions.test.ts",
  ),
  "RACING.STRUCT.date-navigation": tested(...RACE_EXPLORER_EVIDENCE),
  "RACING.STRUCT.state-filters": tested(...RACE_EXPLORER_EVIDENCE),
  "RACING.STRUCT.status-filters": tested(...RACE_EXPLORER_EVIDENCE),
  "RACING.STRUCT.sort": tested(...RACE_EXPLORER_EVIDENCE),
  "RACING.STRUCT.search": tested(...RACE_EXPLORER_EVIDENCE),
  "RACING.STRUCT.track-groupings": tested(...RACE_EXPLORER_EVIDENCE),
  "RACING.STRUCT.runner-counts": tested(...RACE_EXPLORER_EVIDENCE),
  "RACING.STRUCT.result-counts": tested(...RACE_EXPLORER_EVIDENCE),
  "RACING.STRUCT.video-counts": tested(...RACE_EXPLORER_EVIDENCE),
  "RACING.STRUCT.dog-profiles": tested(
    "src/app/dogs/page.tsx",
    "src/app/dogs/[id]/page.tsx",
    "src/components/dog-search.tsx",
    "src/lib/queries.ts",
    "src/components/json-ld.test.ts",
    "src/components/screen-contracts/production-screen-public-racing-interactions.test.ts",
  ),
  "RACING.STRUCT.track-profiles": tested(
    "src/app/tracks/page.tsx",
    "src/app/tracks/[id]/page.tsx",
    "src/lib/queries.ts",
    "src/components/json-ld.test.ts",
    "src/components/screen-contracts/screen-state-evidence.test.ts",
    "src/components/screen-contracts/production-screen-public-racing-interactions.test.ts",
  ),
  "RACING.STRUCT.race-details": tested(
    "src/app/races/[id]/page.tsx",
    "src/lib/queries.ts",
    "src/components/json-ld.test.ts",
    "src/components/screen-contracts/screen-state-evidence.test.ts",
    "src/components/screen-contracts/production-screen-public-racing-interactions.test.ts",
  ),
  "RACING.STRUCT.results": tested(
    "src/app/results/page.tsx",
    "src/app/races/[id]/page.tsx",
    "src/lib/queries.ts",
    "src/components/screen-contracts/screen-state-evidence.test.ts",
  ),
  "RACING.STRUCT.breeding": tested(
    "src/app/breeding/page.tsx",
    "src/lib/queries.ts",
    "src/components/screen-contracts/production-screen-public-racing-interactions.test.ts",
  ),
  "RACING.STRUCT.statistics": tested(...STATISTICS_EVIDENCE),
  "RACING.STRUCT.box-win-rate": tested(...STATISTICS_EVIDENCE),
  "RACING.STRUCT.trainer-leaderboards": tested(...STATISTICS_EVIDENCE),
  "RACING.STRUCT.track-records": tested(...STATISTICS_EVIDENCE),
  "RACING.STRUCT.responsible-use": tested(
    "src/app/responsible-use/page.tsx",
    "src/components/site-footer.tsx",
    "src/app/responsible-use/responsible-use-contract.test.ts",
    "src/components/screen-contracts/production-screen-public-navigation-interactions.test.ts",
  ),
  "RACING.STRUCT.layout": tested(
    "src/components/demo-experience-registry.ts",
    "src/components/screen-contracts/production-screen-coverage.ts",
    "src/components/screen-contracts/production-screen-public-racing-interactions.ts",
    "src/components/screen-contracts/production-screen-public-racing-interactions.test.ts",
    "src/components/screen-contracts/screen-state-evidence.test.ts",
    "src/app/races/races-side-rail-contract.test.ts",
  ),
} as const satisfies Readonly<
  Record<
    ProductRacingStructureRequirementId,
    ProductRacingStructureEvidenceRecord
  >
>;
