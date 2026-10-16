import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/body";
import { newRequestId, successResponse } from "@/lib/api/response";
import { toErrorResponse, zodDetails } from "@/lib/api/with-api-auth";
import { checkUrl, normalizeUrlInput } from "@/lib/checks/url";
import { defaultUrlDeps } from "@/lib/checks/url-sources";
import { clientIp, demoRateLimit } from "@/lib/ratelimit";
import { localeFromAcceptLanguage } from "@/lib/i18n/locale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z
  .object({
    url: z.string().trim().min(1).max(2048).refine((v) => normalizeUrlInput(v) !== null, { message: "Must be a valid http(s) URL" }),
  })
  .strict();

/** Public live demo for the landing page. No API key; 10 requests per hour per IP. */
export async function POST(req: Request) {
  const started = performance.now();
  const requestId = newRequestId();
  const locale = localeFromAcceptLanguage(req.headers.get("accept-language"));
  let headers: Record<string, string> = {};
  try {
    const rl = await demoRateLimit(clientIp(req));
    headers = {
      "x-ratelimit-limit": String(rl.limit),
      "x-ratelimit-remaining": String(Math.max(0, rl.remaining)),
      "x-ratelimit-reset": String(Math.ceil(rl.reset / 1000)),
    };
    if (!rl.success) {
      throw new ApiError("rate_limited", undefined, {
        "retry-after": String(Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000))),
      });
    }
    const parsed = schema.safeParse(await readJsonBody(req, 4096));
    if (!parsed.success) throw new ApiError("invalid_request", zodDetails(parsed.error));
    const result = await checkUrl(parsed.data.url, locale, defaultUrlDeps());
    if (!result) throw new ApiError("invalid_request", [{ field: "url", message: "Must be a valid http(s) URL" }]);
    return successResponse(
      result.data,
      {
        request_id: requestId,
        latency_ms: Math.round(performance.now() - started),
        sources_used: result.sources,
        partial: result.partial,
      },
      headers,
    );
  } catch (err) {
    return toErrorResponse(err, locale, requestId, headers);
  }
}
