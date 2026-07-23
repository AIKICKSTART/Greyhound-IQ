import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_GLOBAL_FOCUS_ORDER_EVIDENCE_FILE =
  "src/components/product-global-focus-order-evidence.ts" as const;
export const PRODUCT_GLOBAL_FOCUS_ORDER_TEST_FILE =
  "src/components/product-global-focus-order-evidence.test.ts" as const;

export const PRODUCT_GLOBAL_FOCUS_ORDER_EVIDENCE_SCOPE =
  "Deterministic source-static focus-order verification for GreyhoundIQ's current TSX and global CSS: the app shell keeps the skip link before header, main and footer; no visual-order or reverse-flow utility remains except the redundant first DOM child marker in the marketplace listing card. It does not prove browser layout, hydrated focus traversal, viewport-specific rendering, assistive-technology output, or deployed candidate behaviour.";

export const PRODUCT_GLOBAL_FOCUS_ORDER_REQUIREMENT_IDS = [
  "GLOBAL.A11Y.focus-order",
] as const;

type ProductGlobalFocusOrderEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const evidence = [
  PRODUCT_GLOBAL_FOCUS_ORDER_EVIDENCE_FILE,
  PRODUCT_GLOBAL_FOCUS_ORDER_TEST_FILE,
  "src/app/layout.tsx",
  "src/app/listings/page.tsx",
  "src/app/globals.css",
  "src/components/feed-system-prototype.tsx",
] as const;

export const PRODUCT_GLOBAL_FOCUS_ORDER_MASTER_EVIDENCE = {
  "GLOBAL.A11Y.focus-order": {
    status: "tested" as const,
    evidence,
  },
} satisfies Readonly<
  Record<
    (typeof PRODUCT_GLOBAL_FOCUS_ORDER_REQUIREMENT_IDS)[number],
    ProductGlobalFocusOrderEvidenceRecord
  >
>;
