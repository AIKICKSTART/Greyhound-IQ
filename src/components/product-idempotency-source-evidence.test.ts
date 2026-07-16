import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import {
  WEBHOOK_DEDUPLICATION_BINDINGS,
  validateWebhookDeduplicationBindings,
} from "../../security/webhook-deduplication-ci-evidence";
import { SCHEDULED_TASK_SOURCE_INVENTORY } from "../../security/scheduled-task-inventory";
import { SCHEDULED_TASK_POLICIES } from "../lib/scheduled-task-policy";
import { PRODUCT_MASTER_EVIDENCE } from "./master-audit-evidence";
import {
  PRODUCT_IDEMPOTENCY_SOURCE_EVIDENCE_FILE,
  PRODUCT_IDEMPOTENCY_SOURCE_EXPECTED_GAIN,
  PRODUCT_IDEMPOTENCY_SOURCE_MASTER_EVIDENCE,
  PRODUCT_IDEMPOTENCY_SOURCE_REQUIREMENT_IDS,
  PRODUCT_IDEMPOTENCY_SOURCE_SCOPE,
  PRODUCT_IDEMPOTENCY_SOURCE_TEST_FILE,
} from "./product-idempotency-source-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-IDEMPOTENCY-SOURCE

const REQUIREMENT_ID = "GLOBAL.DATA.idempotency" as const;
const REQUIREMENT_TEXT =
  "Keep repeated webhook or job execution idempotent." as const;
const ALLOWED_WEBHOOK_STRATEGIES = new Set([
  "domain-compare-and-set",
  "unique-receipt-and-fenced-reducer",
]);

assert.deepEqual(PRODUCT_IDEMPOTENCY_SOURCE_REQUIREMENT_IDS, [REQUIREMENT_ID]);
assert.equal(PRODUCT_IDEMPOTENCY_SOURCE_EXPECTED_GAIN, 1);
const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
  ({ id }) => id === REQUIREMENT_ID,
);
assert.ok(requirement, REQUIREMENT_ID);
assert.equal(requirement.requirement, REQUIREMENT_TEXT);

const record = PRODUCT_IDEMPOTENCY_SOURCE_MASTER_EVIDENCE[REQUIREMENT_ID];
assert.equal(record.status, "tested");
assert.deepEqual(record.evidence.slice(0, 2), [
  PRODUCT_IDEMPOTENCY_SOURCE_EVIDENCE_FILE,
  PRODUCT_IDEMPOTENCY_SOURCE_TEST_FILE,
]);
assert.equal(new Set(record.evidence).size, record.evidence.length);
record.evidence.forEach((path) => assert.equal(existsSync(path), true, path));
assert.deepEqual(PRODUCT_MASTER_EVIDENCE[REQUIREMENT_ID], record);

const evidenceSource = source(PRODUCT_IDEMPOTENCY_SOURCE_EVIDENCE_FILE);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);
assert.match(PRODUCT_IDEMPOTENCY_SOURCE_SCOPE, /every discovered webhook ingress/i);
assert.match(PRODUCT_IDEMPOTENCY_SOURCE_SCOPE, /every source-visible internal scheduled-task route/i);
assert.match(PRODUCT_IDEMPOTENCY_SOURCE_SCOPE, /fail-closed inventory only/i);
assert.match(PRODUCT_IDEMPOTENCY_SOURCE_SCOPE, /does not prove deployed scheduler configuration/i);
assert.match(PRODUCT_IDEMPOTENCY_SOURCE_SCOPE, /cross-provider semantic idempotency/i);

const webhookRouteFiles = collectRouteFiles("src/app").filter((file) =>
  /\/webhooks?\//i.test(file),
);
const sourceReader = (file: string) =>
  existsSync(file) ? source(file) : undefined;

