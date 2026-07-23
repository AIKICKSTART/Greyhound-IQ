import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_PROTECTED_BOUNDARY_EVIDENCE_FILE =
  "src/components/product-protected-boundary-evidence.ts" as const;
export const PRODUCT_PROTECTED_BOUNDARY_TEST_FILE =
  "src/components/product-protected-boundary-evidence.test.ts" as const;

export const PRODUCT_PROTECTED_BOUNDARY_REQUIREMENT_IDS = [
  "GLOBAL.SEC.signed-out",
  "GLOBAL.SEC.safe-errors",
] as const;
export const PRODUCT_PROTECTED_BOUNDARY_EXPECTED_GAIN =
  PRODUCT_PROTECTED_BOUNDARY_REQUIREMENT_IDS.length;

export const PRODUCT_PROTECTED_BOUNDARY_SCOPE =
  "Fail-closed local source verification across the complete registered protected surface: 52 required-auth screen contracts explicitly deny signed-out access with focused permission evidence, 71 required-auth HTTP handlers independently resolve a server authority guard and route failures through the shared safe JSON error boundary, and 80 input-bearing server actions independently resolve server authority while the sole sign-out exception only removes authority. The shared boundary returns no-store, request-correlated responses, preserves only allowlisted application sentinels, and replaces unknown or server failures with fixed fallback text; the global page error surface renders only a digest reference. This proves current repository source and focused units, not deployed identity-provider behavior, database RLS, cross-account runtime denial, reverse-proxy rewriting, or production readiness.";

export type ProductProtectedBoundaryPlane =
  | "http-handler"
  | "screen"
  | "server-action";

export type ProductProtectedBoundaryRecord = {
  id: string;
  plane: ProductProtectedBoundaryPlane;
  serverGuarded: boolean;
  signedOutDenied: boolean;
  safeFailure: boolean;
};

export function findProductProtectedBoundaryIssues(
  records: readonly ProductProtectedBoundaryRecord[],
) {
  const issues: string[] = [];
  const seen = new Set<string>();

  for (const record of records) {
    if (seen.has(record.id)) issues.push(`${record.id}:DUPLICATE`);
    seen.add(record.id);
    if (!record.serverGuarded) issues.push(`${record.id}:SERVER_GUARD_MISSING`);
    if (!record.signedOutDenied) issues.push(`${record.id}:SIGNED_OUT_DENIAL_MISSING`);
    if (record.plane !== "screen" && !record.safeFailure) {
      issues.push(`${record.id}:SAFE_FAILURE_MISSING`);
    }
  }

  return issues.toSorted();
}

type ProductProtectedBoundaryEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const COMMON_EVIDENCE = [
  PRODUCT_PROTECTED_BOUNDARY_EVIDENCE_FILE,
  PRODUCT_PROTECTED_BOUNDARY_TEST_FILE,
  "src/components/demo-experience-registry.ts",
  "src/components/screen-contracts/production-screen-coverage.ts",
  "src/components/screen-contracts/screen-permission-evidence.test.ts",
  "src/components/screen-contracts/production-screen-member-access-state-evidence.test.ts",
  "src/components/screen-contracts/production-screen-messaging-access-state-evidence.test.ts",
  "src/components/screen-contracts/production-screen-admin-access-state-evidence.test.ts",
  "security/endpoints.ts",
  "security/frontend-authorization-evidence.ts",
  "security/frontend-authorization-evidence.test.ts",
  "src/lib/auth.ts",
] as const;

export const PRODUCT_PROTECTED_BOUNDARY_MASTER_EVIDENCE = {
  "GLOBAL.SEC.signed-out": {
    status: "tested",
    evidence: COMMON_EVIDENCE,
  },
  "GLOBAL.SEC.safe-errors": {
    status: "tested",
    evidence: [
      ...COMMON_EVIDENCE,
      "src/lib/api-errors.ts",
      "src/lib/api-errors.test.ts",
      "src/app/error.tsx",
    ],
  },
} as const satisfies Readonly<
  Record<
    (typeof PRODUCT_PROTECTED_BOUNDARY_REQUIREMENT_IDS)[number],
    ProductProtectedBoundaryEvidenceRecord
  >
>;
