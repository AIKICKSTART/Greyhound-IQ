export const SECURITY_ALERT_EVENT_REQUIREMENT_IDS = [
  "security.alert-event.authentication-attack-patterns",
  "security.alert-event.repeated-access-denials",
  "security.alert-event.cross-tenant-access-attempts",
  "security.alert-event.administrator-privilege-changes",
  "security.alert-event.last-owner-change-attempts",
  "security.alert-event.unusual-export-volume",
  "security.alert-event.unusual-message-volume",
  "security.alert-event.unusual-listing-volume",
  "security.alert-event.unusual-ai-cost",
  "security.alert-event.repeated-webhook-signature-failures",
  "security.alert-event.queue-dead-letter-growth",
  "security.alert-event.malware-detections",
  "security.alert-event.database-authentication-failures",
  "security.alert-event.public-access-to-private-storage",
  "security.alert-event.secrets-detected-in-logs-or-builds",
  "security.alert-event.unusual-administration-access",
  "security.alert-event.backup-failure",
  "security.alert-event.restore-test-failure",
  "security.alert-event.audit-log-pipeline-failure",
] as const;

export const SECURITY_ALERT_EVENT_EVIDENCE_SCOPE = {
  sourceDefinitionsVerified: true,
  deploymentVerified: false,
  metricBindingsVerified: false,
  notificationDeliveryVerified: false,
  drillsVerified: false,
} as const;

const SECURITY_ALERT_EVENT_EVIDENCE = [
  "config/security-alert-policy.json",
  "scripts/check-security-alert-policy.ts",
  "scripts/check-security-alert-policy.test.ts",
  "security/security-alert-event-evidence.ts",
  "security/security-alert-event-evidence.test.ts",
] as const;

/**
 * Machine-validated source definitions only. Live deployment, metric bindings,
 * notification delivery and response drills remain explicitly unverified.
 */
export const SECURITY_ALERT_EVENT_MASTER_EVIDENCE = Object.fromEntries(
  SECURITY_ALERT_EVENT_REQUIREMENT_IDS.map((requirementId) => [
    requirementId,
    {
      status: "verified" as const,
      evidence: SECURITY_ALERT_EVENT_EVIDENCE,
    },
  ]),
);
