import {
  NO_CUSTOM_CRYPTOGRAPHY_EVIDENCE,
  NO_CUSTOM_CRYPTOGRAPHY_REQUIREMENT_ID,
} from "./no-custom-cryptography-evidence";

export const VERIFIED_SECRET_CONTROL_IDS = [
  "security.secret-control.no-client",
  "security.secret-control.no-source",
  "security.secret-control.no-example-real",
  "security.secret-control.no-logs",
  "security.secret-control.no-errors",
  "security.secret-control.no-analytics",
  "security.secret-control.short-lived-cloud",
  "security.secret-control.established-crypto",
  "security.secret-control.no-custom-crypto",
] as const;

const SECRET_CONTROL_EVIDENCE = [
  ".env.example",
  ".github/workflows/ci.yml",
  ".github/workflows/cloud-run-deploy.yml",
  "scripts/check-secret-boundaries.ts",
  "scripts/check-secret-boundaries.test.ts",
  "scripts/structured-logging-policy.ts",
  "scripts/structured-logging-policy.test.ts",
  "src/lib/logger.ts",
  "src/lib/logger.test.ts",
  "src/components/onboarding-analytics.ts",
  "src/components/onboarding-analytics.test.ts",
  "security/cryptography-record.ts",
  "security/secret-control-evidence.test.ts",
  "docs/security/secret-controls.md",
] as const;

export const SECRET_CONTROL_MASTER_EVIDENCE = Object.fromEntries(
  VERIFIED_SECRET_CONTROL_IDS.map((requirementId) => [
    requirementId,
    {
      status: "verified" as const,
      evidence:
        requirementId === NO_CUSTOM_CRYPTOGRAPHY_REQUIREMENT_ID
          ? NO_CUSTOM_CRYPTOGRAPHY_EVIDENCE
          : SECRET_CONTROL_EVIDENCE,
    },
  ]),
);
