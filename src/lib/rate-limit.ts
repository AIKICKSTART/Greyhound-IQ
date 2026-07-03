type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitEntries = new Map<string, RateLimitEntry>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const normalizedKey = key.trim();
  if (!normalizedKey) throw new Error("rate_limit.key_required");
  if (!Number.isInteger(limit) || limit < 1) throw new Error("rate_limit.limit_invalid");
  if (!Number.isInteger(windowMs) || windowMs < 1) {
    throw new Error("rate_limit.window_invalid");
  }

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
