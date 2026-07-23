const BILLING_INVOICE_OWNERSHIP_EVIDENCE = [
  "src/app/account/billing/page.tsx",
  "prisma/schema.prisma",
  "prisma/migrations/20260706223000_add_rls_entitlement_policies/migration.sql",
  "prisma/migrations/20260716120000_restrict_sensitive_rls_to_admin/migration.sql",
  "src/lib/db-context.ts",
  "scripts/check-rls-access-matrix-postgres.ts",
  "security/row-level-security-runtime-evidence.json",
  "security/billing-invoice-ownership-evidence.test.ts",
] as const;

export const BILLING_INVOICE_OWNERSHIP_BOUNDARY = {
  verifiedScope:
    "The current source and disposable loopback PostgreSQL replay prove that an authenticated member can select only their own InvoiceRecord rows, while another member and an anonymous context cannot read them.",
  privilegedScope:
    "The same runtime proof confirms that moderators remain owner-scoped, while administrator and system contexts retain intentional cross-user billing visibility.",
  deployedScope:
    "No staging or production database was contacted. Deployed migration, role, and application-image parity remain separate release gates.",
} as const;

export const BILLING_INVOICE_OWNERSHIP_MASTER_EVIDENCE = {
  "security.billing-control.invoice-ownership": {
    status: "verified",
    evidence: BILLING_INVOICE_OWNERSHIP_EVIDENCE,
  },
} as const;
