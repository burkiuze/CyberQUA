import "server-only";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import type { EndpointDef } from "@/lib/api/with-api-auth";
import { checkUrl, normalizeUrlInput } from "@/lib/checks/url";
import { defaultUrlDeps } from "@/lib/checks/url-sources";
import { checkEmail } from "@/lib/checks/email";
import { cachedMxLookup } from "@/lib/checks/email-sources";
import { checkIp, normalizeIp } from "@/lib/checks/ip";
import { defaultIpDeps } from "@/lib/checks/ip-sources";
import { fetchPwnedRange, SHA1_PREFIX_RE, type PasswordRangeData } from "@/lib/checks/password-range";
import { MAX_SECRET_SCAN_BYTES, scanSecrets } from "@/lib/checks/secrets";
import { checkHeaders } from "@/lib/checks/headers-probe";
import { SsrfError } from "@/lib/security/ssrf";
import { cacheGet, cacheSet } from "@/lib/cache";
import { UpstreamError } from "@/lib/http";

const SMALL_BODY = 8 * 1024;

const urlString = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine((v) => normalizeUrlInput(v) !== null, { message: "Must be a valid http(s) URL" });

export const urlCheckEndpoint = {
  path: "/url/check",
  method: "POST",
  publishable: true,
  source: "body",
  maxBodyBytes: SMALL_BODY,
  schema: z.object({ url: urlString }).strict(),
  async run(input, { locale }) {
    const result = await checkUrl(input.url, locale, defaultUrlDeps());
    if (!result) throw new ApiError("invalid_request", [{ field: "url", message: "Must be a valid http(s) URL" }]);
    return result;
  },
} satisfies EndpointDef<z.ZodObject<{ url: typeof urlString }>>;

const emailSchema = z.object({ email: z.string().trim().min(3).max(320) }).strict();
export const emailCheckEndpoint = {
  path: "/email/check",
  method: "POST",
  publishable: true,
  source: "body",
  maxBodyBytes: SMALL_BODY,
  schema: emailSchema,
  run: async (input) => checkEmail(input.email, cachedMxLookup),
} satisfies EndpointDef<typeof emailSchema>;

const passwordSchema = z
  .object({
    sha1_prefix: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .refine((v) => SHA1_PREFIX_RE.test(v), { message: "Must be exactly 5 hex characters (SHA-1 prefix)" }),
  })
  .strict();
export const passwordRangeEndpoint = {
  path: "/password/range",
  method: "POST",
  publishable: true,
  source: "body",
  maxBodyBytes: 1024,
  schema: passwordSchema,
  async run(input) {
    const key = `pwned:${input.sha1_prefix}`;
    const cached = await cacheGet<PasswordRangeData>(key);
    if (cached) return { data: cached, sources: ["pwnedpasswords", "cache"], partial: false };
    try {
      const data = await fetchPwnedRange(input.sha1_prefix);
      await cacheSet(key, data, 24 * 60 * 60);
      return { data, sources: ["pwnedpasswords"], partial: false };
    } catch {
      throw new ApiError("upstream_unavailable");
    }
  },
} satisfies EndpointDef<typeof passwordSchema>;

const headersSchema = z.object({ url: z.string().trim().min(1).max(2048) });
export const headersEndpoint = {
  path: "/headers",
  method: "GET",
  publishable: false,
  source: "query",
  maxBodyBytes: 0,
  schema: headersSchema,
  async run(input, { locale }) {
    const raw = /^[a-z][a-z0-9+.-]*:\/\//i.test(input.url) ? input.url : `https://${input.url}`;
    try {
      return await checkHeaders(raw, locale);
    } catch (err) {
      if (err instanceof SsrfError) {
        if (err.reason === "dns_failure") {
          throw new ApiError("invalid_request", [{ field: "url", message: "Hostname could not be resolved" }]);
        }
        throw new ApiError("invalid_request", [{ field: "url", message: `Target not allowed: ${err.reason}` }]);
      }
      if (err instanceof UpstreamError || err instanceof Error) {
        throw new ApiError("upstream_unavailable", [{ field: "url", message: "Target did not respond in time" }]);
      }
      throw err;
    }
  },
} satisfies EndpointDef<typeof headersSchema>;

const ipSchema = z.object({
  ip: z
    .string()
    .trim()
    .max(64)
    .refine((v) => normalizeIp(v) !== null, { message: "Must be a valid IPv4 or IPv6 address" }),
});
export const ipEndpoint = {
  path: "/ip",
  method: "GET",
  publishable: false,
  source: "params",
  maxBodyBytes: 0,
  schema: ipSchema,
  async run(input) {
    const result = await checkIp(input.ip, defaultIpDeps());
    if (!result) throw new ApiError("invalid_request", [{ field: "ip", message: "Must be a valid IPv4 or IPv6 address" }]);
    return result;
  },
} satisfies EndpointDef<typeof ipSchema>;

const secretsSchema = z
  .object({
    content: z.string(),
    filename: z.string().trim().max(255).optional(),
  })
  .strict();
export const secretsEndpoint = {
  path: "/secrets/scan",
  method: "POST",
  publishable: false,
  source: "body",
  // JSON escaping can inflate content; the 100 KB limit is enforced on the decoded content below.
  maxBodyBytes: MAX_SECRET_SCAN_BYTES * 2 + 4096,
  schema: secretsSchema,
  async run(input, { locale }) {
    if (new TextEncoder().encode(input.content).length > MAX_SECRET_SCAN_BYTES) throw new ApiError("payload_too_large");
    return { data: scanSecrets(input.content, locale, input.filename ?? null), sources: ["secret_rules"], partial: false };
  },
} satisfies EndpointDef<typeof secretsSchema>;

/** Registry used by the session-authenticated playground. */
export const PLAYGROUND_ENDPOINTS = {
  "url.check": urlCheckEndpoint,
  "email.check": emailCheckEndpoint,
  "password.range": passwordRangeEndpoint,
  headers: headersEndpoint,
  ip: ipEndpoint,
  "secrets.scan": secretsEndpoint,
} as const;

export type PlaygroundEndpointId = keyof typeof PLAYGROUND_ENDPOINTS;
