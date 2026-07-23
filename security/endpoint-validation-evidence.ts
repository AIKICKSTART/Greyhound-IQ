export const ENDPOINT_VALIDATION_JSON_ROUTES = [
  "POST /api/actors/[actorId]/mute",
  "POST /api/agents/[type]/run",
  "POST /api/billing/checkout",
  "POST /api/calls/[roomId]/invite",
  "POST /api/calls/rooms",
  "POST /api/conversations",
  "POST /api/conversations/[id]/messages",
  "POST /api/dogs/[id]/claim",
  "POST /api/feed",
  "PATCH /api/feed/[postId]",
  "POST /api/feed/[postId]/comments",
  "POST /api/feed/[postId]/reaction",
  "POST /api/feed/[postId]/save",
  "POST /api/feed/[postId]/share",
  "PATCH /api/feed/comments/[commentId]",
  "POST /api/feed/comments/[commentId]/reaction",
  "POST /api/feed/topics/[topicId]/follow",
  "POST /api/forum/categories/[slug]/threads",
  "POST /api/forum/threads/[id]/posts",
  "POST /api/listings",
  "PATCH /api/listings/[id]",
  "POST /api/listings/[id]/enquiry",
  "POST /api/memory",
  "POST /api/memory/[id]/supersede",
  "POST /api/messages",
  "PATCH /api/media/[id]",
  "POST /api/media/[id]/finalize",
  "POST /api/media/sign-upload",
  "POST /api/reports",
  "POST /api/reports/[id]/resolve",
  "POST /api/users/me/delete",
  "POST /api/users/me/marketing-preferences",
  "PATCH /api/users/me/profile",
] as const;

// Kept for callers created during the first bounded rollout wave.
export const ENDPOINT_VALIDATION_HIGH_RISK_JSON_ROUTES = [
  "POST /api/agents/[type]/run",
  "POST /api/conversations/[id]/messages",
  "POST /api/dogs/[id]/claim",
  "POST /api/listings",
  "PATCH /api/listings/[id]",
  "POST /api/media/[id]/finalize",
  "POST /api/media/sign-upload",
  "POST /api/reports",
  "POST /api/reports/[id]/resolve",
  "POST /api/users/me/delete",
] as const;

const INVALID_FILE_EVIDENCE = [
  "security/endpoint-validation-evidence.ts",
  "security/endpoint-validation-evidence.test.ts",
  "security/external-input-surface-evidence.test.ts",
  "src/lib/json-request.ts",
  "src/lib/json-request.test.ts",
  "src/lib/media-validation.ts",
  "src/lib/media-service.ts",
  "src/lib/media-service.test.ts",
  "src/lib/media-caption.test.ts",
  "src/app/api/media/sign-upload/route.ts",
  "src/app/api/media/[id]/finalize/route.ts",
  "src/app/api/media/[id]/caption/route.ts",
] as const;

const BOUNDED_REQUEST_EVIDENCE = [
  "security/endpoint-validation-evidence.ts",
  "security/endpoint-validation-evidence.test.ts",
  "src/lib/json-request.ts",
  "src/lib/json-request.test.ts",
  "src/lib/api-errors.ts",
  "src/lib/api-errors.test.ts",
  "src/lib/webhook-request-body.ts",
  "security/webhook-request-body-control.test.ts",
  "src/lib/media-validation.ts",
  "src/lib/media-caption.test.ts",
  "src/app/api/analytics/onboarding/handler.ts",
  "src/app/api/analytics/onboarding/route.ts",
  "src/app/api/analytics/onboarding/route.test.ts",
  "next.config.ts",
] as const;

const HOSTILE_FIXTURE_EVIDENCE = [
  "security/endpoint-validation-evidence.ts",
  "security/endpoint-validation-evidence.test.ts",
  "security/endpoint-validation-fixtures.ts",
  "security/endpoint-validation-fixtures.test.ts",
  "security/property-authorization-evidence.test.ts",
  "src/lib/account-validation.ts",
  "src/lib/agent-validation.ts",
  "src/lib/billing/checkout-validation.ts",
  "src/lib/call-validation.ts",
  "src/lib/conversation-validation.ts",
  "src/lib/feed-validation.ts",
  "src/lib/forum-validation.ts",
  "src/lib/listing-validation.ts",
  "src/lib/media-validation.ts",
  "src/lib/memory-validation.ts",
  "src/lib/report-validation.ts",
] as const;

