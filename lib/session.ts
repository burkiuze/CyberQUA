import "server-only";
import { cookies, headers } from "next/headers";
import { frontendApiFromPublishableKey, sessionTokensFromCookies, verifySessionToken } from "@/lib/clerk-session";
import { siteUrl } from "@/lib/env";

async function authorizedParties(): Promise<string[]> {
  const parties = new Set<string>([new URL(siteUrl()).origin]);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    parties.add(`${proto}://${host}`);
  }
  return [...parties];
}

/** Current Clerk user id from a verified session cookie, or null. */
export async function currentUserId(): Promise<string | null> {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const frontendApi = pk ? frontendApiFromPublishableKey(pk) : null;
  if (!frontendApi) return null;
  const store = await cookies();
  const tokens = sessionTokensFromCookies(store.getAll());
  if (tokens.length === 0) return null;
  const parties = await authorizedParties();
  for (const token of tokens) {
    const claims = await verifySessionToken(token, { frontendApi, authorizedParties: parties });
    if (claims) return claims.sub;
  }
  return null;
}
