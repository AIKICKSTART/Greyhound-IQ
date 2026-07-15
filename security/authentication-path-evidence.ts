import { AUTHENTICATION_PATH_REVIEW_RECORDS } from "./authentication-path-review";

const AUTHENTICATION_PATH_REVIEW_EVIDENCE = [
  "security/authentication-path-review.ts",
  "security/authentication-path-review.test.ts",
] as const;

export const AUTHENTICATION_PATH_MASTER_EVIDENCE = Object.fromEntries(
  AUTHENTICATION_PATH_REVIEW_RECORDS.map((record) => [
    record.requirementId,
    {
      status: "verified" as const,
      evidence: [...AUTHENTICATION_PATH_REVIEW_EVIDENCE, ...record.evidence],
    },
  ]),
);
