import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

export type DbContextClient = Prisma.TransactionClient;

export type DbContextUserInput = {
  dbUserId?: string | null;
  profileId?: string | null;
  tier?: string | null;
  profileRole?: string | null;
  role?: string | null;
};

export type DbContextUser = {
  dbUserId: string;
  profileId: string;
  tier: string;
  profileRole: string;
};

const DB_CONTEXT_TRANSACTION_TIMEOUT_MS = 30_000;
const DB_CONTEXT_TRANSACTION_MAX_WAIT_MS = 30_000;

export async function withDbRequestContext<T>(
  current: DbContextUserInput,
  fn: (tx: DbContextClient) => Promise<T>
): Promise<T> {
  const context = resolveDbContextUser(current);
  if (!context) throw new Error("auth.profile_required");

  return prisma.$transaction(
    async (tx) => {
      await setDbRequestContext(tx, context);
      return fn(tx);
    },
    {
      maxWait: DB_CONTEXT_TRANSACTION_MAX_WAIT_MS,
      timeout: DB_CONTEXT_TRANSACTION_TIMEOUT_MS,
    }
  );
}

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

export function resolveDbContextUser(
  current: DbContextUserInput | null | undefined
): DbContextUser | null {
  if (!current?.dbUserId || !current.profileId) return null;

  return {
    dbUserId: current.dbUserId,
    profileId: current.profileId,
    tier: current.tier ?? "free",
    profileRole: current.profileRole ?? current.role ?? "member",
  };
}

export async function setDbRequestContext(
  tx: DbContextClient,
  current: DbContextUser
) {
  await setLocal(tx, "app.current_user_id", current.dbUserId);
  await setLocal(tx, "app.current_profile_id", current.profileId);
  await setLocal(tx, "app.current_tier", current.tier);
  await setLocal(tx, "app.current_role", current.profileRole);
  await setLocal(tx, "app.system", "false");
}

export async function setDbSystemContext(tx: DbContextClient) {
  await setLocal(tx, "app.system", "true");
  await setLocal(tx, "app.current_tier", "system");
  await setLocal(tx, "app.current_role", "system");
}

function setLocal(tx: DbContextClient, key: string, value: string) {
  return tx.$executeRaw`SELECT set_config(${key}, ${value}, true)`;
}
