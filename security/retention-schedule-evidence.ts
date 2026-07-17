import { RETENTION_SCHEDULES } from "./retention-schedule";

const RETENTION_EVIDENCE = [
  "security/retention-schedule.ts",
  "security/retention-schedule-evidence.ts",
  "security/retention-schedule-evidence.test.ts",
  "docs/security/retention-schedule.md",
] as const;

export const RETENTION_SCHEDULE_MASTER_EVIDENCE = Object.fromEntries(
  RETENTION_SCHEDULES.map((record) => [
    record.requirementId,
    { status: "verified" as const, evidence: RETENTION_EVIDENCE },
  ]),
);
