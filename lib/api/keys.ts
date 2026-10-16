import { createHash } from "node:crypto";
import { randomBase62 } from "@/lib/api/response";
import type { KeyType } from "@/lib/plans";

export const API_KEY_RE = /^cq_(live|pub)_[A-Za-z0-9]{32}$/;

export function generateApiKey(type: KeyType): string {
  return `${type === "secret" ? "cq_live_" : "cq_pub_"}${randomBase62(32)}`;
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/** First 12 characters, safe to display (e.g. "cq_live_Ab3d"). */
export function keyPrefix(key: string): string {
  return key.slice(0, 12);
}

export function keyTypeFromString(key: string): KeyType | null {
  const m = API_KEY_RE.exec(key);
  if (!m) return null;
  return m[1] === "live" ? "secret" : "publishable";
}

/** Normalises an allowed origin entry. Supports a single leading wildcard label. */
export function normalizeOrigin(input: string): string | null {
  const value = input.trim().toLowerCase().replace(/\/+$/, "");
  const wildcard = /^(https?):\/\/\*\.([a-z0-9.-]+)(:\d+)?$/.exec(value);
  if (wildcard) {
    const [, scheme, host, port = ""] = wildcard;
    if (!host || !host.includes(".")) return null;
    if (scheme === "http") return null;
    return `${scheme}://*.${host}${port}`;
  }
  try {
    const url = new URL(value);
    if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) return null;
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocal)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function originAllowed(origin: string, allowed: string[]): boolean {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  const normalized = parsed.origin.toLowerCase();
  return allowed.some((entry) => {
    if (!entry.includes("*")) return entry === normalized;
    const m = /^(https?):\/\/\*\.([^:]+)(:\d+)?$/.exec(entry);
    if (!m) return false;
    const [, scheme, base, port = ""] = m;
    const expectedPort = port ? port.slice(1) : "";
    return (
      parsed.protocol === `${scheme}:` &&
      parsed.port === expectedPort &&
      parsed.hostname.endsWith(`.${base}`) &&
      parsed.hostname.length > base!.length + 1
    );
  });
}
