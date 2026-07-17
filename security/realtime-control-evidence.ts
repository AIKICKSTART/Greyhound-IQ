const REALTIME_CONTROL_EVIDENCE = [
  "src/app/api/realtime/token/route.ts",
  "src/components/realtime-refresh.tsx",
  "src/lib/api-errors.ts",
  "src/lib/conversation-service.ts",
  "src/lib/conversation-validation.ts",
  "src/lib/moderation-service.ts",
  "src/lib/report-service.ts",
  "src/lib/realtime-service.ts",
  "src/lib/realtime-service.test.ts",
  "src/lib/realtime-authorization.test.ts",
  "scripts/sql/supabase-private-realtime-policies.sql",
  "security/realtime-control-evidence.test.ts",
] as const;

export const VERIFIED_REALTIME_CONTROL_IDS = [
  "security.realtime-control.connection-authentication",
  "security.realtime-control.session-expiry-during-a-connection",
  "security.realtime-control.re-authentication-or-disconnection",
  "security.realtime-control.conversation-membership",
  "security.realtime-control.room-or-channel-authorization",
  "security.realtime-control.block-relationships",
  "security.realtime-control.attachment-limits",
  "security.realtime-control.delivery-receipts",
  "security.realtime-control.read-receipts",
  "security.realtime-control.presence-visibility",
  "security.realtime-control.typing-indicator-visibility",
  "security.realtime-control.error-redaction",
  "security.realtime-control.offline-delivery",
  "security.realtime-control.server-side-moderation-controls",
  "security.realtime-control.channel-membership",
] as const;

export const REALTIME_CONTROL_MASTER_EVIDENCE = Object.fromEntries(
  VERIFIED_REALTIME_CONTROL_IDS.map((requirementId) => [
    requirementId,
    { status: "verified" as const, evidence: REALTIME_CONTROL_EVIDENCE },
  ]),
);
