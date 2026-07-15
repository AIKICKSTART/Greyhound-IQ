import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_AGENT_RUN_LIFECYCLE_REQUIREMENT_IDS = [
  "ROUTE.AI.secret-safety",
  "ROUTE.AI.states",
  "ROUTE.AI.cancel",
] as const;

export const PRODUCT_AGENT_RUN_LIFECYCLE_EVIDENCE_FILE =
  "src/components/product-agent-run-lifecycle-evidence.ts" as const;
export const PRODUCT_AGENT_RUN_LIFECYCLE_TEST_FILE =
  "src/components/product-agent-run-lifecycle-evidence.test.ts" as const;

type ProductAgentRunLifecycleEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const AGENT_RUN_LIFECYCLE_EVIDENCE = [
  PRODUCT_AGENT_RUN_LIFECYCLE_EVIDENCE_FILE,
  PRODUCT_AGENT_RUN_LIFECYCLE_TEST_FILE,
  "src/components/agent-run-lifecycle.ts",
  "src/components/agent-run-lifecycle.test.ts",
  "src/components/agent-run-cancel-button.tsx",
  "src/app/agents/page.tsx",
  "src/app/api/agents/runs/[id]/cancel/route.ts",
  "src/app/api/agents/[type]/run/route.ts",
  "src/lib/agent-service.ts",
] as const;

export const PRODUCT_AGENT_RUN_LIFECYCLE_MASTER_EVIDENCE =
  Object.fromEntries(
    PRODUCT_AGENT_RUN_LIFECYCLE_REQUIREMENT_IDS.map((id) => [
      id,
      {
        status: "tested" as const,
        evidence: AGENT_RUN_LIFECYCLE_EVIDENCE,
      },
    ]),
  ) as unknown as Record<
    (typeof PRODUCT_AGENT_RUN_LIFECYCLE_REQUIREMENT_IDS)[number],
    ProductAgentRunLifecycleEvidenceRecord
  >;
