import type { ProductMasterRequirementStatus } from "./product-master-requirements";

type ProductOutputEvidence = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
  verificationScope: "output-existence-only";
};

export const PRODUCT_REQUIRED_OUTPUT_PATHS = {
  "OUTPUT.screen-registry": [
    "src/components/demo-experience-registry.ts",
    "docs/design-lab-screen-registry.md",
  ],
  "OUTPUT.story-matrix": ["docs/product/user-story-matrix.md"],
  "OUTPUT.route-inventory": ["docs/product/route-inventory.md"],
  "OUTPUT.action-inventory": ["docs/product/action-inventory.md"],
  "OUTPUT.form-field-registry": ["docs/product/form-field-registry.md"],
  "OUTPUT.permissions-matrix": ["docs/product/permissions-matrix.md"],
  "OUTPUT.state-matrix": ["docs/product/state-matrix.md"],
  "OUTPUT.tour-registry": ["docs/product/onboarding-map.md"],
  "OUTPUT.fixture-registry": [
    "src/components/demo-experience-registry.ts",
    "docs/design-lab-screen-registry.md",
    "docs/product/design-lab-coverage.md",
  ],
  "OUTPUT.coverage-report": ["docs/product/design-lab-coverage.md"],
  "OUTPUT.broken-link-report": [
    "docs/product/broken-link-report.md",
    "output/product-audit/production-link-audit.json",
  ],
  "OUTPUT.missing-screen-report": ["docs/product/missing-screen-report.md"],
  "OUTPUT.missing-action-report": ["docs/product/missing-action-report.md"],
  "OUTPUT.accessibility-audit": ["docs/product/accessibility-audit.md"],
  "OUTPUT.responsive-audit": ["docs/product/responsive-audit.md"],
  "OUTPUT.automated-tests": [
    "scripts/run-unit-tests.ts",
    "scripts/audit-demo-routes.test.ts",
    "scripts/audit-design-lab-user-stories.test.ts",
    "scripts/audit-design-lab-hydrated-stories.test.ts",
  ],
  "OUTPUT.completion-report": ["docs/product/final-audit-report.md"],
} as const;

/**
 * `verified` closes only the immutable requirement to produce or update the
 * named output. It does not claim implementation, interaction or release
 * readiness; the gap-honest outputs keep those atomic requirements open.
 */
export const PRODUCT_REQUIRED_OUTPUT_EVIDENCE: Readonly<
  Record<string, ProductOutputEvidence>
> = Object.fromEntries(
  Object.entries(PRODUCT_REQUIRED_OUTPUT_PATHS).map(([id, paths]) => [
    id,
    {
      status: "verified",
      verificationScope: "output-existence-only",
      evidence: [
        ...paths,
        "src/components/product-required-outputs.test.ts",
      ],
    },
  ]),
);
