export const APPLICATION_LOG_PROHIBITION_REQUIREMENT_IDS = [
  "security.application-log-prohibition.passwords",
  "security.application-log-prohibition.session-tokens",
  "security.application-log-prohibition.access-tokens",
  "security.application-log-prohibition.refresh-tokens",
  "security.application-log-prohibition.recovery-tokens",
  "security.application-log-prohibition.webhook-signatures",
  "security.application-log-prohibition.api-secrets",
  "security.application-log-prohibition.full-payment-card-data",
  "security.application-log-prohibition.database-connection-strings",
  "security.application-log-prohibition.full-authentication-headers",
  "security.application-log-prohibition.private-message-bodies-unless-explicitly-justified",
  "security.application-log-prohibition.sensitive-uploaded-file-contents",
  "security.application-log-prohibition.unredacted-provider-payloads",
  "security.third-party-prohibition.logs",
] as const;

const APPLICATION_LOG_PROHIBITION_EVIDENCE = [
  "src/lib/logger.ts",
  "src/lib/logger.test.ts",
  "security/application-log-prohibition-evidence.test.ts",
] as const;

export const APPLICATION_LOG_PROHIBITION_MASTER_EVIDENCE = Object.fromEntries(
  APPLICATION_LOG_PROHIBITION_REQUIREMENT_IDS.map((requirementId) => [
    requirementId,
    {
      status: "verified" as const,
      evidence: APPLICATION_LOG_PROHIBITION_EVIDENCE,
    },
  ]),
);
