import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

export type DbContextClient = Prisma.TransactionClient;

const DB_CONTEXT_TRANSACTION_TIMEOUT_MS = 30_000;
const DB_CONTEXT_TRANSACTION_MAX_WAIT_MS = 30_000;

export async function withDbSystemContext<T>(
  fn: (tx: DbContextClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await setDbSystemContext(tx);
      return fn(tx);
    },
    {
      maxWait: DB_CONTEXT_TRANSACTION_MAX_WAIT_MS,
      timeout: DB_CONTEXT_TRANSACTION_TIMEOUT_MS,
    }
  );
}

export async function setDbSystemContext(tx: DbContextClient) {
  await setLocal(tx, "app.system", "true");
  await setLocal(tx, "app.current_tier", "system");
  await setLocal(tx, "app.current_role", "system");
}

function setLocal(tx: DbContextClient, key: string, value: string) {
  return tx.$executeRaw`SELECT set_config(${key}, ${value}, true)`;
}
