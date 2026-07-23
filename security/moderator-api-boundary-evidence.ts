const MODERATOR_API_BOUNDARY_EVIDENCE = [
  "src/lib/auth-roles.ts",
  "src/lib/auth.test.ts",
  "src/app/admin/admin-authorization-inventory.ts",
  "src/app/admin/admin-authorization-inventory.test.ts",
  "src/app/api/reports/[id]/resolve/route.ts",
  "security/moderator-api-boundary-evidence.test.ts",
] as const;

export const MODERATOR_API_BOUNDARY_MASTER_EVIDENCE = {
  "security.api-inventory-management.moderator-not-admin": {
    status: "verified" as const,
    evidence: MODERATOR_API_BOUNDARY_EVIDENCE,
  },
};

