import { createPublicKey, verify as verifySignature, type KeyObject } from "node:crypto";

/**
 * Verifies Clerk session tokens without the Clerk secret key.
 *
 * Clerk signs every session token (`__session` cookie) with RS256. The public
 * keys are published at `https://<frontend-api>/.well-known/jwks.json`, so the
 * server can verify signature, issuer, expiry and authorized party on its own.
 * The browser-side Clerk SDK keeps the cookie fresh (tokens live ~60 s).
 */

export interface SessionClaims {
  sub: string;
  sid?: string;
  iss: string;
  exp: number;
  nbf?: number;
  iat?: number;
  azp?: string;
  sts?: string;
}

interface Jwk {
  kid: string;
  kty: string;
  alg?: string;
  n: string;
  e: string;
  use?: string;
}

const CLOCK_SKEW_SECONDS = 5;
const JWKS_TTL_MS = 60 * 60 * 1000;

/** Frontend API host encoded in a publishable key: pk_test_<base64("host$")>. */
export function frontendApiFromPublishableKey(publishableKey: string): string | null {
  const m = /^pk_(test|live)_([A-Za-z0-9+/=_-]+)$/.exec(publishableKey.trim());
  if (!m) return null;
  try {
    const decoded = Buffer.from(m[2]!, "base64").toString("utf8");
    if (!decoded.endsWith("$")) return null;
    const host = decoded.slice(0, -1);
    return /^[a-z0-9.-]+$/i.test(host) ? host : null;
  } catch {
    return null;
  }
}

function base64UrlDecode(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export type JwksFetcher = (url: string) => Promise<{ keys: Jwk[] }>;

const defaultFetcher: JwksFetcher = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(5000), cache: "no-store" });
  if (!res.ok) throw new Error(`jwks_${res.status}`);
  return (await res.json()) as { keys: Jwk[] };
};

const jwksCache = new Map<string, { at: number; keys: Map<string, KeyObject> }>();

async function getKey(issuer: string, kid: string, fetcher: JwksFetcher): Promise<KeyObject | null> {
  const url = `${issuer}/.well-known/jwks.json`;
  let entry = jwksCache.get(url);
  const fresh = entry && Date.now() - entry.at < JWKS_TTL_MS;
  if (!entry || !fresh || !entry.keys.has(kid)) {
    const { keys } = await fetcher(url);
    const map = new Map<string, KeyObject>();
    for (const jwk of keys) {
      if (jwk.kty !== "RSA" || !jwk.kid) continue;
      map.set(jwk.kid, createPublicKey({ key: { kty: "RSA", n: jwk.n, e: jwk.e }, format: "jwk" }));
    }
    entry = { at: Date.now(), keys: map };
    jwksCache.set(url, entry);
  }
  return entry.keys.get(kid) ?? null;
}

export interface VerifyOptions {
  /** Frontend API host, e.g. "amazed-rhino-1426.clerk.accounts.dev". */
  frontendApi: string;
  /** Origins allowed in the `azp` claim. */
  authorizedParties: string[];
  fetcher?: JwksFetcher;
  now?: number;
}

/** Returns the verified claims, or null when the token is missing/invalid/expired. */
export async function verifySessionToken(token: string, options: VerifyOptions): Promise<SessionClaims | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

  let header: { alg?: string; kid?: string; typ?: string };
  let claims: SessionClaims;
  try {
    header = JSON.parse(base64UrlDecode(headerB64).toString("utf8"));
    claims = JSON.parse(base64UrlDecode(payloadB64).toString("utf8"));
  } catch {
    return null;
  }
  if (header.alg !== "RS256" || !header.kid) return null;

  const issuer = `https://${options.frontendApi}`;
  if (claims.iss !== issuer) return null;

  const now = Math.floor((options.now ?? Date.now()) / 1000);
  if (typeof claims.exp !== "number" || claims.exp + CLOCK_SKEW_SECONDS < now) return null;
  if (typeof claims.nbf === "number" && claims.nbf - CLOCK_SKEW_SECONDS > now) return null;
  if (typeof claims.sub !== "string" || !claims.sub.startsWith("user_")) return null;
  if (claims.sts === "pending") return null;
  if (claims.azp && !options.authorizedParties.includes(claims.azp)) return null;

  let key: KeyObject | null;
  try {
    key = await getKey(issuer, header.kid, options.fetcher ?? defaultFetcher);
  } catch {
    return null;
  }
  if (!key) return null;

  const ok = verifySignature(
    "RSA-SHA256",
    Buffer.from(`${headerB64}.${payloadB64}`),
    key,
    base64UrlDecode(sigB64),
  );
  return ok ? claims : null;
}

/** Picks the Clerk session token from a cookie header (`__session` or suffixed `__session_*`). */
export function sessionTokensFromCookies(cookies: Array<{ name: string; value: string }>): string[] {
  const exact = cookies.filter((c) => c.name === "__session").map((c) => c.value);
  const suffixed = cookies.filter((c) => c.name.startsWith("__session_")).map((c) => c.value);
  return [...suffixed, ...exact].filter((v) => v.length > 0);
}
