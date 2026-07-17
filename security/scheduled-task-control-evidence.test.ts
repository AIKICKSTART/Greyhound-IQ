import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import { SCHEDULED_TASK_POLICIES } from "../src/lib/scheduled-task-policy";
import { SCHEDULED_TASK_CONTROL_MASTER_EVIDENCE } from "./scheduled-task-control-evidence";
import {
  SCHEDULED_TASK_SOURCE_INVENTORY,
  type ScheduledTaskSourceRecord,
} from "./scheduled-task-inventory";

const discoveredRouteFiles = collectRouteFiles("src/app/api/internal").sort();
assert.deepEqual(
  SCHEDULED_TASK_SOURCE_INVENTORY.map(({ routeFile }) => routeFile).toSorted(),
  discoveredRouteFiles,
  "every source-visible internal scheduled/maintenance route must be inventoried",
);
assert.deepEqual(
  Object.keys(SCHEDULED_TASK_POLICIES).toSorted(),
  SCHEDULED_TASK_SOURCE_INVENTORY.map(({ taskId }) => taskId).toSorted(),
  "the runtime policy must stay exact with the route inventory",
);

const runtimeControl = readFileSync(
  "src/lib/scheduled-task-control.ts",
  "utf8",
);
assert.match(runtimeControl, /pg_try_advisory_xact_lock/);
assert.match(runtimeControl, /hashtextextended/);
assert.match(runtimeControl, /withDbSystemContext/);
assert.match(runtimeControl, /status: "overlap"/);
assert.match(runtimeControl, /scheduled_task\.started/);
assert.match(runtimeControl, /scheduled_task\.completed/);
assert.match(runtimeControl, /scheduled_task\.failed/);
assert.match(runtimeControl, /scheduled_task\.overlap/);
assert.match(runtimeControl, /timeout: timeoutMs/);

const deployScheduler = readFileSync(
  "scripts/gcp-cloud-run-deploy.ps1",
  "utf8",
);
const syncScheduler = readFileSync("scripts/gcp-scheduler-sync.sh", "utf8");
const githubScheduler = readFileSync(
  ".github/workflows/live-sync.yml",
  "utf8",
);
const monitoring = readFileSync("scripts/gcp-monitoring-setup.sh", "utf8");
const runbook = readFileSync(
  "docs/architecture/incident-response-controls.md",
  "utf8",
);

assert.match(deployScheduler, /MaxRetryAttempts = 3/);
assert.match(deployScheduler, /max-retry-attempts=\$MaxRetryAttempts/);
assert.match(syncScheduler, /max-retry-attempts=3/);
for (const source of [deployScheduler, syncScheduler]) {
  assert.match(source, /min-backoff[^\n]*30s/);
  assert.match(source, /max-backoff[^\n]*120s/);
  assert.match(source, /max-doublings[^\n]*2/);
  assert.match(source, /Australia\/Sydney/);
}
assert.match(githubScheduler, /concurrency:/);
assert.match(githubScheduler, /cancel-in-progress: false/);
assert.match(githubScheduler, /timeout-minutes: 5/);
assert.match(githubScheduler, /--max-time 240/);

for (const task of SCHEDULED_TASK_SOURCE_INVENTORY) {
  assertTask(task);
  assertSchedulerBinding(deployScheduler, task, "deploy");
  assertSchedulerBinding(syncScheduler, task, "sync");
  assert.ok(
    task.timeoutMs < task.attemptDeadlineSeconds * 1_000,
    `${task.taskId}: application timeout needs response headroom inside the Scheduler deadline`,
  );
  assert.ok(task.missedAfterSeconds > task.attemptDeadlineSeconds);
  assert.match(
    monitoring,
    new RegExp(`"${escapeRegExp(task.taskId)}:${task.missedAfterSeconds}"`),
    `${task.taskId}: completion-absence threshold is not source-bound`,
  );
}

