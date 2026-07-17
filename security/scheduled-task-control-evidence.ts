const SCHEDULED_TASK_CONTROL_EVIDENCE = [
  "security/scheduled-task-inventory.ts",
  "security/scheduled-task-control-evidence.test.ts",
  "src/lib/scheduled-task-policy.ts",
  "src/lib/scheduled-task-control.ts",
  "src/lib/internal-auth.ts",
  "scripts/check-internal-auth.ts",
  "scripts/gcp-cloud-run-deploy.ps1",
  "scripts/gcp-scheduler-sync.sh",
  ".github/workflows/live-sync.yml",
  "scripts/gcp-monitoring-setup.sh",
  "docs/architecture/incident-response-controls.md",
] as const;

const VERIFIED_SCHEDULED_TASK_CONTROL_IDS = [
  "security.scheduled-task-control.not-public",
  "security.scheduled-task-control.identity",
  "security.scheduled-task-control.database-role",
  "security.scheduled-task-control.lock",
  "security.scheduled-task-control.overlap",
  "security.scheduled-task-control.idempotency",
  "security.scheduled-task-control.timeout",
  "security.scheduled-task-control.alerting",
  "security.scheduled-task-control.missed-run",
] as const;

export const SCHEDULED_TASK_CONTROL_MASTER_EVIDENCE = Object.fromEntries(
  VERIFIED_SCHEDULED_TASK_CONTROL_IDS.map((requirementId) => [
    requirementId,
    { status: "verified" as const, evidence: SCHEDULED_TASK_CONTROL_EVIDENCE },
  ]),
);
