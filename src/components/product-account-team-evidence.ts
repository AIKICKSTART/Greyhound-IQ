import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_ACCOUNT_TEAM_EVIDENCE_FILE =
  "src/components/product-account-team-evidence.ts" as const;
export const PRODUCT_ACCOUNT_TEAM_TEST_FILE =
  "src/components/product-account-team-evidence.test.ts" as const;

export const PRODUCT_ACCOUNT_TEAM_SCOPE =
  "Focused source and unit verification of the GreyhoundIQ account-team workflow: an authenticated owner or administrator can create a 72-hour one-time invitation whose database record contains SHA-256 email and token hashes rather than the raw values; the authenticated matching account can accept or reject it under a locked, single-use transaction; active non-owners can leave; authorized managers can remove bounded targets; only the authoritative owner can change privileged roles or atomically transfer ownerId; last-owner removal and self-demotion fail closed; and the separately serialized administrator-access contract rejects demotion or banning of the sole active administrator. Every mutation is schema-validated, database-rate-limited with fail-closed behavior, visibly confirmed where destructive, audited inside the mutation transaction, and exposes pending plus success or recoverable-failure feedback. This proves reviewed source and authorization-policy units only. It does not prove browser hydration, invitation email delivery, live WorkOS organisation synchronisation, deployed database RLS, production database concurrency, session email-verification configuration, or end-to-end runtime denial; those remain separate launch evidence.";

export const PRODUCT_ACCOUNT_TEAM_REQUIREMENT_IDS = [
  "ROUTE.ACCOUNT.team-invite",
  "ROUTE.ACCOUNT.invite-accept",
  "ROUTE.ACCOUNT.invite-reject",
  "ROUTE.ACCOUNT.team-leave",
  "ROUTE.ACCOUNT.member-remove",
  "ROUTE.ACCOUNT.member-role",
  "ROUTE.ACCOUNT.least-privilege",
  "ROUTE.ACCOUNT.last-owner",
  "ROUTE.ADMIN.last-owner-admin",
] as const;

export type ProductAccountTeamRequirementId =
  (typeof PRODUCT_ACCOUNT_TEAM_REQUIREMENT_IDS)[number];

export const PRODUCT_ACCOUNT_TEAM_EXPECTED_GAIN =
  PRODUCT_ACCOUNT_TEAM_REQUIREMENT_IDS.length;

type ProductAccountTeamEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

const SHARED_EVIDENCE = [
  PRODUCT_ACCOUNT_TEAM_EVIDENCE_FILE,
  PRODUCT_ACCOUNT_TEAM_TEST_FILE,
  "src/lib/organization-team-policy.ts",
  "src/lib/organization-team-policy.test.ts",
  "src/lib/organization-team-service.ts",
  "src/app/account/team/actions.ts",
  "src/app/account/team/page.tsx",
  "src/app/account/team/team-management.tsx",
  "src/app/account/team/team-invite-form.tsx",
  "src/app/account/team/team-invitation-review.tsx",
  "prisma/schema.prisma",
] as const;

const TESTED_TEAM_EVIDENCE = {
  status: "tested",
  evidence: SHARED_EVIDENCE,
} as const;

const TESTED_LAST_OWNER_ADMIN_EVIDENCE = {
  status: "tested",
  evidence: [
    ...SHARED_EVIDENCE,
    "src/lib/admin-access-contract.ts",
    "src/lib/admin-access-contract.test.ts",
    "src/lib/admin-service.ts",
    "src/lib/account-service.ts",
    "src/lib/account-deletion.test.ts",
  ],
} as const;

export const PRODUCT_ACCOUNT_TEAM_MASTER_EVIDENCE = {
  "ROUTE.ACCOUNT.team-invite": TESTED_TEAM_EVIDENCE,
  "ROUTE.ACCOUNT.invite-accept": TESTED_TEAM_EVIDENCE,
  "ROUTE.ACCOUNT.invite-reject": TESTED_TEAM_EVIDENCE,
  "ROUTE.ACCOUNT.team-leave": TESTED_TEAM_EVIDENCE,
  "ROUTE.ACCOUNT.member-remove": TESTED_TEAM_EVIDENCE,
  "ROUTE.ACCOUNT.member-role": TESTED_TEAM_EVIDENCE,
  "ROUTE.ACCOUNT.least-privilege": TESTED_TEAM_EVIDENCE,
  "ROUTE.ACCOUNT.last-owner": TESTED_TEAM_EVIDENCE,
  "ROUTE.ADMIN.last-owner-admin": TESTED_LAST_OWNER_ADMIN_EVIDENCE,
} as const satisfies Readonly<
  Record<ProductAccountTeamRequirementId, ProductAccountTeamEvidenceRecord>
>;
