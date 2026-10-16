import "server-only";
import { cacheGet, cacheSet } from "@/lib/redis";
import { serverEnv } from "@/lib/env";
import { fetchWithTimeout, UpstreamError } from "@/lib/http";
import type { BlacklistSource, DomainAgeLookup, UrlCheckDeps } from "@/lib/checks/url";

const RDAP_TTL = 24 * 60 * 60;

interface RdapEvent {
  eventAction?: string;
  eventDate?: string;
}

/** Looks up the registration date of a domain via rdap.org, cached for 24 hours. */
export const rdapDomainAge: DomainAgeLookup = async (domain) => {
  const cacheKey = `rdap:${domain}`;
  const cached = await cacheGet<{ registeredAt: string | null }>(cacheKey);
  if (cached) return { registeredAt: cached.registeredAt ? new Date(cached.registeredAt) : null };

  const res = await fetchWithTimeout(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
    headers: { accept: "application/rdap+json, application/json" },
    redirect: "follow",
  });
  if (res.status === 404) {
    // Registry has no RDAP data for this domain/TLD; not an upstream failure.
    await cacheSet(cacheKey, { registeredAt: null }, RDAP_TTL);
    return { registeredAt: null };
  }
  if (!res.ok) throw new UpstreamError("rdap", `status ${res.status}`);
  const body = (await res.json()) as { events?: RdapEvent[] };
  const registration = body.events?.find((e) => e.eventAction === "registration")?.eventDate;
  const date = registration ? new Date(registration) : null;
  const valid = date && !Number.isNaN(date.getTime()) ? date : null;
  await cacheSet(cacheKey, { registeredAt: valid ? valid.toISOString() : null }, RDAP_TTL);
  return { registeredAt: valid };
};

function urlhausSource(authKey: string): BlacklistSource {
  return {
    name: "urlhaus",
    check: async (url) => {
      const res = await fetchWithTimeout("https://urlhaus-api.abuse.ch/v1/url/", {
        method: "POST",
        headers: { "Auth-Key": authKey, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ url }).toString(),
      });
      if (!res.ok) throw new UpstreamError("urlhaus", `status ${res.status}`);
      const body = (await res.json()) as { query_status?: string };
      if (body.query_status === "ok") return true;
      if (body.query_status === "no_results") return false;
      throw new UpstreamError("urlhaus", `query_status ${body.query_status ?? "unknown"}`);
    },
  };
}

function webRiskSource(apiKey: string): BlacklistSource {
  return {
    name: "google_web_risk",
    check: async (url) => {
      const params = new URLSearchParams();
      for (const type of ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"]) params.append("threatTypes", type);
      params.set("uri", url);
      params.set("key", apiKey);
      const res = await fetchWithTimeout(`https://webrisk.googleapis.com/v1/uris:search?${params.toString()}`);
      if (!res.ok) throw new UpstreamError("google_web_risk", `status ${res.status}`);
      const body = (await res.json()) as { threat?: { threatTypes?: string[] } };
      return !!body.threat?.threatTypes?.length;
    },
  };
}

/** Production dependencies for checkUrl. Optional sources are only enabled when their key is set. */
export function defaultUrlDeps(): UrlCheckDeps {
  const blacklists: BlacklistSource[] = [];
  const urlhausKey = serverEnv.urlhausKey();
  if (urlhausKey) blacklists.push(urlhausSource(urlhausKey));
  const webRiskKey = serverEnv.webRiskKey();
  if (webRiskKey) blacklists.push(webRiskSource(webRiskKey));
  return { domainAge: rdapDomainAge, blacklists };
}
