export const ARCHITECTURE_ADAPTATION_BOUNDARIES = [
  {
    boundary: "Next.js route handler and WorkOS callback",
    traceId: "AUTH.CALLBACK.COMPLETE",
    requiredFacets: ["transport", "server", "database", "background", "external"],
  },
  {
    boundary: "Provider webhook and transactional billing reduction",
    traceId: "BILLING.WEBHOOK.PROCESS",
    requiredFacets: ["transport", "server", "database", "external"],
  },
  {
    boundary: "Next.js server action and Supabase Realtime side effect",
    traceId: "PULSE.CONVERSATION.BLOCK",
    requiredFacets: ["frontend", "transport", "server", "database", "external"],
  },
  {
    boundary: "Private media route and Supabase Storage",
    traceId: "MEDIA.ASSET.DELETE",
    requiredFacets: ["transport", "server", "database", "external"],
  },
  {
    boundary: "Database-backed account export response",
    traceId: "ACCOUNT.DATA_EXPORT.DOWNLOAD",
    requiredFacets: ["frontend", "transport", "server", "database"],
  },
] as const;

export const ARCHITECTURE_ADAPTATION_REQUIREMENT_ID =
  "security.security-trace-contract.architecture-adaptation";

export const ARCHITECTURE_ADAPTATION_MASTER_EVIDENCE = {
  [ARCHITECTURE_ADAPTATION_REQUIREMENT_ID]: {
    status: "verified" as const,
    evidence: [
      "security/traces.ts",
      "security/database-operations.ts",
      "security/architecture-adaptation-evidence.ts",
      "security/architecture-adaptation-evidence.test.ts",
    ],
  },
};
