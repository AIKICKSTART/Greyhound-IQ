import { INFRASTRUCTURE_REVIEW_RECORDS } from "./infrastructure-review-coverage";

const REVIEW_EVIDENCE = [
  "security/infrastructure-review-coverage.ts",
  "security/infrastructure-review-coverage.test.ts",
] as const;

export const INFRASTRUCTURE_REVIEW_MASTER_EVIDENCE = Object.fromEntries(
  INFRASTRUCTURE_REVIEW_RECORDS.map((record) => [
    record.requirementId,
    {
      status: "verified" as const,
      evidence: [...REVIEW_EVIDENCE, ...record.evidence],
    },
  ]),
);
