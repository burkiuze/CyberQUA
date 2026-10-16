import "server-only";
import { rpc } from "@/lib/db";
import { currentMonth } from "@/lib/plans";

export interface UsageSummary {
  daily: Array<{ day: string; requests: number; errors: number }>;
  endpoints: Array<{ endpoint: string; requests: number }>;
  total: number;
  errors: number;
  avg_latency_ms: number;
}

const EMPTY: UsageSummary = { daily: [], endpoints: [], total: 0, errors: 0, avg_latency_ms: 0 };

export async function getUsageSummary(userId: string): Promise<UsageSummary> {
  try {
    return (await rpc<UsageSummary>("cq_usage_summary", { p_user: userId, p_days: 30 })) ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

/** Requests counted against this month's quota. */
export async function getMonthlyUsage(userId: string): Promise<number> {
  try {
    return Number(await rpc<number>("cq_monthly_usage", { p_user: userId, p_month: currentMonth() })) || 0;
  } catch {
    return 0;
  }
}

export interface KeyRow {
  id: string;
  name: string;
  type: "secret" | "publishable";
  key_prefix: string;
  allowed_origins: string[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export async function listKeys(userId: string): Promise<KeyRow[]> {
  return (await rpc<KeyRow[]>("cq_list_keys", { p_user: userId })) ?? [];
}

export interface LogRow {
  id: number;
  endpoint: string;
  status_code: number;
  latency_ms: number;
  created_at: string;
  api_key_id: string | null;
  key_name: string | null;
  key_prefix: string | null;
}

export async function listLogs(
  userId: string,
  filter: { endpoint: string | null; statusMin: number | null; statusMax: number | null; offset: number; limit: number },
): Promise<LogRow[]> {
  return (
    (await rpc<LogRow[]>("cq_list_logs", {
      p_user: userId,
      p_endpoint: filter.endpoint,
      p_status_min: filter.statusMin,
      p_status_max: filter.statusMax,
      p_offset: filter.offset,
      p_limit: filter.limit,
    })) ?? []
  );
}
