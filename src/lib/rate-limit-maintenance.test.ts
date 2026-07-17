import assert from "node:assert/strict";
import { runRateLimitPruneMaintenance } from "./rate-limit-maintenance";

(async () => {
  const cutoff = new Date("2026-07-14T00:00:00.000Z");
  const observedCutoffs: number[] = [];
  let continuationCalls = 0;
  const drained = await runRateLimitPruneMaintenance(
    cutoff,
    async (batchCutoff, batchSize) => {
      observedCutoffs.push(batchCutoff.getTime());
      continuationCalls += 1;
      return continuationCalls === 1
        ? { deleted: batchSize, backlog: true }
        : { deleted: 3, backlog: false };
    },
  );

  assert.equal(drained.status, "drained");
  assert.equal(drained.batches, 2);
  assert.equal(drained.deleted, drained.batchSize + 3);
  assert.equal(drained.backlog, false);
  assert.deepEqual(observedCutoffs, [cutoff.getTime(), cutoff.getTime()]);

  let cappedCalls = 0;
  const capped = await runRateLimitPruneMaintenance(
    cutoff,
    async (_batchCutoff, batchSize) => {
      cappedCalls += 1;
      return { deleted: batchSize, backlog: true };
    },
  );
  assert.equal(capped.status, "backlog");
  assert.equal(capped.capped, true);
  assert.equal(capped.stalled, false);
  assert.equal(cappedCalls, capped.maxBatches);
  assert.equal(capped.deleted, capped.batchSize * capped.maxBatches);

  let stalledCalls = 0;
  const stalled = await runRateLimitPruneMaintenance(
    cutoff,
    async () => {
      stalledCalls += 1;
      return { deleted: 0, backlog: true };
    },
  );
  assert.equal(stalled.status, "backlog");
  assert.equal(stalled.capped, false);
  assert.equal(stalled.stalled, true);
  assert.equal(stalledCalls, 1);

  let failureCalls = 0;
  const failed = await runRateLimitPruneMaintenance(
    cutoff,
    async () => {
      failureCalls += 1;
      if (failureCalls === 1) return { deleted: 1, backlog: true };
      throw new Error("database unavailable");
    },
  );
  assert.deepEqual(failed, {
    status: "failed",
    deleted: 1,
    batches: 1,
    backlog: null,
    capped: false,
    stalled: false,
    batchSize: failed.batchSize,
    maxBatches: failed.maxBatches,
  });

  const invalid = await runRateLimitPruneMaintenance(
    cutoff,
    async (_batchCutoff, batchSize) => ({
      deleted: batchSize + 1,
      backlog: true,
    }),
  );
  assert.equal(invalid.status, "failed");
  assert.equal(invalid.deleted, 0);
  assert.equal(invalid.batches, 0);

  console.log("rate-limit maintenance tests passed");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
