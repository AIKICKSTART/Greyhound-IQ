import type { ProductMasterRequirementStatus } from "./product-master-requirements";
import { PRODUCT_ACTION_INVENTORY_SUMMARY } from "./product-action-inventory-evidence";

export const PRODUCT_ACTION_PURPOSE_EVIDENCE_FILE =
  "src/components/product-action-purpose-evidence.ts" as const;
export const PRODUCT_ACTION_PURPOSE_TEST_FILE =
  "src/components/product-action-purpose-evidence.test.ts" as const;

export const PRODUCT_ACTION_PURPOSE_SCOPE =
  `Deterministic source-static reconciliation across all ${PRODUCT_ACTION_INVENTORY_SUMMARY.screenCount} registered screens. Every discoverable interactive JSX control in each recursive implementation-source closure is inventoried once by source location and reconciled against route-scoped action and form contracts; every unmatched control remains an explicit fail-closed gap. The ${PRODUCT_ACTION_INVENTORY_SUMMARY.actionCount} declared actions are also checked for a stable route-scoped id, a non-placeholder outcome statement of at least 20 characters, an enforcement note, and a focused test reference. ACTION.BEHAVIOUR.purpose remains blocked while the control registry contains any unmatched source control. This evidence concerns documented purpose only; it does not prove hydrated execution, a successful real result, immediate feedback, keyboard or focus behavior, pending/success/failure presentation, permission denial, analytics, audit emission, deployed parity, or production readiness.`;

export const PRODUCT_ACTION_PURPOSE_REQUIREMENT_IDS = [
  "ACTION.BEHAVIOUR.purpose",
] as const;

export type ProductActionPurposeRequirementId =
  (typeof PRODUCT_ACTION_PURPOSE_REQUIREMENT_IDS)[number];

export const PRODUCT_ACTION_PURPOSE_EXPECTED_GAIN =
  0;

export const PRODUCT_ACTION_PURPOSE_OPEN_GAP =
  "Every unmatched interactive source control is retained in the automated source-gate registry. The requirement stays blocked until each control is bound to a route-scoped action or form purpose contract." as const;

type ProductActionPurposeEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const EVIDENCE = [
  PRODUCT_ACTION_PURPOSE_EVIDENCE_FILE,
  PRODUCT_ACTION_PURPOSE_TEST_FILE,
  "src/components/product-automated-source-gate-registry.ts",
  "src/components/demo-experience-registry.ts",
  "src/components/screen-contracts/production-screen-coverage.ts",
  "src/components/screen-contracts/design-lab-user-stories.ts",
  "src/components/screen-contracts/screen-contract-source-audit.ts",
] as const;

export const PRODUCT_ACTION_PURPOSE_MASTER_EVIDENCE = {
  "ACTION.BEHAVIOUR.purpose": {
    status: "blocked",
    evidence: EVIDENCE,
  },
} as const satisfies Readonly<
  Record<ProductActionPurposeRequirementId, ProductActionPurposeEvidenceRecord>
>;
