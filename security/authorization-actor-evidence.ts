import { AUTHORIZATION_ACTOR_RECORDS } from "./authorization-actor-matrix";

const AUTHORIZATION_ACTOR_EVIDENCE = [
  "security/authorization-actor-matrix.ts",
  "security/authorization-actor-matrix.test.ts",
] as const;

const AUTHORIZATION_ACTOR_RECORD_EVIDENCE = Object.fromEntries(
  AUTHORIZATION_ACTOR_RECORDS.map((record) => [
    record.requirementId,
    {
      status: "verified" as const,
      evidence: [...AUTHORIZATION_ACTOR_EVIDENCE, ...record.evidence],
    },
  ]),
);

export const SERVER_AUTHORITY_REQUIREMENT_IDS = [
  "security.server-authority.identity",
  "security.server-authority.session",
  "security.server-authority.role",
  "security.server-authority.plan",
  "security.server-authority.moderation",
  "security.server-authority.administration",
  "security.server-authority.browser-untrusted",
  "security.deny-by-default.authentication",
  "security.deny-by-default.role",
] as const;

const SERVER_AUTHORITY_EVIDENCE = [
  "src/lib/auth.ts",
  "src/lib/auth.test.ts",
  "src/lib/auth-roles.ts",
  "src/lib/auth-sync.ts",
  "security/server-authority-evidence.test.ts",
] as const;

export const AUTHORIZATION_ACTOR_MASTER_EVIDENCE = {
  ...AUTHORIZATION_ACTOR_RECORD_EVIDENCE,
  ...Object.fromEntries(
    SERVER_AUTHORITY_REQUIREMENT_IDS.map((requirementId) => [
      requirementId,
      { status: "verified" as const, evidence: SERVER_AUTHORITY_EVIDENCE },
    ]),
  ),
};
