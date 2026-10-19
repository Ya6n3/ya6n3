import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// 5 submissions per IP per 10 minutes.
export const LIMIT = 5;
export const WINDOW_MS = 10 * 60 * 1000;

export interface Limiter {
  /** Records one hit for `key` and returns true if it is over the limit. */
  isLimited(key: string): Promise<boolean>;
}

/**
 * In-memory sliding window. Per server instance, reset on every deploy or cold
 * start, so on Vercel it is only a fallback for local dev or a Redis outage.
 */
export function createMemoryLimiter(limit = LIMIT, windowMs = WINDOW_MS, now = Date.now): Limiter {
  const hits = new Map<string, number[]>();
  return {
    async isLimited(key) {
      const t = now();
      // Drop expired keys so the map can't grow without bound.
      if (hits.size > 10_000) {
        for (const [k, times] of hits) if (t - times[times.length - 1] >= windowMs) hits.delete(k);
      }
      const recent = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
      recent.push(t);
      hits.set(key, recent);
      return recent.length > limit;
    },
  };
}

/**
 * Shared sliding window in Upstash Redis, so the limit holds across all
 * serverless instances and deploys. It fails open: if Redis takes longer than
 * 2s the request is allowed, and if Redis throws, the in-memory limiter is used,
 * so an Upstash outage never blocks real members.
 */
function createRedisLimiter(url: string, token: string): Limiter {
  const ratelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(LIMIT, "10 m"),
    prefix: "kairos:intake",
    timeout: 2000,
  });
  const fallback = createMemoryLimiter();
  return {
    async isLimited(key) {
      try {
        const { success } = await ratelimit.limit(key);
        return !success;
      } catch (err) {
        console.error("Rate limit: Redis unavailable, using in-memory fallback", err);
        return fallback.isLimited(key);
      }
    },
  };
}

let limiter: Limiter | undefined;

/**
 * Picks the limiter from the environment. Accepts both the Upstash names and
 * the KV_* names that Vercel's Upstash integration sets.
 */
export function getLimiter(): Limiter {
  if (limiter) return limiter;
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (url && token) {
    limiter = createRedisLimiter(url, token);
  } else {
    if (process.env.NODE_ENV === "production") {
      console.warn("Rate limit: no Upstash Redis configured, using per-instance in-memory limit.");
    }
    limiter = createMemoryLimiter();
  }
  return limiter;
}

/** Client IP as set by the hosting proxy (Vercel sets both headers). */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-real-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
