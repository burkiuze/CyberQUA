import { describe, expect, it } from "vitest";
import { auditHeaders, cspWeaknesses, parseHsts } from "@/lib/checks/headers";
import { parseRangeResponse } from "@/lib/checks/password-range";
import { localeFromAcceptLanguage } from "@/lib/i18n/locale";

const goodTls = { valid: true, valid_to: "2027-01-01T00:00:00.000Z", days_remaining: 90, issuer: "Let's Encrypt", error: null };

describe("header audit", () => {
  it("grades CyberQUA's own production headers A+", () => {
    // Mirrors next.config.ts + the Clerk strict CSP emitted by proxy.ts.
    const result = auditHeaders(
      {
        url: "https://cyberqua.dev/",
        finalUrl: "https://cyberqua.dev/",
        status: 200,
        headers: {
          "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
          "x-content-type-options": "nosniff",
          "x-frame-options": "DENY",
          "referrer-policy": "strict-origin-when-cross-origin",
          "permissions-policy": "camera=(), microphone=(), geolocation=()",
          "cross-origin-opener-policy": "same-origin",
          "content-security-policy":
            "base-uri 'self'; default-src 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' 'unsafe-inline' https://*.protect.clerk.com 'strict-dynamic' 'nonce-abc123=='; style-src 'self' 'unsafe-inline'",
          "set-cookie": ["__client_uat=0; Path=/; Secure; HttpOnly; SameSite=Lax"],
        },
        httpRedirectsToHttps: true,
        tls: goodTls,
      },
      "tr",
    );
    expect(result.grade).toBe("A+");
    expect(result.score).toBeGreaterThanOrEqual(95);
    expect(result.fixes.missing).toHaveLength(0);
  });

  it("grades a bare site F and produces fixes", () => {
    const result = auditHeaders(
      {
        url: "http://example.com/",
        finalUrl: "http://example.com/",
        status: 200,
        headers: { server: "Apache/2.4.1", "x-powered-by": "PHP/8.1", "set-cookie": "sid=1; Path=/" },
        httpRedirectsToHttps: false,
        tls: null,
      },
      "en",
    );
    expect(result.grade).toBe("F");
    expect(result.fixes.missing).toContain("Content-Security-Policy");
    expect(result.fixes.vercel_json).toContain("Strict-Transport-Security");
    expect(result.fixes.nginx).toContain("add_header X-Content-Type-Options");
    expect(result.fixes.express).toContain('res.setHeader("X-Frame-Options"');
    expect(result.fixes.netlify_headers.startsWith("/*")).toBe(true);
    expect(result.fixes.next_config).toContain("async headers()");
    expect(result.issues.some((i) => i.header === "X-Powered-By")).toBe(true);
  });

  it("warns when the certificate expires within 14 days", () => {
    const result = auditHeaders(
      { url: "https://x.test/", finalUrl: "https://x.test/", status: 200, headers: {}, httpRedirectsToHttps: true, tls: { ...goodTls, days_remaining: 5 } },
      "en",
    );
    expect(result.issues.some((i) => i.header === "TLS" && /5 days/.test(i.message))).toBe(true);
  });

  it("detects CSP weaknesses", () => {
    expect(cspWeaknesses("default-src *; script-src 'self' 'unsafe-inline' 'unsafe-eval'")).toEqual(
      expect.arrayContaining(["unsafe_inline", "unsafe_eval", "wildcard_source", "missing_object_src_none"]),
    );
    expect(cspWeaknesses("default-src 'self'; script-src 'nonce-x' 'unsafe-inline' 'strict-dynamic' https:; object-src 'none'; base-uri 'none'")).toEqual([]);
  });

  it("parses HSTS", () => {
    expect(parseHsts("max-age=31536000; includeSubDomains; preload")).toEqual({ present: true, max_age: 31536000, include_subdomains: true, preload: true });
  });
});

describe("password range", () => {
  it("drops padding rows with count 0", () => {
    const body = "0018A45C4D1DEF81644B54AB7F969B88D65:3\r\n00D4F6E8FA6EECAD2A3AA415EEC418D38EC:0\r\nnot-a-line\r\n011053FD0102E94D6AE2F8B83D76FAF94F6:12";
    expect(parseRangeResponse(body)).toEqual([
      { suffix: "0018A45C4D1DEF81644B54AB7F969B88D65", count: 3 },
      { suffix: "011053FD0102E94D6AE2F8B83D76FAF94F6", count: 12 },
    ]);
  });
});

describe("locale", () => {
  it("defaults to Turkish and honours q-values", () => {
    expect(localeFromAcceptLanguage(null)).toBe("tr");
    expect(localeFromAcceptLanguage("de-DE")).toBe("tr");
    expect(localeFromAcceptLanguage("en-US,en;q=0.9")).toBe("en");
    expect(localeFromAcceptLanguage("en;q=0.5,tr;q=0.8")).toBe("tr");
  });
});
