import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_SERVER_AUTHORITY_EVIDENCE_FILE =
  "src/components/product-server-authority-evidence.ts" as const;
export const PRODUCT_SERVER_AUTHORITY_TEST_FILE =
  "src/components/product-server-authority-evidence.test.ts" as const;

export const PRODUCT_SERVER_AUTHORITY_SCOPE =
  "Focused local source verification that interface visibility is usability only, never authority. The existing source-exhaustive authorization inventory proves protected HTTP handlers, authority-bearing server actions, privileged pages, entitlement reads, alternate entry points, hidden inputs, and browser-controlled state retain server-side denial or delegate to a server-authorized service. This closes only the product invariant that UI hiding must not be treated as authorization. It does not prove deployed signed-out, cross-user, or cross-tenant request matrices, production configuration, or live provider behavior.";

export const PRODUCT_SERVER_AUTHORITY_REQUIREMENT_IDS = [
  "GLOBAL.SEC.server-authority",
] as const;

export type ProductServerAuthorityRequirementId =
  (typeof PRODUCT_SERVER_AUTHORITY_REQUIREMENT_IDS)[number];

export const PRODUCT_SERVER_AUTHORITY_EXPECTED_GAIN =
  PRODUCT_SERVER_AUTHORITY_REQUIREMENT_IDS.length;

type ProductServerAuthorityEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

export const PRODUCT_SERVER_AUTHORITY_MASTER_EVIDENCE = {
  "GLOBAL.SEC.server-authority": {
    status: "tested",
    evidence: [
      PRODUCT_SERVER_AUTHORITY_EVIDENCE_FILE,
      PRODUCT_SERVER_AUTHORITY_TEST_FILE,
      "security/frontend-authorization-evidence.ts",
      "security/frontend-authorization-evidence.test.ts",
      "security/server-authority-aggregate-evidence.ts",
      "security/server-authority-aggregate-evidence.test.ts",
      "security/endpoints.ts",
    ],
  },
} as const satisfies Readonly<
  Record<ProductServerAuthorityRequirementId, ProductServerAuthorityEvidenceRecord>
>;
