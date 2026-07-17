export type SecurityStandardBaselineRecord = {
  requirementId: `security.standards-baseline.${string}`;
  status: "verified" | "open";
  decision: string;
  officialSource: string;
  localControls: readonly string[];
  knownGap?: string;
};

export const SECURITY_STANDARDS_EVIDENCE_PATHS = [
  "security/standards-baseline-evidence.ts",
  "security/standards-baseline-evidence.test.ts",
  "docs/security/standards-baseline.md",
] as const;

/**
 * Adoption evidence, not a claim that every control in each standard passes.
 * Individual controls remain governed by their own implementation and test gates.
 */
export const SECURITY_STANDARDS_BASELINES: readonly SecurityStandardBaselineRecord[] = [
  {
    requirementId: "security.standards-baseline.asvs-5",
    status: "verified",
    decision: "Use OWASP ASVS 5.0.0 identifiers as the application-control verification baseline.",
    officialSource:
      "https://owasp.org/www-project-application-security-verification-standard/",
    localControls: ["docs/security/security-architecture.md", "docs/security/security-test-matrix.md"],
  },
  {
    requirementId: "security.standards-baseline.owasp-top-10-2025",
    status: "verified",
    decision: "Use the released OWASP Top 10:2025 as the web-risk awareness baseline.",
    officialSource: "https://owasp.org/Top10/",
    localControls: ["docs/security/security-architecture.md", "docs/security/risk-register.md"],
  },
  {
    requirementId: "security.standards-baseline.owasp-api-top-10-2023",
    status: "verified",
    decision: "Use OWASP API Security Top 10:2023 for API threat and contract review.",
    officialSource:
      "https://owasp.org/API-Security/editions/2023/en/0x11-t10/",
    localControls: [".spectral.yaml", "docs/security/openapi-static-audit.md", "openapi.json"],
  },
  {
    requirementId: "security.standards-baseline.nist-ssdf-1-1",
    status: "verified",
    decision: "Use final NIST SP 800-218 SSDF 1.1 as the secure-development baseline.",
    officialSource: "https://csrc.nist.gov/pubs/sp/800/218/final",
    localControls: ["docs/security/supply-chain-review.md", "scripts/check-supply-chain-policy.ts", ".github/workflows/ci.yml"],
  },
  {
    requirementId: "security.standards-baseline.nist-ssdf-1-2-draft",
    status: "verified",
    decision: "Track NIST SP 800-218 Rev. 1 SSDF 1.2 as a draft, not a final baseline, as reviewed on 2026-07-14.",
    officialSource: "https://csrc.nist.gov/Projects/ssdf/publications",
    localControls: ["docs/security/standards-baseline.md"],
  },
  {
    requirementId: "security.standards-baseline.australian-privacy-principles",
    status: "verified",
    decision: "Map applicable Australian Privacy Principles through the privacy lifecycle and data classification registers.",
    officialSource:
      "https://www.oaic.gov.au/privacy/australian-privacy-principles",
    localControls: ["docs/security/privacy-data-lifecycle.md", "docs/security/data-classification.md"],
  },
  {
    requirementId: "security.standards-baseline.app-11",
    status: "verified",
    decision: "Map APP 11 protection, retention, destruction, and de-identification duties.",
    officialSource:
      "https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-11-app-11-security-of-personal-information",
    localControls: ["docs/security/privacy-data-lifecycle.md", "docs/security/backup-and-recovery.md"],
  },
  {
    requirementId: "security.standards-baseline.ndb",
    status: "verified",
    decision: "Map the Notifiable Data Breaches assessment, notification, and incident-response duties.",
    officialSource:
      "https://www.oaic.gov.au/privacy/notifiable-data-breaches",
    localControls: ["docs/security/incident-response.md", "docs/security/privacy-data-lifecycle.md"],
  },
  {
    requirementId: "security.standards-baseline.pci-scope",
    status: "open",
    decision: "Apply PCI DSS 4.0.1 only to systems that store, process, transmit, or can impact payment account data.",
    officialSource: "https://www.pcisecuritystandards.org/standards/pci-dss/",
    localControls: ["docs/security/security-architecture.md", "src/lib/billing/stripe-service.ts"],
    knownGap: "A qualified owner has not approved GreyhoundIQ's exact merchant and SAQ scope.",
  },
  {
    requirementId: "security.standards-baseline.provider-held-card-data",
    status: "verified",
    decision: "Keep card entry and cardholder data with Stripe-hosted Checkout and Billing Portal surfaces.",
    officialSource:
      "https://www.pcisecuritystandards.org/standards/pci-dss/",
    localControls: ["src/lib/billing/stripe-service.ts", "src/lib/billing/stripe-readiness.test.ts", "prisma/schema.prisma"],
  },
  {
    requirementId: "security.standards-baseline.defensible-target",
    status: "verified",
    decision: "Target traceable controls, repeatable tests, explicit gaps, and owned residual risk without claiming perfect security.",
    officialSource:
      "https://owasp.org/www-project-application-security-verification-standard/",
    localControls: ["docs/security/release-security-report.md", "docs/security/risk-register.md"],
  },
] as const;

export const SECURITY_STANDARDS_MASTER_EVIDENCE = Object.fromEntries(
  SECURITY_STANDARDS_BASELINES.filter((baseline) => baseline.status === "verified").map(
    (baseline) => [
      baseline.requirementId,
      { status: "verified", evidence: SECURITY_STANDARDS_EVIDENCE_PATHS },
    ],
  ),
) as Readonly<Record<string, {
  status: "verified";
  evidence: typeof SECURITY_STANDARDS_EVIDENCE_PATHS;
}>>;
