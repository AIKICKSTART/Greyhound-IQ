import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_PUBLIC_AUTH_LOADING_EVIDENCE_FILE =
  "src/components/product-public-auth-loading-evidence.ts" as const;
export const PRODUCT_PUBLIC_AUTH_LOADING_TEST_FILE =
  "src/components/product-public-auth-loading-evidence.test.ts" as const;

export const PRODUCT_PUBLIC_AUTH_LOADING_SCOPE =
  "Focused source and unit verification of outbound public authentication-redirect feedback. The root shell delegates unmodified same-window, same-origin /sign-in anchor activation to one client notice, synchronously renders an accessible Opening secure sign-in status before navigation, and clears stale pending state when browser history restores the page. Modified clicks, downloads, events already prevented when observed, other targets, external origins, invalid URLs, and unrelated paths are rejected. This proves local classification and source wiring only. It does not prove hydrated paint timing, provider availability, callback-exchange loading, authentication success, deployed redirects, or production runtime behavior; SYSTEM.auth-callback-loading remains open.";

export const PRODUCT_PUBLIC_AUTH_LOADING_REQUIREMENT_IDS = [
  "ROUTE.PUBLIC.auth-loading",
] as const;

export type ProductPublicAuthLoadingRequirementId =
  (typeof PRODUCT_PUBLIC_AUTH_LOADING_REQUIREMENT_IDS)[number];

export const PRODUCT_PUBLIC_AUTH_LOADING_EXPECTED_GAIN =
  PRODUCT_PUBLIC_AUTH_LOADING_REQUIREMENT_IDS.length;

type ProductPublicAuthLoadingEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

export const PRODUCT_PUBLIC_AUTH_LOADING_MASTER_EVIDENCE = {
  "ROUTE.PUBLIC.auth-loading": {
    status: "tested",
    evidence: [
      PRODUCT_PUBLIC_AUTH_LOADING_EVIDENCE_FILE,
      PRODUCT_PUBLIC_AUTH_LOADING_TEST_FILE,
      "src/components/authentication-navigation-feedback.tsx",
      "src/components/authentication-navigation-feedback.test.ts",
      "src/app/layout.tsx",
    ],
  },
} as const satisfies Readonly<
  Record<
    ProductPublicAuthLoadingRequirementId,
    ProductPublicAuthLoadingEvidenceRecord
  >
>;
