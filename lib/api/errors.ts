import type { Locale } from "@/lib/i18n/locale";

export type ApiErrorCode =
  | "missing_api_key"
  | "invalid_api_key"
  | "revoked_api_key"
  | "secret_key_in_browser"
  | "origin_not_allowed"
  | "endpoint_not_allowed"
  | "invalid_request"
  | "payload_too_large"
  | "rate_limited"
  | "quota_exceeded"
  | "upstream_unavailable"
  | "internal_error"
  | "unauthorized"
  | "forbidden"
  | "key_limit_reached"
  | "not_found";

export const ERROR_STATUS: Record<ApiErrorCode, number> = {
  missing_api_key: 401,
  invalid_api_key: 401,
  revoked_api_key: 401,
  secret_key_in_browser: 403,
  origin_not_allowed: 403,
  endpoint_not_allowed: 403,
  invalid_request: 400,
  payload_too_large: 413,
  rate_limited: 429,
  quota_exceeded: 429,
  upstream_unavailable: 503,
  internal_error: 500,
  unauthorized: 401,
  forbidden: 403,
  key_limit_reached: 409,
  not_found: 404,
};

const MESSAGES: Record<ApiErrorCode, Record<Locale, string>> = {
  missing_api_key: {
    tr: "API anahtarı eksik. 'Authorization: Bearer <anahtar>' header'ını gönderin.",
    en: "API key is missing. Send the 'Authorization: Bearer <key>' header.",
  },
  invalid_api_key: { tr: "API anahtarı geçersiz.", en: "The API key is invalid." },
  revoked_api_key: { tr: "Bu API anahtarı iptal edilmiş.", en: "This API key has been revoked." },
  secret_key_in_browser: {
    tr: "Gizli anahtar tarayıcıdan kullanılamaz. Tarayıcı için açık (cq_pub_) anahtar kullanın.",
    en: "Secret keys must not be used from a browser. Use a publishable (cq_pub_) key instead.",
  },
  origin_not_allowed: {
    tr: "Bu origin, açık anahtarın izinli domain listesinde değil.",
    en: "This origin is not in the publishable key's allowed domains.",
  },
  endpoint_not_allowed: {
    tr: "Açık anahtarlar bu endpoint'e erişemez. Sunucu tarafında gizli anahtar kullanın.",
    en: "Publishable keys cannot access this endpoint. Use a secret key from your server.",
  },
  invalid_request: { tr: "İstek geçersiz.", en: "The request is invalid." },
  payload_too_large: { tr: "İstek gövdesi çok büyük.", en: "The request body is too large." },
  rate_limited: {
    tr: "Dakikalık istek sınırı aşıldı. Retry-After süresi kadar bekleyin.",
    en: "Per-minute rate limit exceeded. Wait for the Retry-After period.",
  },
  quota_exceeded: { tr: "Aylık istek kotanız doldu.", en: "Your monthly request quota is exhausted." },
  upstream_unavailable: {
    tr: "Gerekli dış servis şu anda yanıt vermiyor. Lütfen tekrar deneyin.",
    en: "A required upstream service is unavailable. Please retry.",
  },
  internal_error: { tr: "Beklenmeyen bir hata oluştu.", en: "An unexpected error occurred." },
  unauthorized: { tr: "Oturum açmanız gerekiyor.", en: "You need to sign in." },
  forbidden: { tr: "Bu işlem için yetkiniz yok.", en: "You are not allowed to perform this action." },
  key_limit_reached: {
    tr: "En fazla 5 aktif anahtarınız olabilir. Önce bir anahtarı iptal edin.",
    en: "You can have at most 5 active keys. Revoke one first.",
  },
  not_found: { tr: "Kayıt bulunamadı.", en: "Not found." },
};

export function errorMessage(code: ApiErrorCode, locale: Locale): string {
  return MESSAGES[code][locale];
}

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    public readonly details?: unknown,
    public readonly headers?: Record<string, string>,
  ) {
    super(code);
    this.name = "ApiError";
  }
  get status() {
    return ERROR_STATUS[this.code];
  }
}
