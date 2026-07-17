const CORS_CONTROL_EVIDENCE = [
  "src/lib/request-security.ts",
  "src/lib/request-security.test.ts",
  "src/lib/auth-redirect-contract.ts",
  "src/lib/rate-limit-response.ts",
  "src/lib/workos-redirect.ts",
  "src/lib/workos-redirect.test.ts",
  "src/lib/csp.ts",
  "src/app/api/realtime/token/route.ts",
  "src/lib/realtime-service.ts",
  "src/app/api/calls/[roomId]/token/route.ts",
  "src/lib/call-service.ts",
  "src/lib/call-token.ts",
  "src/proxy.ts",
  "docs/security/websocket-origin-boundary.md",
  "security/cors-control-evidence.test.ts",
] as const;

const VERIFIED_CORS_CONTROL_IDS = [
  "security.cors-control.explicit-origin",
  "security.cors-control.no-wildcard-credentials",
  "security.cors-control.methods",
  "security.cors-control.headers",
  "security.cors-control.preflight",
  "security.cors-control.no-dev-origin",
  "security.cors-control.not-security-boundary",
  "security.cors-control.websocket-origin",
] as const;

export const CORS_CONTROL_MASTER_EVIDENCE = Object.fromEntries(
  VERIFIED_CORS_CONTROL_IDS.map((requirementId) => [
    requirementId,
    { status: "verified" as const, evidence: CORS_CONTROL_EVIDENCE },
  ]),
);
