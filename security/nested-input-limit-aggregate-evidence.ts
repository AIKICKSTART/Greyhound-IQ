import { ENDPOINT_VALIDATION_JSON_ROUTES, ENDPOINT_VALIDATION_MASTER_EVIDENCE } from "./endpoint-validation-evidence";
import { INPUT_VALIDATION_BOUNDARY_MASTER_EVIDENCE } from "./input-validation-boundary-evidence";

export const NESTED_INPUT_LIMIT_REQUIREMENT_ID =
  "security.input-validation.nested-limit";

export type NestedInputLimitFacts = Readonly<{
  sharedDepthPolicy: boolean;
  boundedRequestBodyPolicy: boolean;
  jsonRouteInventoryCount: number;
}>;

export const NESTED_INPUT_LIMIT_FACTS: NestedInputLimitFacts = {
  sharedDepthPolicy:
    INPUT_VALIDATION_BOUNDARY_MASTER_EVIDENCE[
      "security.input-validation.depth-limit"
    ].status === "verified",
  boundedRequestBodyPolicy:
    (ENDPOINT_VALIDATION_MASTER_EVIDENCE as Record<
      string,
      { status: string }
    >)[
      "security.external-input-surface.request-bodies"
    ]?.status === "verified",
  jsonRouteInventoryCount: ENDPOINT_VALIDATION_JSON_ROUTES.length,
};

const EVIDENCE = [
  "src/lib/json-request.ts",
  "src/lib/json-request.test.ts",
  "security/input-validation-boundary-evidence.ts",
  "security/input-validation-boundary-evidence.test.ts",
  "security/endpoint-validation-evidence.ts",
  "security/endpoint-validation-evidence.test.ts",
  "security/nested-input-limit-aggregate-evidence.ts",
  "security/nested-input-limit-aggregate-evidence.test.ts",
] as const;

export function buildNestedInputLimitMasterEvidence(
  facts: NestedInputLimitFacts,
) {
  if (
    !facts.sharedDepthPolicy ||
    !facts.boundedRequestBodyPolicy ||
    facts.jsonRouteInventoryCount < 1
  ) {
    return {};
  }

  return {
    [NESTED_INPUT_LIMIT_REQUIREMENT_ID]: {
      status: "verified" as const,
      evidence: EVIDENCE,
    },
  };
}

export const NESTED_INPUT_LIMIT_MASTER_EVIDENCE =
  buildNestedInputLimitMasterEvidence(NESTED_INPUT_LIMIT_FACTS);

export const NESTED_INPUT_LIMIT_SCOPE =
  "The shared bounded JSON request boundary rejects object or array nesting deeper than JSON_REQUEST_MAX_DEPTH, and the source-derived route regression rejects direct unbounded request-body readers. This is a local application-input control, not a claim about provider payloads that never enter this boundary.";
