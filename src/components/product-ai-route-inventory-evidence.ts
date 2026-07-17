import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_AI_ROUTE_INVENTORY_EVIDENCE_FILE =
  "src/components/product-ai-route-inventory-evidence.ts" as const;
export const PRODUCT_AI_ROUTE_INVENTORY_TEST_FILE =
  "src/components/product-ai-route-inventory-evidence.test.ts" as const;

export const PRODUCT_AI_ROUTE_INVENTORY_SCOPE =
  "Source-static discovery and registration proof for four AI-related user and operator screens, eleven agent, memory, and maintenance API method records, the embedded createAgentRun server action, and the three supported catalogue entries. Run configuration and user history intentionally remain inside /agents, while operator history remains inside /admin/jobs; no unsupported standalone session, history, or configuration page is advertised. This evidence does not prove live execution, provider availability, browser rendering, database contents, isolation, deployment parity, or production readiness.";

export const PRODUCT_AI_ROUTE_INVENTORY_REQUIREMENT_IDS = [
  "ROUTE.AI.related-routes",
] as const;

export type ProductAiRouteInventoryRequirementId =
  (typeof PRODUCT_AI_ROUTE_INVENTORY_REQUIREMENT_IDS)[number];

export const PRODUCT_AI_ROUTE_INVENTORY_EXPECTED_GAIN =
  PRODUCT_AI_ROUTE_INVENTORY_REQUIREMENT_IDS.length;

type ProductAiRouteInventoryEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const EVIDENCE = [
  PRODUCT_AI_ROUTE_INVENTORY_EVIDENCE_FILE,
  PRODUCT_AI_ROUTE_INVENTORY_TEST_FILE,
  "docs/product/ai-route-inventory.md",
  "src/components/demo-experience-registry.ts",
  "src/app/agents/page.tsx",
  "src/app/admin/jobs/page.tsx",
  "src/lib/agent-product-catalogue.ts",
] as const;

export const PRODUCT_AI_ROUTE_INVENTORY_MASTER_EVIDENCE = {
  "ROUTE.AI.related-routes": {
    status: "tested",
    evidence: EVIDENCE,
  },
} as const satisfies Readonly<
  Record<
    ProductAiRouteInventoryRequirementId,
    ProductAiRouteInventoryEvidenceRecord
  >
>;
