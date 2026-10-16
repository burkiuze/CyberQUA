import { isIPv4, isIPv6 } from "node:net";

/**
 * Parses an IPv4 address using inet_aton semantics so that alternative
 * notations (2130706433, 0x7f000001, 0177.0.0.1, 127.1) are recognised.
 * Returns the 32-bit unsigned value or null when the input is not an IPv4 literal.
 */
export function parseIPv4Loose(input: string): number | null {
  const host = input.trim().toLowerCase().replace(/\.$/, "");
  if (host.length === 0 || host.length > 64) return null;
  const parts = host.split(".");
  if (parts.length < 1 || parts.length > 4) return null;

  const values: number[] = [];
  for (const part of parts) {
    if (part.length === 0) return null;
    let value: number;
    if (/^0x[0-9a-f]*$/.test(part)) {
      value = part.length === 2 ? 0 : parseInt(part.slice(2), 16);
    } else if (/^0[0-7]+$/.test(part)) {
      value = parseInt(part.slice(1), 8);
    } else if (/^(0|[1-9][0-9]*)$/.test(part)) {
      value = parseInt(part, 10);
    } else {
      return null;
    }
    if (!Number.isFinite(value)) return null;
    values.push(value);
  }

  const last = values[values.length - 1]!;
  const head = values.slice(0, -1);
  if (head.some((v) => v > 255)) return null;
  const remainingBytes = 4 - head.length;
  if (last >= 2 ** (8 * remainingBytes)) return null;

  let result = 0;
  head.forEach((v, i) => {
    result += v * 2 ** (8 * (3 - i));
  });
  result += last;
  return result >>> 0;
}

export function ipv4ToString(value: number): string {
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join(".");
}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => acc * 256 + Number(octet), 0) >>> 0;
}

const IPV4_RESERVED: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

export function isReservedIPv4(ip: string | number): boolean {
  const value = typeof ip === "number" ? ip : ipv4ToInt(ip);
  return IPV4_RESERVED.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return ((value & mask) >>> 0) === ((ipv4ToInt(base) & mask) >>> 0);
  });
}

/** Expands an IPv6 literal into 8 16-bit groups. Returns null when invalid. */
export function expandIPv6(input: string): number[] | null {
  let ip = input.trim().toLowerCase();
  if (ip.startsWith("[") && ip.endsWith("]")) ip = ip.slice(1, -1);
  const zone = ip.indexOf("%");
  if (zone !== -1) ip = ip.slice(0, zone);
  if (!isIPv6(ip)) return null;

  let tail: number[] = [];
  const lastColon = ip.lastIndexOf(":");
  const lastPart = ip.slice(lastColon + 1);
  if (lastPart.includes(".")) {
    if (!isIPv4(lastPart)) return null;
    const v4 = ipv4ToInt(lastPart);
    tail = [(v4 >>> 16) & 0xffff, v4 & 0xffff];
    ip = ip.slice(0, lastColon + 1) + "0:0";
  }

  const [headStr, tailStr] = ip.includes("::") ? ip.split("::") : [ip, undefined];
  const head = headStr ? headStr.split(":").filter((x) => x.length > 0) : [];
  const rest = tailStr !== undefined ? tailStr.split(":").filter((x) => x.length > 0) : [];
  const missing = 8 - head.length - rest.length;
  if (tailStr === undefined && missing !== 0) return null;
  if (missing < 0) return null;
  const groups = [...head, ...Array<string>(tailStr !== undefined ? missing : 0).fill("0"), ...rest].map((g) =>
    parseInt(g, 16),
  );
  if (groups.length !== 8 || groups.some((g) => Number.isNaN(g) || g < 0 || g > 0xffff)) return null;
  if (tail.length === 2) {
    groups[6] = tail[0]!;
    groups[7] = tail[1]!;
  }
  return groups;
}

export function isReservedIPv6(ip: string): boolean {
  const g = expandIPv6(ip);
  if (!g) return true;
  const [g0, g1, g2, g3, g4, g5, g6, g7] = g as [number, number, number, number, number, number, number, number];
  const allZeroPrefix = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0;
  if (allZeroPrefix && g5 === 0 && g6 === 0 && (g7 === 0 || g7 === 1)) return true; // :: and ::1
  if (allZeroPrefix && g5 === 0xffff) return true; // ::ffff:0:0/96 IPv4-mapped
  if (allZeroPrefix && g5 === 0) return true; // ::/96 IPv4-compatible (deprecated)
  if (g0 === 0x64 && g1 === 0xff9b) return true; // 64:ff9b::/96 NAT64
  if ((g0 & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g0 & 0xffc0) === 0xfe80) return true; // fe80::/10 link local
  if ((g0 & 0xffc0) === 0xfec0) return true; // fec0::/10 site local (deprecated)
  if ((g0 & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (g0 === 0x2001 && g1 === 0x0db8) return true; // documentation
  if (g0 === 0x2002) return true; // 6to4 may embed private IPv4
  if (g0 === 0x2001 && g1 === 0) return true; // Teredo
  if (g0 === 0x0100 && g1 === 0 && g2 === 0 && g3 === 0) return true; // discard prefix
  return false;
}

export type IpVersion = 4 | 6;

export function ipVersion(ip: string): IpVersion | null {
  if (isIPv4(ip)) return 4;
  const stripped = ip.startsWith("[") && ip.endsWith("]") ? ip.slice(1, -1) : ip;
  if (isIPv6(stripped)) return 6;
  return null;
}

/** True when an IP literal (v4 or v6) falls in a private, loopback, link-local or otherwise reserved range. */
export function isPrivateOrReservedIp(ip: string): boolean {
  const version = ipVersion(ip);
  if (version === 4) return isReservedIPv4(ip);
  if (version === 6) return isReservedIPv6(ip);
  const loose = parseIPv4Loose(ip);
  if (loose !== null) return isReservedIPv4(loose);
  return true;
}
