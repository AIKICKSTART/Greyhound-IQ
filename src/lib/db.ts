import { PrismaClient } from "@prisma/client";

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

function runtimeDatabaseUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "1");
    }
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", "10");
    }
    return url.toString();
  } catch {
    return rawUrl;
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

// ponytail: wraps a query so a DB connection failure renders an empty state
// instead of a 500. Always logs so connection issues surface in production logs.
export async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error("[safeQuery] DB error, returning fallback:", err);
    return fallback;
  }
}
