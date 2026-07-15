import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_AI_TRUTH_EVIDENCE_FILE =
  "src/components/product-ai-truth-evidence.ts" as const;
export const PRODUCT_AI_TRUTH_TEST_FILE =
  "src/components/product-ai-truth-evidence.test.ts" as const;

export const PRODUCT_AI_TRUTH_EVIDENCE_SCOPE =
  "Deterministic source and focused-unit verification of the current /agents surface: the three implemented local-harness agents share one capability and tier catalogue, unsupported agents are absent, previews and live outputs disclose heuristic limitations, and authenticated tier-checked runs may write only disclosed user-owned run, context, memory, usage and audit artifacts. This evidence proves the current agent surface only. It does not prove provider or prompt internals, live model quality, deployed authorization, browser rendering, cancellation controls, an interrupted-state experience, related session or configuration routes, client-bundle secret safety, future tool-execution authorization, or production readiness.";

export const PRODUCT_AI_TRUTH_REQUIREMENT_IDS = [
  "ROUTE.AI.gate-explanation",
  "ROUTE.AI.capability-truth",
  "ROUTE.AI.unsupported-hidden",
  "ROUTE.AI.limitations",
  "ROUTE.AI.no-silent-mutation",
  "ROUTE.AI.mutation-authz",
] as const;

export type ProductAiTruthRequirementId =
  (typeof PRODUCT_AI_TRUTH_REQUIREMENT_IDS)[number];

export const PRODUCT_AI_TRUTH_OPEN_REQUIREMENT_IDS = [
  "ROUTE.AI.related-routes",
  "ROUTE.AI.secret-safety",
  "ROUTE.AI.states",
  "ROUTE.AI.cancel",
] as const;

export type ProductAiTruthOpenRequirementId =
  (typeof PRODUCT_AI_TRUTH_OPEN_REQUIREMENT_IDS)[number];

export const PRODUCT_AI_TRUTH_OPEN_GAPS = {
  "ROUTE.AI.related-routes":
    "The registered /agents page and current run/context API routes exist, but there is no independently registered user-facing session, history-detail, configuration or tool-management screen contract.",
  "ROUTE.AI.secret-safety":
    "The surface uses shared safe API errors, but this product batch does not rebuild and scan production client bundles, hydration payloads, provider responses or operational logs for every secret and internal-prompt pattern.",
  "ROUTE.AI.states":
    "Stored runs support running, completed, failed and cancelled values, while the page has no explicit interrupted-state representation and no deterministic UI test covering every required state transition.",
  "ROUTE.AI.cancel":
    "An authenticated ownership-checked cancellation API exists, but /agents does not expose a bound cancel control with confirmation, pending feedback, race handling and a browser-level success test.",
} as const satisfies Readonly<Record<ProductAiTruthOpenRequirementId, string>>;

export const PRODUCT_AI_TRUTH_EXPECTED_GAIN =
  PRODUCT_AI_TRUTH_REQUIREMENT_IDS.length;

type ProductAiTruthEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const COMMON_EVIDENCE = [
  PRODUCT_AI_TRUTH_EVIDENCE_FILE,
  PRODUCT_AI_TRUTH_TEST_FILE,
] as const;

function tested(...evidence: readonly string[]): ProductAiTruthEvidenceRecord {
  return { status: "tested", evidence: [...COMMON_EVIDENCE, ...evidence] };
}

export const PRODUCT_AI_TRUTH_MASTER_EVIDENCE = {
  "ROUTE.AI.gate-explanation": tested(
    "src/lib/agent-product-catalogue.ts",
    "src/app/agents/page.tsx",
    "src/components/pro-gate.tsx",
  ),
  "ROUTE.AI.capability-truth": tested(
    "src/lib/agent-product-catalogue.ts",
    "src/app/agents/page.tsx",
    "src/components/agent-demo-console.tsx",
    "src/lib/agent-service.ts",
  ),
  "ROUTE.AI.unsupported-hidden": tested(
    "src/lib/agent-product-catalogue.ts",
    "src/app/agents/page.tsx",
    "src/components/agent-demo-console.tsx",
    "src/lib/agent-service.ts",
  ),
  "ROUTE.AI.limitations": tested(
    "src/lib/agent-product-catalogue.ts",
    "src/app/agents/page.tsx",
    "src/components/agent-demo-console.tsx",
    "src/lib/agent-service.ts",
  ),
  "ROUTE.AI.no-silent-mutation": tested(
    "src/app/agents/page.tsx",
    "src/lib/agent-service.ts",
    "src/app/actions.ts",
    "src/app/api/agents/[type]/run/route.ts",
  ),
  "ROUTE.AI.mutation-authz": tested(
    "src/lib/agent-service.ts",
    "src/app/actions.ts",
    "src/app/api/agents/[type]/run/route.ts",
    "src/app/api/agents/runs/[id]/route.ts",
    "src/app/api/agents/runs/[id]/cancel/route.ts",
    "src/app/api/agents/context/route.ts",
  ),
} as const satisfies Readonly<
  Record<ProductAiTruthRequirementId, ProductAiTruthEvidenceRecord>
>;
