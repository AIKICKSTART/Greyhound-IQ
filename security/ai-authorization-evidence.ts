const AI_AUTHORIZATION_EVIDENCE = [
  "security/ai-authorization-evidence.ts",
  "security/ai-authorization-evidence.test.ts",
  "src/app/api/agents/[type]/run/route.ts",
  "src/app/actions.ts",
  "src/lib/agent-service.ts",
  "src/lib/dog-card-service.ts",
] as const;

export const AI_AUTHORIZATION_EVIDENCE_SCOPE =
  "Source-bound current AI surface only. Agent toolInvocations are descriptive records of fixed server data reads, not model-selected executable tools. Any future model-driven tool dispatcher must reopen these gates for per-tool authorization review.";

export const AI_AUTHORIZATION_MASTER_EVIDENCE = {
  "security.threat-ai.ordinary-authz": {
    status: "verified" as const,
    evidence: AI_AUTHORIZATION_EVIDENCE,
  },
  "security.threat-ai.tool-authz": {
    status: "verified" as const,
    evidence: AI_AUTHORIZATION_EVIDENCE,
  },
};
