import { describe, expect, it } from "vitest";
import { maskSecret, scanSecrets, shannonEntropy } from "@/lib/checks/secrets";
import { isSupabaseServiceRoleJwt } from "@/lib/data/secret-rules";

/*
 * Test credentials are assembled at runtime so that this file never contains
 * a literal that looks like a real secret (keeps secret scanners quiet).
 */
const j = (...parts: string[]) => parts.join("");
const alnum = (n: number, seed = 7) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  let x = seed;
  for (let i = 0; i < n; i++) {
    x = (x * 1103515245 + 12345) % 2147483648;
    out += chars[x % chars.length];
  }
  return out;
};
const hex = (n: number) => alnum(n * 2).replace(/[^0-9a-f]/g, "").padEnd(n, "a").slice(0, n);
const b64url = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");

const POSITIVES: Record<string, string> = {
  "openrouter-api-key": j("sk-", "or-v1-", hex(64)),
  "anthropic-api-key": j("sk-", "ant-api03-", alnum(95, 3)),
  "openai-project-key": j("sk-", "proj-", alnum(120, 5)),
  "openai-api-key": j("sk-", alnum(20, 11), "T3Blbk", "FJ", alnum(20, 13)),
  "google-api-key": j("AI", "za", alnum(35, 17)),
  "github-fine-grained-pat": j("github", "_pat_", alnum(82, 19)),
  "github-token": j("gh", "p_", alnum(36, 23)),
  "aws-access-key-id": j("AK", "IA", alnum(16, 29).toUpperCase().replace(/[^A-Z0-9]/g, "Q")),
  "stripe-live-key": j("sk", "_live_", alnum(32, 31)),
  "supabase-service-role-jwt": j("eyJ", b64url({ alg: "HS256", typ: "JWT" }).slice(3), ".", b64url({ iss: "supabase", role: "service_role", ref: "abcdefghij" }), ".", alnum(43, 37)),
  "supabase-secret-key": j("sb_", "secret_", alnum(32, 41)),
  "slack-token": j("xo", "xb-", "1234567890", "-", alnum(24, 43)),
  "telegram-bot-token": j("123456789", ":", "AA", alnum(33, 47)),
  "discord-bot-token": j("M", alnum(25, 53), ".", alnum(6, 59), ".", alnum(38, 61)),
  "private-key": j("-----BEGIN ", "RSA PRIVATE KEY-----\n", alnum(64, 67), "\n-----END RSA ", "PRIVATE KEY-----"),
  "generic-high-entropy-secret": j("const ", "apiSecret", " = \"", alnum(40, 71), "\";"),
};

const NEGATIVES: Record<string, string> = {
  "openrouter-api-key": "sk-or-v1-not-a-real-key",
  "anthropic-api-key": "sk-ant-short",
  "openai-project-key": "sk-proj-tooShort",
  "openai-api-key": "sk-123",
  "google-api-key": "AIzaShort",
  "github-fine-grained-pat": "github_pat_short",
  "github-token": "ghp_short",
  "aws-access-key-id": "AKIA123",
  "stripe-live-key": "sk_test_" + alnum(32, 73),
  "supabase-service-role-jwt": j("eyJ", b64url({ alg: "HS256", typ: "JWT" }).slice(3), ".", b64url({ iss: "supabase", role: "anon" }), ".", alnum(43, 79)),
  "supabase-secret-key": "sb_publishable_" + alnum(32, 83),
  "slack-token": "xoxb-",
  "telegram-bot-token": "123:AA",
  "discord-bot-token": "Mshort.abc.def",
  "private-key": "-----BEGIN PUBLIC KEY-----",
  "generic-high-entropy-secret": 'const password = "aaaaaaaaaaaaaaaaaaaaaaaa";',
};

describe("secret scanning rules", () => {
  for (const [ruleId, sample] of Object.entries(POSITIVES)) {
    it(`detects ${ruleId}`, () => {
      const content = `line one\nconst value = "${sample.replace(/"/g, "'")}";\n`;
      const target = ruleId === "generic-high-entropy-secret" || ruleId === "private-key" ? `first\n${sample}\n` : content;
      const { findings } = scanSecrets(target, "en");
      const hit = findings.find((f) => f.rule_id === ruleId);
      expect(hit, JSON.stringify(findings)).toBeDefined();
      expect(hit!.line).toBe(2);
      expect(hit!.column).toBeGreaterThan(0);
      expect(hit!.remediation.length).toBeGreaterThan(10);
    });
  }

  for (const [ruleId, sample] of Object.entries(NEGATIVES)) {
    it(`does not flag a non-secret for ${ruleId}`, () => {
      const { findings } = scanSecrets(`x = "${sample}"\n`, "en");
      expect(findings.find((f) => f.rule_id === ruleId)).toBeUndefined();
    });
  }

  it("never returns the full secret value", () => {
    const content = Object.values(POSITIVES).join("\n");
    const result = scanSecrets(content, "tr");
    expect(result.findings.length).toBeGreaterThanOrEqual(Object.keys(POSITIVES).length);
    const serialized = JSON.stringify(result);
    for (const secret of Object.values(POSITIVES)) {
      const raw = secret.replace(/^const apiSecret = "|";$/g, "");
      expect(serialized.includes(raw)).toBe(false);
    }
    for (const f of result.findings) expect(f.masked).toContain("****");
  });

  it("masks with first 4 + **** + last 4 for long values", () => {
    expect(maskSecret("AKIAABCDEFGHIJKLMNOP")).toBe("AKIA****MNOP");
    expect(maskSecret("short123")).toBe("sh****23");
    expect(maskSecret("tiny")).toBe("****");
  });

  it("ignores env references and placeholders", () => {
    const { findings } = scanSecrets('const token = process.env.GITHUB_TOKEN_VALUE_FROM_ENV;\nconst api_key = "your_api_key_here_please_replace";', "en");
    expect(findings).toHaveLength(0);
  });

  it("computes Shannon entropy", () => {
    expect(shannonEntropy("aaaa")).toBe(0);
    expect(shannonEntropy(alnum(64))).toBeGreaterThan(4);
  });

  it("decodes Supabase JWT roles", () => {
    expect(isSupabaseServiceRoleJwt(POSITIVES["supabase-service-role-jwt"]!)).toBe(true);
    expect(isSupabaseServiceRoleJwt(NEGATIVES["supabase-service-role-jwt"]!)).toBe(false);
  });
});
