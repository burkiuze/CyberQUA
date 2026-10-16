import { z } from "zod";
import { waitUntil } from "@vercel/functions";
import { ApiError, internalRoute } from "@/lib/api/internal";
import { readJsonBody } from "@/lib/api/body";
import { successResponse } from "@/lib/api/response";
import { zodDetails } from "@/lib/api/with-api-auth";
import { PLAYGROUND_ENDPOINTS, type PlaygroundEndpointId } from "@/lib/api/endpoints";
import { incrementQuota, logUsage } from "@/lib/api/deps";
import { assertSameOrigin, ensureProfile, requireUserId } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { planLimits } from "@/lib/plans";
import { MAX_SECRET_SCAN_BYTES } from "@/lib/checks/secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const requestSchema = z.object({
  endpoint: z.enum(Object.keys(PLAYGROUND_ENDPOINTS) as [PlaygroundEndpointId, ...PlaygroundEndpointId[]]),
  input: z.record(z.string(), z.unknown()),
});

/**
 * Session-authenticated proxy for the playground. No API key ever reaches the
 * browser; usage counts against the signed-in user's rate limit and quota.
 */
export const POST = internalRoute(async (req, { locale, requestId }) => {
  const started = performance.now();
  assertSameOrigin(req);
  const userId = await requireUserId();
  const profile = await ensureProfile(userId);
  const limits = planLimits(profile.plan);

  const rl = await rateLimit(`user:${userId}`, limits.perMinute.secret, 60);
  const rlHeaders = {
    "x-ratelimit-limit": String(rl.limit),
    "x-ratelimit-remaining": String(Math.max(0, rl.remaining)),
    "x-ratelimit-reset": String(Math.ceil(rl.reset / 1000)),
  };
  if (!rl.success) {
    throw new ApiError("rate_limited", undefined, {
      ...rlHeaders,
      "retry-after": String(Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000))),
    });
  }
  const quota = await incrementQuota(userId, limits.monthlyQuota);
  if (!quota.allowed) throw new ApiError("quota_exceeded");

  const body = requestSchema.safeParse(await readJsonBody(req, MAX_SECRET_SCAN_BYTES * 2 + 4096));
  if (!body.success) throw new ApiError("invalid_request", zodDetails(body.error));
  const def = PLAYGROUND_ENDPOINTS[body.data.endpoint];

  let status = 200;
  try {
    const parsed = def.schema.safeParse(body.data.input);
    if (!parsed.success) throw new ApiError("invalid_request", zodDetails(parsed.error));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (def.run as (input: any, ctx: { locale: typeof locale }) => ReturnType<typeof def.run>)(
      parsed.data,
      { locale },
    );
    return successResponse(
      result.data,
      {
        request_id: requestId,
        latency_ms: Math.round(performance.now() - started),
        sources_used: result.sources,
        partial: result.partial,
      },
      rlHeaders,
    );
  } catch (err) {
    status = err instanceof ApiError ? err.status : 500;
    throw err;
  } finally {
    waitUntil(
      logUsage({
        user_id: userId,
        api_key_id: null,
        endpoint: def.path,
        status_code: status,
        latency_ms: Math.round(performance.now() - started),
      }).catch(() => undefined),
    );
  }
});
