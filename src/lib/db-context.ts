import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

export type DbContextClient = Prisma.TransactionClient;

export type DbContextUser = {
  dbUserId: string;
  profileId: string;
  profileRole: string;
  tier: string;
};

const DB_CONTEXT_TRANSACTION_TIMEOUT_MS = 30_000;
const DB_CONTEXT_TRANSACTION_MAX_WAIT_MS = 30_000;

export type DbContextTransactionOptions = {
  maxWait?: number;
  timeout?: number;
};

export type DbQueryDeadlineOptions = {
  maxWait?: number;
  statementTimeoutMilliseconds: number;
  transactionTimeoutMilliseconds: number;
};

export async function withDbRequestContext<T>(
  current: DbContextUser,
  fn: (tx: DbContextClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await setDbRequestContext(tx, current);
      return fn(tx);
    },
    {
      maxWait: DB_CONTEXT_TRANSACTION_MAX_WAIT_MS,
      timeout: DB_CONTEXT_TRANSACTION_TIMEOUT_MS,
    },
  );
}

export async function withDbSystemContext<T>(
  fn: (tx: DbContextClient) => Promise<T>,
  options?: DbContextTransactionOptions,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await setDbSystemContext(tx);
      return fn(tx);
    },
    {
      maxWait: options?.maxWait ?? DB_CONTEXT_TRANSACTION_MAX_WAIT_MS,
      timeout: options?.timeout ?? DB_CONTEXT_TRANSACTION_TIMEOUT_MS,
    },
  );
}

export async function withDbAnonymousContext<T>(
  fn: (tx: DbContextClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await setDbAnonymousContext(tx);
      return fn(tx);
    },
    {
      maxWait: DB_CONTEXT_TRANSACTION_MAX_WAIT_MS,
      timeout: DB_CONTEXT_TRANSACTION_TIMEOUT_MS,
    },
  );
}

export async function withDbAnonymousQueryDeadline<T>(
  fn: (tx: DbContextClient) => Promise<T>,
  options: DbQueryDeadlineOptions,
): Promise<T> {
  assertDbQueryDeadlineOptions(options);
  return prisma.$transaction(
    async (tx) => {
      await setDbAnonymousContext(tx);
      await tx.$executeRaw`SELECT set_config('statement_timeout', ${`${options.statementTimeoutMilliseconds}ms`}, true)`;
      return fn(tx);
    },
    {
      maxWait: options.maxWait ?? DB_CONTEXT_TRANSACTION_MAX_WAIT_MS,
      timeout: options.transactionTimeoutMilliseconds,
    },
  );
}

// Single round trip: every GUC in one statement. Latency here multiplies
// across all wrapped queries (notably the rate limiter on hot paths).
export async function setDbRequestContext(
  tx: DbContextClient,
  current: DbContextUser,
) {
  await tx.$executeRaw`SELECT
    set_config('app.current_user_id', ${current.dbUserId}, true),
    set_config('app.current_profile_id', ${current.profileId}, true),
    set_config('app.current_actor_id', '', true),
    set_config('app.current_tier', ${current.tier}, true),
    set_config('app.current_role', ${current.profileRole}, true),
    set_config('app.system', 'false', true)`;
}

export async function setDbSystemContext(tx: DbContextClient) {
  await tx.$executeRaw`SELECT
    set_config('app.system', 'true', true),
    set_config('app.current_user_id', '', true),
    set_config('app.current_profile_id', '', true),
    set_config('app.current_actor_id', '', true),
    set_config('app.current_tier', 'system', true),
    set_config('app.current_role', 'system', true)`;
}

async function setDbAnonymousContext(tx: DbContextClient) {
  await tx.$executeRaw`SELECT
    set_config('app.current_user_id', '', true),
    set_config('app.current_profile_id', '', true),
    set_config('app.current_actor_id', '', true),
    set_config('app.current_tier', 'free', true),
    set_config('app.current_role', 'member', true),
    set_config('app.system', 'false', true)`;
}

function assertDbQueryDeadlineOptions(options: DbQueryDeadlineOptions) {
  if (
    !Number.isSafeInteger(options.statementTimeoutMilliseconds) ||
    options.statementTimeoutMilliseconds <= 0 ||
    !Number.isSafeInteger(options.transactionTimeoutMilliseconds) ||
    options.transactionTimeoutMilliseconds <=
      options.statementTimeoutMilliseconds ||
    (options.maxWait !== undefined &&
      (!Number.isSafeInteger(options.maxWait) || options.maxWait <= 0))
  ) {
    throw new Error("database.invalid_query_deadline");
  }
}
