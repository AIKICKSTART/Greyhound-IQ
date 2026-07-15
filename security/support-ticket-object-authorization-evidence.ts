export const SUPPORT_TICKET_OBJECT_AUTHORIZATION_EVIDENCE_FILE =
  "security/support-ticket-object-authorization-evidence.ts" as const;
export const SUPPORT_TICKET_OBJECT_AUTHORIZATION_TEST_FILE =
  "security/support-ticket-object-authorization-evidence.test.ts" as const;

export const SUPPORT_TICKET_OBJECT_AUTHORIZATION_SCOPE =
  "Source and unit evidence for the implemented member support-ticket detail read. The route derives the current profile on the server and passes the supplied ticket identifier to a request-context service that selects by both ticket id and current database user id, returns only an explicit bounded projection, and produces the same not-found outcome for missing and foreign tickets. The synthetic fixture additionally requires the exact demo environment, demo account and fixture identifier and is disabled in production. This closes only support-ticket-id object authorization for the member detail read; it does not claim reply mutations, administrator operations, deployed row-level-security parity or runtime cross-user database testing.";

export const SUPPORT_TICKET_OBJECT_AUTHORIZATION_REQUIREMENT_IDS = [
  "security.object-authorization.support-ticket-id",
] as const;

const EVIDENCE = [
  SUPPORT_TICKET_OBJECT_AUTHORIZATION_EVIDENCE_FILE,
  SUPPORT_TICKET_OBJECT_AUTHORIZATION_TEST_FILE,
  "src/app/account/support/[id]/page.tsx",
  "src/lib/support-ticket-service.ts",
  "src/lib/demo-support-ticket.ts",
  "src/lib/demo-support-ticket.test.ts",
  "src/components/product-account-support-ticket-detail-evidence.ts",
  "src/components/product-account-support-ticket-detail-evidence.test.ts",
] as const;

export const SUPPORT_TICKET_OBJECT_AUTHORIZATION_MASTER_EVIDENCE =
  Object.fromEntries(
    SUPPORT_TICKET_OBJECT_AUTHORIZATION_REQUIREMENT_IDS.map(
      (requirementId) => [
        requirementId,
        { status: "verified" as const, evidence: EVIDENCE },
      ],
    ),
  );

