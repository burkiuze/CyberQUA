import "server-only";
import { Redis } from "@upstash/redis";
import { serverEnv } from "@/lib/env";

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis({ url: serverEnv.redisUrl(), token: serverEnv.redisToken() });
  }
  return client;
}

/** Reads a JSON value from the cache. Cache failures are treated as a miss. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const value = await getRedis().get<T>(key);
    return value ?? null;
  } catch {
    return null;
  }
}

/** Writes a JSON value to the cache. Cache failures never break a request. */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await getRedis().set(key, value, { ex: ttlSeconds });
  } catch {
    // ignore cache write failures
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await getRedis().del(...keys);
  } catch {
    // ignore
  }
}