assert.match(monitoring, /greyhoundiq_prod_scheduled_task_attention/);
assert.match(monitoring, /greyhoundiq_prod_scheduler_failures/);
assert.match(monitoring, /scheduled_task\.failed/);
assert.match(monitoring, /scheduled_task\.overlap/);
assert.match(monitoring, /scheduled_task\.completed/);
assert.match(monitoring, /conditionAbsent/);
assert.match(runbook, /## Scheduled-task failure or missed run/);
assert.match(runbook, /never bypass the lock/i);
assert.match(runbook, /one authenticated POST/i);
assert.match(runbook, /do not prove deployed Scheduler jobs/i);

const expectedIds = [
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
assert.deepEqual(
  Object.keys(SCHEDULED_TASK_CONTROL_MASTER_EVIDENCE),
  expectedIds,
);
for (const requirementId of expectedIds) {
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    SCHEDULED_TASK_CONTROL_MASTER_EVIDENCE[requirementId],
  );
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.equal(isMasterRequirementComplete(requirement), true);
}

console.log(
  `Scheduled-task controls passed: ${SCHEDULED_TASK_SOURCE_INVENTORY.length} internal tasks have distributed locks, overlap rejection, repeat-safe work, deadlines, alerts and missed-run recovery`,
);

function assertTask(task: ScheduledTaskSourceRecord) {
  assert.ok(task.taskId.trim());
  assert.ok(task.executionIdentity.includes("INTERNAL_API_SECRET"));
  assert.ok(
    task.databaseRole.includes("Shared server runtime PostgreSQL identity"),
  );
  assert.ok(task.handlers.length > 0);
  assert.ok(task.databaseEvidenceFiles.length > 0);
  assert.ok(task.schedules.length > 0);
  assert.ok(task.idempotencyEvidence.length > 0);
  assert.ok(task.missedRunRecovery.trim());

  const routeSource = readFileSync(task.routeFile, "utf8");
  const authIndex = routeSource.indexOf("requireInternalRequest(request)");
  const controlIndex = routeSource.indexOf(
    `executeScheduledTask("${task.taskId}"`,
  );
  assert.ok(authIndex >= 0, `${task.taskId}: internal authentication is required`);
  assert.ok(
    controlIndex > authIndex,
    `${task.taskId}: the distributed control must run after authentication`,
  );
  assert.equal(
    [...routeSource.matchAll(/executeScheduledTask\(/g)].length,
    1,
    `${task.taskId}: exactly one task control must own the route execution`,
  );
  assert.match(routeSource, /export async function POST\(/);
  assert.doesNotMatch(routeSource, /export async function GET\(/);
  assert.match(routeSource, /execution\.status === "overlap"/);
  for (const handler of task.handlers) {
    assert.ok(
      routeSource.indexOf(`${handler}(`, authIndex) > authIndex,
      `${task.taskId}: ${handler} must execute only after internal authentication`,
    );
  }
  for (const evidenceFile of task.databaseEvidenceFiles) {
    const databaseSource = readFileSync(evidenceFile, "utf8");
    assert.match(
      databaseSource,
      /withDbSystemContext|prisma\.\$transaction/,
      `${task.taskId}: database execution context must be explicit in ${evidenceFile}`,
    );
  }
  for (const item of task.idempotencyEvidence) {
    const source = readFileSync(item.sourceFile, "utf8");
    for (const marker of item.markers) {
      assert.ok(
        source.includes(marker),
        `${task.taskId}: missing idempotency marker ${marker} in ${item.sourceFile}`,
      );
    }
  }
}

function assertSchedulerBinding(
  source: string,
  task: ScheduledTaskSourceRecord,
  kind: "deploy" | "sync",
) {
  const route = `/api/internal/${task.taskId}`;
  assert.ok(source.includes(route), `${task.taskId}: missing ${kind} route binding`);
  const bindings =
    kind === "deploy"
      ? [...source.matchAll(/@\{[\s\S]*?\n\s*\}/g)]
          .map(([block]) => block)
          .filter((block) => block.includes(route))
      : source
          .split(/\r?\n/)
          .filter((line) => /^upsert_(?:http|oidc) greyhoundiq-(?:prod|staging)-/.test(line))
          .filter((line) => line.includes(route));
  assert.ok(bindings.length > 0, `${task.taskId}: no ${kind} scheduler binding`);
  for (const schedule of task.schedules) {
    assert.ok(
      bindings.some((binding) => binding.includes(`"${schedule}"`)),
      `${task.taskId}: ${kind} is missing schedule ${schedule}`,
    );
  }
}

function collectRouteFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectRouteFiles(path);
    return entry.name === "route.ts" ? [path.replaceAll("\\", "/")] : [];
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
