import {
  ENDPOINT_VALIDATION_FIXTURES,
  type EndpointValidationFixture,
} from "./endpoint-validation-fixtures";
import { PROPERTY_AUTHORIZATION_FACTS } from "./property-authorization-evidence";

export const NULL_INPUT_BEHAVIOR_REQUIREMENT_ID =
  "security.input-validation.null";

export type ReviewedNullableInput = Readonly<{
  endpoint: string;
  field: string;
  disposition: string;
}>;

export const REVIEWED_NULLABLE_INPUTS = [
  ...nullable("POST /api/actors/[actorId]/mute", ["actorId"], "Omission or null selects the current server-resolved actor."),
  ...nullable("POST /api/agents/[type]/run", ["conversationContextId"], "Optional conversation context is absent."),
  ...nullable("POST /api/conversations", ["senderActorId"], "Omission or null selects the current server-resolved actor."),
  ...nullable("POST /api/dogs/[id]/claim", ["evidence"], "Optional supporting evidence is absent."),
  ...nullable("POST /api/feed", ["pageId", "topicId"], "Optional feed relationship is absent."),
  ...nullable("POST /api/feed/[postId]/comments", ["actorId", "parentCommentId"], "Optional actor or parent relationship is absent."),
  ...nullable("POST /api/feed/[postId]/reaction", ["actorId"], "Omission or null selects the current server-resolved actor."),
  ...nullable("POST /api/feed/[postId]/save", ["actorId"], "Omission or null selects the current server-resolved actor."),
  ...nullable("POST /api/feed/[postId]/share", ["actorId", "body"], "Optional actor selection or share commentary is absent."),
  ...nullable("POST /api/feed/comments/[commentId]/reaction", ["actorId"], "Omission or null selects the current server-resolved actor."),
  ...nullable("POST /api/feed/topics/[topicId]/follow", ["actorId"], "Omission or null selects the current server-resolved actor."),
  ...nullable("POST /api/listings", ["categoryId", "condition", "damDogId", "dogId", "itemBrand", "itemModel", "postcode", "price", "region", "sireDogId", "state", "suburb"], "Nullable listing detail is explicitly absent."),
  ...nullable("PATCH /api/listings/[id]", ["categoryId", "condition", "damDogId", "dogId", "itemBrand", "itemModel", "postcode", "price", "region", "sireDogId", "state", "suburb"], "Null explicitly clears the optional listing detail."),
  ...nullable("POST /api/memory", ["sourceRef"], "Optional source reference is absent."),
  ...nullable("PATCH /api/media/[id]", ["altText"], "Null explicitly clears optional alternative text."),
  ...nullable("POST /api/reports", ["description"], "Optional report description is absent."),
  ...nullable("POST /api/reports/[id]/resolve", ["notes"], "Optional resolution notes are absent."),
  ...nullable("PATCH /api/users/me/profile", ["bio", "kennelName", "kennelPrefix", "phone", "state", "website"], "Null explicitly clears the optional profile field."),
] as const satisfies readonly ReviewedNullableInput[];

export type NullInputBehaviorAudit = Readonly<{
  routes: number;
  fields: number;
  nullableFields: number;
  issues: readonly string[];
}>;

