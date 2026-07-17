import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_ACCESSIBILITY_FIELD_LABEL_EVIDENCE_FILE =
  "src/components/product-accessibility-field-label-evidence.ts" as const;
export const PRODUCT_ACCESSIBILITY_FIELD_LABEL_TEST_FILE =
  "src/components/product-accessibility-field-label-evidence.test.ts" as const;

export const PRODUCT_ACCESSIBILITY_FIELD_LABEL_REQUIREMENT_IDS = [
  "GLOBAL.A11Y.names",
  "GLOBAL.A11Y.labels",
] as const;

export const PRODUCT_ACCESSIBILITY_FIELD_LABEL_SCOPE =
  "Deterministic source-static verification of every non-hidden native input, select and textarea in the complete reachable local source closures for all registered screen contracts. Each direct field has a persistent programmatic accessible label through a wrapping or associated label, aria-label or aria-labelledby; placeholders never satisfy the contract. Composite MediaAttachmentFields instances are excluded because their named visible attachment button owns a hidden browser file input. This does not prove visual rendering, browser accessibility-tree output, field-specific error linkage, third-party content or production readiness.";

type ProductAccessibilityFieldLabelEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const EVIDENCE = [
  PRODUCT_ACCESSIBILITY_FIELD_LABEL_EVIDENCE_FILE,
  PRODUCT_ACCESSIBILITY_FIELD_LABEL_TEST_FILE,
  "src/components/product-field-contract-source-registry.ts",
  "src/components/media-attachment-fields.tsx",
] as const;

const TESTED = {
  status: "tested",
  evidence: EVIDENCE,
} as const satisfies ProductAccessibilityFieldLabelEvidenceRecord;

export const PRODUCT_ACCESSIBILITY_FIELD_LABEL_MASTER_EVIDENCE = {
  "GLOBAL.A11Y.names": TESTED,
  "GLOBAL.A11Y.labels": TESTED,
} as const satisfies Readonly<
  Record<
    (typeof PRODUCT_ACCESSIBILITY_FIELD_LABEL_REQUIREMENT_IDS)[number],
    ProductAccessibilityFieldLabelEvidenceRecord
  >
>;
