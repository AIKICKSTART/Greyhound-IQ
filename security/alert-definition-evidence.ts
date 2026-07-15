export const ALERT_RECORD_FIELD_REQUIREMENT_IDS = [
  "security.alert-record.field.owner",
  "security.alert-record.field.severity",
  "security.alert-record.field.threshold",
  "security.alert-record.field.investigation-steps",
  "security.alert-record.field.containment-steps",
  "security.alert-record.field.escalation-path",
  "security.alert-record.field.false-positive-review",
  "security.alert-record.field.test-method",
] as const;

const ALERT_RECORD_EVIDENCE = [
  "config/slo-alert-policy.json",
  "scripts/check-slo-alert-policy.ts",
  "docs/architecture/slo-alert-policy.md",
  "security/alert-definition-records.ts",
  "security/alert-definition-records.test.ts",
] as const;

/** Structural alert-definition evidence; deployment and page delivery remain open. */
export const ALERT_RECORD_MASTER_EVIDENCE = Object.fromEntries(
  ALERT_RECORD_FIELD_REQUIREMENT_IDS.map((requirementId) => [
    requirementId,
    {
      status: "verified" as const,
      evidence: ALERT_RECORD_EVIDENCE,
    },
  ]),
);
