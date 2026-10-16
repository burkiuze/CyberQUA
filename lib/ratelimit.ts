import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "@/lib/redis";

type Window = Parameters<typeof Ratelimit.slidingWindow>[1];

const limiters = new Map<string, Ratelimit>();

/** Returns a cached sliding-window limiter for the given budget. */
export function rateLimitFor(limit: number, window: Window, prefix = "rl"): Ratelimit {
  const id = `${prefix}:${limit}:${window}`;
  let limiter = limiters.get(id);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(limit, window),
      prefix: id,
      analytics: false,
    });
    limiters.set(id, limiter);
  }
  return limiter;
}

/** Live demo on the landing page: 10 requests per hour per IP. */
export function demoLimiter(): Ratelimit {
  return rateLimitFor(10, "1 h", "rl:demo");
}

/** Best-effort client IP for anonymous rate limiting. Never persisted. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || "unknown";
}
