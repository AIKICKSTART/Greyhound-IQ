import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_RESPONSIVE_WIDTH_EVIDENCE_FILE =
  "src/components/product-responsive-width-evidence.ts" as const;
export const PRODUCT_RESPONSIVE_WIDTH_TEST_FILE =
  "src/components/product-responsive-width-evidence.test.ts" as const;

export const PRODUCT_RESPONSIVE_WIDTH_EVIDENCE_SCOPE =
  "Current-source-bound isolated loopback Chrome verification of every configured Design Lab workspace area and the architecture report at each of the eleven exact required widths. It rejects horizontal overflow, malformed or missing cases, runtime exceptions, mutating requests, unreadable responsive table/diagram fallbacks, stale source/report/script digests and evidence older than 24 hours. It is not deployed production or native-app evidence.";

export const PRODUCT_RESPONSIVE_REQUIRED_WIDTHS = [
  320, 360, 375, 390, 430, 768, 820, 1024, 1280, 1440, 1920,
] as const;

export const PRODUCT_RESPONSIVE_WIDTH_REQUIREMENT_IDS =
  PRODUCT_RESPONSIVE_REQUIRED_WIDTHS.map(
    (width) => `GLOBAL.WIDTH.${width}` as const,
  );

export type ProductResponsiveWidthEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const SHARED_EVIDENCE = [
  PRODUCT_RESPONSIVE_WIDTH_EVIDENCE_FILE,
  PRODUCT_RESPONSIVE_WIDTH_TEST_FILE,
  "scripts/audit-design-lab-responsive-workspace.ts",
  "scripts/audit-design-lab-responsive-workspace.test.ts",
  "output/design-lab-responsive-workspace/latest.json",
] as const;

export const PRODUCT_RESPONSIVE_WIDTH_MASTER_EVIDENCE = Object.fromEntries(
  PRODUCT_RESPONSIVE_WIDTH_REQUIREMENT_IDS.map((requirementId) => [
    requirementId,
    { status: "tested" as const, evidence: SHARED_EVIDENCE },
  ]),
) as Readonly<Record<string, ProductResponsiveWidthEvidenceRecord>>;
