import { describe, expect, it } from "vitest";
import { analyzeUrlHeuristics, checkUrl, detectLookalike, homoglyphVariants } from "@/lib/checks/url";

describe("lookalike detection", () => {
  it("flags g00gle.com as a google lookalike", () => {
    const match = detectLookalike("g00gle.com");
    expect(match?.brand).toBe("google");
    expect(match?.kind).toBe("homoglyph");
  });

  it("flags paypa1.com as a paypal lookalike", () => {
    const match = detectLookalike("paypa1.com");
    expect(match?.brand).toBe("paypal");
  });

  it("flags Cyrillic аpple.com (punycode) as an apple lookalike", () => {
    const host = new URL("https://аpple.com").hostname;
    expect(host.startsWith("xn--")).toBe(true);
    const match = detectLookalike(host);
    expect(match?.brand).toBe("apple");
    expect(match?.kind).toBe("homoglyph");
  });

  it("flags a brand used in a subdomain of an unrelated domain", () => {
    const match = detectLookalike("garanti.guvenli-giris.xyz");
    expect(match?.brand).toBe("garantibbva");
    expect(match?.kind).toBe("subdomain");
  });

  it("flags rn→m and vv→w substitutions", () => {
    expect(homoglyphVariants("arnazon")).toContain("amazon");
    expect(detectLookalike("vvhatsapp.net")?.brand).toBe("whatsapp");
  });

  it("does not flag official domains or their subdomains", () => {
    expect(detectLookalike("google.com")).toBeNull();
    expect(detectLookalike("mail.google.com")).toBeNull();
    expect(detectLookalike("turkiye.gov.tr")).toBeNull();
  });

  it("does not flag unrelated domains", () => {
    expect(detectLookalike("example.com")).toBeNull();
    expect(detectLookalike("wikipedia.org")).toBeNull();
  });
});

describe("checkUrl", () => {
  it("rates google.com as safe", async () => {
    const result = await checkUrl("https://google.com", "tr");
    expect(result?.data.risk).toBe("safe");
    expect(result?.data.reasons).toHaveLength(0);
  });

  it("rates g00gle-login.xyz with a brand-new domain as critical", async () => {
    const now = new Date("2026-10-16T00:00:00Z");
    const result = await checkUrl("https://g00gle-login.xyz/verify", "tr", {
      now,
      domainAge: async () => ({ registeredAt: new Date("2026-10-12T00:00:00Z") }),
    });
    expect(result?.data.risk).toBe("critical");
    expect(result?.data.checks.domain_age_days).toBe(4);
    expect(result?.data.checks.suspicious_tld).toBe(true);
    const codes = result?.data.reasons.map((r) => r.code);
    expect(codes).toContain("lookalike_domain");
    expect(codes).toContain("new_domain");
    expect(result?.sources).toEqual(["heuristics", "rdap"]);
  });

  it("forces a 95+ score when blacklisted", async () => {
    const result = await checkUrl("https://example.com/", "en", {
      blacklists: [{ name: "urlhaus", check: async () => true }],
    });
    expect(result?.data.score).toBeGreaterThanOrEqual(95);
    expect(result?.data.checks.blacklisted).toBe(true);
  });

  it("marks the result partial when an upstream fails, without crashing", async () => {
    const result = await checkUrl("https://example.com/", "en", {
      domainAge: async () => {
        throw new Error("timeout");
      },
      blacklists: [{ name: "google_web_risk", check: async () => { throw new Error("503"); } }],
    });
    expect(result?.partial).toBe(true);
    expect(result?.data.checks.blacklisted).toBeNull();
  });

  it("detects shorteners, @ signs, redirect params and raw IPs", () => {
    expect(analyzeUrlHeuristics("https://bit.ly/abc", "tr")?.checks.shortened).toBe(true);
    const at = analyzeUrlHeuristics("https://paypal.com@evil.example/", "tr");
    expect(at?.findings.map((f) => f.code)).toContain("at_sign");
    expect(analyzeUrlHeuristics("https://x.example/?redirect=https://evil", "tr")?.checks.redirect_param).toBe(true);
    expect(analyzeUrlHeuristics("http://192.168.1.1/login", "tr")?.checks.ip_host).toBe(true);
  });

  it("returns null for invalid URLs", async () => {
    expect(await checkUrl("javascript:alert(1)", "tr")).toBeNull();
  });
});
