// Simple in-memory sliding-window rate limiter. Fine for this app's deployment (one Node process
// under pm2 on a single VPS, not serverless/multi-instance) — a limiter like this resets on
// restart and doesn't share state across instances, which would be wrong for a multi-server or
// serverless deployment, but is a reasonable, zero-dependency choice at this scale.
//
// Used to slow down brute-force login attempts (see login()/adminLogin() in actions.ts) — layered
// on top of, not instead of, the Turnstile captcha already on both login forms.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** Returns true if this call is allowed, false if `key` has hit `max` attempts within `windowMs`. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    // Occasional lazy cleanup so the map doesn't grow unbounded over a long-running process.
    if (buckets.size > 5000) {
      for (const [k, b] of Array.from(buckets)) if (now > b.resetAt) buckets.delete(k);
    }
    return true;
  }

  if (bucket.count >= max) return false;
  bucket.count++;
  return true;
}
