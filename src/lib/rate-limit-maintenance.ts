import { withDbSystemContext } from "@/lib/db-context";

const RATE_LIMIT_PRUNE_BATCH_SIZE = 5_000;
const RATE_LIMIT_PRUNE_MAX_BATCHES = 10;
const RATE_LIMIT_PRUNE_MAX_WAIT_MS = 1_000;
const RATE_LIMIT_PRUNE_TRANSACTION_TIMEOUT_MS = 8_000;
const RATE_LIMIT_PRUNE_LOCK_TIMEOUT = "750ms";
const RATE_LIMIT_PRUNE_STATEMENT_TIMEOUT = "3000ms";

type RateLimitPruneBatchInput = {
  deleted: unknown;
  backlog: unknown;
};

type RateLimitPruneBatch = {
  deleted: number;
  backlog: boolean;
};

type CompletedRateLimitPrune = {
  status: "drained" | "backlog";
  deleted: number;
  batches: number;
  backlog: boolean;
  capped: boolean;
  stalled: boolean;
  batchSize: number;
  maxBatches: number;
};

type FailedRateLimitPrune = {
  status: "failed";
  deleted: number;
  batches: number;
  backlog: null;
  capped: false;
  stalled: false;
  batchSize: number;
  maxBatches: number;
};

export type RateLimitPruneResult =
  | CompletedRateLimitPrune
  | FailedRateLimitPrune;

type PruneBatch = (
  cutoff: Date,
  batchSize: number,
) => Promise<RateLimitPruneBatchInput>;

// Exported as a deterministic test seam. Production passes the indexed database
// batch below; tests prove the loop and deletion ceilings without mutating a DB.
export async function runRateLimitPruneMaintenance(
  cutoff: Date,
  pruneBatch: PruneBatch,
): Promise<RateLimitPruneResult> {
  let deleted = 0;
  let batches = 0;
  let backlog = false;
  let stalled = false;

  try {
    for (let batchNumber = 0; batchNumber < RATE_LIMIT_PRUNE_MAX_BATCHES; batchNumber += 1) {
      const batch = validateBatch(
        await pruneBatch(cutoff, RATE_LIMIT_PRUNE_BATCH_SIZE),
      );
      deleted += batch.deleted;
      batches += 1;
      backlog = batch.backlog;

      if (!backlog) break;
      if (batch.deleted === 0) {
        stalled = true;
        break;
      }
    }
  } catch {
    // Individual batches commit atomically. Report only completed-batch progress
    // and keep the hourly aggregate refresh independent from cleanup failures.
    return {
      status: "failed",
      deleted,
      batches,
      backlog: null,
      capped: false,
      stalled: false,
      batchSize: RATE_LIMIT_PRUNE_BATCH_SIZE,
      maxBatches: RATE_LIMIT_PRUNE_MAX_BATCHES,
    };
  }

  const capped =
    backlog && !stalled && batches === RATE_LIMIT_PRUNE_MAX_BATCHES;

  return {
    status: backlog ? "backlog" : "drained",
    deleted,
    batches,
    backlog,
    capped,
    stalled,
    batchSize: RATE_LIMIT_PRUNE_BATCH_SIZE,
    maxBatches: RATE_LIMIT_PRUNE_MAX_BATCHES,
  };
}

export async function pruneExpiredRateLimits(): Promise<RateLimitPruneResult> {
  // One cutoff per run prevents a busy limiter from extending the cleanup loop.
  return runRateLimitPruneMaintenance(new Date(), deleteExpiredRateLimitBatch);
}

async function deleteExpiredRateLimitBatch(
  cutoff: Date,
  batchSize: number,
): Promise<RateLimitPruneBatchInput> {
  return withDbSystemContext(
    async (tx) => {
      await tx.$queryRaw`
        SELECT
          set_config('lock_timeout', ${RATE_LIMIT_PRUNE_LOCK_TIMEOUT}, true),
          set_config('statement_timeout', ${RATE_LIMIT_PRUNE_STATEMENT_TIMEOUT}, true),
          set_config('enable_hashjoin', 'off', true),
          set_config('enable_mergejoin', 'off', true)
      `;

      // resetAt is indexed. SKIP LOCKED keeps cleanup from waiting on a counter
      // being reset while each short transaction locks at most one batch. The
      // transaction-local join settings keep the locked physical row ids as
      // bounded TID lookups rather than allowing a target-table rescan.
      const deletedRows = await tx.$queryRaw<Array<{ deleted: number }>>`
        WITH expired AS (
          SELECT ctid
          FROM "RateLimit"
          WHERE "resetAt" <= ${cutoff}
          ORDER BY "resetAt"
          LIMIT ${batchSize}
          FOR UPDATE SKIP LOCKED
        ), deleted AS (
          DELETE FROM "RateLimit" AS target
          USING expired
          WHERE target.ctid = expired.ctid
          RETURNING 1
        )
        SELECT count(*)::integer AS "deleted"
        FROM deleted
      `;
      const backlogRows = await tx.$queryRaw<Array<{ backlog: boolean }>>`
        SELECT EXISTS (
          SELECT 1
          FROM "RateLimit"
          WHERE "resetAt" <= ${cutoff}
        ) AS "backlog"
      `;

      return {
        deleted: deletedRows[0]?.deleted,
        backlog: backlogRows[0]?.backlog,
      };
    },
    {
      maxWait: RATE_LIMIT_PRUNE_MAX_WAIT_MS,
      timeout: RATE_LIMIT_PRUNE_TRANSACTION_TIMEOUT_MS,
    },
  );
}

function validateBatch(batch: RateLimitPruneBatchInput): RateLimitPruneBatch {
  if (
    !Number.isInteger(batch.deleted) ||
    (batch.deleted as number) < 0 ||
    (batch.deleted as number) > RATE_LIMIT_PRUNE_BATCH_SIZE ||
    typeof batch.backlog !== "boolean"
  ) {
    throw new Error("rate_limit.prune_batch_invalid");
  }

  return {
    deleted: batch.deleted as number,
    backlog: batch.backlog,
  };
}
