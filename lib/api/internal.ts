import "server-only";
import { ApiError } from "@/lib/api/errors";
import { newRequestId } from "@/lib/api/response";
import { toErrorResponse } from "@/lib/api/with-api-auth";
import { localeFromAcceptLanguage, type Locale } from "@/lib/i18n/locale";

/** Wraps a session-authenticated internal route with uniform error handling. */
export function internalRoute(
  fn: (req: Request, ctx: { locale: Locale; requestId: string }) => Promise<Response>,
) {
  return async (req: Request): Promise<Response> => {
    const requestId = newRequestId();
    const locale = localeFromAcceptLanguage(req.headers.get("accept-language"));
    try {
      return await fn(req, { locale, requestId });
    } catch (err) {
      return toErrorResponse(err, locale, requestId);
    }
  };
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export { ApiError };
