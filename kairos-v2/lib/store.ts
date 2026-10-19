import "server-only";
import { Redis } from "@upstash/redis";

/**
 * Tiny key-value store used for locks, de-duplication and counters.
 * Backed by Upstash Redis when configured (shared across all serverless
 * instances); otherwise an in-memory map that only protects a single instance.
 */
export interface Store {
  /** Sets `key` only if it does not exist. Returns true if this call set it. */
  setOnce(key: string, value: string, ttlSeconds: number): Promise<boolean>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<void>;
  /** Increments a counter, setting its TTL on first use. Returns the new value. */
  incr(key: string, ttlSeconds: number): Promise<number>;
  readonly shared: boolean;
}

export function createMemoryStore(now = Date.now): Store {
  const data = new Map<string, { value: string; expires: number }>();
  const live = (key: string) => {
    const hit = data.get(key);
    if (hit && hit.expires <= now()) {
      data.delete(key);
      return undefined;
    }
    return hit;
  };
  return {
    shared: false,
    async setOnce(key, value, ttl) {
      if (live(key)) return false;
      data.set(key, { value, expires: now() + ttl * 1000 });
      return true;
    },
    async get(key) {
      return live(key)?.value ?? null;
    },
    async del(key) {
      data.delete(key);
    },
    async incr(key, ttl) {
      const hit = live(key);
      const next = (hit ? Number(hit.value) : 0) + 1;
      data.set(key, { value: String(next), expires: hit?.expires ?? now() + ttl * 1000 });
      return next;
    },
  };
}

function createRedisStore(redis: Redis): Store {
  return {
    shared: true,
    async setOnce(key, value, ttl) {
      return (await redis.set(key, value, { nx: true, ex: ttl })) === "OK";
    },
    async get(key) {
      const v = await redis.get<string>(key);
      return v == null ? null : String(v);
    },
    async del(key) {
      await redis.del(key);
    },
    async incr(key, ttl) {
      const n = await redis.incr(key);
      if (n === 1) await redis.expire(key, ttl);
      return n;
    },
  };
}

let store: Store | undefined;

/** Accepts both the Upstash names and the KV_* names Vercel's integration sets. */
export function getStore(): Store {
  if (store) return store;
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  store = url && token ? createRedisStore(new Redis({ url, token })) : createMemoryStore();
  return store;
}

/** For tests. */
export function setStore(s: Store | undefined) {
  store = s;
}
