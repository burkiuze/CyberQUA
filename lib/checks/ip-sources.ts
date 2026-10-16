import "server-only";
import { getRedis, cacheGet, cacheSet } from "@/lib/redis";
import { serverEnv } from "@/lib/env";
import { fetchWithTimeout, UpstreamError } from "@/lib/http";
import { ipVersion } from "@/lib/security/ip-ranges";
import type { IpCheckDeps } from "@/lib/checks/ip";

const TOR_SET = "tor:exits";
const TOR_UPDATED = "tor:updated_at";
const TOR_LOCK = "tor:lock";
const TOR_REFRESH_MS = 60 * 60 * 1000;

/** Downloads the Tor bulk exit list and atomically replaces the Redis set. */
async function refreshTorList(): Promise<void> {
  const redis = getRedis();
  const locked = await redis.set(TOR_LOCK, "1", { nx: true, ex: 60 });
  if (locked === null) return; // another instance is refreshing
  try {
    const res = await fetchWithTimeout("https://check.torproject.org/torbulkexitlist");
    if (!res.ok) throw new UpstreamError("tor", `status ${res.status}`);
    const ips = (await res.text())
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && ipVersion(l) !== null);
    if (ips.length === 0) throw new UpstreamError("tor", "empty list");
    const tmp = `${TOR_SET}:tmp:${Date.now()}`;
    for (let i = 0; i < ips.length; i += 1000) {
      const chunk = ips.slice(i, i + 1000);
      await redis.sadd(tmp, chunk[0]!, ...chunk.slice(1));
    }
    await redis.rename(tmp, TOR_SET);
    await redis.expire(TOR_SET, 6 * 60 * 60);
    await redis.set(TOR_UPDATED, String(Date.now()));
  } finally {
    await redis.del(TOR_LOCK);
  }
}

async function isTorExit(ip: string): Promise<boolean> {
  const redis = getRedis();
  const updatedRaw = await redis.get<string | number>(TOR_UPDATED);
  const updated = updatedRaw ? Number(updatedRaw) : 0;
  const stale = Date.now() - updated > TOR_REFRESH_MS;
  if (stale) {
    const exists = await redis.exists(TOR_SET);
    if (!exists) {
      await refreshTorList();
    } else {
      // Serve the existing list; refresh in the background of this request.
      refreshTorList().catch(() => undefined);
    }
  }
  if (!(await redis.exists(TOR_SET))) throw new UpstreamError("tor", "exit list unavailable");
  return (await redis.sismember(TOR_SET, ip)) === 1;
}

async function abuseLookup(apiKey: string, ip: string) {
  const key = `abuse:${ip}`;
  const cached = await cacheGet<{ score: number; country: string | null }>(key);
  if (cached) return cached;
  const params = new URLSearchParams({ ipAddress: ip, maxAgeInDays: "90" });
  const res = await fetchWithTimeout(`https://api.abuseipdb.com/api/v2/check?${params.toString()}`, {
    headers: { Key: apiKey, Accept: "application/json" },
  });
  if (!res.ok) throw new UpstreamError("abuseipdb", `status ${res.status}`);
  const body = (await res.json()) as { data?: { abuseConfidenceScore?: number; countryCode?: string | null } };
  const result = {
    score: Math.max(0, Math.min(100, Number(body.data?.abuseConfidenceScore ?? 0))),
    country: body.data?.countryCode ?? null,
  };
  await cacheSet(key, result, 6 * 60 * 60);
  return result;
}

export function defaultIpDeps(): IpCheckDeps {
  const apiKey = serverEnv.abuseIpDbKey();
  return {
    isTorExit,
    abuseLookup: apiKey ? (ip) => abuseLookup(apiKey, ip) : undefined,
  };
}
