import { describe, expect, it } from "vitest";
import { checkIp } from "@/lib/checks/ip";

describe("ip check", () => {
  it("rejects invalid input", async () => {
    expect(await checkIp("999.1.1.1")).toBeNull();
    expect(await checkIp("hello")).toBeNull();
  });

  it("flags private addresses and skips external lookups for them", async () => {
    let called = false;
    const result = await checkIp("192.168.1.10", { isTorExit: async () => ((called = true), true) });
    expect(result?.data.is_private).toBe(true);
    expect(called).toBe(false);
  });

  it("combines Tor and AbuseIPDB signals", async () => {
    const result = await checkIp("185.220.101.1", {
      isTorExit: async () => true,
      abuseLookup: async () => ({ score: 100, country: "DE" }),
    });
    expect(result?.data).toMatchObject({ version: 4, is_tor_exit: true, abuse_score: 100, country: "DE", risk: "critical" });
    expect(result?.sources).toEqual(expect.arrayContaining(["ip_ranges", "tor_exit_list", "abuseipdb"]));
  });

  it("marks partial when a source fails and supports IPv6", async () => {
    const result = await checkIp("2606:4700:4700::1111", {
      isTorExit: async () => {
        throw new Error("down");
      },
    });
    expect(result?.data.version).toBe(6);
    expect(result?.data.is_tor_exit).toBeNull();
    expect(result?.partial).toBe(true);
  });
});
