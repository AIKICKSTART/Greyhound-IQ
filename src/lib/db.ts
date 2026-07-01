import { PrismaClient } from "@prisma/client";

import { runtimeDatabaseUrl } from "@/lib/database-url";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// ponytail: only construct PrismaClient when the URL is a valid Postgres URL.
// If the URL is wrong/missing/SQLite/etc, the app boots with a no-op stub so
// pages render empty states instead of 500s. Real fix = correct DATABASE_URL
// in .env. This keeps dev experience clean even before the DB is configured.
function makePrisma(): PrismaClient | null {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
    return null;
  }
  try {
    return new PrismaClient({
      datasources: {
        db: {
          url: runtimeDatabaseUrl(url),
        },
      },
    });
  } catch {
    return null;
  }
}

const realPrisma = globalForPrisma.prisma ?? makePrisma();

if (realPrisma && process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = realPrisma;
}

// Stub that returns empty results for every model call. Lets the app render
// without a DB; queries will still surface in error logs.
const stub = new Proxy({} as PrismaClient, {
  get: () => {
    return new Proxy({}, {
      get: (_t, method) => {
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

// ponytail: wraps a query so a DB connection failure renders an empty state
// instead of a 500. Production logs keep connection issues visible; development
// stays quiet so expected DB fallbacks do not trip the Next.js console overlay.
export async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (process.env.NODE_ENV === "production") {
      const message = `[safeQuery] DB error, returning fallback: ${summarizeDatabaseError(err)}`;
      console.error(message);
    }
    return fallback;
  }
}
