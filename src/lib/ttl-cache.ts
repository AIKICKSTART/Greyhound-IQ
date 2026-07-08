import "server-only";

// ponytail: per-instance scope. Each Cloud Run instance keeps its own Map, so a
// cached count can lag up to `ttlMs` and differs between instances. Fine for
// hot aggregate counts (admin dashboard, unread badges); do NOT use where a
// stale read is incorrect (auth, entitlements, money).

type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

// Returns the cached value for `key`, or runs `fn`, caches it for `ttlMs`, and
// returns it. Concurrent callers for the same key share one in-flight promise.
export async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.value as T;
  }

  const pending = inflight.get(key);
  if (pending) {
    return pending as Promise<T>;
  }

  const promise = (async () => {
    try {
      const value = await fn();
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}
