import { describe, expect, it } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import { frontendApiFromPublishableKey, sessionTokensFromCookies, verifySessionToken, type JwksFetcher } from "@/lib/clerk-session";

const FAPI = "amazed-rhino-1426.clerk.accounts.dev";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = publicKey.export({ format: "jwk" }) as { n: string; e: string };
const fetcher: JwksFetcher = async () => ({ keys: [{ kid: "ins_test", kty: "RSA", alg: "RS256", n: jwk.n, e: jwk.e }] });

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
function token(claims: Record<string, unknown>, header: Record<string, unknown> = { alg: "RS256", kid: "ins_test", typ: "JWT" }) {
  const data = `${b64(header)}.${b64(claims)}`;
  return `${data}.${sign("RSA-SHA256", Buffer.from(data), privateKey).toString("base64url")}`;
}

const now = Math.floor(Date.now() / 1000);
const base = { sub: "user_123", iss: `https://${FAPI}`, exp: now + 60, nbf: now - 5, iat: now, azp: "https://cyberqua.vercel.app" };
const opts = { frontendApi: FAPI, authorizedParties: ["https://cyberqua.vercel.app"], fetcher };

describe("Clerk session verification (no secret key)", () => {
  it("decodes the frontend API from a publishable key", () => {
    expect(frontendApiFromPublishableKey("pk_test_YW1hemVkLXJoaW5vLTE0MjYuY2xlcmsuYWNjb3VudHMuZGV2JA")).toBe(FAPI);
    expect(frontendApiFromPublishableKey("nope")).toBeNull();
  });

  it("accepts a valid token", async () => {
    expect((await verifySessionToken(token(base), opts))?.sub).toBe("user_123");
  });

  it("rejects expired, wrong issuer, wrong azp, bad signature and alg none", async () => {
    expect(await verifySessionToken(token({ ...base, exp: now - 60 }), opts)).toBeNull();
    expect(await verifySessionToken(token({ ...base, iss: "https://evil.clerk.accounts.dev" }), opts)).toBeNull();
    expect(await verifySessionToken(token({ ...base, azp: "https://evil.example" }), opts)).toBeNull();
    const t = token(base);
    const tampered = t.split(".");
    tampered[1] = b64({ ...base, sub: "user_admin" });
    expect(await verifySessionToken(tampered.join("."), opts)).toBeNull();
    const none = `${b64({ alg: "none", kid: "ins_test" })}.${b64(base)}.`;
    expect(await verifySessionToken(none, opts)).toBeNull();
    expect(await verifySessionToken(token({ ...base, sts: "pending" }), opts)).toBeNull();
  });

  it("finds session cookies", () => {
    expect(sessionTokensFromCookies([{ name: "__session_abc", value: "a" }, { name: "__session", value: "b" }, { name: "x", value: "c" }])).toEqual(["a", "b"]);
  });
});
