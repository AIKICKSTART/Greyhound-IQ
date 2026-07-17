export const APPLICATION_LOG_ENVELOPE_REQUIREMENT_IDS = [
  "security.application-log-field.environment",
  "security.application-log-field.request-or-correlation-id",
  "security.application-log-field.trace-id",
  "security.application-log-field.action",
  "security.application-log-field.timestamp",
  "security.application-log-field.actor-id-where-appropriate",
  "security.application-log-field.tenant-id-where-appropriate",
  "security.application-log-field.target-type",
  "security.application-log-field.safe-target-id",
  "security.application-log-field.outcome",
  "security.application-log-field.error-classification",
  "security.application-log-field.duration",
  "security.application-log-field.security-relevant-metadata",
] as const;

const APPLICATION_LOG_ENVELOPE_EVIDENCE = [
  "src/lib/logger.ts",
  "src/lib/logger.test.ts",
  "security/application-log-envelope-evidence.test.ts",
] as const;

export const APPLICATION_LOG_ENVELOPE_MASTER_EVIDENCE = Object.fromEntries(
  APPLICATION_LOG_ENVELOPE_REQUIREMENT_IDS.map((requirementId) => [
    requirementId,
    {
      status: "verified" as const,
      evidence: APPLICATION_LOG_ENVELOPE_EVIDENCE,
    },
  ]),
);
