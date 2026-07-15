import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_GLOBAL_FUNCTIONALITY_SOURCE_EVIDENCE_FILE =
  "src/components/product-global-functionality-source-evidence.ts" as const;
export const PRODUCT_GLOBAL_FUNCTIONALITY_SOURCE_TEST_FILE =
  "src/components/product-global-functionality-source-evidence.test.ts" as const;

export const PRODUCT_GLOBAL_FUNCTIONALITY_SOURCE_REQUIREMENT_IDS = [
  "GLOBAL.FUNC.links",
  "GLOBAL.FUNC.server-authz",
] as const;

export type ProductGlobalFunctionalitySourceRequirementId =
  (typeof PRODUCT_GLOBAL_FUNCTIONALITY_SOURCE_REQUIREMENT_IDS)[number];

export const PRODUCT_GLOBAL_FUNCTIONALITY_SOURCE_EXPECTED_GAIN =
  PRODUCT_GLOBAL_FUNCTIONALITY_SOURCE_REQUIREMENT_IDS.length;

export const PRODUCT_GLOBAL_FUNCTIONALITY_SOURCE_SCOPE =
  "Deterministic source-static verification of two current repository-wide functional controls. Every source-resolvable internal JSX, catalogue and router/redirect destination in a registered screen's recursive local source closure resolves to a current page or route-handler pattern. Every currently discovered protected HTTP handler and authority-bearing server action independently resolves a server-side current-user, moderator or administrator guard, with the sole input-free sign-out action retained as an explicit exception. This proves the local source surface only; it does not prove external-link availability, hydrated browser clicks, redirects after deployment, object- or tenant-level authorization for every record, identity-provider behavior, database RLS, cross-user denial, or production readiness.";

type ProductGlobalFunctionalitySourceEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const COMMON_EVIDENCE = [
  PRODUCT_GLOBAL_FUNCTIONALITY_SOURCE_EVIDENCE_FILE,
  PRODUCT_GLOBAL_FUNCTIONALITY_SOURCE_TEST_FILE,
] as const;

function tested(
  ...evidence: readonly string[]
): ProductGlobalFunctionalitySourceEvidenceRecord {
  return { status: "tested", evidence: [...COMMON_EVIDENCE, ...evidence] };
}

export const PRODUCT_GLOBAL_FUNCTIONALITY_SOURCE_MASTER_EVIDENCE = {
  "GLOBAL.FUNC.links": tested(
    "src/components/product-automated-source-gate-registry.ts",
    "src/components/product-automated-source-gate-evidence.test.ts",
    "src/components/demo-experience-registry.ts",
    "src/components/screen-contracts/screen-contract-source-audit.ts",
    "security/endpoints.ts",
  ),
  "GLOBAL.FUNC.server-authz": tested(
    "security/frontend-authorization-evidence.ts",
    "security/frontend-authorization-evidence.test.ts",
    "security/server-authority-evidence.test.ts",
    "security/endpoints.ts",
    "src/lib/auth.ts",
  ),
} as const satisfies Readonly<
  Record<
    ProductGlobalFunctionalitySourceRequirementId,
    ProductGlobalFunctionalitySourceEvidenceRecord
  >
>;
