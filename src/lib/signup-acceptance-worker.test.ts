import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  processSignupAcceptanceBatch,
  signupAcceptanceRetryDelayMs,
  SignupAcceptanceWorkerFailure,
  type SignupAcceptanceClaim,
  type SignupAcceptanceWorkerStore,
} from "./signup-acceptance-worker";

const now = new Date("2026-07-14T01:00:00.000Z");

function claim(
  overrides: Partial<SignupAcceptanceClaim> = {},
): SignupAcceptanceClaim {
  return {
    id: "outbox_1",
    userId: "user_123",
    idempotencyKey: "signup.accepted:user_123",
    correlationId: "request_123",
    attempt: 1,
    leaseToken: "lease_123",
    leaseExpiresAt: new Date(now.getTime() + 60_000),
    ...overrides,
  };
}

function fakeStore(input: {
  claims: readonly SignupAcceptanceClaim[];
  expiredDeadLettered?: number;
  complete?: boolean;
  failureResult?: "retry" | "dead-letter" | "lease-lost";
}) {
  const pendingClaims = [...input.claims];
  let reportedExpired = false;
  const failures: Parameters<SignupAcceptanceWorkerStore["fail"]>[0][] = [];
  const completed: SignupAcceptanceClaim[] = [];
  const claimInputs: Parameters<SignupAcceptanceWorkerStore["claimBatch"]>[0][] =
    [];
  const store: SignupAcceptanceWorkerStore = {
    async claimBatch(options) {
      claimInputs.push(options);
      const expiredDeadLettered = reportedExpired
        ? 0
        : (input.expiredDeadLettered ?? 0);
      reportedExpired = true;
      return {
        claims: pendingClaims.splice(0, options.limit),
        expiredDeadLettered,
      };
    },
    async complete(item) {
      completed.push(item);
      return input.complete ?? true;
    },
    async fail(failure) {
      failures.push(failure);
      return input.failureResult ?? (failure.retryAt ? "retry" : "dead-letter");
    },
  };
  return { store, failures, completed, claimInputs };
}

