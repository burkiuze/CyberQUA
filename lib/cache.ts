import "server-only";
import { rpc } from "@/lib/db";

/** Reads a JSON value from the cache. Cache failures are treated as a miss. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    return (await rpc<T | null>("cq_cache_get", { p_key: key })) ?? null;
  } catch {
    return null;
  }
}

/** Writes a JSON value to the cache. Cache failures never break a request. */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await rpc("cq_cache_set", { p_key: key, p_value: value, p_ttl_seconds: ttlSeconds });
  } catch {
    // ignore cache write failures
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await rpc("cq_cache_del", { p_keys: keys });
  } catch {
    // ignore
  }
}
