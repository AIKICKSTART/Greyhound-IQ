const ADMINISTRATION_BOUNDARY_EVIDENCE = [
  "src/lib/auth-roles.ts",
  "src/lib/auth.test.ts",
  "src/lib/auth.ts",
  "src/lib/admin-access-contract.ts",
  "src/lib/admin-access-contract.test.ts",
  "src/lib/report-ban-policy.test.ts",
  "src/lib/admin-service.ts",
  "src/app/admin/admin-nav-data.ts",
  "src/app/admin/admin-nav-data.test.ts",
  "src/app/admin/admin-authorization-inventory.ts",
  "src/app/admin/admin-authorization-inventory.test.ts",
  "security/administration-boundary-evidence.test.ts",
] as const;

const VERIFIED_ADMINISTRATION_BOUNDARY_IDS = [
  "security.administration-control.role-separation",
  "security.administration-control.server-permission",
  "security.administration-control.role-boundaries",
  "security.administration-control.self-lockout",
] as const;

export const ADMINISTRATION_BOUNDARY_MASTER_EVIDENCE = Object.fromEntries(
  VERIFIED_ADMINISTRATION_BOUNDARY_IDS.map((requirementId) => [
    requirementId,
    {
      status: "verified" as const,
      evidence: ADMINISTRATION_BOUNDARY_EVIDENCE,
    },
  ]),
);
