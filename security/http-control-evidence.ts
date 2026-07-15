const HTTP_CONTROL_EVIDENCE = [
  "src/app/api/realtime/token/route.ts",
  "src/components/realtime-refresh.tsx",
  "src/lib/request-security.ts",
  "src/lib/request-security.test.ts",
  "src/lib/workos-redirect.ts",
  "scripts/http-method-boundary.cjs",
  "scripts/http-method-boundary.test.ts",
  "Dockerfile",
  "package.json",
  "src/proxy.ts",
  "src/app/api/media/[id]/blob/route.ts",
  "src/app/api/replay/stream/handler.ts",
  "src/app/api/replay/stream/route.ts",
  "src/app/api/users/me/export/route.ts",
  "security/http-control-evidence.test.ts",
] as const;

const VERIFIED_HTTP_CONTROL_IDS = [
  "security.http-control.no-get-mutation",
  "security.http-control.unsupported-method",
  "security.http-control.content-types",
  "security.http-control.reject-unexpected-body-type",
  "security.http-control.cache-sensitivity",
  "security.http-control.no-public-private-cache",
  "security.http-control.no-store",
  "security.http-control.safe-download",
  "security.http-control.redirect-validation",
] as const;

export const HTTP_CONTROL_MASTER_EVIDENCE = Object.fromEntries(
  VERIFIED_HTTP_CONTROL_IDS.map((requirementId) => [
    requirementId,
    { status: "verified" as const, evidence: HTTP_CONTROL_EVIDENCE },
  ]),
);
