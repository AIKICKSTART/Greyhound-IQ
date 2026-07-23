import type { SecurityMasterEvidenceRecord } from "./master-audit-evidence";

export const SECURITY_REQUIRED_OUTPUT_PATHS = {
  "security.output.01.security-architecture": [
    "docs/security/security-architecture.md",
  ],
  "security.output.02.trust-boundaries": [
    "docs/security/trust-boundaries.md",
  ],
  "security.output.03.data-flow-diagrams": [
    "docs/security/data-flow-diagrams.md",
  ],
  "security.output.04.api-inventory": [
    "docs/security/api-inventory.md",
    "docs/security/api-inventory.json",
  ],
  "security.output.05.security-trace-registry": [
    "docs/security/security-trace-registry.md",
  ],
  "security.output.06.frontend-server-database-map": [
    "docs/security/frontend-server-database-map.md",
  ],
  "security.output.07.database-inventory": [
    "docs/security/database-inventory.md",
  ],
  "security.output.08.database-query-map": [
    "docs/security/database-query-map.md",
  ],
  "security.output.09.database-role-matrix": [
    "docs/security/database-role-matrix.md",
  ],
  "security.output.10.data-classification": [
    "docs/security/data-classification.md",
  ],
  "security.output.11.authorization-matrix": [
    "docs/security/authorization-matrix.md",
  ],
  "security.output.12.authentication-review": [
    "docs/security/authentication-review.md",
  ],
  "security.output.13.session-review": ["docs/security/session-review.md"],
  "security.output.14.threat-model": ["docs/security/threat-model.md"],
  "security.output.15.abuse-case-map": ["docs/security/abuse-case-map.md"],
  "security.output.16.file-upload-review": [
    "docs/security/file-upload-review.md",
  ],
  "security.output.17.webhook-review": ["docs/security/webhook-review.md"],
  "security.output.18.third-party-register": [
    "docs/security/third-party-register.md",
  ],
  "security.output.19.secrets-register": [
    "docs/security/secrets-register.md",
  ],
  "security.output.20.logging-and-alerting": [
    "docs/security/logging-and-alerting.md",
  ],
  "security.output.21.privacy-data-lifecycle": [
    "docs/security/privacy-data-lifecycle.md",
  ],
  "security.output.22.incident-response": [
    "docs/security/incident-response.md",
  ],
  "security.output.23.backup-and-recovery": [
    "docs/security/backup-and-recovery.md",
  ],
  "security.output.24.supply-chain-review": [
    "docs/security/supply-chain-review.md",
  ],
  "security.output.25.security-test-matrix": [
    "docs/security/security-test-matrix.md",
  ],
  "security.output.26.risk-register": ["docs/security/risk-register.md"],
  "security.output.27.release-security-report": [
    "docs/security/release-security-report.md",
  ],
  "security.output.28.registry-traces": ["security/traces.ts"],
  "security.output.29.registry-endpoints": ["security/endpoints.ts"],
  "security.output.30.registry-policies": ["security/policies.ts"],
  "security.output.31.registry-audit-events": ["security/audit-events.ts"],
  "security.output.32.registry-data-classification": [
    "security/data-classification.ts",
  ],
  "security.output.33.registry-database-operations": [
    "security/database-operations.ts",
  ],
  "security.output.34.registry-rate-limits": ["security/rate-limits.ts"],
  "security.output.35.registry-third-parties": ["security/third-parties.ts"],
} as const;

/**
 * `verified` here closes only the immutable "Produce <path>" requirement.
 * It does not verify the controls, deployments or runtime behaviour described
 * by an output; those remain separate atomic security requirements.
 */
export const SECURITY_REQUIRED_OUTPUT_EVIDENCE: Readonly<
  Record<string, SecurityMasterEvidenceRecord>
> = Object.fromEntries(
  Object.entries(SECURITY_REQUIRED_OUTPUT_PATHS).map(([id, paths]) => [
    id,
    {
      status: "verified",
      verificationScope: "output-existence-only",
      evidence: [
        ...paths,
        "src/components/security-required-outputs.test.ts",
        ...(paths.some((path) => path.startsWith("security/"))
          ? ["security/registry.test.ts"]
          : []),
      ],
    },
  ]),
);
