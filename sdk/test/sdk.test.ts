import { describe, expect, it } from "vitest";
import { CyberQUA, CyberQUAError, estimateStrength, sha1Hex, shield } from "../src/index.js";

const KEY = "cq_live_" + "A1b2C3d4".repeat(4);

function mockFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return handler(url, init);
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const ok = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { request_id: "req_x", latency_ms: 1, sources_used: [], partial: false } }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("CyberQUA client", () => {
  it("validates the api key", () => {
    expect(() => new CyberQUA({ apiKey: undefined })).toThrow(CyberQUAError);
    expect(() => new CyberQUA({ apiKey: "nope" })).toThrow(/invalid format/);
  });

  it("checks a password with k-anonymity: only 5 hash characters leave the device", async () => {
    const password = "Galatasaray1905";
    const hash = await sha1Hex(password);
    const { fn, calls } = mockFetch(() =>
      ok({ prefix: hash.slice(0, 5), suffixes: [{ suffix: hash.slice(5), count: 4242 }, { suffix: "0".repeat(35), count: 1 }] }),
    );
    const cq = new CyberQUA({ apiKey: KEY, baseUrl: "https://api.test", fetch: fn });
    const result = await cq.password.check(password);
    expect(result.leaked).toBe(true);
    expect(result.leak_count).toBe(4242);
    expect(result.score).toBe(0);
    expect(result.tips.length).toBeGreaterThan(0);
    const sent = String(calls[0]!.init.body);
    expect(sent).toBe(JSON.stringify({ sha1_prefix: hash.slice(0, 5) }));
    expect(sent).not.toContain(password);
    expect(sent).not.toContain(hash.slice(5));
    expect(calls[0]!.url).toBe("https://api.test/api/v1/password/range");
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
  });

  it("retries 429/503 honouring Retry-After, at most twice", async () => {
    let n = 0;
    const { fn, calls } = mockFetch(() => {
      n++;
      if (n <= 2) {
        return new Response(JSON.stringify({ success: false, error: { code: "rate_limited", message: "slow down" }, meta: { request_id: "r" } }), {
          status: 429,
          headers: { "retry-after": "0" },
        });
      }
      return ok({ ip: "1.1.1.1" });
    });
    const cq = new CyberQUA({ apiKey: KEY, fetch: fn });
    await expect(cq.ip.check("1.1.1.1")).resolves.toMatchObject({ ip: "1.1.1.1" });
    expect(calls).toHaveLength(3);

    const always = mockFetch(() => new Response(JSON.stringify({ success: false, error: { code: "upstream_unavailable", message: "down" } }), { status: 503, headers: { "retry-after": "0" } }));
    const cq2 = new CyberQUA({ apiKey: KEY, fetch: always.fn });
    await expect(cq2.url.check("https://x.test")).rejects.toMatchObject({ code: "upstream_unavailable", status: 503 });
    expect(always.calls).toHaveLength(3);
  });

  it("does not retry quota_exceeded and exposes code/status/message", async () => {
    const { fn, calls } = mockFetch(() => new Response(JSON.stringify({ success: false, error: { code: "quota_exceeded", message: "Aylık istek kotanız doldu." } }), { status: 429 }));
    const cq = new CyberQUA({ apiKey: KEY, fetch: fn });
    const err = await cq.email.check("a@b.co").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CyberQUAError);
    expect(err).toMatchObject({ code: "quota_exceeded", status: 429, message: "Aylık istek kotanız doldu." });
    expect(calls).toHaveLength(1);
  });

  it("times out", async () => {
    const fn = ((_: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      })) as unknown as typeof fetch;
    const cq = new CyberQUA({ apiKey: KEY, fetch: fn, timeout: 20 });
    await expect(cq.url.check("https://x.test")).rejects.toMatchObject({ code: "timeout" });
  });

  it("builds request paths for every endpoint", async () => {
    const { fn, calls } = mockFetch(() => ok({}));
    const cq = new CyberQUA({ apiKey: KEY, baseUrl: "https://api.test/", fetch: fn });
    await cq.url.check("https://g00gle-login.xyz");
    await cq.headers.check("https://example.com/?a=1");
    await cq.email.check("ali@tempmail.com");
    await cq.ip.check("2001:db8::1");
    await cq.secrets.scan("const a = 1;", { filename: "a.js" });
    expect(calls.map((c) => `${c.init.method} ${c.url.replace("https://api.test/api/v1", "")}`)).toEqual([
      "POST /url/check",
      "GET /headers?url=https%3A%2F%2Fexample.com%2F%3Fa%3D1",
      "POST /email/check",
      "GET /ip/2001%3Adb8%3A%3A1",
      "POST /secrets/scan",
    ]);
  });
});

describe("password strength (on-device)", () => {
  it("penalises Turkish dictionary words, years and keyboard runs", () => {
    expect(estimateStrength("Galatasaray1905").score).toBeLessThanOrEqual(1);
    expect(estimateStrength("qwerty123").score).toBe(0);
    expect(estimateStrength("fenerbahce1907", "en").tips.join(" ")).toMatch(/team names/);
    expect(estimateStrength("istanbul34").score).toBeLessThanOrEqual(1);
  });

  it("rates long random passphrases highly", () => {
    expect(estimateStrength("kedi-Masa_bulut!Pencere7-armut").score).toBeGreaterThanOrEqual(3);
    expect(estimateStrength("x9#Lq2!vR7&mZp4@Wd").score).toBe(4);
  });

  it("returns localised tips", () => {
    expect(estimateStrength("abc", "tr").tips.some((t) => t.includes("karakter"))).toBe(true);
    expect(estimateStrength("abc", "en").tips.some((t) => t.includes("characters"))).toBe(true);
  });
});

describe("shield", () => {
  it("sets security headers as Express middleware", () => {
    const set: Record<string, string> = {};
    let removed = "";
    let nextCalled = false;
    const cq = new CyberQUA({ apiKey: KEY, fetch: (() => {}) as unknown as typeof fetch });
    const mw = cq.shield();
    mw({}, { setHeader: (k, v) => (set[k] = v), removeHeader: (k) => (removed = k) }, () => (nextCalled = true));
    expect(nextCalled).toBe(true);
    expect(removed).toBe("X-Powered-By");
    expect(set["Strict-Transport-Security"]).toContain("preload");
    expect(set["X-Content-Type-Options"]).toBe("nosniff");
    expect(set["Content-Security-Policy"]).toContain("object-src 'none'");
  });

  it("produces next.config headers and applies to Headers objects", () => {
    expect(shield.nextHeaders({ hstsMaxAge: false })).not.toContainEqual(expect.objectContaining({ key: "Strict-Transport-Security" }));
    const h = new Headers();
    shield.apply(h, { frameOptions: "SAMEORIGIN" });
    expect(h.get("x-frame-options")).toBe("SAMEORIGIN");
  });
});
