export const VERIFIED_SQL_INJECTION_CONTROL_IDS = [
  "security.injection-prevention.prevent-sql",
  "security.injection-prevention.parameterized",
  "security.injection-prevention.identifier-allowlist",
  "security.injection-prevention.bound-parameter-limit",
  "security.query-safety.parameterized-values",
] as const;

const SQL_INJECTION_CONTROL_EVIDENCE = [
  ".github/workflows/ci.yml",
  "package.json",
  "scripts/check-production-sql-safety.ts",
  "scripts/check-production-sql-safety.test.ts",
  "security/ci-gate-evidence.ts",
  "security/ci-gate-evidence.test.ts",
  "security/sql-injection-control-evidence.test.ts",
] as const;

export const SQL_INJECTION_CONTROL_MASTER_EVIDENCE = Object.fromEntries(
  VERIFIED_SQL_INJECTION_CONTROL_IDS.map((requirementId) => [
    requirementId,
    {
      status: "verified" as const,
      evidence: SQL_INJECTION_CONTROL_EVIDENCE,
    },
  ]),
);
