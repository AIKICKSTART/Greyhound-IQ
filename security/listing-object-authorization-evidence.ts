export const LISTING_OBJECT_AUTHORIZATION_EVIDENCE_FILE =
  "security/listing-object-authorization-evidence.ts" as const;
export const LISTING_OBJECT_AUTHORIZATION_TEST_FILE =
  "security/listing-object-authorization-evidence.test.ts" as const;

export const LISTING_OBJECT_AUTHORIZATION_SCOPE =
  "Source and unit evidence for the owner-only listing edit boundary. The authenticated PATCH route parses an allowlisted body, the service resolves the supplied listing identifier together with the current server profile, a missing or foreign listing fails as listing.not_found before any write, and status changes derive from stored listing state. This proves the listing-identifier authorization requirement and the authorized and unauthorized listing-edit traces only; it does not claim deployed-database execution, cross-tenant runtime evidence, other listing operations, or authorization for other object types.";

export const LISTING_OBJECT_AUTHORIZATION_REQUIREMENT_IDS = [
  "security.server-authority.listing",
  "security.object-authorization.listing-id",
  "security.trace.30.listing-edit",
  "security.trace.31.unauthorised-other-seller-edit",
] as const;

export type ListingObjectAuthorizationRequirementId =
  (typeof LISTING_OBJECT_AUTHORIZATION_REQUIREMENT_IDS)[number];

type ListingAuthorizationTraceStep = Readonly<{
  sourceFile: string;
  sourceSymbol: string;
  input: string;
  output: string;
  trustBoundary: string;
  securityControl: string;
  failure: string;
  test: string;
}>;

type ListingAuthorizationTrace = Readonly<{
  requirementId:
    | "security.trace.30.listing-edit"
    | "security.trace.31.unauthorised-other-seller-edit";
  actor: string;
  expectedResult: "allowed" | "denied";
  steps: readonly ListingAuthorizationTraceStep[];
}>;

const ROUTE_TEST = "src/components/product-marketplace-edit-evidence.test.ts";
const OWNER_ROUTE_TEST =
  "src/components/product-marketplace-edit-route-evidence.test.ts";

export const LISTING_EDIT_AUTHORIZATION_TRACES: readonly ListingAuthorizationTrace[] = [
  {
    requirementId: "security.trace.30.listing-edit",
    actor: "Authenticated paid seller editing a listing owned by their current server profile",
    expectedResult: "allowed",
    steps: [
      {
        sourceFile: "src/app/api/listings/[id]/route.ts",
        sourceSymbol: "PATCH",
        input: "Route listing id and bounded JSON patch body",
        output: "Current server profile, parsed allowlisted patch, and delegated listing update",
        trustBoundary: "Browser request to authenticated Next.js route",
        securityControl: "requireCurrentUserProfile followed by listingPatchSchema.parse",
        failure: "Authentication, rate-limit, body, or schema errors become the route's safe JSON error response",
        test: ROUTE_TEST,
      },
      {
        sourceFile: "src/lib/listing-service.ts",
        sourceSymbol: "getOwnedListing",
        input: "Current server profile and requested listing id",
        output: "Listing selected by both id and current.profileId",
        trustBoundary: "Application service to request-scoped database context",
        securityControl: "findFirst where id equals listingId and profileId equals current.profileId",
        failure: "No matching owner-scoped record throws listing.not_found",
        test: OWNER_ROUTE_TEST,
      },
      {
        sourceFile: "src/lib/listing-service.ts",
        sourceSymbol: "updateListingForCurrentUser",
        input: "Owner-scoped stored listing and allowlisted patch",
        output: "Updated listing, optional status history, and listing.update audit",
        trustBoundary: "Authorized service state to transactional database mutation",
        securityControl: "Stored listing status determines the next moderation status before the update",
        failure: "Ownership denial occurs before the transaction and therefore before any listing write",
        test: ROUTE_TEST,
      },
    ],
  },
  {
    requirementId: "security.trace.31.unauthorised-other-seller-edit",
    actor: "Authenticated seller supplying another seller's valid listing id",
    expectedResult: "denied",
    steps: [
      {
        sourceFile: "src/app/api/listings/[id]/route.ts",
        sourceSymbol: "PATCH",
        input: "Correctly typed foreign listing id and syntactically valid patch body",
        output: "Current server profile and delegated update attempt",
        trustBoundary: "Untrusted object identifier crosses into the authenticated route",
        securityControl: "The route supplies server-derived current identity rather than a client owner id",
        failure: "The service error is reduced through jsonError without returning a foreign listing",
        test: ROUTE_TEST,
      },
      {
        sourceFile: "src/lib/listing-service.ts",
        sourceSymbol: "getOwnedListing",
        input: "Foreign listing id plus the attacker's current.profileId",
        output: "No matching owner-scoped record",
        trustBoundary: "Application service to request-scoped database context",
        securityControl: "The ownership predicate is inseparable from the listing-id lookup",
        failure: "Throws listing.not_found before updateListingForCurrentUser reaches a write",
        test: OWNER_ROUTE_TEST,
      },
    ],
  },
] as const;

const COMMON_EVIDENCE = [
  LISTING_OBJECT_AUTHORIZATION_EVIDENCE_FILE,
  LISTING_OBJECT_AUTHORIZATION_TEST_FILE,
  "src/app/api/listings/[id]/route.ts",
  "src/app/listings/[id]/edit/page.tsx",
  "src/lib/listing-service.ts",
  "src/lib/listing-validation.ts",
  "src/lib/listing-validation.test.ts",
  "src/components/product-marketplace-edit-evidence.ts",
  ROUTE_TEST,
  "src/components/product-marketplace-edit-route-evidence.ts",
  OWNER_ROUTE_TEST,
] as const;

export const LISTING_OBJECT_AUTHORIZATION_MASTER_EVIDENCE = Object.fromEntries(
  LISTING_OBJECT_AUTHORIZATION_REQUIREMENT_IDS.map((requirementId) => [
    requirementId,
    { status: "verified" as const, evidence: COMMON_EVIDENCE },
  ]),
);

export const LISTING_OBJECT_AUTHORIZATION_EXPECTED_GAIN =
  LISTING_OBJECT_AUTHORIZATION_REQUIREMENT_IDS.length;
