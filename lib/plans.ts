export type PlanId = "free" | "pro";
export type KeyType = "secret" | "publishable";

export interface PlanLimits {
  monthlyQuota: number;
  perMinute: Record<KeyType, number>;
}

export const PLANS: Record<PlanId, PlanLimits> = {
  free: { monthlyQuota: 1_000, perMinute: { secret: 30, publishable: 10 } },
  pro: { monthlyQuota: 50_000, perMinute: { secret: 300, publishable: 100 } },
};

export function planLimits(plan: string | null | undefined): PlanLimits {
  return plan === "pro" ? PLANS.pro : PLANS.free;
}

export const MAX_ACTIVE_KEYS = 5;

/** YYYY-MM in UTC, used for the monthly quota counter key. */
export function currentMonth(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
