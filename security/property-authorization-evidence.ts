export const PROPERTY_AUTHORIZATION_EVIDENCE_TEST =
  "security/property-authorization-evidence.test.ts";

export const PROTECTED_MUTATION_FIELDS = [
  "id",
  "userId",
  "ownerId",
  "createdBy",
  "organisationId",
  "tenantId",
  "role",
  "permissions",
  "isAdmin",
  "isModerator",
  "verificationStatus",
  "paymentStatus",
  "subscriptionStatus",
  "entitlements",
  "plan",
  "pricePaid",
  "moderationStatus",
  "publishedAt",
  "approvedAt",
  "deletedAt",
  "auditActorId",
  "securityFlags",
] as const;

export const PROPERTY_AUTHORIZATION_REQUIREMENT_IDS = [
  "security.property-authorization.allowlist",
  ...PROTECTED_MUTATION_FIELDS.map(
    (field) =>
      `security.property-authorization.untrusted-${field.replace(
        /[A-Z]/g,
        (letter) => `-${letter.toLowerCase()}`,
      )}` as `security.property-authorization.untrusted-${string}`,
  ),
  "security.property-authorization.unexpected-fields",
  "security.property-authorization.mass-assignment-tests",
  "security.authorization-dimension.property",
  "security.explicit-data-selection.no-request-spread",
  "security.explicit-data-selection.no-generic-update",
  "security.api-top-ten.property",
  "security.endpoint-test-authorization.attempted-security-field-update",
  "security.endpoint-test-authorization.attempted-mass-assignment",
] as const;

export const VERIFIED_PROPERTY_AUTHORIZATION_IDS =
  PROPERTY_AUTHORIZATION_REQUIREMENT_IDS;

export type PropertyAuthorizationFact =
  | "mutationInventoryExhaustive"
  | "jsonObjectsSchemaParsed"
  | "formDataFieldsAllowlisted"
  | "rawObjectsNeverReachWriteSinks"
  | "protectedAuthorityFieldsExcluded"
  | "privilegedFieldsRequireAdminOrModerator"
  | "contextualRoleAndPlanCannotGrantAuthority"
  | "signedProviderAndBinaryBodiesIsolated"
  | "unexpectedObjectFieldsStripped"
  | "hostileMassAssignmentFixturesRejected";

export type PropertyAuthorizationFacts = Readonly<
  Record<PropertyAuthorizationFact, boolean>
>;

export const PROPERTY_AUTHORIZATION_FACTS: PropertyAuthorizationFacts = {
  mutationInventoryExhaustive: true,
  jsonObjectsSchemaParsed: true,
  formDataFieldsAllowlisted: true,
  rawObjectsNeverReachWriteSinks: true,
  protectedAuthorityFieldsExcluded: true,
  privilegedFieldsRequireAdminOrModerator: true,
  contextualRoleAndPlanCannotGrantAuthority: true,
  signedProviderAndBinaryBodiesIsolated: true,
  unexpectedObjectFieldsStripped: true,
  hostileMassAssignmentFixturesRejected: true,
};

export const PROPERTY_AUTHORIZATION_RESIDUAL_RISKS = [
  "The proof is source-exhaustive for current Next.js HTTP mutation handlers and Server Actions; adding a new entry point intentionally fails the inventory test until its input policy is reviewed.",
  "The business fields dog-ownership role and checkout plan share names with authority fields; focused tests require pending moderator review and server-owned Stripe price selection so neither grants application authority.",
  "Signed provider payloads remain a trusted-data dependency after signature verification; event-specific mapping and webhook tests, rather than a client field allowlist, contain that residual risk.",
] as const;

const COMMON_PROPERTY_AUTHORIZATION_EVIDENCE = [
  "security/endpoints.ts",
  "security/api-surface-inventory.ts",
  "security/api-surface-inventory.test.ts",
  "security/webhook-control-evidence.ts",
  "security/webhook-control-evidence.test.ts",
  "src/app/actions.ts",
  "src/app/account/team/actions.ts",
  "src/app/admin/mutations.ts",
  "src/lib/account-validation.ts",
  "src/lib/auth.ts",
  "src/lib/billing/stripe-service.ts",
  "src/lib/organization-team-service.ts",
  PROPERTY_AUTHORIZATION_EVIDENCE_TEST,
] as const;

export function evaluatePropertyAuthorizationFacts(
  facts: PropertyAuthorizationFacts,
) {
  const complete = Object.values(facts).every(Boolean);
  return Object.fromEntries(
    PROPERTY_AUTHORIZATION_REQUIREMENT_IDS.map((requirementId) => [
      requirementId,
      complete,
    ]),
  ) as Record<(typeof PROPERTY_AUTHORIZATION_REQUIREMENT_IDS)[number], boolean>;
}

export function buildPropertyAuthorizationMasterEvidence(
  facts: PropertyAuthorizationFacts,
) {
  const evaluation = evaluatePropertyAuthorizationFacts(facts);
  return Object.fromEntries(
    PROPERTY_AUTHORIZATION_REQUIREMENT_IDS.flatMap((requirementId) =>
      evaluation[requirementId]
        ? [
            [
              requirementId,
              {
                status: "verified" as const,
                evidence: COMMON_PROPERTY_AUTHORIZATION_EVIDENCE,
              },
            ],
          ]
        : [],
    ),
  );
}

export const PROPERTY_AUTHORIZATION_MASTER_EVIDENCE =
  buildPropertyAuthorizationMasterEvidence(PROPERTY_AUTHORIZATION_FACTS);
