const COOKIE_CONTROL_EVIDENCE = [
  ".env.example",
  "src/lib/workos-env.ts",
  "src/lib/workos-env.test.ts",
  "src/app/actions.ts",
  "src/components/cookie-consent.tsx",
  "src/components/interactive-help.tsx",
  "src/components/onboarding-analytics-client.ts",
  "src/app/admin/error.tsx",
  "security/cookie-control-evidence.test.ts",
] as const;

const VERIFIED_COOKIE_CONTROL_IDS = [
  "security.cookie-control.secure",
  "security.cookie-control.http-only",
  "security.cookie-control.same-site",
  "security.cookie-control.domain",
  "security.cookie-control.path",
  "security.cookie-control.no-url-session",
  "security.cookie-control.no-analytics-session",
  "security.cookie-control.no-client-log-session",
  "security.cookie-control.no-error-report-session",
  "security.cookie-control.no-local-storage",
] as const;

export const COOKIE_CONTROL_MASTER_EVIDENCE = Object.fromEntries(
  VERIFIED_COOKIE_CONTROL_IDS.map((requirementId) => [
    requirementId,
    { status: "verified" as const, evidence: COOKIE_CONTROL_EVIDENCE },
  ]),
);
