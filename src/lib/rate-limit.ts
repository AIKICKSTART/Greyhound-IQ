import { withDbSystemContext } from "@/lib/db-context";
import { logError } from "@/lib/logger";

type RateLimitResult = { allowed: boolean; remaining: number; resetAt: number };

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  opts?: { failClosed?: boolean }
): Promise<RateLimitResult> {
  const normalizedKey = key.trim();
  if (!normalizedKey) throw new Error("rate_limit.key_required");
  if (!Number.isInteger(limit) || limit < 1) throw new Error("rate_limit.limit_invalid");
  if (!Number.isInteger(windowMs) || windowMs < 1) {
    throw new Error("rate_limit.window_invalid");
  }

  const windowSeconds = windowMs / 1000;

  try {
    const rows = await withDbSystemContext(
      (tx) => tx.$queryRaw<Array<{ count: number; resetAt: Date }>>`
        INSERT INTO "RateLimit" ("key","count","resetAt")
        VALUES (${normalizedKey}, 1, now() + make_interval(secs => ${windowSeconds}))
        ON CONFLICT ("key") DO UPDATE SET
          "count" = CASE WHEN "RateLimit"."resetAt" <= now() THEN 1 ELSE "RateLimit"."count" + 1 END,
          "resetAt" = CASE WHEN "RateLimit"."resetAt" <= now() THEN now() + make_interval(secs => ${windowSeconds}) ELSE "RateLimit"."resetAt" END
        RETURNING "count", "resetAt"
      `
    );

    const row = rows[0];
    if (!row) {
      // Dev DB stub returns no rows; fall back to per-process memory.
      return checkRateLimitInMemory(normalizedKey, limit, windowMs);
    }

    return {
      allowed: row.count <= limit,
      remaining: Math.max(0, limit - row.count),
      resetAt: row.resetAt.getTime(),
    };
  } catch (err) {
    logError("rate_limit.db_error", { key: normalizedKey }, err);
    // Security-sensitive keys (auth, credential, abuse-critical) opt in to
    // failing closed; a DB outage must not disable those limits.
    if (opts?.failClosed) {
      return { allowed: false, remaining: 0, resetAt: Date.now() + windowMs };
    }
    // ponytail: fail open on DB error — the limiter must never become an outage mode.
    return { allowed: true, remaining: limit, resetAt: Date.now() + windowMs };
  }
}

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitEntries = new Map<string, RateLimitEntry>();

function checkRateLimitInMemory(
  normalizedKey: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  pruneExpiredEntries(now);

  const existing = rateLimitEntries.get(normalizedKey);
  const entry =
    existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + windowMs };

  entry.count += 1;
  rateLimitEntries.set(normalizedKey, entry);

  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  };
}

function pruneExpiredEntries(now: number) {
  for (const [key, entry] of rateLimitEntries) {
    if (entry.resetAt <= now) rateLimitEntries.delete(key);
  }
}
