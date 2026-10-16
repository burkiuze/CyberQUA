import { randomBytes } from "node:crypto";
import { ApiError, errorMessage, type ApiErrorCode } from "@/lib/api/errors";
import type { Locale } from "@/lib/i18n/locale";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Uniformly random base62 string using rejection sampling (no modulo bias). */
export function randomBase62(length: number): string {
  let out = "";
  while (out.length < length) {
    const bytes = randomBytes(length * 2);
    for (const b of bytes) {
      if (b < 248) out += BASE62[b % 62];
      if (out.length === length) break;
    }
  }
  return out;
}

export function newRequestId(): string {
  return `req_${randomBase62(20)}`;
}

export interface SuccessMeta {
  request_id: string;
  latency_ms: number;
  sources_used: string[];
  partial: boolean;
}

const BASE_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

export function successResponse(data: unknown, meta: SuccessMeta, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ success: true, data, meta }), {
    status: 200,
    headers: { ...BASE_HEADERS, "x-request-id": meta.request_id, ...headers },
  });
}

export function errorResponse(
  code: ApiErrorCode,
  locale: Locale,
  requestId: string,
  { details, headers = {} }: { details?: unknown; headers?: Record<string, string> } = {},
): Response {
  const err = new ApiError(code);
  const body: Record<string, unknown> = {
    success: false,
    error: { code, message: errorMessage(code, locale), ...(details !== undefined ? { details } : {}) },
    meta: { request_id: requestId },
  };
  return new Response(JSON.stringify(body), {
    status: err.status,
    headers: { ...BASE_HEADERS, "x-request-id": requestId, ...headers },
  });
}
