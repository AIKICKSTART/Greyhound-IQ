import {
  AUDIT_EVENT_REQUIREMENT_BINDINGS,
  auditEventRequirementIsImplemented,
} from "./audit-event-coverage";

const AUDIT_EVENT_COVERAGE_EVIDENCE = [
  "security/audit-events.ts",
  "security/audit-event-coverage.ts",
  "security/audit-event-coverage.test.ts",
] as const;

type AuditEventCoverageEvidence = {
  status: "verified" | "not-applicable-with-justification";
  evidence: readonly string[];
  notApplicableJustification?: string;
};

export const AUDIT_EVENT_COVERAGE_MASTER_EVIDENCE: Readonly<
  Record<string, AuditEventCoverageEvidence>
> = {
  ...Object.fromEntries(
    AUDIT_EVENT_REQUIREMENT_BINDINGS.filter(
      auditEventRequirementIsImplemented,
    ).map(({ requirementId }) => [
      requirementId,
      {
        status: "verified" as const,
        evidence: AUDIT_EVENT_COVERAGE_EVIDENCE,
      },
    ]),
  ),
  "security.audit-event.support-impersonation-where-supported": {
    status: "not-applicable-with-justification" as const,
    notApplicableJustification:
      "GreyhoundIQ does not implement support impersonation. Support staff update tickets as their own authenticated administrator identity; no user-session switching path exists.",
    evidence: [
      "src/lib/admin-service.ts",
      "security/audit-event-coverage.test.ts",
    ],
  },
};
