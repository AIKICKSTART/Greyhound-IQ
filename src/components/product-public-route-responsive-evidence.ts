import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_PUBLIC_ROUTE_RESPONSIVE_EVIDENCE_FILE =
  "src/components/product-public-route-responsive-evidence.ts" as const;
export const PRODUCT_PUBLIC_ROUTE_RESPONSIVE_TEST_FILE =
  "src/components/product-public-route-responsive-evidence.test.ts" as const;

export const PRODUCT_PUBLIC_ROUTE_RESPONSIVE_SCOPE =
  "Fresh isolated loopback Chrome verification of every production-enabled public screen at 390px phone, 820px tablet, 1024px desktop-transition and 1280px desktop widths. Each case must return HTTP 200 at its registered route and keep the document, body, landmark regions, forms and tables within the viewport without horizontal scrolling. Synthetic document and region overflow fixtures prove the evaluator fails closed. This is current local browser evidence only; it does not prove deployed-image parity, authenticated screens, third-party browser compatibility, visual quality or production readiness.";

export const PRODUCT_PUBLIC_ROUTE_RESPONSIVE_REQUIREMENT_IDS = [
  "ROUTE.PUBLIC.responsive",
] as const;

export const PRODUCT_PUBLIC_ROUTE_RESPONSIVE_EXPECTED_GAIN =
  PRODUCT_PUBLIC_ROUTE_RESPONSIVE_REQUIREMENT_IDS.length;

export const PRODUCT_PUBLIC_ROUTE_RESPONSIVE_WIDTHS = [
  390, 820, 1024, 1280,
] as const;

export type PublicRouteResponsiveMeasurement = Readonly<{
  route: string;
  width: number;
  httpStatus: number;
  finalPath: string;
  documentClientWidth: number;
  documentScrollWidth: number;
  bodyClientWidth: number;
  bodyScrollWidth: number;
  overflowingRegions: readonly string[];
}>;

export function findPublicRouteResponsiveFailures(
  measurement: PublicRouteResponsiveMeasurement,
) {
  const failures: string[] = [];
  const prefix = `${measurement.route}@${measurement.width}`;
  if (measurement.httpStatus !== 200) {
    failures.push(`${prefix}: HTTP ${measurement.httpStatus}, expected 200`);
  }
  if (measurement.finalPath !== measurement.route) {
    failures.push(
      `${prefix}: final path ${measurement.finalPath}, expected ${measurement.route}`,
    );
  }
  if (measurement.documentScrollWidth > measurement.documentClientWidth) {
    failures.push(
      `${prefix}: document overflows ${measurement.documentScrollWidth}px > ${measurement.documentClientWidth}px`,
    );
  }
  if (measurement.bodyScrollWidth > measurement.bodyClientWidth) {
    failures.push(
      `${prefix}: body overflows ${measurement.bodyScrollWidth}px > ${measurement.bodyClientWidth}px`,
    );
  }
  for (const region of measurement.overflowingRegions) {
    failures.push(`${prefix}: ${region} exceeds the viewport`);
  }
  return failures;
}

type ProductPublicRouteResponsiveEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

export const PRODUCT_PUBLIC_ROUTE_RESPONSIVE_MASTER_EVIDENCE = {
  "ROUTE.PUBLIC.responsive": {
    status: "tested",
    evidence: [
      PRODUCT_PUBLIC_ROUTE_RESPONSIVE_EVIDENCE_FILE,
      PRODUCT_PUBLIC_ROUTE_RESPONSIVE_TEST_FILE,
      "src/components/demo-experience-registry.ts",
      "src/app/globals.css",
      "src/app/layout.tsx",
    ],
  },
} as const satisfies Readonly<
  Record<
    (typeof PRODUCT_PUBLIC_ROUTE_RESPONSIVE_REQUIREMENT_IDS)[number],
    ProductPublicRouteResponsiveEvidenceRecord
  >
>;
