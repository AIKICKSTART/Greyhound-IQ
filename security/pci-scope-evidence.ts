export const PCI_SCOPE_EVIDENCE_SCOPE =
  "GreyhoundIQ currently redirects authenticated users to Stripe-hosted Checkout and Portal and does not collect payment-card numbers, CVCs or expiry values. This is a source-bound scope decision, not a PCI compliance attestation. Adding direct card fields, embedded payment components or server-side card-data handling must reopen the gate.";

const PCI_SCOPE_EVIDENCE = [
  "security/pci-scope-evidence.ts",
  "security/pci-scope-evidence.test.ts",
  "docs/security/pci-scope.md",
  "src/app/api/billing/checkout/route.ts",
  "src/app/api/billing/bespoke/checkout/route.ts",
  "src/app/api/billing/portal/route.ts",
  "src/lib/billing/checkout-validation.ts",
  "src/lib/billing/stripe-service.ts",
  "src/lib/billing/stripe-webhooks.ts",
  "src/lib/billing/stripe-webhook-settlement.test.ts",
  "src/lib/json-request.ts",
  "src/lib/json-request.test.ts",
  "src/lib/logger.ts",
  "src/lib/logger.test.ts",
] as const;

export const PCI_SCOPE_MASTER_EVIDENCE = {
  "security.billing-control.no-card-logs": {
    status: "verified" as const,
    evidence: PCI_SCOPE_EVIDENCE,
  },
  "security.billing-control.card-provider": {
    status: "verified" as const,
    evidence: PCI_SCOPE_EVIDENCE,
  },
};
