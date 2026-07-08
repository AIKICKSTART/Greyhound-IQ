import { PrismaClient } from "@prisma/client";

import {
  databaseUrlConfigurationError,
  runtimeDatabaseUrl,
} from "@/lib/database-url";
import { logError, logWarn } from "@/lib/logger";

// Slow-query threshold. Above this a single WARNING line is emitted per query so
// pathological queries surface in Cloud Logging without flooding it.
const SLOW_QUERY_MS = 500;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prismaConfigurationError = databaseConfigurationError();

function makePrisma(): PrismaClient | null {
  if (prismaConfigurationError) return null;
  try {
    const client = new PrismaClient({
      datasources: {
        db: {
          url: runtimeDatabaseUrl(process.env.DATABASE_URL ?? ""),
        },
      },
    });
    // $extends returns a structurally-wider client; callers only use the
    // PrismaClient surface, so cast back for the existing export contract.
    return client.$extends(slowQueryLogger) as unknown as PrismaClient;
  } catch {
    return null;
  }
}

const slowQueryLogger = {
  query: {
    async $allOperations({
      model,
      operation,
      args,
      query,
    }: {
      model?: string;
      operation: string;
      args: unknown;
      query: (args: unknown) => Promise<unknown>;
    }) {
      const start = performance.now();
      try {
        return await query(args);
      } finally {
        const durationMs = Math.round(performance.now() - start);
        if (durationMs > SLOW_QUERY_MS) {
          logWarn("db.slow_query", {
            model: model ?? "raw",
            operation,
            durationMs,
          });
        }
      }
    },
  },
} as const;

export function databaseConfigurationError() {
  const error = databaseUrlConfigurationError(process.env.DATABASE_URL, {
    production: process.env.NODE_ENV === "production",
    required: process.env.NODE_ENV === "production",
  });

  return error ? `DATABASE_URL ${error}.` : null;
}

const realPrisma = globalForPrisma.prisma ?? makePrisma();

if (realPrisma && process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = realPrisma;
}

// ponytail: development-only no-op DB so local UI can render before env setup.
// Production fails fast above; this must never be the live source of truth.
const stub = new Proxy({} as PrismaClient, {
  get: (_target, model) => {
    if (typeof model === "string" && model.startsWith("$")) {
      return () =>
        prismaConfigurationError
          ? Promise.reject(new Error(prismaConfigurationError))
          : Promise.resolve(model === "$executeRaw" ? 0 : []);
    }
    return new Proxy({}, {
      get: (_t, method) => {
        if (prismaConfigurationError) {
          return () => Promise.reject(new Error(prismaConfigurationError));
        }
        // findUnique / findFirst → return null
        if (method === "findUnique" || method === "findFirst") {
          return () => Promise.resolve(null);
        }
        // findMany / groupBy / aggregate → return empty array
        if (
          method === "findMany" ||
          method === "groupBy" ||
          method === "aggregate"
        ) {
          return () => Promise.resolve([]);
        }
        // count → 0
        if (method === "count") {
          return () => Promise.resolve(0);
        }
        // create / update / delete / upsert → no-op stub
        return () => Promise.resolve({});
      },
    });
  },
});

export const prisma: PrismaClient = (realPrisma as PrismaClient) ?? (stub as PrismaClient);

function summarizeDatabaseError(err: unknown) {
  const maybeRecord = err && typeof err === "object" ? err as Record<string, unknown> : null;
  const name = err instanceof Error ? err.name : "DatabaseError";
  const code = typeof maybeRecord?.code === "string" ? maybeRecord.code : null;
  const rawMessage = err instanceof Error ? err.message : String(err);

  if (code === "P2024" || /connection pool|Timed out fetching a new connection/i.test(rawMessage)) {
    return `${name}: connection pool timeout${code ? ` (${code})` : ""}`;
  }
  if (code === "P1001" || /can't reach database server|database server/i.test(rawMessage)) {
    return `${name}: database unreachable${code ? ` (${code})` : ""}`;
  }
  if (/57014|statement timeout|canceling statement due to statement timeout/i.test(rawMessage)) {
    return `${name}: statement timeout (Postgres 57014)`;
  }

  const message = rawMessage.replace(/\s+/g, " ").trim();
  const shortMessage = message.length > 360 ? `${message.slice(0, 360)}...` : message;

  return code ? `${name} ${code}: ${shortMessage}` : `${name}: ${shortMessage}`;
}

// ponytail: development-only graceful query wrapper. Production must fail closed
// so source-of-truth database problems cannot render as empty or stale states.
export async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (process.env.NODE_ENV === "production" && prismaConfigurationError) {
    throw new Error(prismaConfigurationError);
  }

  try {
    return await fn();
  } catch (err) {
    if (process.env.NODE_ENV === "production") {
      // Summarized only: raw Prisma errors can embed connection strings.
      logError("db.safe_query_failed", {
        summary: `DB error, failing closed: ${summarizeDatabaseError(err)}`,
      });
      throw err;
    }
    return fallback;
  }
}
