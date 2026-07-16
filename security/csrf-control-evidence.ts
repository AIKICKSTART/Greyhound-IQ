const CSRF_CONTROL_EVIDENCE = [
  "src/lib/request-security.ts",
  "src/lib/request-security.test.ts",
  "src/proxy.ts",
  "security/http-control-evidence.test.ts",
  "security/application-surface-inventory.ts",
  "security/application-surface-inventory.test.ts",
  "security/csrf-control-evidence.test.ts",
] as const;

const VERIFIED_CSRF_CONTROL_IDS = [
  "security.csrf-control.state-changing-cookie-action",
  "security.csrf-control.framework-defense",
  "security.csrf-control.origin-validation",
  "security.csrf-control.reject-cross-site",
  "security.csrf-control.not-samesite-only",
  "security.csrf-control.no-get-mutation",
  "security.csrf-control.missing-test",
  "security.csrf-control.invalid-test",
  "security.csrf-control.server-actions",
  "security.csrf-control.uploads",
] as const;

const NOT_APPLICABLE_CSRF_CONTROLS = {
  "security.csrf-control.reused-test":
    "GreyhoundIQ uses stateless Origin and Fetch Metadata validation rather than a reusable synchronizer token; every cookie-authenticated mutation is evaluated independently.",
  "security.csrf-control.rpc":
    "The exhaustive application inventory has no browser-callable RPC procedure. The two discovered Supabase RPC calls are outbound server-side Realtime grant operations.",
} as const;

export const CSRF_CONTROL_MASTER_EVIDENCE = {
  ...Object.fromEntries(
    VERIFIED_CSRF_CONTROL_IDS.map((requirementId) => [
      requirementId,
      { status: "verified" as const, evidence: CSRF_CONTROL_EVIDENCE },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(NOT_APPLICABLE_CSRF_CONTROLS).map(
      ([requirementId, notApplicableJustification]) => [
        requirementId,
        {
          status: "not-applicable-with-justification" as const,
          evidence: CSRF_CONTROL_EVIDENCE,
          notApplicableJustification,
        },
      ],
    ),
  ),
} as const;
