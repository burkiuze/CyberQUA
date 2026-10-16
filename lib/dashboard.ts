import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getRedis } from "@/lib/redis";
import { quotaKey } from "@/lib/plans";

export interface UsageSummary {
  daily: Array<{ day: string; requests: number; errors: number }>;
  endpoints: Array<{ endpoint: string; requests: number }>;
  total: number;
  errors: number;
  avg_latency_ms: number;
}

export async function getUsageSummary(userId: string): Promise<UsageSummary> {
  const { data, error } = await supabaseAdmin().rpc("usage_summary", { p_user_id: userId, p_days: 30 });
  if (error || !data) return { daily: [], endpoints: [], total: 0, errors: 0, avg_latency_ms: 0 };
  return data as UsageSummary;
}

/** Requests used this month, read from the authoritative Redis quota counter. */
export async function getMonthlyUsage(userId: string): Promise<number> {
  try {
    const value = await getRedis().get<number | string>(quotaKey(userId));
    return Number(value ?? 0) || 0;
  } catch {
    return 0;
  }
}
