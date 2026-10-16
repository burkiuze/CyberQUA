import "server-only";
import { createHash } from "node:crypto";
import { connect as tlsConnect, type PeerCertificate } from "node:tls";
import { isIP } from "node:net";
import { cacheGet, cacheSet } from "@/lib/redis";
import { assertSafeUrl, safeFetchHeaders, type Resolver, systemResolver } from "@/lib/security/ssrf";
import { auditHeaders, type HeaderAuditData, type TlsInfo } from "@/lib/checks/headers";
import type { Locale } from "@/lib/i18n/locale";
import type { CheckResult } from "@/lib/checks/text";

const TIMEOUT_MS = 5000;
const CACHE_TTL = 10 * 60;

/** Reads the peer certificate from an already validated IP, using SNI for the hostname. */
export async function inspectTls(hostname: string, address: string): Promise<TlsInfo> {
  return new Promise((resolve) => {
    const socket = tlsConnect({
      host: address,
      port: 443,
      servername: isIP(hostname) ? undefined : hostname,
      rejectUnauthorized: false,
      timeout: TIMEOUT_MS,
    });
    const done = (info: TlsInfo) => {
      socket.destroy();
      resolve(info);
    };
    socket.once("secureConnect", () => {
      const cert: PeerCertificate = socket.getPeerCertificate();
      const validTo = cert?.valid_to ? new Date(cert.valid_to) : null;
      const days = validTo ? Math.floor((validTo.getTime() - Date.now()) / 86_400_000) : null;
      const authError = socket.authorizationError ? String(socket.authorizationError) : null;
      const issuer = cert?.issuer ? (cert.issuer.O ?? cert.issuer.CN ?? null) : null;
      done({
        valid: socket.authorized && (days ?? -1) >= 0,
        valid_to: validTo ? validTo.toISOString() : null,
        days_remaining: days,
        issuer: Array.isArray(issuer) ? issuer.join(", ") : issuer,
        error: authError ?? (days !== null && days < 0 ? "CERT_HAS_EXPIRED" : null),
      });
    });
    socket.once("timeout", () => done({ valid: false, valid_to: null, days_remaining: null, issuer: null, error: "TIMEOUT" }));
    socket.once("error", (err) =>
      done({ valid: false, valid_to: null, days_remaining: null, issuer: null, error: (err as NodeJS.ErrnoException).code ?? "TLS_ERROR" }),
    );
  });
}

/** Checks whether plain HTTP on the same host redirects to HTTPS. */
async function probeHttpRedirect(hostname: string, resolver: Resolver): Promise<boolean> {
  const host = isIP(hostname) === 6 ? `[${hostname}]` : hostname;
  const { final, hops } = await safeFetchHeaders(`http://${host}/`, { maxRedirects: 3, timeoutMs: TIMEOUT_MS, resolver });
  return hops.length > 0 && final.url.startsWith("https://");
}

export async function checkHeaders(
  rawUrl: string,
  locale: Locale,
  resolver: Resolver = systemResolver,
): Promise<CheckResult<HeaderAuditData>> {
  const { url } = await assertSafeUrl(rawUrl, resolver);
  const normalized = url.toString();
  const cacheKey = `headers:${locale}:${createHash("sha256").update(normalized).digest("hex")}`;
  const cached = await cacheGet<CheckResult<HeaderAuditData>>(cacheKey);
  if (cached) return cached;

  const main = await safeFetchHeaders(normalized, { maxRedirects: 3, timeoutMs: TIMEOUT_MS, resolver });
  const finalUrl = new URL(main.final.url);
  const hostname = finalUrl.hostname.replace(/^\[|\]$/g, "");
  const sources = ["http_headers"];
  let partial = false;

  const [redirect, tls] = await Promise.all([
    (async () => {
      if (url.protocol === "http:") return main.final.url.startsWith("https://");
      try {
        return await probeHttpRedirect(url.hostname.replace(/^\[|\]$/g, ""), resolver);
      } catch {
        partial = true;
        return null;
      }
    })(),
    (async () => {
      if (finalUrl.protocol !== "https:") return null;
      const info = await inspectTls(hostname, main.final.address);
      sources.push("tls");
      return info;
    })(),
  ]);

  const data = auditHeaders(
    {
      url: normalized,
      finalUrl: main.final.url,
      status: main.final.status,
      headers: main.final.headers,
      httpRedirectsToHttps: redirect,
      tls,
    },
    locale,
  );
  const result: CheckResult<HeaderAuditData> = { data, sources, partial };
  if (!partial) await cacheSet(cacheKey, result, CACHE_TTL);
  return result;
}
