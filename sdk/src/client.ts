import { CyberQUAError } from "./errors.js";
import { sha1Hex } from "./crypto.js";
import { estimateStrength } from "./strength.js";
import { shield, type ExpressMiddleware, type ShieldOptions } from "./shield.js";
import type {
  ApiSuccess,
  EmailCheckResult,
  HeadersCheckResult,
  IpCheckResult,
  Locale,
  PasswordCheckResult,
  PasswordRangeResult,
  SecretsScanResult,
  UrlCheckResult,
} from "./types.js";

export interface CyberQUAOptions {
  /** cq_live_… (server) or cq_pub_… (browser, allowed origins only). */
  apiKey: string | undefined;
  /** Defaults to https://cyberqua.dev */
  baseUrl?: string;
  /** Per-request timeout in ms (default 10 000). */
  timeout?: number;
  /** Language of error messages and tips (default "tr"). */
  locale?: Locale;
  /** Max automatic retries on 429/503 (default 2). */
  maxRetries?: number;
  /** Custom fetch implementation (defaults to globalThis.fetch). */
  fetch?: typeof fetch;
}

export interface ResponseEnvelope<T> {
  data: T;
  meta: ApiSuccess<T>["meta"];
}

const DEFAULT_BASE_URL = "https://cyberqua.dev";
const MAX_RETRY_WAIT_MS = 30_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function retryDelay(header: string | null, attempt: number): number {
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.min(MAX_RETRY_WAIT_MS, Math.max(0, seconds * 1000));
    const date = Date.parse(header);
    if (!Number.isNaN(date)) return Math.min(MAX_RETRY_WAIT_MS, Math.max(0, date - Date.now()));
  }
  return Math.min(MAX_RETRY_WAIT_MS, 500 * 2 ** attempt);
}

export class CyberQUA {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly locale: Locale;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: CyberQUAOptions) {
    if (!options?.apiKey) {
      throw new CyberQUAError("missing_api_key", 0, "CyberQUA: apiKey is required (e.g. process.env.CYBERQUA_API_KEY).");
    }
    if (!/^cq_(live|pub)_[A-Za-z0-9]{32}$/.test(options.apiKey)) {
      throw new CyberQUAError("invalid_api_key", 0, "CyberQUA: apiKey has an invalid format.");
    }
    if (options.apiKey.startsWith("cq_live_") && typeof window !== "undefined" && typeof document !== "undefined") {
      throw new CyberQUAError(
        "secret_key_in_browser",
        0,
        "CyberQUA: secret keys (cq_live_) must never be used in the browser. Use a publishable key (cq_pub_).",
      );
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeout = options.timeout ?? 10_000;
    this.locale = options.locale ?? "tr";
    this.maxRetries = Math.max(0, options.maxRetries ?? 2);
    const f = options.fetch ?? (globalThis.fetch as typeof fetch | undefined);
    if (!f) throw new CyberQUAError("network_error", 0, "CyberQUA: no fetch implementation available (Node 18+ required).");
    this.fetchImpl = f.bind(globalThis);
  }

  /** Low-level request helper. Returns `{ data, meta }` or throws CyberQUAError. */
  async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<ResponseEnvelope<T>> {
    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);
      let res: Response;
      try {
        res = await this.fetchImpl(`${this.baseUrl}/api/v1${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Accept-Language": this.locale,
            Accept: "application/json",
            ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timer);
        if ((err as { name?: string })?.name === "AbortError") {
          throw new CyberQUAError("timeout", 0, `CyberQUA: request timed out after ${this.timeout} ms`);
        }
        throw new CyberQUAError("network_error", 0, `CyberQUA: network error (${(err as Error)?.message ?? "unknown"})`);
      }
      clearTimeout(timer);

      let payload: unknown = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }
      const envelope = payload as
        | { success: true; data: T; meta: ResponseEnvelope<T>["meta"] }
        | { success: false; error: { code: string; message: string; details?: unknown }; meta?: { request_id?: string } }
        | null;

      if (res.ok && envelope && envelope.success) {
        return { data: envelope.data, meta: envelope.meta };
      }

      const code = envelope && !envelope.success ? envelope.error.code : res.status === 503 ? "upstream_unavailable" : "internal_error";
      const retryable = (res.status === 429 && code !== "quota_exceeded") || res.status === 503;
      if (retryable && attempt < this.maxRetries) {
        await sleep(retryDelay(res.headers.get("Retry-After"), attempt));
        continue;
      }
      if (envelope && !envelope.success) {
        throw new CyberQUAError(envelope.error.code, res.status, envelope.error.message, envelope.meta?.request_id ?? null, envelope.error.details);
      }
      throw new CyberQUAError(code, res.status, `CyberQUA: unexpected response (HTTP ${res.status})`);
    }
  }

  readonly url = {
    /** Phishing / lookalike risk of a link. The link is never opened. */
    check: async (url: string): Promise<UrlCheckResult> => (await this.request<UrlCheckResult>("POST", "/url/check", { url })).data,
  };

  readonly password = {
    /** Raw k-anonymity range for a 5-character SHA-1 prefix. */
    range: async (sha1Prefix: string): Promise<PasswordRangeResult> =>
      (await this.request<PasswordRangeResult>("POST", "/password/range", { sha1_prefix: sha1Prefix.toUpperCase() })).data,

    /**
     * Leak + strength check. The password is hashed on-device; only the first
     * 5 hex characters of its SHA-1 hash are sent. Matching and strength
     * estimation also happen on-device.
     */
    check: async (password: string): Promise<PasswordCheckResult> => {
      const hash = await sha1Hex(password);
      const range = await this.password.range(hash.slice(0, 5));
      const suffix = hash.slice(5);
      const match = range.suffixes.find((s) => s.suffix === suffix);
      const leakCount = match?.count ?? 0;
      const strength = estimateStrength(password, this.locale, leakCount > 0);
      return { score: strength.score, leaked: leakCount > 0, leak_count: leakCount, tips: strength.tips };
    },

    /** Offline strength estimate only (no network). */
    strength: (password: string) => estimateStrength(password, this.locale, false),
  };

  readonly headers = {
    /** Security header audit (secret keys only). */
    check: async (url: string): Promise<HeadersCheckResult> =>
      (await this.request<HeadersCheckResult>("GET", `/headers?url=${encodeURIComponent(url)}`)).data,
  };

  readonly email = {
    check: async (email: string): Promise<EmailCheckResult> => (await this.request<EmailCheckResult>("POST", "/email/check", { email })).data,
  };

  readonly ip = {
    /** IP reputation (secret keys only). */
    check: async (ip: string): Promise<IpCheckResult> => (await this.request<IpCheckResult>("GET", `/ip/${encodeURIComponent(ip)}`)).data,
  };

  readonly secrets = {
    /** Scans up to 100 KB of text for leaked credentials (secret keys only). Content is never stored. */
    scan: async (content: string, options: { filename?: string } = {}): Promise<SecretsScanResult> =>
      (await this.request<SecretsScanResult>("POST", "/secrets/scan", { content, ...(options.filename ? { filename: options.filename } : {}) })).data,
  };

  /** Local security-header middleware for Express / Next.js. Makes no API calls. */
  shield(options?: ShieldOptions): ExpressMiddleware {
    return shield.create(options);
  }
}
