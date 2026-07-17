import { DELETION_LIFECYCLE_RECORDS } from "./deletion-lifecycle-coverage";

const DELETION_LIFECYCLE_EVIDENCE = [
  "security/deletion-lifecycle-coverage.ts",
  "security/deletion-lifecycle-coverage.test.ts",
] as const;

export const DELETION_LIFECYCLE_MASTER_EVIDENCE = Object.fromEntries(
  [
    ...DELETION_LIFECYCLE_RECORDS.map((record) => [
      record.requirementId,
      {
        status: "verified" as const,
        evidence: [...DELETION_LIFECYCLE_EVIDENCE, ...record.evidence],
      },
    ] as const),
    [
      "security.deletion-lifecycle.truthful-interface",
      {
        status: "verified" as const,
        evidence: [
          "src/app/account/page.tsx",
          "src/app/api/users/me/delete/route.ts",
          "security/deletion-lifecycle-coverage.test.ts",
        ],
      },
    ] as const,
  ],
);
