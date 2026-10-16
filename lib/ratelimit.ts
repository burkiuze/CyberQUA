import "server-only";
import { rpc } from "@/lib/db";
import type { RateLimitResult } from "@/lib/api/with-api-auth";

/** Sliding-window rate limit stored in Postgres. */
export function rateLimit(bucket: string, limit: number, windowSeconds = 60): Promise<RateLimitResult> {
  return rpc<RateLimitResult>("cq_rate_limit", { p_bucket: bucket, p_limit: limit, p_window_seconds: windowSeconds });
}

/** Live demo on the landing page: 10 requests per hour per IP. */
export function demoRateLimit(ip: string): Promise<RateLimitResult> {
  return rateLimit(`demo:${ip}`, 10, 3600);
}

/** Best-effort client IP for anonymous rate limiting. Never persisted in logs. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || "unknown";
}
