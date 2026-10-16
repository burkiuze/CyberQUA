import type { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { errorResponse, newRequestId, successResponse } from "@/lib/api/response";
import { API_KEY_RE, hashApiKey, originAllowed } from "@/lib/api/keys";
import { readJsonBody } from "@/lib/api/body";
import { localeFromAcceptLanguage, type Locale } from "@/lib/i18n/locale";
import { planLimits, type KeyType, type PlanId } from "@/lib/plans";
import type { CheckResult } from "@/lib/checks/text";

export interface ApiKeyRecord {
  id: string;
  user_id: string;
  type: KeyType;
  allowed_origins: string[];
  revoked: boolean;
  plan: PlanId;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Unix epoch milliseconds when the window resets. */
  reset: number;
}

export interface UsageEntry {
  user_id: string;
  api_key_id: string | null;
  endpoint: string;
  status_code: number;
  latency_ms: number;
}

export interface AuthDeps {
  findKey(hash: string): Promise<ApiKeyRecord | null>;
  rateLimit(identifier: string, limitPerMinute: number): Promise<RateLimitResult>;
  incrementQuota(userId: string, monthlyLimit: number): Promise<{ allowed: boolean; used: number }>;
  logUsage(entry: UsageEntry): Promise<void>;
  waitUntil(promise: Promise<unknown>): void;
}

export type InputSource = "body" | "query" | "params";

export interface EndpointContext {
  locale: Locale;
}

export interface EndpointDef<S extends z.ZodType> {
  /** Path relative to /api/v1, stored in usage logs. */
  path: string;
  method: "GET" | "POST";
  /** Whether publishable (browser) keys may call this endpoint. */
  publishable: boolean;
  source: InputSource;
  maxBodyBytes: number;
  schema: S;
  run(input: z.output<S>, ctx: EndpointContext): Promise<CheckResult<unknown>>;
}

export type RouteContext = { params: Promise<Record<string, string | string[] | undefined>> };

const EXPOSED_HEADERS = "X-Request-Id, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After";

/** Extracts the raw (unvalidated) input object for an endpoint. */
export async function extractInput(
  req: Request,
  source: InputSource,
  maxBodyBytes: number,
  ctx?: RouteContext,
): Promise<unknown> {
  if (source === "query") {
    return Object.fromEntries(new URL(req.url).searchParams.entries());
  }
  if (source === "params") {
    const params = ctx ? await ctx.params : {};
    return Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k, typeof v === "string" ? safeDecode(v) : v]),
    );
  }
  return readJsonBody(req, maxBodyBytes);
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Formats Zod issues into `{ field, message }` pairs. */
export function zodDetails(error: z.ZodError): Array<{ field: string; message: string }> {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : "(root)",
    message: issue.message,
  }));
}

export function createApiHandler<S extends z.ZodType>(def: EndpointDef<S>, deps: AuthDeps) {
  return async function handler(req: Request, ctx?: RouteContext): Promise<Response> {
    const started = performance.now();
    const requestId = newRequestId();
    const locale = localeFromAcceptLanguage(req.headers.get("accept-language"));
    const origin = req.headers.get("origin");
    let key: ApiKeyRecord | null = null;
    let extraHeaders: Record<string, string> = {};
    let response: Response;

    try {
      // 1. Authorization header
      const authorization = req.headers.get("authorization");
      if (!authorization || authorization.trim().length === 0) throw new ApiError("missing_api_key");

      // 2. Format
      const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization.trim());
      const rawKey = match?.[1] ?? "";
      if (!API_KEY_RE.test(rawKey)) throw new ApiError("invalid_api_key");

      // 3. Lookup by SHA-256 hash (Redis cache → Supabase)
      const record = await deps.findKey(hashApiKey(rawKey));
      if (!record) throw new ApiError("invalid_api_key");
      if (record.revoked) throw new ApiError("revoked_api_key");
      key = record;

      // 4. Key type rules
      if (record.type === "secret") {
        if (origin) throw new ApiError("secret_key_in_browser");
      } else {
        if (!def.publishable) throw new ApiError("endpoint_not_allowed");
        if (!origin || !originAllowed(origin, record.allowed_origins)) throw new ApiError("origin_not_allowed");
        extraHeaders = {
          "access-control-allow-origin": origin,
          "access-control-expose-headers": EXPOSED_HEADERS,
          vary: "Origin",
        };
      }

      // 5. Per-key sliding-window rate limit
      const limits = planLimits(record.plan);
      const rl = await deps.rateLimit(`key:${record.id}`, limits.perMinute[record.type]);
      extraHeaders = {
        ...extraHeaders,
        "x-ratelimit-limit": String(rl.limit),
        "x-ratelimit-remaining": String(Math.max(0, rl.remaining)),
        "x-ratelimit-reset": String(Math.ceil(rl.reset / 1000)),
      };
      if (!rl.success) {
        const retryAfter = Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000));
        throw new ApiError("rate_limited", undefined, { "retry-after": String(retryAfter) });
      }

      // 6. Monthly quota
      const quota = await deps.incrementQuota(record.user_id, limits.monthlyQuota);
      if (!quota.allowed) throw new ApiError("quota_exceeded");

      // 7. Input validation
      const raw = await extractInput(req, def.source, def.maxBodyBytes, ctx);
      const parsed = def.schema.safeParse(raw);
      if (!parsed.success) throw new ApiError("invalid_request", zodDetails(parsed.error));

      // 8. Run
      const result = await def.run(parsed.data, { locale });
      response = successResponse(
        result.data,
        {
          request_id: requestId,
          latency_ms: Math.round(performance.now() - started),
          sources_used: result.sources,
          partial: result.partial,
        },
        extraHeaders,
      );
    } catch (err) {
      response = toErrorResponse(err, locale, requestId, extraHeaders);
    }

    // 9. Usage log after the response (never contains request bodies, IPs or queried values)
    if (key) {
      const entry: UsageEntry = {
        user_id: key.user_id,
        api_key_id: key.id,
        endpoint: def.path,
        status_code: response.status,
        latency_ms: Math.round(performance.now() - started),
      };
      deps.waitUntil(deps.logUsage(entry).catch(() => undefined));
    }
    return response;
  };
}

export function toErrorResponse(
  err: unknown,
  locale: Locale,
  requestId: string,
  extraHeaders: Record<string, string> = {},
): Response {
  if (err instanceof ApiError) {
    return errorResponse(err.code, locale, requestId, {
      details: err.details,
      headers: { ...extraHeaders, ...(err.headers ?? {}) },
    });
  }
  // Log only the error class and request id — never inputs.
  console.error(`[cyberqua] internal_error ${requestId}: ${err instanceof Error ? err.name : "unknown"}`);
  return errorResponse("internal_error", locale, requestId, { headers: extraHeaders });
}

/** CORS preflight. Browsers only get CORS headers for endpoints that accept publishable keys. */
export function preflight(publishable: boolean) {
  return function OPTIONS(req: Request): Response {
    const origin = req.headers.get("origin");
    if (!publishable || !origin) return new Response(null, { status: 204 });
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "Authorization, Content-Type, Accept-Language",
        "access-control-max-age": "600",
        vary: "Origin",
      },
    });
  };
}
