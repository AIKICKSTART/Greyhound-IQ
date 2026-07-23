import {
  LAGO_BILLABLE_METRIC_KEYS,
  type LagoBillableMetricKey,
} from "./billable-metrics";

const DEFAULT_BATCH_SIZE = 25;
const MAX_BATCH_SIZE = 100;
const DEFAULT_CONCURRENCY = 5;
const MAX_CONCURRENCY = 10;
const DEFAULT_LEASE_MS = 45_000;
const MIN_LEASE_MS = 20_000;
const MAX_LEASE_MS = 300_000;
const LEASE_SETTLEMENT_BUDGET_MS = 5_000;
const DEFAULT_HANDLER_TIMEOUT_MS = 12_000;
const MIN_HANDLER_TIMEOUT_MS = 1_000;
const DEFAULT_MAX_ATTEMPTS = 5;
const MAX_ATTEMPTS = 10;
const RETRY_BASE_MS = 30_000;
const RETRY_MAX_MS = 900_000;

export type UsageDeliveryClaim = Readonly<{
  id: string;
  usageEventId: string | null;
  idempotencyKey: string;
  metricKey: string;
  userId: string | null;
  billingCustomerId: string | null;
  subscriptionId: string | null;
  quantity: number;
  occurredAt: Date;
  attempt: number;
  leaseToken: string;
  leaseExpiresAt: Date;
}>;

export type UsageDeliveryOutcome = "sent" | "ignored";
export type UsageDeliveryFailureResult =
  | "retry"
  | "dead-letter"
  | "lease-lost";

export interface UsageDeliveryWorkerStore {
  claimBatch(input: {
    now: Date;
    limit: number;
    leaseMs: number;
    maxAttempts: number;
  }): Promise<{
    claims: readonly UsageDeliveryClaim[];
    expiredDeadLettered: number;
  }>;
  complete(input: {
    claim: UsageDeliveryClaim;
    completedAt: Date;
    outcome: UsageDeliveryOutcome;
  }): Promise<boolean>;
  fail(input: {
    claim: UsageDeliveryClaim;
    failedAt: Date;
    errorCode: string;
    retryAt: Date | null;
  }): Promise<UsageDeliveryFailureResult>;
}

export type UsageDeliveryHandler = (
  claim: UsageDeliveryClaim,
  signal: AbortSignal,
) => Promise<UsageDeliveryOutcome>;

export type UsageDeliveryWorkerResult = Readonly<{
  claimed: number;
  sent: number;
  ignored: number;
  retried: number;
  deadLettered: number;
  leaseLost: number;
  expiredDeadLettered: number;
}>;

export class UsageDeliveryWorkerFailure extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, retryable = true) {
    const normalizedCode = normalizedWorkerErrorCode(code);
    super(normalizedCode);
    this.name = "UsageDeliveryWorkerFailure";
    this.code = normalizedCode;
    this.retryable = retryable;
  }
}

export async function processUsageDeliveryBatch(input: {
  store: UsageDeliveryWorkerStore;
  handler: UsageDeliveryHandler;
  clock?: () => Date;
  limit?: number;
  concurrency?: number;
  leaseMs?: number;
  handlerTimeoutMs?: number;
  maxAttempts?: number;
}): Promise<UsageDeliveryWorkerResult> {
  const clock = input.clock ?? (() => new Date());
  const limit = boundedInteger(
    "billing.usage_worker_limit_invalid",
    input.limit,
    DEFAULT_BATCH_SIZE,
    1,
    MAX_BATCH_SIZE,
  );
  const concurrency = boundedInteger(
    "billing.usage_worker_concurrency_invalid",
    input.concurrency,
    Math.min(DEFAULT_CONCURRENCY, limit),
    1,
    Math.min(MAX_CONCURRENCY, limit),
  );
  const leaseMs = boundedInteger(
    "billing.usage_worker_lease_invalid",
    input.leaseMs,
    DEFAULT_LEASE_MS,
    MIN_LEASE_MS,
    MAX_LEASE_MS,
  );
  const handlerTimeoutMs = boundedInteger(
    "billing.usage_worker_timeout_invalid",
    input.handlerTimeoutMs,
    DEFAULT_HANDLER_TIMEOUT_MS,
    MIN_HANDLER_TIMEOUT_MS,
    leaseMs - LEASE_SETTLEMENT_BUDGET_MS,
  );
  const maxAttempts = boundedInteger(
    "billing.usage_worker_attempts_invalid",
    input.maxAttempts,
    DEFAULT_MAX_ATTEMPTS,
    1,
    MAX_ATTEMPTS,
  );
  const result = {
    claimed: 0,
    sent: 0,
    ignored: 0,
    retried: 0,
    deadLettered: 0,
    leaseLost: 0,
    expiredDeadLettered: 0,
  };
  const seenIds = new Set<string>();
  const seenIdempotencyKeys = new Set<string>();

  while (result.claimed < limit) {
    const claimLimit = Math.min(concurrency, limit - result.claimed);
    const batch = await input.store.claimBatch({
      now: clock(),
      limit: claimLimit,
      leaseMs,
      maxAttempts,
    });
    if (batch.claims.length > claimLimit) {
      throw new Error("billing.usage_worker_claim_limit_exceeded");
    }
    result.expiredDeadLettered += batch.expiredDeadLettered;
    result.deadLettered += batch.expiredDeadLettered;
    if (batch.claims.length === 0) break;

    for (const claim of batch.claims) {
      assertClaimNotSeen(claim, seenIds, seenIdempotencyKeys);
      result.claimed += 1;
    }

    await Promise.all(
      batch.claims.map(async (claim) => {
        const handled = await runClaimHandler(
          input.handler,
          claim,
          handlerTimeoutMs,
        );
        if (handled.ok) {
          const completed = await input.store.complete({
            claim,
            completedAt: clock(),
            outcome: handled.outcome,
          });
          if (!completed) result.leaseLost += 1;
          else if (handled.outcome === "sent") result.sent += 1;
          else result.ignored += 1;
          return;
        }

        const failedAt = clock();
        const retryAt =
          handled.failure.retryable && claim.attempt < maxAttempts
            ? new Date(
                failedAt.getTime() +
                  usageDeliveryRetryDelayMs(
                    claim.attempt,
                    claim.idempotencyKey,
                  ),
              )
            : null;
        const disposition = await input.store.fail({
          claim,
          failedAt,
          errorCode: handled.failure.code,
          retryAt,
        });
        if (disposition === "retry") result.retried += 1;
        else if (disposition === "dead-letter") result.deadLettered += 1;
        else result.leaseLost += 1;
      }),
    );
  }

  return result;
}

