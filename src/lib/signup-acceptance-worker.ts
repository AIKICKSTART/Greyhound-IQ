import { signupAcceptanceIdempotencyKey } from "./signup-acceptance";

const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 25;
const DEFAULT_LEASE_MS = 60_000;
const MIN_LEASE_MS = 15_000;
const MAX_LEASE_MS = 300_000;
const LEASE_SETTLEMENT_BUDGET_MS = 10_000;
const DEFAULT_HANDLER_TIMEOUT_MS = 45_000;
const MIN_HANDLER_TIMEOUT_MS = 10;
const DEFAULT_MAX_ATTEMPTS = 5;
const MAX_ATTEMPTS = 10;
const RETRY_BASE_MS = 5_000;
const RETRY_MAX_MS = 900_000;

export type SignupAcceptanceClaim = Readonly<{
  id: string;
  userId: string;
  idempotencyKey: string;
  correlationId: string | null;
  attempt: number;
  leaseToken: string;
  leaseExpiresAt: Date;
}>;

export type SignupAcceptanceWorkItem = Readonly<{
  userId: string;
  idempotencyKey: string;
  correlationId: string | null;
  attempt: number;
}>;

export type SignupAcceptanceClaimBatch = Readonly<{
  claims: readonly SignupAcceptanceClaim[];
  expiredDeadLettered: number;
}>;

export type SignupAcceptanceFailureResult =
  | "retry"
  | "dead-letter"
  | "lease-lost";

export interface SignupAcceptanceWorkerStore {
  claimBatch(input: {
    now: Date;
    limit: number;
    leaseMs: number;
    maxAttempts: number;
  }): Promise<SignupAcceptanceClaimBatch>;
  complete(claim: SignupAcceptanceClaim, completedAt: Date): Promise<boolean>;
  fail(input: {
    claim: SignupAcceptanceClaim;
    failedAt: Date;
    errorCode: string;
    retryAt: Date | null;
  }): Promise<SignupAcceptanceFailureResult>;
}

export type SignupAcceptanceHandler = (
  item: SignupAcceptanceWorkItem,
  signal: AbortSignal,
) => Promise<void>;

export type SignupAcceptanceWorkerResult = Readonly<{
  claimed: number;
  completed: number;
  retried: number;
  deadLettered: number;
  leaseLost: number;
  expiredDeadLettered: number;
}>;

export class SignupAcceptanceWorkerFailure extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, retryable = true) {
    const normalizedCode = normalizedWorkerErrorCode(code);
    super(normalizedCode);
    this.name = "SignupAcceptanceWorkerFailure";
    this.code = normalizedCode;
    this.retryable = retryable;
  }
}

export async function processSignupAcceptanceBatch(input: {
  store: SignupAcceptanceWorkerStore;
  handler: SignupAcceptanceHandler;
  clock?: () => Date;
  limit?: number;
  leaseMs?: number;
  handlerTimeoutMs?: number;
  maxAttempts?: number;
}): Promise<SignupAcceptanceWorkerResult> {
  const clock = input.clock ?? (() => new Date());
  const limit = boundedInteger(
    "signup.worker_limit",
    input.limit,
    DEFAULT_BATCH_SIZE,
    1,
    MAX_BATCH_SIZE,
  );
  const leaseMs = boundedInteger(
    "signup.worker_lease_ms",
    input.leaseMs,
    DEFAULT_LEASE_MS,
    MIN_LEASE_MS,
    MAX_LEASE_MS,
  );
  const handlerTimeoutMs = boundedInteger(
    "signup.worker_handler_timeout_ms",
    input.handlerTimeoutMs,
    DEFAULT_HANDLER_TIMEOUT_MS,
    MIN_HANDLER_TIMEOUT_MS,
    leaseMs - LEASE_SETTLEMENT_BUDGET_MS,
  );
  const maxAttempts = boundedInteger(
    "signup.worker_max_attempts",
    input.maxAttempts,
    DEFAULT_MAX_ATTEMPTS,
    1,
    MAX_ATTEMPTS,
  );

  const result = {
    claimed: 0,
    completed: 0,
    retried: 0,
    deadLettered: 0,
    leaseLost: 0,
    expiredDeadLettered: 0,
  };
  const seenIds = new Set<string>();
  const seenIdempotencyKeys = new Set<string>();

  // Claim immediately before handling each item. This avoids acquiring a batch
  // of leases that could expire while earlier items are still running and caps
  // downstream concurrency at one per worker invocation.
  for (let index = 0; index < limit; index += 1) {
    const batch = await input.store.claimBatch({
      now: clock(),
      limit: 1,
      leaseMs,
      maxAttempts,
    });
    result.expiredDeadLettered += batch.expiredDeadLettered;
    result.deadLettered += batch.expiredDeadLettered;
    if (batch.claims.length === 0) break;
    if (batch.claims.length !== 1) {
      throw new Error("signup.worker_claim_limit_exceeded");
    }

    const claim = batch.claims[0];
    assertClaimNotSeen(claim, seenIds, seenIdempotencyKeys);
    result.claimed += 1;
    const failure = await runClaimHandler(
      input.handler,
      claim,
      handlerTimeoutMs,
    );

    if (!failure) {
      const completed = await input.store.complete(claim, clock());
      if (completed) result.completed += 1;
      else result.leaseLost += 1;
      continue;
    }

    const failedAt = clock();
    const retryAt =
      failure.retryable && claim.attempt < maxAttempts
        ? new Date(
            failedAt.getTime() +
              signupAcceptanceRetryDelayMs(
                claim.attempt,
                claim.idempotencyKey,
              ),
          )
        : null;
    const disposition = await input.store.fail({
      claim,
      failedAt,
      errorCode: failure.code,
      retryAt,
    });
    if (disposition === "retry") result.retried += 1;
    else if (disposition === "dead-letter") result.deadLettered += 1;
    else result.leaseLost += 1;
  }

  return result;
}

