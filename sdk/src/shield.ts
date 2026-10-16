/**
 * cq.shield(): adds security headers locally — no API call involved.
 * Works as Express/Connect middleware and with Next.js (next.config.js headers()
 * or a Response in middleware/proxy).
 */

export interface ShieldOptions {
  /** Content-Security-Policy value. Set to false to omit. */
  contentSecurityPolicy?: string | false;
  /** HSTS max-age in seconds (default 2 years). Set to false to omit (e.g. local HTTP). */
  hstsMaxAge?: number | false;
  hstsPreload?: boolean;
  frameOptions?: "DENY" | "SAMEORIGIN";
  referrerPolicy?: string;
  permissionsPolicy?: string;
  crossOriginOpenerPolicy?: "same-origin" | "same-origin-allow-popups" | "unsafe-none";
  /** Extra headers to set verbatim. */
  extra?: Record<string, string>;
}

const DEFAULT_CSP =
  "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests";

export function shieldHeaders(options: ShieldOptions = {}): Record<string, string> {
  const headers: Record<string, string> = {};
  if (options.hstsMaxAge !== false) {
    const maxAge = options.hstsMaxAge ?? 63072000;
    headers["Strict-Transport-Security"] = `max-age=${maxAge}; includeSubDomains${options.hstsPreload === false ? "" : "; preload"}`;
  }
  if (options.contentSecurityPolicy !== false) {
    headers["Content-Security-Policy"] = options.contentSecurityPolicy ?? DEFAULT_CSP;
  }
  headers["X-Frame-Options"] = options.frameOptions ?? "DENY";
  headers["X-Content-Type-Options"] = "nosniff";
  headers["Referrer-Policy"] = options.referrerPolicy ?? "strict-origin-when-cross-origin";
  headers["Permissions-Policy"] = options.permissionsPolicy ?? "camera=(), microphone=(), geolocation=(), payment=()";
  headers["Cross-Origin-Opener-Policy"] = options.crossOriginOpenerPolicy ?? "same-origin";
  return { ...headers, ...(options.extra ?? {}) };
}

interface NodeLikeResponse {
  setHeader(name: string, value: string): unknown;
  removeHeader?(name: string): unknown;
}

export type ExpressMiddleware = ((req: unknown, res: NodeLikeResponse, next: (err?: unknown) => void) => void) & {
  /** The header map this middleware applies. */
  headers: Record<string, string>;
  /** `[{ key, value }]` for next.config.js `headers()`. */
  nextHeaders: () => Array<{ key: string; value: string }>;
  /** Sets the headers on a Fetch API Headers object (e.g. NextResponse.headers). */
  apply: (target: { set(name: string, value: string): void }) => void;
};

function build(options: ShieldOptions = {}): ExpressMiddleware {
  const headers = shieldHeaders(options);
  const middleware = ((_req: unknown, res: NodeLikeResponse, next: (err?: unknown) => void) => {
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    res.removeHeader?.("X-Powered-By");
    next();
  }) as ExpressMiddleware;
  middleware.headers = headers;
  middleware.nextHeaders = () => Object.entries(headers).map(([key, value]) => ({ key, value }));
  middleware.apply = (target) => {
    for (const [k, v] of Object.entries(headers)) target.set(k, v);
  };
  return middleware;
}

export const shield = {
  /** Express / Connect middleware: `app.use(shield.express())`. */
  express: (options?: ShieldOptions) => build(options),
  /** For next.config.js: `headers: shield.nextHeaders()`. */
  nextHeaders: (options?: ShieldOptions) => build(options).nextHeaders(),
  /** Apply to a Fetch API Headers object, e.g. in Next.js middleware/proxy. */
  apply: (target: { set(name: string, value: string): void }, options?: ShieldOptions) => build(options).apply(target),
  /** Plain header map. */
  headers: shieldHeaders,
  create: build,
};
