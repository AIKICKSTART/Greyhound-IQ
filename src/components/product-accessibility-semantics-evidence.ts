import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_ACCESSIBILITY_SEMANTICS_EVIDENCE_FILE =
  "src/components/product-accessibility-semantics-evidence.ts" as const;
export const PRODUCT_ACCESSIBILITY_SEMANTICS_TEST_FILE =
  "src/components/product-accessibility-semantics-evidence.test.ts" as const;

export const PRODUCT_ACCESSIBILITY_SEMANTICS_SCOPE =
  "Deterministic source-static verification of every non-test TSX table in src/app and src/components, including semantic headers for direct tables and the local ResponsiveTable wrapper callers, plus the shared Base UI dialog boundary and every SheetContent consumer title. This proves the current native table structure and dialog-primitive source boundary only; it does not prove rendered browser focus movement, focus restoration, Escape or backdrop behaviour, assistive-technology announcements, responsive visibility, third-party content, or production readiness.";

export const PRODUCT_ACCESSIBILITY_SEMANTICS_REQUIREMENT_IDS = [
  "GLOBAL.A11Y.tables",
  "GLOBAL.A11Y.dialogs",
] as const;

export const PRODUCT_ACCESSIBILITY_SEMANTICS_OPEN_REQUIREMENT_IDS = [
  "GLOBAL.A11Y.headings",
  "GLOBAL.A11Y.names",
  "GLOBAL.A11Y.labels",
  "GLOBAL.A11Y.errors",
  "GLOBAL.A11Y.live-regions",
] as const;

export type ProductAccessibilitySemanticsRequirementId =
  (typeof PRODUCT_ACCESSIBILITY_SEMANTICS_REQUIREMENT_IDS)[number];

type ProductAccessibilitySemanticsEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const EVIDENCE = [
  PRODUCT_ACCESSIBILITY_SEMANTICS_EVIDENCE_FILE,
  PRODUCT_ACCESSIBILITY_SEMANTICS_TEST_FILE,
  "src/components/ui/sheet.tsx",
  "src/app/account/privacy/page.tsx",
] as const;

const TESTED = {
  status: "tested",
  evidence: EVIDENCE,
} as const satisfies ProductAccessibilitySemanticsEvidenceRecord;

export const PRODUCT_ACCESSIBILITY_SEMANTICS_MASTER_EVIDENCE = {
  "GLOBAL.A11Y.tables": TESTED,
  "GLOBAL.A11Y.dialogs": TESTED,
} as const satisfies Readonly<
  Record<
    ProductAccessibilitySemanticsRequirementId,
    ProductAccessibilitySemanticsEvidenceRecord
  >
>;
