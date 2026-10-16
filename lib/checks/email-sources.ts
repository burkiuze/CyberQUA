import "server-only";
import { resolveMx } from "node:dns/promises";
import { cacheGet, cacheSet } from "@/lib/redis";
import { withTimeout } from "@/lib/http";
import type { MxLookup } from "@/lib/checks/email";

const NEGATIVE_DNS_CODES = new Set(["ENOTFOUND", "ENODATA", "ENOTIMP", "EBADNAME", "ESERVFAIL_NX"]);

/** MX lookup with a 5 second timeout and a 1 hour Redis cache. */
export const cachedMxLookup: MxLookup = async (domain) => {
  const key = `mx:${domain}`;
  const cached = await cacheGet<{ has: boolean }>(key);
  if (cached) return cached.has;
  let has: boolean;
  try {
    const records = await withTimeout(resolveMx(domain));
    has = records.some((r) => r.exchange && r.exchange !== ".");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (!code || !NEGATIVE_DNS_CODES.has(code)) throw err;
    has = false;
  }
  await cacheSet(key, { has }, 60 * 60);
  return has;
};