export function signupAcceptanceRetryDelayMs(
  attempt: number,
  idempotencyKey: string,
) {
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new Error("signup.worker_attempt_invalid");
  }
  const exponent = Math.min(attempt - 1, 8);
  const cap = Math.min(RETRY_BASE_MS * 2 ** exponent, RETRY_MAX_MS);
  const floor = Math.max(1_000, Math.floor(cap / 2));
  const span = cap - floor + 1;
  return floor + (stableHash(`${idempotencyKey}:${attempt}`) % span);
}

async function runClaimHandler(
  handler: SignupAcceptanceHandler,
  claim: SignupAcceptanceClaim,
  timeoutMs: number,
) {
  try {
    validateClaim(claim);
    await runWithDeadline(
      handler,
      {
        userId: claim.userId,
        idempotencyKey: claim.idempotencyKey,
        correlationId: claim.correlationId,
        attempt: claim.attempt,
      },
      timeoutMs,
    );
    return null;
  } catch (error) {
    return workerFailure(error);
  }
}

function validateClaim(claim: SignupAcceptanceClaim) {
  if (claim.idempotencyKey !== signupAcceptanceIdempotencyKey(claim.userId)) {
    throw new SignupAcceptanceWorkerFailure(
      "signup.claim_idempotency_invalid",
      false,
    );
  }
  if (!Number.isInteger(claim.attempt) || claim.attempt < 1) {
    throw new SignupAcceptanceWorkerFailure("signup.claim_attempt_invalid", false);
  }
  if (!claim.leaseToken.trim()) {
    throw new SignupAcceptanceWorkerFailure("signup.claim_lease_invalid", false);
  }
}

async function runWithDeadline(
  handler: SignupAcceptanceHandler,
  item: SignupAcceptanceWorkItem,
  timeoutMs: number,
) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new SignupAcceptanceWorkerFailure("signup.handler_timeout"));
      controller.abort();
    }, timeoutMs);
  });

  try {
    await Promise.race([handler(item, controller.signal), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function workerFailure(error: unknown) {
  if (error instanceof SignupAcceptanceWorkerFailure) return error;
  return new SignupAcceptanceWorkerFailure("signup.handler_failed");
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
  if (!/^signup\.[a-z0-9_.-]{1,72}$/.test(normalized)) {
    return "signup.handler_failed";
  }
  return normalized;
}

function assertClaimNotSeen(
  claim: SignupAcceptanceClaim,
  ids: Set<string>,
  idempotencyKeys: Set<string>,
) {
  if (ids.has(claim.id) || idempotencyKeys.has(claim.idempotencyKey)) {
    throw new Error("signup.worker_duplicate_claim");
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
