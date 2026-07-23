import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_GLOBAL_SECURITY_INVARIANT_EVIDENCE_FILE =
  "src/components/product-global-security-invariant-evidence.ts" as const;
export const PRODUCT_GLOBAL_SECURITY_INVARIANT_TEST_FILE =
  "src/components/product-global-security-invariant-evidence.test.ts" as const;

export const PRODUCT_GLOBAL_SECURITY_INVARIANT_EVIDENCE_SCOPE =
  "Deterministic source and focused-unit verification of four bounded product-security invariants: authentication returns accept only local paths, browser payment-return parameters cannot settle entitlement state, sensitive failure paths issue safe correlation or recovery references, and every Prisma model denies production-row copying into Design Lab fixtures. This evidence does not prove deployed identity-provider behavior, every authorization or blocked-user path, a production client-bundle secret scan, product-wide identifier minimization, staging database isolation, or production readiness.";

export const PRODUCT_GLOBAL_SECURITY_INVARIANT_REQUIREMENT_IDS = [
  "GLOBAL.SEC.open-redirect",
  "GLOBAL.SEC.payment-proof",
  "GLOBAL.SEC.reference-codes",
  "GLOBAL.SEC.fixture-privacy",
] as const;

export type ProductGlobalSecurityInvariantRequirementId =
  (typeof PRODUCT_GLOBAL_SECURITY_INVARIANT_REQUIREMENT_IDS)[number];

export const PRODUCT_GLOBAL_SECURITY_INVARIANT_OPEN_REQUIREMENT_IDS = [
  "GLOBAL.SEC.signed-out",
  "GLOBAL.SEC.blocked",
  "GLOBAL.SEC.safe-errors",
  "GLOBAL.SEC.server-authority",
  "GLOBAL.SEC.internal-ids",
  "GLOBAL.SEC.client-secrets",
] as const;

export type ProductGlobalSecurityInvariantOpenRequirementId =
  (typeof PRODUCT_GLOBAL_SECURITY_INVARIANT_OPEN_REQUIREMENT_IDS)[number];

export const PRODUCT_GLOBAL_SECURITY_INVARIANT_OPEN_GAPS = {
  "GLOBAL.SEC.signed-out":
    "Focused screen contracts prove fail-closed reads for required routes and private messaging, but negative API and React Server Component evidence does not yet cover every protected payload and endpoint.",
  "GLOBAL.SEC.blocked":
    "Messaging contracts deny new blocked-user actions, while existing conversation history remains intentionally visible to participants and no exhaustive blocked-user response-field matrix covers every community surface.",
  "GLOBAL.SEC.safe-errors":
    "The shared API error helper redacts unknown failures and handles known authorization sentinels safely, but no exhaustive callsite inventory proves that every unauthorised action delegates to that helper or an equivalent safe response.",
  "GLOBAL.SEC.server-authority":
    "Page access tests prove server guard ordering for registered protected screens, but every mutation, object identifier and tenant boundary has not yet been mapped to an independently tested server-side authorization decision.",
  "GLOBAL.SEC.internal-ids":
    "The repository has no complete response-field and rendered-payload inventory that classifies each internal identifier, proves business necessity and detects unnecessary exposure across every API, page and export.",
  "GLOBAL.SEC.client-secrets":
    "Source controls and secret inventories exist, but the current immutable production client bundles and hydration payloads have not been rebuilt and scanned after source freeze for every server credential pattern.",
} as const satisfies Readonly<
  Record<ProductGlobalSecurityInvariantOpenRequirementId, string>
>;

export const PRODUCT_GLOBAL_SECURITY_INVARIANT_EXPECTED_GAIN =
  PRODUCT_GLOBAL_SECURITY_INVARIANT_REQUIREMENT_IDS.length;

type ProductGlobalSecurityInvariantEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const COMMON_EVIDENCE = [
  PRODUCT_GLOBAL_SECURITY_INVARIANT_EVIDENCE_FILE,
  PRODUCT_GLOBAL_SECURITY_INVARIANT_TEST_FILE,
] as const;

function tested(
  ...evidence: readonly string[]
): ProductGlobalSecurityInvariantEvidenceRecord {
  return { status: "tested", evidence: [...COMMON_EVIDENCE, ...evidence] };
}

export const PRODUCT_GLOBAL_SECURITY_INVARIANT_MASTER_EVIDENCE = {
  "GLOBAL.SEC.open-redirect": tested(
    "src/lib/workos-redirect.ts",
    "src/lib/workos-redirect.test.ts",
    "src/app/sign-in/route.ts",
    "src/app/callback/route.ts",
  ),
  "GLOBAL.SEC.payment-proof": tested(
    "src/app/pricing/page.tsx",
    "src/lib/billing/stripe-webhooks.ts",
    "src/lib/billing/stripe-readiness.test.ts",
    "src/lib/billing/stripe-webhook-settlement.test.ts",
  ),
  "GLOBAL.SEC.reference-codes": tested(
    "src/app/callback/route.ts",
    "src/app/auth/error/page.tsx",
    "src/lib/auth-callback-route-contract.test.ts",
    "src/lib/api-errors.ts",
    "src/lib/api-errors.test.ts",
    "src/lib/request-id.ts",
    "src/lib/request-id.test.ts",
  ),
  "GLOBAL.SEC.fixture-privacy": tested(
    "security/local-data-policy.ts",
    "src/lib/design-lab-local-data-policy.test.ts",
    "scripts/local-database.ts",
    "scripts/seed-demo-route-fixtures.ts",
  ),
} as const satisfies Readonly<
  Record<
    ProductGlobalSecurityInvariantRequirementId,
    ProductGlobalSecurityInvariantEvidenceRecord
  >
>;
