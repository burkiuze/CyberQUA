import { lookup as dnsLookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import { isIP } from "node:net";
import { Agent, request } from "undici";
import { expandIPv6, ipv4ToString, isPrivateOrReservedIp, parseIPv4Loose } from "@/lib/security/ip-ranges";

export class SsrfError extends Error {
  constructor(
    public readonly reason:
      | "invalid_url"
      | "protocol_not_allowed"
      | "port_not_allowed"
      | "credentials_not_allowed"
      | "private_address"
      | "dns_failure"
      | "too_many_redirects",
    message?: string,
  ) {
    super(message ?? reason);
    this.name = "SsrfError";
  }
}

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>;

export const systemResolver: Resolver = async (hostname) => {
  const results: LookupAddress[] = await dnsLookup(hostname, { all: true, verbatim: true });
  return results.map((r) => ({ address: r.address, family: r.family === 6 ? 6 : 4 }));
};

const BLOCKED_HOSTNAMES = [/^localhost$/i, /\.localhost$/i, /\.local$/i, /\.internal$/i, /^metadata\.google\.internal$/i];

/** Validates protocol, port and credentials of a URL without touching the network. */
export function parseTargetUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SsrfError("invalid_url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfError("protocol_not_allowed");
  }
  if (url.port !== "" && url.port !== "80" && url.port !== "443") {
    throw new SsrfError("port_not_allowed");
  }
  if (url.username || url.password) {
    throw new SsrfError("credentials_not_allowed");
  }
  return url;
}

function hostnameOf(url: URL): string {
  const host = url.hostname;
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

/**
 * Resolves the hostname of a URL and verifies that NONE of the resulting
 * addresses is private or reserved. IP literals in any notation are checked
 * directly without DNS.
 */
export async function resolveSafeAddresses(url: URL, resolver: Resolver = systemResolver): Promise<ResolvedAddress[]> {
  const host = hostnameOf(url);
  if (BLOCKED_HOSTNAMES.some((re) => re.test(host))) {
    throw new SsrfError("private_address");
  }

  const literalVersion = isIP(host);
  if (literalVersion === 4 || literalVersion === 6) {
    if (isPrivateOrReservedIp(host)) throw new SsrfError("private_address");
    return [{ address: host, family: literalVersion }];
  }

  // Alternative IPv4 notations that slipped past URL normalisation.
  const loose = parseIPv4Loose(host);
  if (loose !== null) {
    const ip = ipv4ToString(loose);
    if (isPrivateOrReservedIp(ip)) throw new SsrfError("private_address");
    return [{ address: ip, family: 4 }];
  }

  let addresses: ResolvedAddress[];
  try {
    addresses = await resolver(host);
  } catch {
    throw new SsrfError("dns_failure");
  }
  if (addresses.length === 0) throw new SsrfError("dns_failure");
  for (const { address, family } of addresses) {
    if (family === 6 && !expandIPv6(address)) throw new SsrfError("private_address");
    if (isPrivateOrReservedIp(address)) throw new SsrfError("private_address");
  }
  return addresses;
}

/** Full pre-flight check: syntax, protocol, port and DNS. */
export async function assertSafeUrl(raw: string, resolver: Resolver = systemResolver) {
  const url = parseTargetUrl(raw);
  const addresses = await resolveSafeAddresses(url, resolver);
  return { url, addresses };
}

/** Creates an undici Agent whose connections are pinned to an already validated address. */
export function pinnedAgent(address: ResolvedAddress, timeoutMs: number): Agent {
  return new Agent({
    connect: {
      timeout: timeoutMs,
      lookup: (_hostname, options, callback) => {
        const opts = options as { all?: boolean } | undefined;
        const cb = callback as (...args: unknown[]) => void;
        if (opts?.all) cb(null, [{ address: address.address, family: address.family }]);
        else cb(null, address.address, address.family);
      },
    },
    headersTimeout: timeoutMs,
    bodyTimeout: timeoutMs,
  });
}

export interface HopResult {
  url: string;
  status: number;
  headers: Record<string, string | string[]>;
  address: string;
}

export interface SafeFetchResult {
  final: HopResult;
  hops: HopResult[];
}

/**
 * Performs a GET request that only reads response headers. Every hop of a
 * redirect chain (max `maxRedirects`) is re-validated and the TCP connection
 * is pinned to the validated IP, which defeats DNS rebinding.
 */
export async function safeFetchHeaders(
  rawUrl: string,
  {
    maxRedirects = 3,
    timeoutMs = 5000,
    resolver = systemResolver,
    signal,
  }: { maxRedirects?: number; timeoutMs?: number; resolver?: Resolver; signal?: AbortSignal } = {},
): Promise<SafeFetchResult> {
  const hops: HopResult[] = [];
  let current = rawUrl;
  const overall = signal ?? AbortSignal.timeout(timeoutMs);

  for (let i = 0; i <= maxRedirects; i++) {
    const { url, addresses } = await assertSafeUrl(current, resolver);
    const address = addresses[0]!;
    const agent = pinnedAgent(address, timeoutMs);
    try {
      const res = await request(url.toString(), {
        method: "GET",
        dispatcher: agent,
        signal: overall,
        headers: {
          "user-agent": "CyberQUA-HeaderAudit/1.0 (+https://cyberqua.dev)",
          accept: "text/html,*/*;q=0.8",
        },
      });
      // Never read the body: drop the connection once headers are in.
      res.body.destroy();
      const headers: Record<string, string | string[]> = {};
      for (const [k, v] of Object.entries(res.headers)) {
        if (v !== undefined) headers[k.toLowerCase()] = v;
      }
      const hop: HopResult = { url: url.toString(), status: res.statusCode, headers, address: address.address };
      hops.push(hop);

      const location = headers["location"];
      if (res.statusCode >= 300 && res.statusCode < 400 && location) {
        if (i === maxRedirects) throw new SsrfError("too_many_redirects");
        current = new URL(Array.isArray(location) ? location[0]! : location, url).toString();
        continue;
      }
      return { final: hop, hops };
    } finally {
      agent.destroy().catch(() => undefined);
    }
  }
  throw new SsrfError("too_many_redirects");
}
