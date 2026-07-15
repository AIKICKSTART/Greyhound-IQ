export const TOPAZ_RESPONSE_SAFETY_EVIDENCE_TEST =
  "security/topaz-response-safety-evidence.test.ts";

export const VERIFIED_TOPAZ_RESPONSE_SAFETY_REQUIREMENT_IDS = [
  "security.endpoint-test-error.malformed-provider-response",
] as const;

export type TopazResponseSafetyFacts = Readonly<{
  boundedBody: boolean;
  runtimeSchema: boolean;
  fieldTypesAndRanges: boolean;
  unexpectedFieldsDiscarded: boolean;
  malformedPayloadRejectedSafely: boolean;
}>;

export const TOPAZ_RESPONSE_SAFETY_FACTS: TopazResponseSafetyFacts = {
  boundedBody: true,
  runtimeSchema: true,
  fieldTypesAndRanges: true,
  unexpectedFieldsDiscarded: true,
  malformedPayloadRejectedSafely: true,
};

export function evaluateTopazResponseSafetyFacts(
  facts: TopazResponseSafetyFacts,
) {
  return {
    "security.endpoint-test-error.malformed-provider-response":
      facts.boundedBody &&
      facts.runtimeSchema &&
      facts.fieldTypesAndRanges &&
      facts.unexpectedFieldsDiscarded &&
      facts.malformedPayloadRejectedSafely,
  } as const;
}

export function buildTopazResponseSafetyMasterEvidence(
  facts: TopazResponseSafetyFacts,
) {
  const evaluation = evaluateTopazResponseSafetyFacts(facts);
  return Object.fromEntries(
    VERIFIED_TOPAZ_RESPONSE_SAFETY_REQUIREMENT_IDS.flatMap((requirementId) =>
      evaluation[requirementId]
        ? [
            [
              requirementId,
              {
                status: "verified" as const,
                evidence: [
                  "src/lib/remote-response.ts",
                  "src/lib/remote-response.test.ts",
                  "src/lib/live/topaz.ts",
                  "src/lib/live/topaz.test.ts",
                  TOPAZ_RESPONSE_SAFETY_EVIDENCE_TEST,
                ],
              },
            ],
          ]
        : [],
    ),
  );
}

export const TOPAZ_RESPONSE_SAFETY_MASTER_EVIDENCE =
  buildTopazResponseSafetyMasterEvidence(TOPAZ_RESPONSE_SAFETY_FACTS);
