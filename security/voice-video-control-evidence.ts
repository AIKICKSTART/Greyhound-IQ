export const VERIFIED_VOICE_VIDEO_CONTROL_IDS = [
  "security.voice-video-control.short-lived",
  "security.voice-video-control.scope",
  "security.voice-video-control.no-master-secret",
  "security.voice-video-control.membership",
  "security.voice-video-control.blocks",
  "security.voice-video-control.invitation-limit",
  "security.voice-video-control.lifecycle-audit",
  "security.voice-video-control.removal",
  "security.voice-video-control.expiry",
  "security.voice-video-control.enumeration",
] as const;

export const OPEN_VOICE_VIDEO_CONTROL_GAPS = {
  "security.voice-video-control.reuse":
    "LiveKit credentials are room-and-participant scoped and expire after ten minutes, but GreyhoundIQ does not yet maintain a one-time token identifier or deny replay of the same credential before expiry.",
} as const;

const VOICE_VIDEO_CONTROL_EVIDENCE = [
  "security/voice-video-control-evidence.ts",
  "security/voice-video-control-evidence.test.ts",
  "scripts/check-call-token-permissions.ts",
  "scripts/check-comms-security.ts",
  "src/lib/call-token.ts",
  "src/lib/call-service.ts",
  "src/lib/call-validation.ts",
  "src/lib/livekit-admin.ts",
  "src/app/api/calls/rooms/route.ts",
  "src/app/api/calls/[roomId]/token/route.ts",
  "src/app/api/calls/[roomId]/invite/route.ts",
  "src/app/api/calls/[roomId]/end/route.ts",
  "src/app/api/livekit/webhook/route.ts",
  "prisma/schema.prisma",
  "prisma/migrations/20260710146000_scope_call_children_to_conversation/migration.sql",
  "prisma/migrations/20260710147000_split_call_invite_permissions/migration.sql",
  "prisma/migrations/20260710148000_constrain_call_invite_responses/migration.sql",
  "package.json",
  ".github/workflows/ci.yml",
] as const;

export const VOICE_VIDEO_CONTROL_MASTER_EVIDENCE = Object.fromEntries(
  VERIFIED_VOICE_VIDEO_CONTROL_IDS.map((requirementId) => [
    requirementId,
    { status: "verified" as const, evidence: VOICE_VIDEO_CONTROL_EVIDENCE },
  ]),
);
