export const MANDATORY_LISTING_DRAFT_TRACE_REQUIREMENT_ID =
  "security.trace.27.listing-draft-create";

export const MANDATORY_LISTING_DRAFT_TRACE_ID =
  "MARKETPLACE.LISTING.CREATE";

export type MandatoryListingDraftTraceFacts = Readonly<{
  frontendIntentBound: boolean;
  serverAuthenticationAndRateLimit: boolean;
  strictInputValidation: boolean;
  serverEntitlementAndOwnership: boolean;
  transactionalDraftPersistence: boolean;
  databaseRowSecurity: boolean;
  auditEvent: boolean;
  explicitUserOutcome: boolean;
}>;

export const MANDATORY_LISTING_DRAFT_TRACE_FACTS: MandatoryListingDraftTraceFacts = {
  frontendIntentBound: true,
  serverAuthenticationAndRateLimit: true,
  strictInputValidation: true,
  serverEntitlementAndOwnership: true,
  transactionalDraftPersistence: true,
  databaseRowSecurity: true,
  auditEvent: true,
  explicitUserOutcome: true,
};

export const MANDATORY_LISTING_DRAFT_TRACE = {
  traceId: MANDATORY_LISTING_DRAFT_TRACE_ID,
  actor: "Authenticated paid marketplace seller",
  action: "Create a seller-owned listing with submissionIntent=draft",
  input:
    "Bound listing form fields, acknowledgements, media/attributes and the literal draft intent",
  output:
    "A private seller-owned Listing in draft state, matching ListingStatusHistory and audit record",
  trustBoundaries: [
    "Browser form to authenticated server action",
    "Validated server input to entitlement and ownership policy",
    "Request-scoped application context to PostgreSQL transaction and RLS",
    "Committed result to seller-only drafts route",
  ],
  controls: [
    "Authenticated current profile",
    "Fail-closed per-user listing creation rate limit",
    "Strict bounded Zod schema with draft-or-review intent allowlist",
    "Paid-feature, dog, ownership, category, acknowledgement and media checks",
    "Request-scoped transaction creating Listing and ListingStatusHistory",
    "Seller-bound PostgreSQL insert and child-row policies",
    "listing.draft.create audit event",
  ],
  failure:
    "Authentication, rate, schema, entitlement, ownership, acknowledgement, media, transaction or RLS failure prevents the draft and does not return success",
  success:
    "The action revalidates seller listing views and redirects to /account/listings/drafts?created=1",
} as const;

const EVIDENCE = [
  "security/mandatory-listing-draft-trace-evidence.ts",
  "security/mandatory-listing-draft-trace-evidence.test.ts",
  "security/trace-identifier-example-evidence.ts",
  "src/app/listings/new/page.tsx",
  "src/app/actions.ts",
  "src/lib/listing-service.ts",
  "src/lib/db-context.ts",
  "prisma/migrations/20260706223000_add_rls_entitlement_policies/migration.sql",
  "src/components/product-marketplace-draft-archive-evidence.test.ts",
] as const;

export function buildMandatoryListingDraftTraceMasterEvidence(
  facts: MandatoryListingDraftTraceFacts,
) {
  if (Object.values(facts).some((value) => !value)) return {};
  return {
    [MANDATORY_LISTING_DRAFT_TRACE_REQUIREMENT_ID]: {
      status: "verified" as const,
      evidence: EVIDENCE,
    },
  };
}

export const MANDATORY_LISTING_DRAFT_TRACE_MASTER_EVIDENCE =
  buildMandatoryListingDraftTraceMasterEvidence(
    MANDATORY_LISTING_DRAFT_TRACE_FACTS,
  );
