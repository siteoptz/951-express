// Simple in-memory fixed-window limiter, keyed per client. Per server instance only: it blunts casual abuse,
// it is not a distributed limit. TODO: move to a shared store if abuse shows up.
export type RateLimiter = {
  check: (key: string, now?: number) => { ok: boolean; retryAfterSeconds: number };
};

export function createRateLimiter({
  limit,
  windowMs,
  maxKeys = 5000,
}: {
  limit: number;
  windowMs: number;
  maxKeys?: number;
}): RateLimiter {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return {
    check(key, now = Date.now()) {
      if (hits.size > maxKeys) {
        for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
        if (hits.size > maxKeys) hits.clear();
      }
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= now) {
        hits.set(key, { count: 1, resetAt: now + windowMs });
        return { ok: true, retryAfterSeconds: 0 };
      }
      entry.count++;
      return entry.count <= limit
        ? { ok: true, retryAfterSeconds: 0 }
        : { ok: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
    },
  };
}

/** First address in x-forwarded-for, else x-real-ip, else a shared bucket. */
export function clientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown'
  );
}
