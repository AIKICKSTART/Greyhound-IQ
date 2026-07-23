import "server-only";

import { randomUUID } from "node:crypto";

import { withDbSystemContext } from "@/lib/db-context";
import type {
  SignupAcceptanceClaim,
  SignupAcceptanceWorkerStore,
} from "@/lib/signup-acceptance-worker";

const WORKER_TRANSACTION_MAX_WAIT_MS = 1_000;
const WORKER_TRANSACTION_TIMEOUT_MS = 5_000;

export const signupAcceptanceWorkerStore: SignupAcceptanceWorkerStore = {
  async claimBatch({ now, limit, leaseMs, maxAttempts }) {
    const leaseToken = randomUUID();
    const leaseExpiresAt = new Date(now.getTime() + leaseMs);

    return withDbSystemContext(
      async (tx) => {
        const expiredDeadLettered = await tx.$executeRaw`
          WITH candidates AS (
            SELECT "id"
            FROM "SignupOutbox"
            WHERE "retryCount" >= ${maxAttempts}
              AND (
                ("status" = 'pending' AND "nextRetryAt" <= ${now})
                OR (
                  "status" = 'processing'
                  AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" <= ${now})
                )
              )
            ORDER BY "nextRetryAt" ASC, "createdAt" ASC, "id" ASC
            FOR UPDATE SKIP LOCKED
            LIMIT ${limit}
          )
          UPDATE "SignupOutbox" AS outbox
          SET
            "status" = 'dead_letter',
            "leaseToken" = NULL,
            "leaseExpiresAt" = NULL,
            "deadLetteredAt" = ${now},
            "lastErrorCode" = 'signup.attempts_exhausted',
            "updatedAt" = ${now}
          FROM candidates
          WHERE outbox."id" = candidates."id"`;

        const claims = await tx.$queryRaw<SignupAcceptanceClaim[]>`
          WITH candidates AS (
            SELECT "id"
            FROM "SignupOutbox"
            WHERE "retryCount" < ${maxAttempts}
              AND (
                ("status" = 'pending' AND "nextRetryAt" <= ${now})
                OR (
                  "status" = 'processing'
                  AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" <= ${now})
                )
              )
            ORDER BY "nextRetryAt" ASC, "createdAt" ASC, "id" ASC
            FOR UPDATE SKIP LOCKED
            LIMIT ${limit}
          )
          UPDATE "SignupOutbox" AS outbox
          SET
            "status" = 'processing',
            "retryCount" = outbox."retryCount" + 1,
            "lastAttemptAt" = ${now},
            "leaseExpiresAt" = ${leaseExpiresAt},
            "leaseToken" = ${leaseToken},
            "deadLetteredAt" = NULL,
            "lastErrorCode" = CASE
              WHEN outbox."status" = 'processing' THEN 'signup.lease_expired'
              ELSE outbox."lastErrorCode"
            END,
            "updatedAt" = ${now}
          FROM candidates
          WHERE outbox."id" = candidates."id"
          RETURNING
            outbox."id",
            outbox."userId",
            outbox."idempotencyKey",
            outbox."correlationId",
            outbox."retryCount" AS "attempt",
            outbox."leaseToken",
            outbox."leaseExpiresAt"`;

        return { claims, expiredDeadLettered };
      },
      {
        maxWait: WORKER_TRANSACTION_MAX_WAIT_MS,
        timeout: WORKER_TRANSACTION_TIMEOUT_MS,
      },
    );
  },

  async complete(claim, completedAt) {
    const updated = await withDbSystemContext(
      (tx) => tx.$executeRaw`
        UPDATE "SignupOutbox"
        SET
          "status" = 'sent',
          "leaseToken" = NULL,
          "leaseExpiresAt" = NULL,
          "sentAt" = ${completedAt},
          "lastErrorCode" = NULL,
          "updatedAt" = ${completedAt}
        WHERE "id" = ${claim.id}
          AND "status" = 'processing'
          AND "leaseToken" = ${claim.leaseToken}`,
      {
        maxWait: WORKER_TRANSACTION_MAX_WAIT_MS,
        timeout: WORKER_TRANSACTION_TIMEOUT_MS,
      },
    );
    return updated === 1;
  },

  async fail({ claim, failedAt, errorCode, retryAt }) {
    const updated = retryAt
      ? await retryClaim(claim, failedAt, errorCode, retryAt)
      : await deadLetterClaim(claim, failedAt, errorCode);
    if (updated !== 1) return "lease-lost";
    return retryAt ? "retry" : "dead-letter";
  },
};

function retryClaim(
  claim: SignupAcceptanceClaim,
  failedAt: Date,
  errorCode: string,
  retryAt: Date,
) {
  return withDbSystemContext(
    (tx) => tx.$executeRaw`
      UPDATE "SignupOutbox"
      SET
        "status" = 'pending',
        "leaseToken" = NULL,
        "leaseExpiresAt" = NULL,
        "nextRetryAt" = ${retryAt},
        "lastErrorCode" = ${errorCode},
        "updatedAt" = ${failedAt}
      WHERE "id" = ${claim.id}
        AND "status" = 'processing'
        AND "leaseToken" = ${claim.leaseToken}`,
    {
      maxWait: WORKER_TRANSACTION_MAX_WAIT_MS,
      timeout: WORKER_TRANSACTION_TIMEOUT_MS,
    },
  );
}

function deadLetterClaim(
  claim: SignupAcceptanceClaim,
  failedAt: Date,
  errorCode: string,
) {
  return withDbSystemContext(
    (tx) => tx.$executeRaw`
      UPDATE "SignupOutbox"
      SET
        "status" = 'dead_letter',
        "leaseToken" = NULL,
        "leaseExpiresAt" = NULL,
        "deadLetteredAt" = ${failedAt},
        "lastErrorCode" = ${errorCode},
        "updatedAt" = ${failedAt}
      WHERE "id" = ${claim.id}
        AND "status" = 'processing'
        AND "leaseToken" = ${claim.leaseToken}`,
    {
      maxWait: WORKER_TRANSACTION_MAX_WAIT_MS,
      timeout: WORKER_TRANSACTION_TIMEOUT_MS,
    },
  );
}
