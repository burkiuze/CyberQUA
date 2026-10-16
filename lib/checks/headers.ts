import type { Locale } from "@/lib/i18n/locale";
import { t, type Severity } from "@/lib/checks/text";

export type HeaderMap = Record<string, string | string[] | undefined>;

export type Grade = "A+" | "A" | "B" | "C" | "D" | "F";

export interface HeaderIssue {
  header: string;
  severity: Severity;
  message: string;
}

export interface TlsInfo {
  valid: boolean;
  valid_to: string | null;
  days_remaining: number | null;
  issuer: string | null;
  error: string | null;
}

export interface CookieAudit {
  name: string;
  secure: boolean;
  http_only: boolean;
  same_site: string | null;
}

export interface HeaderAuditInput {
  url: string;
  finalUrl: string;
  status: number;
  headers: HeaderMap;
  /** null when the probe could not run. */
  httpRedirectsToHttps: boolean | null;
  tls: TlsInfo | null;
}

export interface HeaderFixes {
  missing: string[];
  vercel_json: string;
  netlify_headers: string;
  next_config: string;
  express: string;
  nginx: string;
}

export interface HeaderAuditData {
  url: string;
  final_url: string;
  status: number;
  grade: Grade;
  score: number;
  checks: {
    hsts: { present: boolean; max_age: number | null; include_subdomains: boolean; preload: boolean };
    csp: { present: boolean; weaknesses: string[] };
    clickjacking: { protected: boolean; via: "x-frame-options" | "frame-ancestors" | null };
    x_content_type_options: boolean;
    referrer_policy: string | null;
    permissions_policy: boolean;
    coop: string | null;
    info_leak: { server: string | null; x_powered_by: string | null };
    cookies: CookieAudit[];
    https_redirect: boolean | null;
    tls: TlsInfo | null;
  };
  issues: HeaderIssue[];
  fixes: HeaderFixes;
}

function header(headers: HeaderMap, name: string): string | null {
  const v = headers[name.toLowerCase()];
  if (v === undefined) return null;
  return Array.isArray(v) ? v.join(", ") : v;
}

