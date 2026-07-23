import {
  ENDPOINT_VALIDATION_FIXTURES,
  type EndpointValidationFixture,
} from "./endpoint-validation-fixtures";
import { ENDPOINT_VALIDATION_JSON_ROUTES } from "./endpoint-validation-evidence";
import { PROPERTY_AUTHORIZATION_FACTS } from "./property-authorization-evidence";

export const UNKNOWN_INPUT_FIELD_REQUIREMENT_ID =
  "security.input-validation.unknown-field";

export type UnknownInputFieldFacts = Readonly<{
  routeInventoryExact: boolean;
  routeUnexpectedFieldsContained: boolean;
  mutationInventoryExhaustive: boolean;
  jsonObjectsSchemaParsed: boolean;
  formDataFieldsAllowlisted: boolean;
  rawObjectsNeverReachWriteSinks: boolean;
  unexpectedObjectFieldsStripped: boolean;
  providerAndBinaryBodiesIsolated: boolean;
  hostileMassAssignmentFixturesRejected: boolean;
}>;

export const UNKNOWN_INPUT_FIELD_FACTS: UnknownInputFieldFacts = {
  routeInventoryExact: sameStrings(
    ENDPOINT_VALIDATION_FIXTURES.map(({ endpoint }) => endpoint),
    ENDPOINT_VALIDATION_JSON_ROUTES,
  ),
  routeUnexpectedFieldsContained: unknownFieldsAreContained(
    ENDPOINT_VALIDATION_FIXTURES,
  ),
  mutationInventoryExhaustive:
    PROPERTY_AUTHORIZATION_FACTS.mutationInventoryExhaustive,
  jsonObjectsSchemaParsed: PROPERTY_AUTHORIZATION_FACTS.jsonObjectsSchemaParsed,
  formDataFieldsAllowlisted:
    PROPERTY_AUTHORIZATION_FACTS.formDataFieldsAllowlisted,
  rawObjectsNeverReachWriteSinks:
    PROPERTY_AUTHORIZATION_FACTS.rawObjectsNeverReachWriteSinks,
  unexpectedObjectFieldsStripped:
    PROPERTY_AUTHORIZATION_FACTS.unexpectedObjectFieldsStripped,
  providerAndBinaryBodiesIsolated:
    PROPERTY_AUTHORIZATION_FACTS.signedProviderAndBinaryBodiesIsolated,
  hostileMassAssignmentFixturesRejected:
    PROPERTY_AUTHORIZATION_FACTS.hostileMassAssignmentFixturesRejected,
};

const EVIDENCE = [
  "security/endpoint-validation-evidence.ts",
  "security/endpoint-validation-evidence.test.ts",
  "security/endpoint-validation-fixtures.ts",
  "security/endpoint-validation-fixtures.test.ts",
  "security/property-authorization-evidence.ts",
  "security/property-authorization-evidence.test.ts",
  "security/unknown-input-field-aggregate-evidence.ts",
  "security/unknown-input-field-aggregate-evidence.test.ts",
] as const;

export function buildUnknownInputFieldMasterEvidence(
  facts: UnknownInputFieldFacts,
) {
  if (!Object.values(facts).every(Boolean)) return {};

  return {
    [UNKNOWN_INPUT_FIELD_REQUIREMENT_ID]: {
      status: "verified" as const,
      evidence: EVIDENCE,
    },
  };
}

export function unknownFieldsAreContained(
  fixtures: readonly EndpointValidationFixture[],
) {
  if (fixtures.length < 1) return false;

  return fixtures.every((fixture) => {
    const hostile = fixture.cases.find(
      ({ kind }) => kind === "unexpected-fields",
    );
    if (
      !hostile ||
      hostile.expectation !== "reject-or-strip" ||
      !hostile.strippedKey
    ) {
      return false;
    }

    const parsed = fixture.schema.safeParse(hostile.input);
    return (
      !parsed.success ||
      !(hostile.strippedKey in (parsed.data as Record<string, unknown>))
    );
  });
}

export const UNKNOWN_INPUT_FIELD_MASTER_EVIDENCE =
  buildUnknownInputFieldMasterEvidence(UNKNOWN_INPUT_FIELD_FACTS);

export const UNKNOWN_INPUT_FIELD_SCOPE =
  "Every current HTTP mutation body has exactly one reviewed input policy; all 33 bounded JSON/form API bodies reject or strip unexpected properties, all discovered Server Actions read only allowlisted scalar/FormData fields, and raw inputs cannot reach write sinks. Signed provider and binary bodies remain separately classified boundaries.";

function sameStrings(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    left.toSorted().every((value, index) => value === right.toSorted()[index])
  );
}
