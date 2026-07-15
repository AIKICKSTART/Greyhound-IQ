const PRIVACY_MINIMISATION_EVIDENCE = [
  "prisma/schema.prisma",
  "security/database-column-records.ts",
  "security/personal-information-records.ts",
  "security/personal-information-records.test.ts",
  "security/privacy-minimisation.ts",
  "security/privacy-minimisation-evidence.ts",
  "security/privacy-minimisation-evidence.test.ts",
  "security/third-parties.ts",
  "docs/security/privacy-minimisation-assessment.md",
  "src/lib/logger.ts",
  "src/lib/logger.test.ts",
] as const;

export const PRIVACY_MINIMISATION_REQUIREMENT_IDS = [
  "security.privacy-minimisation.minimise",
  "security.privacy-minimisation.no-future-use",
] as const;

export const PRIVACY_MINIMISATION_MASTER_EVIDENCE = Object.fromEntries(
  PRIVACY_MINIMISATION_REQUIREMENT_IDS.map((requirementId) => [
    requirementId,
    { status: "verified" as const, evidence: PRIVACY_MINIMISATION_EVIDENCE },
  ]),
);
