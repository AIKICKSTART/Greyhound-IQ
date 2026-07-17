import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  AGGREGATE_MAINTENANCE_BUDGET_MS,
  AGGREGATE_VIEW_STATEMENT_MAX_MS,
  getAggregateRefreshTiming,
  refreshAggregateMaterializedView,
} from "./sync";

(async () => {
  const fullBudget = getAggregateRefreshTiming(
    AGGREGATE_MAINTENANCE_BUDGET_MS,
    0,
  );
  assert.equal(AGGREGATE_MAINTENANCE_BUDGET_MS, 780_000);
  assert.equal(AGGREGATE_VIEW_STATEMENT_MAX_MS, 120_000);
  assert.equal(fullBudget.statementTimeoutMs, 120_000);
  assert.equal(fullBudget.transactionTimeoutMs, 122_000);

  const constrainedBudget = getAggregateRefreshTiming(130_000, 0);
  assert.equal(constrainedBudget.statementTimeoutMs, 113_000);
  assert.equal(
    constrainedBudget.transactionMaxWaitMs +
      constrainedBudget.transactionTimeoutMs +
      constrainedBudget.responseReserveMs,
    130_000,
  );

  let dbExecutions = 0;
  await assert.rejects(
    refreshAggregateMaterializedView("giq_box_bias", 17_999, {
      now: () => 0,
      execute: async () => {
        dbExecutions += 1;
      },
    }),
    /aggregate_refresh\.deadline_exhausted/,
  );
  assert.equal(dbExecutions, 0, "deadline exhaustion must precede database work");

  const schedulerSource = readFileSync("scripts/gcp-scheduler-sync.sh", "utf8");
  const deploySource = readFileSync("scripts/gcp-cloud-run-deploy.ps1", "utf8");
  const routeSource = readFileSync(
    "src/app/api/internal/aggregate-refresh/route.ts",
    "utf8",
  );
  const schedulerSeconds = Number(
    schedulerSource.match(/prod-aggregate-refresh[^\n]+"(\d+)s"/)?.[1],
  );
  const platformSeconds = Number(
    deploySource.match(/"--timeout=(\d+)"/)?.[1],
  );
  assert.equal(schedulerSeconds, 840);
  assert.equal(platformSeconds, 900);
  assert.ok(AGGREGATE_MAINTENANCE_BUDGET_MS / 1_000 < schedulerSeconds);
  assert.ok(schedulerSeconds < platformSeconds);
  assert.match(routeSource, /export const maxDuration = 300;/);

  console.log("aggregate maintenance timing tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
