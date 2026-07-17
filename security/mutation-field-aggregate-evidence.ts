import { PROPERTY_AUTHORIZATION_FACTS } from "./property-authorization-evidence";

export const MUTATION_FIELD_AGGREGATE_REQUIREMENT_IDS = [
  "security.explicit-data-selection.mutate-fields",
  "security.ci.07.unrestricted-mutation-fields",
  "security.release.07.mutations-field-allowlist",
] as const;

export type MutationFieldAggregateFacts = Readonly<{
  mutationInventoryExhaustive: boolean;
  jsonObjectsSchemaParsed: boolean;
  formDataFieldsAllowlisted: boolean;
  rawObjectsNeverReachWriteSinks: boolean;
  protectedAuthorityFieldsExcluded: boolean;
  unexpectedObjectFieldsStripped: boolean;
  hostileMassAssignmentFixturesRejected: boolean;
}>;

export const MUTATION_FIELD_AGGREGATE_FACTS: MutationFieldAggregateFacts = {
  mutationInventoryExhaustive:
    PROPERTY_AUTHORIZATION_FACTS.mutationInventoryExhaustive,
  jsonObjectsSchemaParsed: PROPERTY_AUTHORIZATION_FACTS.jsonObjectsSchemaParsed,
  formDataFieldsAllowlisted:
    PROPERTY_AUTHORIZATION_FACTS.formDataFieldsAllowlisted,
  rawObjectsNeverReachWriteSinks:
    PROPERTY_AUTHORIZATION_FACTS.rawObjectsNeverReachWriteSinks,
  protectedAuthorityFieldsExcluded:
    PROPERTY_AUTHORIZATION_FACTS.protectedAuthorityFieldsExcluded,
  unexpectedObjectFieldsStripped:
    PROPERTY_AUTHORIZATION_FACTS.unexpectedObjectFieldsStripped,
  hostileMassAssignmentFixturesRejected:
    PROPERTY_AUTHORIZATION_FACTS.hostileMassAssignmentFixturesRejected,
};

const EVIDENCE = [
  "security/mutation-field-aggregate-evidence.ts",
  "security/mutation-field-aggregate-evidence.test.ts",
  "security/property-authorization-evidence.ts",
  "security/property-authorization-evidence.test.ts",
  "security/endpoints.ts",
] as const;

export function buildMutationFieldAggregateMasterEvidence(
  facts: MutationFieldAggregateFacts,
) {
  if (!Object.values(facts).every(Boolean)) return {};

  return Object.fromEntries(
    MUTATION_FIELD_AGGREGATE_REQUIREMENT_IDS.map((requirementId) => [
      requirementId,
      { status: "verified" as const, evidence: EVIDENCE },
    ]),
  );
}

export const MUTATION_FIELD_AGGREGATE_MASTER_EVIDENCE =
  buildMutationFieldAggregateMasterEvidence(MUTATION_FIELD_AGGREGATE_FACTS);