function headerList(headers: HeaderMap, name: string): string[] {
  const v = headers[name.toLowerCase()];
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

export function parseHsts(value: string | null) {
  if (!value) return { present: false, max_age: null, include_subdomains: false, preload: false };
  const directives = value.split(";").map((d) => d.trim().toLowerCase());
  const maxAgeDirective = directives.find((d) => d.startsWith("max-age="));
  const maxAge = maxAgeDirective ? Number.parseInt(maxAgeDirective.slice(8).replace(/"/g, ""), 10) : null;
  return {
    present: true,
    max_age: Number.isFinite(maxAge) ? maxAge : null,
    include_subdomains: directives.includes("includesubdomains"),
    preload: directives.includes("preload"),
  };
}

export function parseCsp(value: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  for (const part of value.split(";")) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    const name = tokens.shift()?.toLowerCase();
    if (name && !directives.has(name)) directives.set(name, tokens.map((x) => x.toLowerCase()));
  }
  return directives;
}

/** Returns the weaknesses of a CSP in the spirit of Google's CSP Evaluator. */
export function cspWeaknesses(value: string): string[] {
  const csp = parseCsp(value);
  const weaknesses: string[] = [];
  const scriptSrc = csp.get("script-src") ?? csp.get("default-src");
  if (!scriptSrc) {
    weaknesses.push("missing_script_src");
  } else {
    const hasNonceOrHash = scriptSrc.some((s) => s.startsWith("'nonce-") || /^'sha(256|384|512)-/.test(s));
    const strictDynamic = scriptSrc.includes("'strict-dynamic'");
    // 'unsafe-inline' is ignored by CSP2+ browsers when a nonce or hash is present.
    if (scriptSrc.includes("'unsafe-inline'") && !hasNonceOrHash) weaknesses.push("unsafe_inline");
    if (scriptSrc.includes("'unsafe-eval'")) weaknesses.push("unsafe_eval");
    // Wildcards and scheme sources are ignored under 'strict-dynamic'.
    if (!strictDynamic && scriptSrc.some((s) => s === "*" || s === "http:" || s === "https:" || s === "data:")) {
      weaknesses.push("wildcard_source");
    }
  }
  const defaultSrc = csp.get("default-src");
  if (defaultSrc?.includes("*")) {
    if (!weaknesses.includes("wildcard_source")) weaknesses.push("wildcard_source");
  }
  const objectSrc = csp.get("object-src") ?? defaultSrc;
  if (!objectSrc || !objectSrc.includes("'none'")) weaknesses.push("missing_object_src_none");
  if (!csp.has("base-uri")) weaknesses.push("missing_base_uri");
  return weaknesses;
}

export function parseSetCookie(value: string): CookieAudit {
  const [pair = "", ...attrs] = value.split(";");
  const name = pair.split("=")[0]?.trim() ?? "";
  const lower = attrs.map((a) => a.trim().toLowerCase());
  const sameSite = lower.find((a) => a.startsWith("samesite="));
  return {
    name,
    secure: lower.includes("secure"),
    http_only: lower.includes("httponly"),
    same_site: sameSite ? sameSite.slice(9) : null,
  };
}

const GOOD_REFERRER = new Set([
  "no-referrer",
  "same-origin",
  "strict-origin",
  "strict-origin-when-cross-origin",
  "no-referrer-when-downgrade",
  "origin",
  "origin-when-cross-origin",
]);

export const RECOMMENDED_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

export function buildFixes(missing: string[]): HeaderFixes {
  const entries = missing.map((name) => [name, RECOMMENDED_HEADERS[name]!] as const).filter(([, v]) => v);
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  const vercel = JSON.stringify(
    { headers: [{ source: "/(.*)", headers: entries.map(([key, value]) => ({ key, value })) }] },
    null,
    2,
  );
  const netlify = ["/*", ...entries.map(([k, v]) => `  ${k}: ${v}`)].join("\n");
  const next = [
    "// next.config.js",
    "module.exports = {",
    "  async headers() {",
    "    return [",
    "      {",
    '        source: "/(.*)",',
    "        headers: [",
    ...entries.map(([k, v]) => `          { key: "${k}", value: "${esc(v)}" },`),
    "        ],",
    "      },",
    "    ];",
    "  },",
    "};",
  ].join("\n");
  const express = [
    "// Express middleware",
    "app.disable(\"x-powered-by\");",
    "app.use((req, res, next) => {",
    ...entries.map(([k, v]) => `  res.setHeader("${k}", "${esc(v)}");`),
    "  next();",
    "});",
  ].join("\n");
  const nginx = [
    "# nginx (server bloğu içinde / inside the server block)",
    "server_tokens off;",
    ...entries.map(([k, v]) => `add_header ${k} "${esc(v)}" always;`),
  ].join("\n");

  return { missing, vercel_json: vercel, netlify_headers: netlify, next_config: next, express, nginx };
}

export function gradeFor(score: number, hasCritical: boolean): Grade {
  if (score >= 95 && !hasCritical) return "A+";
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

/** Pure scoring of a header snapshot. Weights sum to 100. */
export function auditHeaders(input: HeaderAuditInput, locale: Locale): HeaderAuditData {
  const { headers } = input;
  const isHttps = input.finalUrl.startsWith("https://");
  const issues: HeaderIssue[] = [];
  const missing = new Set<string>();
  let score = 0;
  const issue = (h: string, severity: Severity, tr: string, en: string) =>
    issues.push({ header: h, severity, message: t(locale, { tr, en }) });

  // HSTS — 20
  const hsts = parseHsts(isHttps ? header(headers, "strict-transport-security") : null);
  if (!hsts.present) {
    missing.add("Strict-Transport-Security");
    issue("Strict-Transport-Security", "high", "HSTS header'ı yok; tarayıcılar HTTPS'i zorunlu tutmuyor.", "HSTS is missing; browsers are not forced to use HTTPS.");
  } else {
    if ((hsts.max_age ?? 0) >= 31_536_000) score += 12;
    else {
      missing.add("Strict-Transport-Security");
      issue("Strict-Transport-Security", "medium", "HSTS max-age en az 31536000 (1 yıl) olmalı.", "HSTS max-age should be at least 31536000 (1 year).");
    }
    if (hsts.include_subdomains) score += 4;
    else issue("Strict-Transport-Security", "low", "HSTS includeSubDomains içermiyor.", "HSTS lacks includeSubDomains.");
    if (hsts.preload) score += 4;
    else issue("Strict-Transport-Security", "low", "HSTS preload içermiyor.", "HSTS lacks preload.");
  }

  // CSP — 25
  const cspValue = header(headers, "content-security-policy");
  const weaknesses = cspValue ? cspWeaknesses(cspValue) : [];
  if (!cspValue) {
    missing.add("Content-Security-Policy");
    issue("Content-Security-Policy", "high", "Content-Security-Policy yok; XSS'e karşı ek koruma eksik.", "No Content-Security-Policy; XSS defence-in-depth is missing.");
  } else {
    score += 15;
    const penalties: Record<string, number> = {
      unsafe_inline: 5, unsafe_eval: 4, wildcard_source: 4, missing_script_src: 4, missing_object_src_none: 1, missing_base_uri: 1,
    };
    const lost = Math.min(10, weaknesses.reduce((s, w) => s + (penalties[w] ?? 1), 0));
    score += 10 - lost;
    const labels: Record<string, [string, string]> = {
      unsafe_inline: ["script-src 'unsafe-inline' içeriyor (nonce/hash olmadan).", "script-src allows 'unsafe-inline' without a nonce/hash."],
      unsafe_eval: ["script-src 'unsafe-eval' içeriyor.", "script-src allows 'unsafe-eval'."],
      wildcard_source: ["CSP joker karakter (*) veya geniş şema kaynakları içeriyor.", "CSP contains wildcard (*) or broad scheme sources."],
      missing_script_src: ["CSP'de script-src veya default-src yok.", "CSP has no script-src or default-src."],
      missing_object_src_none: ["CSP object-src 'none' içermiyor.", "CSP lacks object-src 'none'."],
      missing_base_uri: ["CSP base-uri tanımlamıyor.", "CSP does not define base-uri."],
    };
    for (const w of weaknesses) {
      const [tr, en] = labels[w] ?? [w, w];
      issue("Content-Security-Policy", w === "unsafe_inline" || w === "unsafe_eval" ? "medium" : "low", tr, en);
    }
  }

  // Clickjacking — 10
  const xfo = header(headers, "x-frame-options")?.toUpperCase() ?? null;
  const frameAncestors = cspValue ? parseCsp(cspValue).get("frame-ancestors") : undefined;
  let clickjackingVia: "x-frame-options" | "frame-ancestors" | null = null;
  if (frameAncestors && !frameAncestors.includes("*")) clickjackingVia = "frame-ancestors";
  else if (xfo === "DENY" || xfo === "SAMEORIGIN") clickjackingVia = "x-frame-options";
  if (clickjackingVia) score += 10;
  else {
    missing.add("X-Frame-Options");
    issue("X-Frame-Options", "medium", "Clickjacking koruması yok (X-Frame-Options veya frame-ancestors).", "No clickjacking protection (X-Frame-Options or frame-ancestors).");
  }

  // nosniff — 10
  const nosniff = header(headers, "x-content-type-options")?.toLowerCase().trim() === "nosniff";
  if (nosniff) score += 10;
  else {
    missing.add("X-Content-Type-Options");
    issue("X-Content-Type-Options", "medium", "X-Content-Type-Options: nosniff eksik.", "X-Content-Type-Options: nosniff is missing.");
  }

  // Referrer-Policy — 5
  const referrer = header(headers, "referrer-policy");
  const referrerTokens = referrer?.toLowerCase().split(",").map((s) => s.trim()) ?? [];
  if (referrerTokens.some((r) => GOOD_REFERRER.has(r))) score += 5;
  else {
    missing.add("Referrer-Policy");
    issue("Referrer-Policy", "low", "Referrer-Policy eksik veya zayıf.", "Referrer-Policy is missing or weak.");
  }

  // Permissions-Policy — 5
  const permissions = !!header(headers, "permissions-policy");
  if (permissions) score += 5;
  else {
    missing.add("Permissions-Policy");
    issue("Permissions-Policy", "low", "Permissions-Policy eksik.", "Permissions-Policy is missing.");
  }

  // COOP — 5
  const coop = header(headers, "cross-origin-opener-policy");
  if (coop && /same-origin/i.test(coop)) score += 5;
  else {
    missing.add("Cross-Origin-Opener-Policy");
    issue("Cross-Origin-Opener-Policy", "low", "Cross-Origin-Opener-Policy eksik.", "Cross-Origin-Opener-Policy is missing.");
  }

  // Information leakage — 5
  const server = header(headers, "server");
  const poweredBy = header(headers, "x-powered-by");
  const serverLeaks = !!server && /\d/.test(server);
  if (!serverLeaks && !poweredBy) score += 5;
  if (serverLeaks) issue("Server", "low", `Server header'ı sürüm bilgisi sızdırıyor (${server}).`, `The Server header leaks version information (${server}).`);
  if (poweredBy) issue("X-Powered-By", "low", `X-Powered-By header'ı teknoloji bilgisi sızdırıyor (${poweredBy}).`, `X-Powered-By leaks technology information (${poweredBy}).`);

  // Cookies — 5
  const cookies = headerList(headers, "set-cookie").map(parseSetCookie);
  const badCookies = cookies.filter((c) => !c.secure || !c.http_only || !c.same_site);
  if (badCookies.length === 0) score += 5;
  for (const c of badCookies) {
    const missingFlags = [!c.secure && "Secure", !c.http_only && "HttpOnly", !c.same_site && "SameSite"].filter(Boolean).join(", ");
    issue("Set-Cookie", "medium", `'${c.name}' çerezinde eksik bayraklar: ${missingFlags}.`, `Cookie '${c.name}' is missing flags: ${missingFlags}.`);
  }

  // HTTP → HTTPS redirect — 5
  if (input.httpRedirectsToHttps === true) score += 5;
  else if (input.httpRedirectsToHttps === false) {
    issue("Location", "medium", "HTTP istekleri HTTPS'e yönlendirilmiyor.", "HTTP requests are not redirected to HTTPS.");
  }

  // TLS — 5
  const tls = input.tls;
  if (isHttps && tls) {
    if (tls.valid && (tls.days_remaining ?? 0) >= 14) score += 5;
    else if (tls.valid) {
      score += 2;
      issue("TLS", "high", `TLS sertifikasının bitmesine ${tls.days_remaining} gün kaldı.`, `The TLS certificate expires in ${tls.days_remaining} days.`);
    } else {
      issue("TLS", "critical", `TLS sertifikası geçersiz: ${tls.error ?? "bilinmeyen hata"}.`, `The TLS certificate is invalid: ${tls.error ?? "unknown error"}.`);
    }
  } else if (!isHttps) {
    issue("TLS", "critical", "Site HTTPS kullanmıyor.", "The site does not use HTTPS.");
  }

  const hasCritical = issues.some((i) => i.severity === "critical");
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  return {
    url: input.url,
    final_url: input.finalUrl,
    status: input.status,
    grade: gradeFor(finalScore, hasCritical),
    score: finalScore,
    checks: {
      hsts,
      csp: { present: !!cspValue, weaknesses },
      clickjacking: { protected: !!clickjackingVia, via: clickjackingVia },
      x_content_type_options: nosniff,
      referrer_policy: referrer,
      permissions_policy: permissions,
      coop,
      info_leak: { server, x_powered_by: poweredBy },
      cookies,
      https_redirect: input.httpRedirectsToHttps,
      tls,
    },
    issues,
    fixes: buildFixes([...missing]),
  };
}
