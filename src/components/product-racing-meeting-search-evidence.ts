import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_RACING_MEETING_SEARCH_EVIDENCE_FILE =
  "src/components/product-racing-meeting-search-evidence.ts" as const;
export const PRODUCT_RACING_MEETING_SEARCH_TEST_FILE =
  "src/components/product-racing-meeting-search-evidence.test.ts" as const;

export const PRODUCT_RACING_MEETING_SEARCH_SCOPE =
  "Deterministic source and pure-helper verification that /races accepts a bounded q parameter, searches track and state fields through the meeting relationship, can search all harvested dates or an explicit date, preserves the query across date, state, status and sort controls, and renders matching races grouped into meeting panels with a specific empty result. This evidence proves the implemented meeting-search contract only. It does not execute a live database search or prove production data completeness, browser rendering, a meeting-detail route, statistical provenance, or production readiness; status, zero-versus-missing, adjacent-race and return-context behavior have separate focused evidence.";

export const PRODUCT_RACING_MEETING_SEARCH_REQUIREMENT_IDS = [
  "ROUTE.RACING.search-meeting",
] as const;

export type ProductRacingMeetingSearchRequirementId =
  (typeof PRODUCT_RACING_MEETING_SEARCH_REQUIREMENT_IDS)[number];

export const PRODUCT_RACING_MEETING_SEARCH_OPEN_REQUIREMENT_IDS = [] as const;

export type ProductRacingMeetingSearchOpenRequirementId =
  (typeof PRODUCT_RACING_MEETING_SEARCH_OPEN_REQUIREMENT_IDS)[number];

export const PRODUCT_RACING_MEETING_SEARCH_OPEN_GAPS = {} as const satisfies Readonly<
  Record<ProductRacingMeetingSearchOpenRequirementId, string>
>;

export const PRODUCT_RACING_MEETING_SEARCH_EXPECTED_GAIN =
  PRODUCT_RACING_MEETING_SEARCH_REQUIREMENT_IDS.length;

type ProductRacingMeetingSearchEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const COMMON_EVIDENCE = [
  PRODUCT_RACING_MEETING_SEARCH_EVIDENCE_FILE,
  PRODUCT_RACING_MEETING_SEARCH_TEST_FILE,
] as const;

export const PRODUCT_RACING_MEETING_SEARCH_MASTER_EVIDENCE = {
  "ROUTE.RACING.search-meeting": {
    status: "tested",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/app/races/page.tsx",
      "src/lib/race-search.ts",
      "src/lib/queries.ts",
      "src/components/product-racing-structure-evidence.ts",
      "src/components/product-racing-structure-evidence.test.ts",
    ],
  },
} as const satisfies Readonly<
  Record<
    ProductRacingMeetingSearchRequirementId,
    ProductRacingMeetingSearchEvidenceRecord
  >
>;
