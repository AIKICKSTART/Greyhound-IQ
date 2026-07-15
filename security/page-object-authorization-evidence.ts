export const PAGE_OBJECT_AUTHORIZATION_EVIDENCE_FILE =
  "security/page-object-authorization-evidence.ts" as const;
export const PAGE_OBJECT_AUTHORIZATION_TEST_FILE =
  "security/page-object-authorization-evidence.test.ts" as const;

export const PAGE_OBJECT_AUTHORIZATION_SCOPE =
  "Source evidence for the implemented custom-page identifier boundary. Every current member page read, update, publish, delete, page-authored feed-post and dog-card path derives the current profile on the server and binds the supplied page identifier to that profile before a protected read or effect. This closes only page-id object authorization and server page authority for these implemented paths; it does not claim deployed-database parity, cross-user runtime testing, tenant authorization or authorization for other object types.";

export const PAGE_OBJECT_AUTHORIZATION_REQUIREMENT_IDS = [
  "security.object-authorization.page-id",
  "security.server-authority.page",
] as const;

const EVIDENCE = [
  PAGE_OBJECT_AUTHORIZATION_EVIDENCE_FILE,
  PAGE_OBJECT_AUTHORIZATION_TEST_FILE,
  "src/app/account/pages/[id]/page.tsx",
  "src/app/actions.ts",
  "src/app/api/feed/route.ts",
  "src/lib/custom-page-service.ts",
  "src/lib/dog-card-service.ts",
  "src/lib/feed-service.ts",
  "src/lib/feed-validation.ts",
  "src/lib/social-actor-service.ts",
] as const;

export const PAGE_OBJECT_AUTHORIZATION_MASTER_EVIDENCE = Object.fromEntries(
  PAGE_OBJECT_AUTHORIZATION_REQUIREMENT_IDS.map((requirementId) => [
    requirementId,
    { status: "verified" as const, evidence: EVIDENCE },
  ]),
);
