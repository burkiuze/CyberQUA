import "server-only";
import { waitUntil } from "@vercel/functions";
import { rpc } from "@/lib/db";
import { cacheGet, cacheSet } from "@/lib/cache";
import { rateLimit } from "@/lib/ratelimit";
import { currentMonth } from "@/lib/plans";
import type { ApiKeyRecord, AuthDeps, UsageEntry } from "@/lib/api/with-api-auth";

const KEY_CACHE_TTL = 60;

export function apiKeyCacheKey(hash: string): string {
  return `apikey:${hash}`;
}

async function findKey(hash: string): Promise<ApiKeyRecord | null> {
  const cacheKey = apiKeyCacheKey(hash);
  const cached = await cacheGet<ApiKeyRecord | { missing: true }>(cacheKey);
  if (cached) return "missing" in cached ? null : cached;

  const row = await rpc<{
    id: string;
    user_id: string;
    type: string;
    allowed_origins: string[] | null;
    revoked: boolean;
    plan: string;
  } | null>("cq_find_key", { p_hash: hash });
  if (!row) {
    await cacheSet(cacheKey, { missing: true }, KEY_CACHE_TTL);
    return null;
  }
  const record: ApiKeyRecord = {
    id: row.id,
    user_id: row.user_id,
    type: row.type === "publishable" ? "publishable" : "secret",
    allowed_origins: row.allowed_origins ?? [],
    revoked: row.revoked,
    plan: row.plan === "pro" ? "pro" : "free",
  };
  await cacheSet(cacheKey, record, KEY_CACHE_TTL);
  return record;
}

export async function incrementQuota(userId: string, monthlyLimit: number) {
  return rpc<{ allowed: boolean; used: number }>("cq_increment_quota", {
    p_user: userId,
    p_month: currentMonth(),
    p_limit: monthlyLimit,
  });
}

export async function logUsage(entry: UsageEntry): Promise<void> {
  await rpc("cq_log_usage", {
    p_user: entry.user_id,
    p_key: entry.api_key_id,
    p_endpoint: entry.endpoint,
    p_status: entry.status_code,
    p_latency: entry.latency_ms,
  });
}

export function defaultAuthDeps(): AuthDeps {
  return {
    findKey,
    rateLimit: (identifier, limit) => rateLimit(identifier, limit, 60),
    incrementQuota,
    logUsage,
    waitUntil: (p) => waitUntil(p),
  };
}
