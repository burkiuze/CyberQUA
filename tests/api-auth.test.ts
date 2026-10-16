import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createApiHandler, type ApiKeyRecord, type AuthDeps, type EndpointDef, type UsageEntry } from "@/lib/api/with-api-auth";
import { generateApiKey, hashApiKey, keyPrefix, normalizeOrigin, originAllowed } from "@/lib/api/keys";

const echoSchema = z.object({ value: z.string().min(1) }).strict();

function endpoint(publishable = true): EndpointDef<typeof echoSchema> {
  return {
    path: "/echo",
    method: "POST",
    publishable,
    source: "body",
    maxBodyBytes: 1024,
    schema: echoSchema,
    run: async (input) => ({ data: { echoed: input.value }, sources: ["test"], partial: false }),
  };
}

function setup(overrides: Partial<ApiKeyRecord> = {}, rate = { success: true, remaining: 29 }, quotaAllowed = true) {
  const key = generateApiKey(overrides.type ?? "secret");
  const record: ApiKeyRecord = {
    id: "11111111-1111-1111-1111-111111111111",
    user_id: "user_test",
    type: "secret",
    allowed_origins: [],
    revoked: false,
    plan: "free",
    ...overrides,
  };
  const logs: UsageEntry[] = [];
  const pending: Promise<unknown>[] = [];
  const deps: AuthDeps = {
    findKey: async (hash) => (hash === hashApiKey(key) ? record : null),
    rateLimit: async (_id, limit) => ({ success: rate.success, limit, remaining: rate.remaining, reset: Date.now() + 30_000 }),
    incrementQuota: async () => ({ allowed: quotaAllowed, used: 1 }),
    logUsage: async (entry) => {
      logs.push(entry);
    },
    waitUntil: (p) => {
      pending.push(p);
    },
  };
  return { key, deps, logs, pending };
}

function request(key: string | null, body: unknown = { value: "hi" }, headers: Record<string, string> = {}) {
  return new Request("https://cyberqua.test/api/v1/echo", {
    method: "POST",
    headers: { "content-type": "application/json", ...(key !== null ? { authorization: `Bearer ${key}` } : {}), ...headers },
    body: JSON.stringify(body),
  });
}

async function json(res: Response) {
  return (await res.json()) as { success: boolean; error?: { code: string; message: string; details?: unknown }; data?: unknown; meta: Record<string, unknown> };
}

