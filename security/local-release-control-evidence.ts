export const LOCAL_RELEASE_CONTROL_REQUIREMENT_IDS = [
  "security.release.09.queries-parameterized",
  "security.release.21.secrets-outside-source-client",
] as const;

const LOCAL_RELEASE_CONTROL_EVIDENCE_FILE =
  "security/local-release-control-evidence.ts";
const LOCAL_RELEASE_CONTROL_TEST_FILE =
  "security/local-release-control-evidence.test.ts";

export const LOCAL_RELEASE_CONTROL_MASTER_EVIDENCE = {
  "security.release.09.queries-parameterized": verified(
    "scripts/check-production-sql-safety.ts",
    "scripts/check-production-sql-safety.test.ts",
    "security/orm-injection-control-evidence.ts",
    "security/orm-injection-control-evidence.test.ts",
  ),
  "security.release.21.secrets-outside-source-client": verified(
    "scripts/check-secret-boundaries.ts",
    "scripts/check-secret-boundaries.test.ts",
    "security/secret-control-evidence.ts",
    "security/secret-control-evidence.test.ts",
  ),
} as const;

function verified(...evidence: readonly string[]) {
  return {
    status: "verified" as const,
    evidence: [
      LOCAL_RELEASE_CONTROL_EVIDENCE_FILE,
      LOCAL_RELEASE_CONTROL_TEST_FILE,
      ...evidence,
    ],
  };
}
