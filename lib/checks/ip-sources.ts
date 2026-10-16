import "server-only";
import { cacheGet, cacheSet } from "@/lib/cache";
import { rpc } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { fetchWithTimeout, UpstreamError } from "@/lib/http";
import { ipVersion } from "@/lib/security/ip-ranges";
import type { IpCheckDeps } from "@/lib/checks/ip";

const TOR_REFRESH_MS = 60 * 60 * 1000;

interface TorStatus {
  updated_at: string | null;
  has_list: boolean;
  member: boolean;
}

/** Downloads the Tor bulk exit list and atomically replaces the stored set. */
async function refreshTorList(): Promise<void> {
  const res = await fetchWithTimeout("https://check.torproject.org/torbulkexitlist");
  if (!res.ok) throw new UpstreamError("tor", `status ${res.status}`);
  const ips = (await res.text())
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && ipVersion(l) !== null);
  if (ips.length === 0) throw new UpstreamError("tor", "empty list");
  await rpc("cq_tor_replace", { p_ips: ips });
}

/** Membership in the Tor exit list, refreshed at most hourly. */
async function isTorExit(ip: string): Promise<boolean> {
  let status = await rpc<TorStatus>("cq_tor_status", { p_ip: ip });
  const updatedMs = status.updated_at ? Number(status.updated_at) * 1000 : 0;
  if (Date.now() - updatedMs > TOR_REFRESH_MS) {
    if (!status.has_list) {
      await refreshTorList();
      status = await rpc<TorStatus>("cq_tor_status", { p_ip: ip });
    } else {
      // Serve the current list; refresh it alongside this request.
      await refreshTorList().catch(() => undefined);
      status = await rpc<TorStatus>("cq_tor_status", { p_ip: ip });
    }
  }
  if (!status.has_list) throw new UpstreamError("tor", "exit list unavailable");
  return status.member;
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
