import "server-only";
import { waitUntil } from "@vercel/functions";
import { getRedis, cacheGet, cacheSet } from "@/lib/redis";
import { supabaseAdmin } from "@/lib/supabase/server";
import { quotaKey } from "@/lib/plans";
import type { ApiKeyRecord, AuthDeps, UsageEntry } from "@/lib/api/with-api-auth";
import { rateLimitFor } from "@/lib/ratelimit";

const KEY_CACHE_TTL = 60;
const QUOTA_TTL = 40 * 24 * 60 * 60;

export function apiKeyCacheKey(hash: string): string {
  return `apikey:${hash}`;
}

async function findKey(hash: string): Promise<ApiKeyRecord | null> {
  const cacheKey = apiKeyCacheKey(hash);
  const cached = await cacheGet<ApiKeyRecord | { missing: true }>(cacheKey);
  if (cached) return "missing" in cached ? null : cached;

  const { data, error } = await supabaseAdmin()
    .from("api_keys")
    .select("id, user_id, type, allowed_origins, revoked_at, profiles!inner(plan)")
    .eq("key_hash", hash)
    .maybeSingle();
  if (error) throw new Error("api_key_lookup_failed");
  if (!data) {
    await cacheSet(cacheKey, { missing: true }, KEY_CACHE_TTL);
    return null;
  }
  const profile = (Array.isArray(data.profiles) ? data.profiles[0] : data.profiles) as { plan?: string } | null;
  const record: ApiKeyRecord = {
    id: data.id as string,
    user_id: data.user_id as string,
    type: data.type === "publishable" ? "publishable" : "secret",
    allowed_origins: (data.allowed_origins as string[] | null) ?? [],
    revoked: data.revoked_at !== null,
    plan: profile?.plan === "pro" ? "pro" : "free",
  };
  await cacheSet(cacheKey, record, KEY_CACHE_TTL);
  return record;
}

export async function incrementQuota(userId: string, monthlyLimit: number) {
  const redis = getRedis();
  const key = quotaKey(userId);
  const used = await redis.incr(key);
  if (used === 1) await redis.expire(key, QUOTA_TTL);
  if (used > monthlyLimit) {
    await redis.decr(key);
    return { allowed: false, used: used - 1 };
  }
  return { allowed: true, used };
}

export async function logUsage(entry: UsageEntry): Promise<void> {
  const db = supabaseAdmin();
  await db.from("usage_logs").insert(entry);
  if (entry.api_key_id) {
    // Update last_used_at at most once per minute per key.
    const first = await getRedis().set(`lastused:${entry.api_key_id}`, "1", { nx: true, ex: 60 });
    if (first !== null) {
      await db.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", entry.api_key_id);
    }
  }
}

export function defaultAuthDeps(): AuthDeps {
  return {
    findKey,
    rateLimit: (identifier, limit) => rateLimitFor(limit, "1 m").limit(identifier),
    incrementQuota,
    logUsage,
    waitUntil: (p) => waitUntil(p),
  };
}