export function usageDeliveryRetryDelayMs(
  attempt: number,
  idempotencyKey: string,
) {
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new Error("billing.usage_worker_attempt_invalid");
  }
  const exponent = Math.min(attempt - 1, 8);
  const cap = Math.min(RETRY_BASE_MS * 2 ** exponent, RETRY_MAX_MS);
  const floor = Math.max(1_000, Math.floor(cap / 2));
  const span = cap - floor + 1;
  return floor + (stableHash(`${idempotencyKey}:${attempt}`) % span);
}

export function assertUsageDeliveryClaim(
  claim: UsageDeliveryClaim,
): asserts claim is UsageDeliveryClaim & { metricKey: LagoBillableMetricKey } {
  if (!claim.id.trim() || !claim.leaseToken.trim()) {
    throw new UsageDeliveryWorkerFailure(
      "billing.usage_claim_lease_invalid",
      false,
    );
  }
  if (
    !claim.idempotencyKey.trim() ||
    claim.idempotencyKey.length > 200 ||
    claim.idempotencyKey !== claim.idempotencyKey.trim()
  ) {
    throw new UsageDeliveryWorkerFailure(
      "billing.usage_claim_idempotency_invalid",
      false,
    );
  }
  if (
    !(LAGO_BILLABLE_METRIC_KEYS as readonly string[]).includes(claim.metricKey)
  ) {
    throw new UsageDeliveryWorkerFailure(
      "billing.usage_claim_metric_invalid",
      false,
    );
  }
  if (
    !Number.isInteger(claim.quantity) ||
    claim.quantity < 1 ||
    claim.quantity > 2_147_483_647
  ) {
    throw new UsageDeliveryWorkerFailure(
      "billing.usage_claim_quantity_invalid",
      false,
    );
  }
  if (
    !(claim.occurredAt instanceof Date) ||
    Number.isNaN(claim.occurredAt.getTime()) ||
    !Number.isInteger(claim.attempt) ||
    claim.attempt < 1
  ) {
    throw new UsageDeliveryWorkerFailure(
      "billing.usage_claim_envelope_invalid",
      false,
    );
  }
  if (!claim.userId && !claim.subscriptionId && !claim.billingCustomerId) {
    throw new UsageDeliveryWorkerFailure(
      "billing.usage_claim_context_missing",
      false,
    );
  }
}

async function runClaimHandler(
  handler: UsageDeliveryHandler,
  claim: UsageDeliveryClaim,
  timeoutMs: number,
) {
  try {
    assertUsageDeliveryClaim(claim);
    return {
      ok: true as const,
      outcome: await runWithDeadline(handler, claim, timeoutMs),
    };
  } catch (error) {
    return { ok: false as const, failure: workerFailure(error) };
  }
}

async function runWithDeadline(
  handler: UsageDeliveryHandler,
  claim: UsageDeliveryClaim,
  timeoutMs: number,
) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new UsageDeliveryWorkerFailure("billing.usage_handler_timeout"));
    }, timeoutMs);
  });

  try {
    return await Promise.race([handler(claim, controller.signal), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function workerFailure(error: unknown) {
  if (error instanceof UsageDeliveryWorkerFailure) return error;
  return new UsageDeliveryWorkerFailure("billing.usage_handler_failed");
}

function boundedInteger(
  code: string,
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const resolved = value ?? fallback;
  if (
    !Number.isInteger(resolved) ||
    resolved < minimum ||
    resolved > maximum
  ) {
    throw new Error(code);
  }
  return resolved;
}

function normalizedWorkerErrorCode(code: string) {
  const normalized = code.trim().toLowerCase();
  if (!/^billing\.usage_[a-z0-9_.-]{1,72}$/.test(normalized)) {
    return "billing.usage_handler_failed";
  }
  return normalized;
}

function assertClaimNotSeen(
  claim: UsageDeliveryClaim,
  ids: Set<string>,
  idempotencyKeys: Set<string>,
) {
  if (ids.has(claim.id) || idempotencyKeys.has(claim.idempotencyKey)) {
    throw new Error("billing.usage_worker_duplicate_claim");
  }
  ids.add(claim.id);
  idempotencyKeys.add(claim.idempotencyKey);
}

function stableHash(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}
