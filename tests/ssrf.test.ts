import { describe, expect, it } from "vitest";
import { assertSafeUrl, SsrfError, type Resolver } from "@/lib/security/ssrf";
import { isPrivateOrReservedIp, parseIPv4Loose } from "@/lib/security/ip-ranges";

const publicResolver: Resolver = async () => [{ address: "93.184.215.14", family: 4 }];
const privateResolver: Resolver = async () => [{ address: "10.1.2.3", family: 4 }];
const mixedResolver: Resolver = async () => [
  { address: "93.184.215.14", family: 4 },
  { address: "192.168.1.10", family: 4 },
];

async function rejected(url: string, resolver: Resolver = publicResolver) {
  try {
    await assertSafeUrl(url, resolver);
    return null;
  } catch (err) {
    expect(err).toBeInstanceOf(SsrfError);
    return (err as SsrfError).reason;
  }
}

describe("SSRF protection", () => {
  it.each([
    "http://localhost/",
    "http://127.0.0.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "http://2130706433/",
    "http://0x7f000001/",
    "http://0177.0.0.1/",
    "http://127.1/",
    "http://10.0.0.5/",
    "http://[::ffff:127.0.0.1]/",
    "http://[fe80::1]/",
    "http://[fc00::1]/",
    "http://100.64.0.1/",
    "http://0.0.0.0/",
    "http://224.0.0.1/",
  ])("rejects %s", async (url) => {
    expect(await rejected(url)).toBe("private_address");
  });

  it("rejects a domain that resolves to a private IP", async () => {
    expect(await rejected("https://internal.example.org/", privateResolver)).toBe("private_address");
  });

  it("rejects when ANY resolved address is private", async () => {
    expect(await rejected("https://rebind.example.org/", mixedResolver)).toBe("private_address");
  });

  it("rejects other protocols, ports and credentials", async () => {
    expect(await rejected("ftp://example.com/")).toBe("protocol_not_allowed");
    expect(await rejected("file:///etc/passwd")).toBe("protocol_not_allowed");
    expect(await rejected("http://example.com:8080/")).toBe("port_not_allowed");
    expect(await rejected("http://user:pass@example.com/")).toBe("credentials_not_allowed");
  });

  it("allows example.com", async () => {
    const { url, addresses } = await assertSafeUrl("https://example.com/", publicResolver);
    expect(url.hostname).toBe("example.com");
    expect(addresses[0]?.address).toBe("93.184.215.14");
  });

  it("allows public IP literals on 80/443", async () => {
    expect(await rejected("http://93.184.215.14:80/")).toBeNull();
    expect(await rejected("https://[2606:2800:21f:cb07:6820:80da:af6b:8b2c]/")).toBeNull();
  });
});

describe("IP parsing", () => {
  it("parses alternative IPv4 notations", () => {
    expect(parseIPv4Loose("2130706433")).toBe(0x7f000001);
    expect(parseIPv4Loose("0x7f000001")).toBe(0x7f000001);
    expect(parseIPv4Loose("0177.0.0.1")).toBe(0x7f000001);
    expect(parseIPv4Loose("127.1")).toBe(0x7f000001);
    expect(parseIPv4Loose("example.com")).toBeNull();
    expect(parseIPv4Loose("256.1.1.1")).toBeNull();
  });

  it("classifies reserved ranges", () => {
    for (const ip of ["127.0.0.1", "10.0.0.1", "172.16.5.4", "172.31.255.255", "192.168.0.1", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:8.8.8.8"]) {
      expect(isPrivateOrReservedIp(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "185.220.101.1", "2606:4700:4700::1111"]) {
      expect(isPrivateOrReservedIp(ip), ip).toBe(false);
    }
  });
});