assert.deepEqual(
  validateWebhookDeduplicationBindings(
    WEBHOOK_DEDUPLICATION_BINDINGS,
    webhookRouteFiles,
    sourceReader,
  ),
  [],
  "every discovered webhook ingress must have complete registered deduplication evidence",
);
assert.equal(WEBHOOK_DEDUPLICATION_BINDINGS.length, 3);
assert.equal(WEBHOOK_DEDUPLICATION_BINDINGS.length, webhookRouteFiles.length);
for (const binding of WEBHOOK_DEDUPLICATION_BINDINGS) {
  assert.equal(ALLOWED_WEBHOOK_STRATEGIES.has(binding.strategy), true);
  assert.ok(binding.sourceChecks.length > 0, binding.routeFile);
  for (const check of binding.sourceChecks) {
    assert.ok(check.requiredMarkers.length > 0, check.file);
  }
}
assert.deepEqual(
  validateWebhookDeduplicationBindings(
    WEBHOOK_DEDUPLICATION_BINDINGS,
    [...webhookRouteFiles, "src/app/api/webhooks/new-provider/route.ts"],
    sourceReader,
  ).filter((issue) => issue.startsWith("ROUTE_UNREGISTERED:")),
  ["ROUTE_UNREGISTERED:src/app/api/webhooks/new-provider/route.ts"],
  "a new webhook must fail closed until its idempotency strategy is registered",
);

const internalRouteFiles = collectRouteFiles("src/app/api/internal");
assert.equal(SCHEDULED_TASK_SOURCE_INVENTORY.length, 12);
assert.deepEqual(
  SCHEDULED_TASK_SOURCE_INVENTORY.map(({ routeFile }) => routeFile).toSorted(),
  internalRouteFiles,
  "every source-visible internal scheduled-task route must be inventoried",
);
assert.deepEqual(
  SCHEDULED_TASK_SOURCE_INVENTORY.map(({ taskId }) => taskId).toSorted(),
  Object.keys(SCHEDULED_TASK_POLICIES).toSorted(),
  "scheduled-task inventory and runtime policy must remain exact",
);
assert.equal(
  new Set(SCHEDULED_TASK_SOURCE_INVENTORY.map(({ taskId }) => taskId)).size,
  SCHEDULED_TASK_SOURCE_INVENTORY.length,
);

for (const task of SCHEDULED_TASK_SOURCE_INVENTORY) {
  assert.ok(task.idempotencyEvidence.length > 0, task.taskId);
  const routeSource = source(task.routeFile);
  assert.ok(
    routeSource.includes("requireInternalRequest(request)"),
    `${task.taskId}: internal authentication is required`,
  );
  assert.ok(
    routeSource.includes(`executeScheduledTask("${task.taskId}"`),
    `${task.taskId}: distributed execution control is required`,
  );
  assert.ok(
    routeSource.includes('execution.status === "overlap"'),
    `${task.taskId}: overlap rejection is required`,
  );
  for (const item of task.idempotencyEvidence) {
    const itemSource = source(item.sourceFile);
    assert.ok(item.markers.length > 0, item.sourceFile);
    for (const marker of item.markers) {
      assert.ok(
        itemSource.includes(marker),
        `${task.taskId}: missing repeat-safety marker ${marker} in ${item.sourceFile}`,
      );
    }
  }
}

const scheduledTaskControlSource = source("src/lib/scheduled-task-control.ts");
assert.match(scheduledTaskControlSource, /pg_try_advisory_xact_lock/);
assert.match(scheduledTaskControlSource, /status: "overlap"/);

console.log(
  `Product idempotency source evidence passed: ${WEBHOOK_DEDUPLICATION_BINDINGS.length} webhook ingresses and ${SCHEDULED_TASK_SOURCE_INVENTORY.length} scheduled tasks are exhaustively registered with source-only repeat-safety proof.`,
);

function source(path: string) {
  return readFileSync(path, "utf8");
}

function collectRouteFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Unsupported symbolic link under route source: ${fullPath}`);
      }
      if (entry.isDirectory()) return collectRouteFiles(fullPath);
      return entry.name === "route.ts"
        ? [relative(process.cwd(), fullPath).replaceAll("\\", "/")]
        : [];
    })
    .toSorted();
}
