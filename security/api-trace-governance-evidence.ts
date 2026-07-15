import {
  MANDATORY_PUBLIC_RACING_TRACE_BINDINGS,
  MANDATORY_PUBLIC_RACING_TRACE_MASTER_EVIDENCE,
} from "./mandatory-public-racing-trace-evidence";

const API_EVIDENCE = [
  "security/api-trace-governance-evidence.ts",
  "security/api-trace-governance-evidence.test.ts",
  "security/endpoints.ts",
  "security/registry.test.ts",
  "security/api-surface-inventory.ts",
  "security/api-surface-inventory.test.ts",
] as const;

const ADMIN_EVIDENCE = [
  "security/api-trace-governance-evidence.ts",
  "security/api-trace-governance-evidence.test.ts",
  "src/app/admin/admin-authorization-inventory.ts",
  "src/app/admin/admin-authorization-inventory.test.ts",
] as const;

const TRACE_EVIDENCE = [
  "security/api-trace-governance-evidence.ts",
  "security/api-trace-governance-evidence.test.ts",
  "security/traces.ts",
  "security/registry.test.ts",
] as const;

const REGISTRY_GOVERNANCE_EVIDENCE = [
  "security/api-trace-governance-evidence.ts",
  "security/api-trace-governance-evidence.test.ts",
  "security/traces.ts",
  "security/endpoints.ts",
  "security/policies.ts",
  "security/audit-events.ts",
  "security/data-classification.ts",
  "security/database-operations.ts",
  "security/rate-limits.ts",
  "security/third-parties.ts",
  "security/final-traceability.ts",
  "security/final-traceability.test.ts",
  "scripts/generate-security-trace-registry.ts",
  "docs/security/security-trace-registry.md",
  "package.json",
] as const;

export const MANDATORY_TRACE_BINDINGS = {
  ...MANDATORY_PUBLIC_RACING_TRACE_BINDINGS,
  "security.trace.04.auth-callback-session": "AUTH.CALLBACK.COMPLETE",
  "security.trace.40.payment-webhook": "BILLING.WEBHOOK.PROCESS",
  "security.trace.43.data-export-request": "ACCOUNT.DATA_EXPORT.DOWNLOAD",
  "security.trace.44.account-deletion-request": "ACCOUNT.DELETION.EXECUTE",
  "security.trace.51.background-queued-event": "AUTH.CALLBACK.COMPLETE",
  "security.trace.52.design-lab-privileged-render": "DESIGN_LAB.SCREEN.REVIEW",
  "security.trace.54.private-file-download": "ACCOUNT.DATA_EXPORT.DOWNLOAD",
} as const;

/**
 * Narrow source-static and registry-link evidence. Deployed endpoint parity,
 * runtime authorization, and complete trace coverage remain separate gates.
 */
export const API_TRACE_GOVERNANCE_MASTER_EVIDENCE = {
  ...MANDATORY_PUBLIC_RACING_TRACE_MASTER_EVIDENCE,
  "security.api-inventory-management.all-apis": {
    status: "verified",
    evidence: API_EVIDENCE,
  },
  "security.api-inventory-management.debug-not-public": {
    status: "not-applicable-with-justification",
    evidence: API_EVIDENCE,
    notApplicableJustification:
      "The exhaustive source inventory contains no debug or diagnostics endpoint.",
  },
  "security.api-inventory-management.obsolete-disabled": {
    status: "not-applicable-with-justification",
    evidence: API_EVIDENCE,
    notApplicableJustification:
      "Every source-inventoried endpoint is unversioned and no /api/vN route exists.",
  },
  "security.api-inventory-management.metrics-restricted": {
    status: "not-applicable-with-justification",
    evidence: API_EVIDENCE,
    notApplicableJustification:
      "The exhaustive source inventory contains no metrics endpoint.",
  },
  "security.api-inventory-management.admin-separation": {
    status: "verified",
    evidence: ADMIN_EVIDENCE,
  },
  "security.trace-identifier.format": {
    status: "verified",
    evidence: TRACE_EVIDENCE,
  },
  "security.trace-identifier.database-map": {
    status: "verified",
    evidence: [
      ...TRACE_EVIDENCE,
      "security/database-operations.ts",
    ],
  },
  "security.trace-identifier.audit-registry": {
    status: "verified",
    evidence: [...TRACE_EVIDENCE, "security/audit-events.ts"],
  },
  "security.trace-identifier.coverage": {
    status: "verified",
    evidence: [
      "security/api-trace-governance-evidence.ts",
      "security/api-trace-governance-evidence.test.ts",
      "security/traces.ts",
      "security/final-traceability.ts",
      "security/final-traceability.test.ts",
      "docs/security/security-trace-registry.md",
    ],
  },
  "security.trace-identifier-example.auth-callback-complete": {
    status: "verified",
    evidence: TRACE_EVIDENCE,
  },
  "security.trace-identifier-example.billing-webhook": {
    status: "verified",
    evidence: TRACE_EVIDENCE,
  },
  "security.security-trace-contract.single-authority": {
    status: "verified",
    evidence: [
      ...TRACE_EVIDENCE,
      "security/final-traceability.ts",
      "security/final-traceability.test.ts",
    ],
  },
  "security.registry-governance.adapt-paths": {
    status: "verified",
    evidence: REGISTRY_GOVERNANCE_EVIDENCE,
  },
  "security.registry-governance.single-authority": {
    status: "verified",
    evidence: REGISTRY_GOVERNANCE_EVIDENCE,
  },
  "security.registry-governance.generated-docs": {
    status: "verified",
    evidence: REGISTRY_GOVERNANCE_EVIDENCE,
  },
  "security.trace.04.auth-callback-session": {
    status: "verified",
    evidence: TRACE_EVIDENCE,
  },
  "security.trace.40.payment-webhook": {
    status: "verified",
    evidence: TRACE_EVIDENCE,
  },
  "security.trace.43.data-export-request": {
    status: "verified",
    evidence: TRACE_EVIDENCE,
  },
  "security.trace.44.account-deletion-request": {
    status: "verified",
    evidence: TRACE_EVIDENCE,
  },
  "security.trace.51.background-queued-event": {
    status: "verified",
    evidence: [
      ...TRACE_EVIDENCE,
      "src/lib/signup-acceptance-worker.ts",
      "src/lib/signup-acceptance-worker-store.ts",
      "src/lib/signup-acceptance-worker.test.ts",
    ],
  },
  "security.trace.52.design-lab-privileged-render": {
    status: "verified",
    evidence: TRACE_EVIDENCE,
  },
  "security.trace.54.private-file-download": {
    status: "verified",
    evidence: [
      ...TRACE_EVIDENCE,
      "src/app/api/users/me/export/route.ts",
      "src/app/api/users/me/export/route.test.ts",
      "src/lib/user-export-policy.test.ts",
    ],
  },
} as const;
