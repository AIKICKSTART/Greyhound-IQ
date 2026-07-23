import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_SCREEN_LOCATION_EVIDENCE_FILE =
  "src/components/product-screen-location-evidence.ts" as const;
export const PRODUCT_SCREEN_LOCATION_TEST_FILE =
  "src/components/product-screen-location-evidence.test.ts" as const;

export const PRODUCT_SCREEN_LOCATION_SCOPE =
  "Deterministic source verification of all 103 registered screen contracts. Every screen has a unique canonical route, concrete route and non-empty screen title, and its exact recursive local source closure declares at least one non-empty page-level h1. This proves source-declared screen identity and heading orientation only; it does not prove conditional browser rendering, visual placement, assistive-technology output, measured user comprehension, deployed parity or production readiness.";

export const PRODUCT_SCREEN_LOCATION_REQUIREMENT_IDS = [
  "COMPLETE.UNDERSTAND.location",
] as const;

export const PRODUCT_SCREEN_LOCATION_EXPECTED_GAIN =
  PRODUCT_SCREEN_LOCATION_REQUIREMENT_IDS.length;

type ProductScreenLocationEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

export type ScreenLocationContract = Readonly<{
  route: string;
  concreteRoute: string;
  title: string;
  pageHeadingCount: number;
}>;

export function findScreenLocationContractFailures(
  contracts: readonly ScreenLocationContract[],
) {
  const failures: string[] = [];
  const seenRoutes = new Set<string>();
  const seenConcreteRoutes = new Set<string>();
  const seenTitles = new Set<string>();

  for (const contract of contracts) {
    const route = contract.route.trim();
    const concreteRoute = contract.concreteRoute.trim();
    const title = contract.title.trim();

    if (!route.startsWith("/")) failures.push(`${contract.route}: invalid route`);
    if (!concreteRoute.startsWith("/")) {
      failures.push(`${contract.route}: invalid concrete route`);
    }
    if (!title) failures.push(`${contract.route}: missing screen title`);
    if (contract.pageHeadingCount < 1) {
      failures.push(`${contract.route}: missing non-empty page-level h1`);
    }
    if (seenRoutes.has(route)) failures.push(`${contract.route}: duplicate route`);
    if (seenConcreteRoutes.has(concreteRoute)) {
      failures.push(`${contract.route}: duplicate concrete route`);
    }
    if (seenTitles.has(title.toLocaleLowerCase("en-AU"))) {
      failures.push(`${contract.route}: duplicate screen title`);
    }

    seenRoutes.add(route);
    seenConcreteRoutes.add(concreteRoute);
    seenTitles.add(title.toLocaleLowerCase("en-AU"));
  }

  return failures;
}

const COMMON_EVIDENCE = [
  PRODUCT_SCREEN_LOCATION_EVIDENCE_FILE,
  PRODUCT_SCREEN_LOCATION_TEST_FILE,
  "src/components/demo-experience-registry.ts",
  "src/components/screen-contracts/screen-contract-source-audit.ts",
] as const;

export const PRODUCT_SCREEN_LOCATION_MASTER_EVIDENCE = {
  "COMPLETE.UNDERSTAND.location": {
    status: "tested",
    evidence: COMMON_EVIDENCE,
  },
} as const satisfies Readonly<
  Record<
    (typeof PRODUCT_SCREEN_LOCATION_REQUIREMENT_IDS)[number],
    ProductScreenLocationEvidenceRecord
  >
>;
