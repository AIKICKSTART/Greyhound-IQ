import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_DOCUMENTATION_AUTHORITY_EVIDENCE_FILE =
  "src/components/product-documentation-authority-evidence.ts" as const;
export const PRODUCT_DOCUMENTATION_AUTHORITY_TEST_FILE =
  "src/components/product-documentation-authority-evidence.test.ts" as const;

export const PRODUCT_DOCUMENTATION_AUTHORITY_SCOPE =
  "Deterministic source and documentation verification that production parity is merged into the canonical docs/product/production-parity.md owner, the dated production crawl remains distinct from current local source evidence, and each managed route, story, action, form, permission, state, onboarding, Design Lab, parity and final-audit topic has one unique canonical Markdown owner in docs/product/documentation-authority.md. This proves canonical ownership and the managed product-audit documentation boundary only. It does not prove that arbitrary prose outside the managed set contains no repeated sentences, that the historical production crawl is current, that browser or deployed behavior matches local source, or that GreyhoundIQ is production-ready.";

export const PRODUCT_DOCUMENTATION_AUTHORITY_REQUIREMENT_IDS = [
  "DOC.PATH.parity",
  "DOC.PATH.no-duplicate",
] as const;

export type ProductDocumentationAuthorityRequirementId =
  (typeof PRODUCT_DOCUMENTATION_AUTHORITY_REQUIREMENT_IDS)[number];

export const PRODUCT_DOCUMENTATION_AUTHORITY_EXPECTED_GAIN =
  PRODUCT_DOCUMENTATION_AUTHORITY_REQUIREMENT_IDS.length;

export const PRODUCT_DOCUMENTATION_AUTHORITIES = [
  ["DOC.PATH.route", "docs/product/route-inventory.md"],
  ["DOC.PATH.stories", "docs/product/user-story-matrix.md"],
  ["DOC.PATH.actions", "docs/product/action-inventory.md"],
  ["DOC.PATH.forms", "docs/product/form-field-registry.md"],
  ["DOC.PATH.permissions", "docs/product/permissions-matrix.md"],
  ["DOC.PATH.states", "docs/product/state-matrix.md"],
  ["DOC.PATH.onboarding", "docs/product/onboarding-map.md"],
  ["DOC.PATH.design-lab", "docs/product/design-lab-coverage.md"],
  ["DOC.PATH.parity", "docs/product/production-parity.md"],
  ["DOC.PATH.final", "docs/product/final-audit-report.md"],
] as const;

type ProductDocumentationAuthorityEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const EVIDENCE = [
  PRODUCT_DOCUMENTATION_AUTHORITY_EVIDENCE_FILE,
  PRODUCT_DOCUMENTATION_AUTHORITY_TEST_FILE,
  "docs/product/documentation-authority.md",
  "docs/product/production-parity.md",
  "docs/product/final-audit-report.md",
] as const;

export const PRODUCT_DOCUMENTATION_AUTHORITY_MASTER_EVIDENCE = {
  "DOC.PATH.parity": { status: "tested", evidence: EVIDENCE },
  "DOC.PATH.no-duplicate": { status: "tested", evidence: EVIDENCE },
} as const satisfies Readonly<
  Record<
    ProductDocumentationAuthorityRequirementId,
    ProductDocumentationAuthorityEvidenceRecord
  >
>;