const INVALID_IDENTIFIER_EVIDENCE = [
  "security/endpoint-validation-evidence.ts",
  "security/endpoint-validation-evidence.test.ts",
  "security/endpoints.ts",
  "src/lib/request-security.ts",
  "src/lib/request-security.test.ts",
  "src/proxy.ts",
] as const;

const UNSUPPORTED_METHOD_EVIDENCE = [
  "security/endpoint-validation-evidence.ts",
  "security/endpoint-validation-evidence.test.ts",
  "security/http-control-evidence.test.ts",
  "scripts/http-method-boundary.cjs",
  "scripts/http-method-boundary.test.ts",
  "src/lib/request-security.ts",
  "src/lib/request-security.test.ts",
  "src/proxy.ts",
] as const;

const INVALID_DATE_EVIDENCE = [
  "security/endpoint-validation-evidence.ts",
  "security/endpoint-validation-evidence.test.ts",
  "src/app/admin/admin-input-contract.ts",
  "src/app/admin/admin-input-contract.test.ts",
  "src/app/admin/form-controls.tsx",
  "src/app/admin/mutations.ts",
] as const;

export const ENDPOINT_VALIDATION_HOSTILE_REQUIREMENT_IDS = [
  "security.endpoint-test-validation.missing-required-field",
  "security.endpoint-test-validation.null",
  "security.endpoint-test-validation.empty-string",
  "security.endpoint-test-validation.excessively-long-value",
  "security.endpoint-test-validation.out-of-range-number",
  "security.endpoint-test-validation.invalid-enumeration",
  "security.endpoint-test-validation.unexpected-fields",
  "security.endpoint-test-validation.invalid-nested-object",
  "security.endpoint-test-validation.oversized-array",
  "security.endpoint-test-validation.invalid-url",
] as const;

export const ENDPOINT_VALIDATION_IDENTIFIER_REQUIREMENT_IDS = [
  "security.endpoint-test-validation.invalid-identifier",
  "security.external-input-surface.path-parameters",
  "security.deny-by-default.identifier",
] as const;

export const ENDPOINT_VALIDATION_REQUEST_BOUNDARY_REQUIREMENT_IDS = [
  "security.external-input-surface.request-bodies",
  "security.input-validation.error",
  "security.resource-control.request-size-limit",
] as const;

export const ENDPOINT_VALIDATION_MASTER_EVIDENCE = {
  ...Object.fromEntries(
    ENDPOINT_VALIDATION_HOSTILE_REQUIREMENT_IDS.map((requirementId) => [
      requirementId,
      { status: "verified" as const, evidence: HOSTILE_FIXTURE_EVIDENCE },
    ]),
  ),
  "security.endpoint-test-validation.invalid-file": {
    status: "verified" as const,
    evidence: INVALID_FILE_EVIDENCE,
  },
  "security.endpoint-test-validation.unexpected-content-type": {
    status: "verified" as const,
    evidence: BOUNDED_REQUEST_EVIDENCE,
  },
  "security.endpoint-test-validation.oversized-request": {
    status: "verified" as const,
    evidence: BOUNDED_REQUEST_EVIDENCE,
  },
  ...Object.fromEntries(
    ENDPOINT_VALIDATION_IDENTIFIER_REQUIREMENT_IDS.map((requirementId) => [
      requirementId,
      { status: "verified" as const, evidence: INVALID_IDENTIFIER_EVIDENCE },
    ]),
  ),
  ...Object.fromEntries(
    ENDPOINT_VALIDATION_REQUEST_BOUNDARY_REQUIREMENT_IDS.map(
      (requirementId) => [
        requirementId,
        { status: "verified" as const, evidence: BOUNDED_REQUEST_EVIDENCE },
      ],
    ),
  ),
  "security.endpoint-test-validation.unsupported-method": {
    status: "verified" as const,
    evidence: UNSUPPORTED_METHOD_EVIDENCE,
  },
  "security.endpoint-test-validation.invalid-date": {
    status: "verified" as const,
    evidence: INVALID_DATE_EVIDENCE,
  },
};