export function auditNullInputBehavior(
  fixtures: readonly EndpointValidationFixture[],
  reviewed: readonly ReviewedNullableInput[] = REVIEWED_NULLABLE_INPUTS,
): NullInputBehaviorAudit {
  const issues: string[] = [];
  const accepted = new Set<string>();
  const reviewedKeys = reviewed.map(({ endpoint, field }) => key(endpoint, field));
  const reviewedSet = new Set(reviewedKeys);
  let fields = 0;

  if (fixtures.length < 1) issues.push("NULL_ROUTE_INVENTORY_VACUOUS");
  if (reviewedSet.size !== reviewedKeys.length) {
    issues.push("NULL_REVIEW_DUPLICATE");
  }
  if (reviewed.some(({ disposition }) => !disposition.trim())) {
    issues.push("NULL_REVIEW_DISPOSITION_MISSING");
  }

  for (const fixture of fixtures) {
    if (fixture.schema.safeParse(null).success) {
      issues.push(`NULL_BODY_ACCEPTED:${fixture.endpoint}`);
    }

    const shape = schemaShape(fixture.schema);
    if (!shape || shape.length < 1) {
      issues.push(`NULL_SCHEMA_SHAPE_MISSING:${fixture.endpoint}`);
      continue;
    }
    fields += shape.length;

    for (const field of shape) {
      const parsed = fixture.schema.safeParse({
        ...fixture.valid,
        [field]: null,
      });
      if (parsed.success) accepted.add(key(fixture.endpoint, field));
    }
  }

  for (const acceptedKey of accepted) {
    if (!reviewedSet.has(acceptedKey)) {
      issues.push(`NULL_FIELD_UNREVIEWED:${acceptedKey}`);
    }
  }
  for (const reviewedKey of reviewedSet) {
    if (!accepted.has(reviewedKey)) {
      issues.push(`NULL_REVIEW_STALE:${reviewedKey}`);
    }
  }

  return {
    routes: fixtures.length,
    fields,
    nullableFields: accepted.size,
    issues: [...new Set(issues)].toSorted(),
  };
}

export type NullInputBehaviorFacts = Readonly<{
  exactNullReview: boolean;
  mutationInventoryExhaustive: boolean;
  jsonObjectsSchemaParsed: boolean;
  formDataFieldsAllowlisted: boolean;
  providerAndBinaryBodiesIsolated: boolean;
}>;

const currentAudit = auditNullInputBehavior(ENDPOINT_VALIDATION_FIXTURES);

export const NULL_INPUT_BEHAVIOR_FACTS: NullInputBehaviorFacts = {
  exactNullReview: currentAudit.issues.length === 0,
  mutationInventoryExhaustive:
    PROPERTY_AUTHORIZATION_FACTS.mutationInventoryExhaustive,
  jsonObjectsSchemaParsed: PROPERTY_AUTHORIZATION_FACTS.jsonObjectsSchemaParsed,
  formDataFieldsAllowlisted:
    PROPERTY_AUTHORIZATION_FACTS.formDataFieldsAllowlisted,
  providerAndBinaryBodiesIsolated:
    PROPERTY_AUTHORIZATION_FACTS.signedProviderAndBinaryBodiesIsolated,
};

export function buildNullInputBehaviorMasterEvidence(
  facts: NullInputBehaviorFacts,
) {
  if (!Object.values(facts).every(Boolean)) return {};
  return {
    [NULL_INPUT_BEHAVIOR_REQUIREMENT_ID]: {
      status: "verified" as const,
      evidence: [
        "security/endpoint-validation-fixtures.ts",
        "security/endpoint-validation-fixtures.test.ts",
        "security/property-authorization-evidence.ts",
        "security/property-authorization-evidence.test.ts",
        "security/null-input-behavior-evidence.ts",
        "security/null-input-behavior-evidence.test.ts",
      ],
    },
  };
}

export const NULL_INPUT_BEHAVIOR_MASTER_EVIDENCE =
  buildNullInputBehaviorMasterEvidence(NULL_INPUT_BEHAVIOR_FACTS);

export const NULL_INPUT_BEHAVIOR_SCOPE =
  "Every current client-controlled JSON/form mutation schema rejects a null body. Each declared field is null-mutated, every accepted null is bound to an exact reviewed field disposition, Server Action FormData fields are allowlisted, and provider/binary bodies stay separately classified.";

function nullable(
  endpoint: string,
  fields: readonly string[],
  disposition: string,
): ReviewedNullableInput[] {
  return fields.map((field) => ({ endpoint, field, disposition }));
}

function key(endpoint: string, field: string) {
  return `${endpoint}#${field}`;
}

function schemaShape(schema: unknown): string[] | null {
  const candidate = asRecord(schema);
  const definition = asRecord(candidate?._def);
  const rawShape = definition?.shape;
  const shape = typeof rawShape === "function" ? rawShape() : rawShape;
  const record = asRecord(shape);
  return record ? Object.keys(record).toSorted() : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
