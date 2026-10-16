export type CyberQUAErrorCode =
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
  | "timeout"
  | "network_error"
  | (string & {});

/** Error thrown for every failed CyberQUA call. */
export class CyberQUAError extends Error {
  readonly code: CyberQUAErrorCode;
  readonly status: number;
  readonly requestId: string | null;
  readonly details: unknown;

  constructor(code: CyberQUAErrorCode, status: number, message: string, requestId: string | null = null, details?: unknown) {
    super(message);
    this.name = "CyberQUAError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.details = details;
  }
}