describe("withApiAuth", () => {
  it("returns 401 missing_api_key without Authorization", async () => {
    const { deps } = setup();
    const res = await createApiHandler(endpoint(), deps)(request(null));
    expect(res.status).toBe(401);
    const body = await json(res);
    expect(body.error?.code).toBe("missing_api_key");
    expect(body.meta.request_id).toMatch(/^req_[A-Za-z0-9]{20}$/);
    expect(res.headers.get("x-request-id")).toBe(body.meta.request_id);
  });

  it("returns 401 invalid_api_key for a malformed key", async () => {
    const { deps } = setup();
    for (const bad of ["cq_live_short", "sk_live_" + "a".repeat(32), "cq_test_" + "a".repeat(32), "cq_live_" + "a".repeat(31) + "!"]) {
      const res = await createApiHandler(endpoint(), deps)(request(bad));
      expect(res.status).toBe(401);
      expect((await json(res)).error?.code).toBe("invalid_api_key");
    }
  });

  it("returns 401 invalid_api_key for an unknown key", async () => {
    const { deps } = setup();
    const res = await createApiHandler(endpoint(), deps)(request(generateApiKey("secret")));
    expect((await json(res)).error?.code).toBe("invalid_api_key");
  });

  it("returns 401 revoked_api_key for a revoked key", async () => {
    const { key, deps, logs } = setup({ revoked: true });
    const res = await createApiHandler(endpoint(), deps)(request(key));
    expect(res.status).toBe(401);
    expect((await json(res)).error?.code).toBe("revoked_api_key");
    expect(logs).toHaveLength(1);
    expect(logs[0]?.status_code).toBe(401);
  });

  it("returns 429 rate_limited with Retry-After when the limit is exceeded", async () => {
    const { key, deps } = setup({}, { success: false, remaining: 0 });
    const res = await createApiHandler(endpoint(), deps)(request(key));
    expect(res.status).toBe(429);
    expect((await json(res)).error?.code).toBe("rate_limited");
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(res.headers.get("x-ratelimit-limit")).toBe("30");
    expect(res.headers.get("x-ratelimit-remaining")).toBe("0");
  });

  it("returns 429 quota_exceeded when the monthly quota is used up", async () => {
    const { key, deps } = setup({}, { success: true, remaining: 10 }, false);
    const res = await createApiHandler(endpoint(), deps)(request(key));
    expect((await json(res)).error?.code).toBe("quota_exceeded");
  });

  it("rejects secret keys used from a browser", async () => {
    const { key, deps } = setup();
    const res = await createApiHandler(endpoint(), deps)(request(key, undefined, { origin: "https://app.example" }));
    expect(res.status).toBe(403);
    expect((await json(res)).error?.code).toBe("secret_key_in_browser");
  });

  it("enforces publishable key origin allowlist and endpoint restrictions", async () => {
    const { key, deps } = setup({ type: "publishable", allowed_origins: ["https://app.example"] });
    const ok = await createApiHandler(endpoint(true), deps)(request(key, undefined, { origin: "https://app.example" }));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("access-control-allow-origin")).toBe("https://app.example");
    expect(ok.headers.get("x-ratelimit-limit")).toBe("10");

    const wrongOrigin = await createApiHandler(endpoint(true), deps)(request(key, undefined, { origin: "https://evil.example" }));
    expect((await json(wrongOrigin)).error?.code).toBe("origin_not_allowed");

    const noOrigin = await createApiHandler(endpoint(true), deps)(request(key));
    expect((await json(noOrigin)).error?.code).toBe("origin_not_allowed");

    const secretOnly = await createApiHandler(endpoint(false), deps)(request(key, undefined, { origin: "https://app.example" }));
    expect((await json(secretOnly)).error?.code).toBe("endpoint_not_allowed");
  });

  it("returns 400 invalid_request with field details", async () => {
    const { key, deps } = setup();
    const res = await createApiHandler(endpoint(), deps)(request(key, { value: "" }));
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error?.code).toBe("invalid_request");
    expect(JSON.stringify(body.error?.details)).toContain("value");
  });

  it("returns 413 payload_too_large for oversized bodies", async () => {
    const { key, deps } = setup();
    const res = await createApiHandler(endpoint(), deps)(request(key, { value: "x".repeat(5000) }));
    expect(res.status).toBe(413);
  });

  it("answers in English when Accept-Language prefers en", async () => {
    const { deps } = setup();
    const res = await createApiHandler(endpoint(), deps)(request(null, undefined, { "accept-language": "en-US,en;q=0.9,tr;q=0.8" }));
    expect((await json(res)).error?.message).toMatch(/API key is missing/);
  });

  it("succeeds with the standard envelope, headers and a usage log", async () => {
    const { key, deps, logs, pending } = setup();
    const res = await createApiHandler(endpoint(), deps)(request(key));
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ echoed: "hi" });
    expect(body.meta.sources_used).toEqual(["test"]);
    expect(body.meta.partial).toBe(false);
    expect(typeof body.meta.latency_ms).toBe("number");
    for (const h of ["x-request-id", "x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset"]) {
      expect(res.headers.get(h), h).toBeTruthy();
    }
    await Promise.all(pending);
    expect(logs).toEqual([
      expect.objectContaining({ user_id: "user_test", endpoint: "/echo", status_code: 200 }),
    ]);
    // Usage logs never contain request content.
    expect(JSON.stringify(logs)).not.toContain("hi");
  });
});

describe("API keys", () => {
  it("generates keys in the documented format", () => {
    const secret = generateApiKey("secret");
    const pub = generateApiKey("publishable");
    expect(secret).toMatch(/^cq_live_[A-Za-z0-9]{32}$/);
    expect(pub).toMatch(/^cq_pub_[A-Za-z0-9]{32}$/);
    expect(keyPrefix(secret)).toHaveLength(12);
    expect(hashApiKey(secret)).toMatch(/^[0-9a-f]{64}$/);
    expect(generateApiKey("secret")).not.toBe(secret);
  });

  it("normalises and matches allowed origins", () => {
    expect(normalizeOrigin("https://Example.com/")).toBe("https://example.com");
    expect(normalizeOrigin("http://example.com")).toBeNull();
    expect(normalizeOrigin("http://localhost:3000")).toBe("http://localhost:3000");
    expect(normalizeOrigin("https://example.com/path")).toBeNull();
    expect(normalizeOrigin("https://*.example.com")).toBe("https://*.example.com");
    expect(originAllowed("https://app.example.com", ["https://*.example.com"])).toBe(true);
    expect(originAllowed("https://example.com", ["https://*.example.com"])).toBe(false);
    expect(originAllowed("https://evil-example.com", ["https://*.example.com"])).toBe(false);
    expect(originAllowed("https://example.com.evil.io", ["https://example.com"])).toBe(false);
  });
});
