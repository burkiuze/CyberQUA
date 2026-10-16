import { fetchWithTimeout, UpstreamError } from "@/lib/http";

export interface PasswordRangeData {
  prefix: string;
  suffixes: Array<{ suffix: string; count: number }>;
}

export const SHA1_PREFIX_RE = /^[0-9A-F]{5}$/;

/** Parses a HIBP range response, dropping padding rows (count 0). */
export function parseRangeResponse(body: string): Array<{ suffix: string; count: number }> {
  const result: Array<{ suffix: string; count: number }> = [];
  for (const line of body.split(/\r?\n/)) {
    const [suffix, countRaw] = line.trim().split(":");
    if (!suffix || !countRaw) continue;
    const count = Number.parseInt(countRaw, 10);
    if (!/^[0-9A-F]{35}$/i.test(suffix) || !Number.isFinite(count) || count <= 0) continue;
    result.push({ suffix: suffix.toUpperCase(), count });
  }
  return result;
}

/** Fetches a k-anonymity range from Have I Been Pwned with response padding enabled. */
export async function fetchPwnedRange(prefix: string): Promise<PasswordRangeData> {
  if (!SHA1_PREFIX_RE.test(prefix)) throw new Error("invalid prefix");
  const res = await fetchWithTimeout(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { "Add-Padding": "true", "User-Agent": "CyberQUA-API" },
  });
  if (!res.ok) throw new UpstreamError("pwnedpasswords", `status ${res.status}`);
  return { prefix, suffixes: parseRangeResponse(await res.text()) };
}
