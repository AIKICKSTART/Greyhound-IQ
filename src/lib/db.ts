import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ponytail: wraps a query so a DB connection failure renders an empty state
// instead of a 500. Real fix = correct DATABASE_URL in .env. Always logs so
// connection issues surface in production logs (Sentry / Vercel / etc).
export async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error("[safeQuery] DB error, returning fallback:", err);
    return fallback;
  }
}
