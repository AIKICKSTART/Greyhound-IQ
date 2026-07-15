import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_LOCAL_RESIDUAL_GATES_EVIDENCE_FILE =
  "src/components/product-local-residual-gates-evidence.ts" as const;
export const PRODUCT_LOCAL_RESIDUAL_GATES_TEST_FILE =
  "src/components/product-local-residual-gates-evidence.test.ts" as const;

export const PRODUCT_LOCAL_RESIDUAL_GATE_IDS = [
  "GLOBAL.SEC.client-secrets",
  "SYSTEM.unsupported-browser",
] as const;
export const PRODUCT_LOCAL_RESIDUAL_GATES_EXPECTED_GAIN =
  PRODUCT_LOCAL_RESIDUAL_GATE_IDS.length;

export const PRODUCT_LOCAL_RESIDUAL_GATES_SCOPE =
  "Two bounded local controls. GLOBAL.SEC.client-secrets reuses the existing post-build CI gate that inventories configured server secrets, ignores explicitly public variables, scans every regular client-bundle file for plain, escaped and URL-encoded values, rejects symlink traversal, and exits non-zero on a leak. SYSTEM.unsupported-browser is explicitly excluded because the current production runtime declares no user-agent compatibility denial, unsupported-browser route, or browser-specific blocking experience; the exhaustive source check fails closed if one is introduced. The secret control proves repository wiring, detector behavior and the current local build only, not an immutable deployed bundle. The browser exclusion does not claim compatibility with obsolete browsers, third-party scripts, or deployed rendering.";

type ProductLocalResidualGateEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const COMMON_EVIDENCE = [
  PRODUCT_LOCAL_RESIDUAL_GATES_EVIDENCE_FILE,
  PRODUCT_LOCAL_RESIDUAL_GATES_TEST_FILE,
] as const;

export const PRODUCT_LOCAL_RESIDUAL_GATES_MASTER_EVIDENCE = {
  "GLOBAL.SEC.client-secrets": {
    status: "tested",
    evidence: [
      ...COMMON_EVIDENCE,
      "scripts/check-secret-boundaries.ts",
      "scripts/check-secret-boundaries.test.ts",
      "security/ci-gate-evidence.ts",
      "security/ci-gate-evidence.test.ts",
      "security/secret-inventory.ts",
      ".github/workflows/ci.yml",
      "package.json",
    ],
  },
  "SYSTEM.unsupported-browser": {
    status: "excluded",
    evidence: COMMON_EVIDENCE,
  },
} as const satisfies Readonly<
  Record<
    (typeof PRODUCT_LOCAL_RESIDUAL_GATE_IDS)[number],
    ProductLocalResidualGateEvidenceRecord
  >
>;
