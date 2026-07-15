import { AUTHORIZATION_ACTOR_RECORDS } from "./authorization-actor-matrix";

const AUTHORIZATION_ACTOR_EVIDENCE = [
  "security/authorization-actor-matrix.ts",
  "security/authorization-actor-matrix.test.ts",
] as const;

export const AUTHORIZATION_ACTOR_MASTER_EVIDENCE = Object.fromEntries(
  AUTHORIZATION_ACTOR_RECORDS.map((record) => [
    record.requirementId,
    {
      status: "verified" as const,
      evidence: [...AUTHORIZATION_ACTOR_EVIDENCE, ...record.evidence],
    },
  ]),
);
