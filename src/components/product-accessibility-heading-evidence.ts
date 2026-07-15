import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_ACCESSIBILITY_HEADING_EVIDENCE_FILE =
  "src/components/product-accessibility-heading-evidence.ts" as const;
export const PRODUCT_ACCESSIBILITY_HEADING_TEST_FILE =
  "src/components/product-accessibility-heading-evidence.test.tsx" as const;

export const PRODUCT_ACCESSIBILITY_HEADING_SCOPE =
  "Deterministic source and shared-component render verification of the eight production-enabled public routes registered in SCREEN_CONTRACTS. Each route has one page-level h1 and its direct headings, shared hero, home hero and footer headings never skip a level. This does not prove browser-only conditional content, keyboard navigation, focus behavior, assistive-technology output, responsive visibility, authenticated routes, third-party embeds, or production readiness.";

export const PRODUCT_ACCESSIBILITY_HEADING_REQUIREMENT_IDS = [
  "GLOBAL.A11Y.headings",
] as const;

export const PRODUCT_ACCESSIBILITY_HEADING_EXPECTED_GAIN =
  PRODUCT_ACCESSIBILITY_HEADING_REQUIREMENT_IDS.length;

type ProductAccessibilityHeadingEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const EVIDENCE = [
  PRODUCT_ACCESSIBILITY_HEADING_EVIDENCE_FILE,
  PRODUCT_ACCESSIBILITY_HEADING_TEST_FILE,
  "src/app/page.tsx",
  "src/app/about/page.tsx",
  "src/app/auth/error/page.tsx",
  "src/app/contact/page.tsx",
  "src/app/pricing/page.tsx",
  "src/app/privacy/page.tsx",
  "src/app/responsible-use/page.tsx",
  "src/app/terms/page.tsx",
  "src/components/home-hero.tsx",
  "src/components/page-hero.tsx",
  "src/components/meeting-card.tsx",
  "src/components/site-footer.tsx",
] as const;

export const PRODUCT_ACCESSIBILITY_HEADING_MASTER_EVIDENCE = {
  "GLOBAL.A11Y.headings": {
    status: "tested",
    evidence: EVIDENCE,
  },
} as const satisfies Readonly<
  Record<
    (typeof PRODUCT_ACCESSIBILITY_HEADING_REQUIREMENT_IDS)[number],
    ProductAccessibilityHeadingEvidenceRecord
  >
>;
