import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_ROUTE_REFRESH_FIXTURE_EVIDENCE_FILE =
  "src/components/product-route-refresh-fixture-evidence.ts" as const;
export const PRODUCT_ROUTE_REFRESH_FIXTURE_TEST_FILE =
  "src/components/product-route-refresh-fixture-evidence.test.ts" as const;

export const PRODUCT_ROUTE_REFRESH_FIXTURE_SCOPE =
  "Source-fingerprint-bound loopback HTTP verification that every registered dynamic page owns one bracket-free representative concrete route and that every registered page route succeeds when requested directly with its exact fixture path, a main landmark, a heading, no React stream failure, and no error marker. This proves deterministic dynamic fixtures and direct deep-route server rendering for the audited source; it does not prove authenticated production data, deployed routing, client hydration state restoration, or browser back/forward behavior.";

export const PRODUCT_ROUTE_REFRESH_FIXTURE_REQUIREMENT_IDS = [
  "GLOBAL.FUNC.dynamic-fixture",
  "GLOBAL.FUNC.deep-refresh",
] as const;

type ProductRouteRefreshFixtureRequirementId =
  (typeof PRODUCT_ROUTE_REFRESH_FIXTURE_REQUIREMENT_IDS)[number];

type ProductRouteRefreshFixtureEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const COMMON_EVIDENCE = [
  PRODUCT_ROUTE_REFRESH_FIXTURE_EVIDENCE_FILE,
  PRODUCT_ROUTE_REFRESH_FIXTURE_TEST_FILE,
  "src/components/demo-experience-registry.ts",
  "src/components/demo-experience-registry.test.ts",
  "src/components/screen-contracts/production-screen-coverage.test.ts",
  "scripts/resolve-demo-route-samples.ts",
  "scripts/audit-demo-routes.ts",
  "scripts/audit-demo-routes.test.ts",
  "output/demo-route-audit/latest.json",
] as const;

export const PRODUCT_ROUTE_REFRESH_FIXTURE_MASTER_EVIDENCE = {
  "GLOBAL.FUNC.dynamic-fixture": {
    status: "tested",
    evidence: COMMON_EVIDENCE,
  },
  "GLOBAL.FUNC.deep-refresh": {
    status: "tested",
    evidence: COMMON_EVIDENCE,
  },
} as const satisfies Readonly<
  Record<
    ProductRouteRefreshFixtureRequirementId,
    ProductRouteRefreshFixtureEvidenceRecord
  >
>;
