import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_PLACEHOLDER_PROHIBITION_EVIDENCE_FILE =
  "src/components/product-placeholder-prohibition-evidence.ts" as const;
export const PRODUCT_PLACEHOLDER_PROHIBITION_TEST_FILE =
  "src/components/product-placeholder-prohibition-evidence.test.ts" as const;

export const PRODUCT_PLACEHOLDER_PROHIBITION_EVIDENCE_SCOPE =
  "Source-static absence of seven exact generic placeholder directives from non-test runtime source under src, plus normalization that rejects persisted pricing copy containing the prohibited Coming soon phrase. This evidence does not prove that every visible action is implemented, that acceptance or browser tests pass, that no semantically equivalent placeholder wording exists, that the remaining exclusion is justified, or that the product is production-ready.";

export const PRODUCT_PLACEHOLDER_PROHIBITION_REQUIREMENT_IDS = [
  "COMPLETE.NO_PLACEHOLDER.add-later",
  "COMPLETE.NO_PLACEHOLDER.todo",
  "COMPLETE.NO_PLACEHOLDER.coming-soon",
  "COMPLETE.NO_PLACEHOLDER.mock-this",
  "COMPLETE.NO_PLACEHOLDER.handle-errors",
  "COMPLETE.NO_PLACEHOLDER.support-mobile",
  "COMPLETE.NO_PLACEHOLDER.add-accessibility",
] as const;

export type ProductPlaceholderProhibitionRequirementId =
  (typeof PRODUCT_PLACEHOLDER_PROHIBITION_REQUIREMENT_IDS)[number];

export const PRODUCT_PLACEHOLDER_PROHIBITION_OPEN_REQUIREMENT_IDS = [
  "COMPLETE.NO_PLACEHOLDER.explicit-exclusion",
] as const;

export type ProductPlaceholderProhibitionOpenRequirementId =
  (typeof PRODUCT_PLACEHOLDER_PROHIBITION_OPEN_REQUIREMENT_IDS)[number];

export const PRODUCT_PLACEHOLDER_PROHIBITION_OPEN_GAPS = {
  "COMPLETE.NO_PLACEHOLDER.explicit-exclusion":
    "Open master requirements have default owners, but there is no exhaustive, reviewed record proving that every unimplemented requirement is either implemented, tested or excluded with a requirement-specific owner and reason.",
} as const satisfies Readonly<
  Record<ProductPlaceholderProhibitionOpenRequirementId, string>
>;

export const PRODUCT_PLACEHOLDER_PROHIBITION_EXPECTED_GAIN =
  PRODUCT_PLACEHOLDER_PROHIBITION_REQUIREMENT_IDS.length;

type ProductPlaceholderProhibitionEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const PLACEHOLDER_PROHIBITION_EVIDENCE = [
  PRODUCT_PLACEHOLDER_PROHIBITION_EVIDENCE_FILE,
  PRODUCT_PLACEHOLDER_PROHIBITION_TEST_FILE,
] as const;

function tested(): ProductPlaceholderProhibitionEvidenceRecord {
  return {
    status: "tested",
    evidence: PLACEHOLDER_PROHIBITION_EVIDENCE,
  };
}

export const PRODUCT_PLACEHOLDER_PROHIBITION_MASTER_EVIDENCE = {
  "COMPLETE.NO_PLACEHOLDER.add-later": tested(),
  "COMPLETE.NO_PLACEHOLDER.todo": tested(),
  "COMPLETE.NO_PLACEHOLDER.coming-soon": tested(),
  "COMPLETE.NO_PLACEHOLDER.mock-this": tested(),
  "COMPLETE.NO_PLACEHOLDER.handle-errors": tested(),
  "COMPLETE.NO_PLACEHOLDER.support-mobile": tested(),
  "COMPLETE.NO_PLACEHOLDER.add-accessibility": tested(),
} as const satisfies Readonly<
  Record<
    ProductPlaceholderProhibitionRequirementId,
    ProductPlaceholderProhibitionEvidenceRecord
  >
>;