async function main() {
  const successStore = fakeStore({
    claims: [claim()],
    expiredDeadLettered: 2,
  });
  const handled: string[] = [];
  const success = await processSignupAcceptanceBatch({
    store: successStore.store,
    handler: async (item) => {
      handled.push(`${item.idempotencyKey}:${item.correlationId}`);
    },
    clock: () => now,
    limit: 4,
    leaseMs: 20_000,
    handlerTimeoutMs: 5_000,
    maxAttempts: 3,
  });
  assert.deepEqual(handled, ["signup.accepted:user_123:request_123"]);
  assert.equal(successStore.completed.length, 1);
  assert.deepEqual(success, {
    claimed: 1,
    completed: 1,
    retried: 0,
    deadLettered: 2,
    leaseLost: 0,
    expiredDeadLettered: 2,
  });
  assert.deepEqual(successStore.claimInputs[0], {
    now,
    limit: 1,
    leaseMs: 20_000,
    maxAttempts: 3,
  });

  const retryStore = fakeStore({ claims: [claim()] });
  const retry = await processSignupAcceptanceBatch({
    store: retryStore.store,
    handler: async () => {
      throw new Error("sensitive provider text must not persist");
    },
    clock: () => now,
    leaseMs: 20_000,
    handlerTimeoutMs: 5_000,
    maxAttempts: 3,
  });
  assert.equal(retry.retried, 1);
  assert.equal(retryStore.failures[0]?.errorCode, "signup.handler_failed");
  assert.equal(
    retryStore.failures[0]?.retryAt?.getTime(),
    now.getTime() +
      signupAcceptanceRetryDelayMs(1, "signup.accepted:user_123"),
  );

  const exhaustedStore = fakeStore({
    claims: [claim({ attempt: 3 })],
  });
  const exhausted = await processSignupAcceptanceBatch({
    store: exhaustedStore.store,
    handler: async () => {
      throw new SignupAcceptanceWorkerFailure("signup.provider_unavailable");
    },
    clock: () => now,
    leaseMs: 20_000,
    handlerTimeoutMs: 5_000,
    maxAttempts: 3,
  });
  assert.equal(exhausted.deadLettered, 1);
  assert.equal(exhaustedStore.failures[0]?.retryAt, null);
  assert.equal(
    exhaustedStore.failures[0]?.errorCode,
    "signup.provider_unavailable",
  );

  const invalidStore = fakeStore({
    claims: [claim({ idempotencyKey: "signup.accepted:other_user" })],
  });
  let invalidHandled = false;
  const invalid = await processSignupAcceptanceBatch({
    store: invalidStore.store,
    handler: async () => {
      invalidHandled = true;
    },
    clock: () => now,
    leaseMs: 20_000,
    handlerTimeoutMs: 5_000,
  });
  assert.equal(invalidHandled, false);
  assert.equal(invalid.deadLettered, 1);
  assert.equal(
    invalidStore.failures[0]?.errorCode,
    "signup.claim_idempotency_invalid",
  );
  assert.equal(invalidStore.failures[0]?.retryAt, null);

  const leaseLostStore = fakeStore({
    claims: [claim()],
    complete: false,
  });
  const leaseLost = await processSignupAcceptanceBatch({
    store: leaseLostStore.store,
    handler: async () => undefined,
    clock: () => now,
    leaseMs: 20_000,
    handlerTimeoutMs: 5_000,
  });
  assert.equal(leaseLost.leaseLost, 1);
  assert.equal(leaseLost.completed, 0);

  const timeoutStore = fakeStore({ claims: [claim()] });
  const timeout = await processSignupAcceptanceBatch({
    store: timeoutStore.store,
    handler: (_item, signal) =>
      new Promise<void>((resolve) => {
        signal.addEventListener("abort", () => resolve(), { once: true });
      }),
    clock: () => now,
    leaseMs: 15_000,
    handlerTimeoutMs: 10,
  });
  assert.equal(timeout.retried, 1);
  assert.equal(timeoutStore.failures[0]?.errorCode, "signup.handler_timeout");

  assert.equal(
    signupAcceptanceRetryDelayMs(2, "signup.accepted:user_123"),
    signupAcceptanceRetryDelayMs(2, "signup.accepted:user_123"),
  );
  assert.ok(
    signupAcceptanceRetryDelayMs(2, "signup.accepted:user_123") >= 5_000,
  );
  assert.ok(
    signupAcceptanceRetryDelayMs(2, "signup.accepted:user_123") <= 10_000,
  );
  await assert.rejects(
    () =>
      processSignupAcceptanceBatch({
        store: successStore.store,
        handler: async () => undefined,
        limit: 26,
      }),
    /signup\.worker_limit/,
  );
  await assert.rejects(
    () =>
      processSignupAcceptanceBatch({
        store: successStore.store,
        handler: async () => undefined,
        leaseMs: 20_000,
        handlerTimeoutMs: 10_001,
      }),
    /signup\.worker_handler_timeout_ms/,
  );

  const storeSource = readFileSync(
    new URL("./signup-acceptance-worker-store.ts", import.meta.url),
    "utf8",
  );
  const schema = readFileSync(
    new URL("../../prisma/schema.prisma", import.meta.url),
    "utf8",
  );
  const migration = readFileSync(
    new URL(
      "../../prisma/migrations/20260714010000_add_signup_outbox_lease_token/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const correlationMigration = readFileSync(
    new URL(
      "../../prisma/migrations/20260714012500_add_signup_outbox_correlation_id/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const architecturePlan = readFileSync(
    new URL("../components/design-lab-architecture-plan.ts", import.meta.url),
    "utf8",
  );
  const deliveryProgress = readFileSync(
    new URL("../components/design-lab-delivery-progress.ts", import.meta.url),
    "utf8",
  );
  assert.match(storeSource, /FOR UPDATE SKIP LOCKED/);
  assert.match(storeSource, /"retryCount" = outbox\."retryCount" \+ 1/);
  assert.match(storeSource, /"leaseToken" = \$\{leaseToken\}/);
  assert.match(storeSource, /"leaseToken" = \$\{claim\.leaseToken\}/);
  assert.match(storeSource, /outbox\."correlationId"/);
  assert.match(storeSource, /withDbSystemContext/);
  assert.match(storeSource, /signup\.attempts_exhausted/);
  assert.doesNotMatch(storeSource, /fetch\(|email|payload|metadata/i);
  assert.match(schema, /leaseToken\s+String\?/);
  assert.match(schema, /correlationId\s+String\?\s+@db\.VarChar\(128\)/);
  assert.match(migration, /ADD COLUMN "leaseToken" TEXT/);
  assert.match(correlationMigration, /ADD COLUMN "correlationId" VARCHAR\(128\)/);
  assert.doesNotMatch(
    correlationMigration,
    /"(?:email|payload|credential|secret)"/i,
  );
  for (const taskId of ["ARCH-503", "ARCH-504", "ARCH-505", "ARCH-506"]) {
    assert.match(
      architecturePlan,
      new RegExp(`id: "${taskId}"[\\s\\S]{0,180}status: "in-progress"`),
    );
  }
  assert.match(deliveryProgress, /src\/lib\/signup-acceptance-worker\.ts/);
  assert.match(deliveryProgress, /all three forward-only migrations are applied/);
  assert.match(deliveryProgress, /leaseToken is nullable text/);
  assert.match(deliveryProgress, /no worker runtime, sink idempotency, queue, replay or backlog evidence is claimed/);

  console.log("signup acceptance worker tests passed");
}

void main();
