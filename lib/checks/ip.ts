import { ipVersion, isPrivateOrReservedIp, type IpVersion } from "@/lib/security/ip-ranges";
import { clampScore, riskLevel, type CheckResult, type RiskLevel } from "@/lib/checks/text";

export interface IpCheckData {
  ip: string;
  version: IpVersion;
  is_private: boolean;
  is_tor_exit: boolean | null;
  abuse_score: number | null;
  country: string | null;
  risk: RiskLevel;
  score: number;
}

export interface IpCheckDeps {
  /** Returns membership in the Tor exit list. Throws when the list is unavailable. */
  isTorExit?: (ip: string) => Promise<boolean>;
  /** Returns the AbuseIPDB confidence score and country. Only present when configured. */
  abuseLookup?: (ip: string) => Promise<{ score: number; country: string | null }>;
}

export function normalizeIp(input: string): string | null {
  const trimmed = input.trim();
  const unbracketed = trimmed.startsWith("[") && trimmed.endsWith("]") ? trimmed.slice(1, -1) : trimmed;
  return ipVersion(unbracketed) ? unbracketed.toLowerCase() : null;
}

export async function checkIp(rawIp: string, deps: IpCheckDeps = {}): Promise<CheckResult<IpCheckData> | null> {
  const ip = normalizeIp(rawIp);
  if (!ip) return null;
  const version = ipVersion(ip)!;
  const isPrivate = isPrivateOrReservedIp(ip);
  const sources = ["ip_ranges"];
  let partial = false;

  let isTorExit: boolean | null = null;
  let abuseScore: number | null = null;
  let country: string | null = null;

  if (!isPrivate) {
    await Promise.all([
      (async () => {
        if (!deps.isTorExit) return;
        try {
          isTorExit = await deps.isTorExit(ip);
          sources.push("tor_exit_list");
        } catch {
          partial = true;
        }
      })(),
      (async () => {
        if (!deps.abuseLookup) return;
        try {
          const result = await deps.abuseLookup(ip);
          abuseScore = result.score;
          country = result.country;
          sources.push("abuseipdb");
        } catch {
          partial = true;
        }
      })(),
    ]);
  }

  let score = 0;
  if (isTorExit) score += 50;
  if (abuseScore !== null) score += abuseScore * 0.8;
  score = clampScore(score);

  return {
    data: {
      ip,
      version,
      is_private: isPrivate,
      is_tor_exit: isTorExit,
      abuse_score: abuseScore,
      country,
      risk: riskLevel(score),
      score,
    },
    sources,
    partial,
  };
}
