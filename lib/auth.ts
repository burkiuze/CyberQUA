import "server-only";
import { ApiError } from "@/lib/api/errors";
import { rpc } from "@/lib/db";
import { siteUrl } from "@/lib/env";
import { currentUserId } from "@/lib/session";
import type { PlanId } from "@/lib/plans";
import type { Locale } from "@/lib/i18n/locale";

export interface Profile {
  id: string;
  display_name: string | null;
  plan: PlanId;
  locale: Locale;
  created_at: string;
}

/** Returns the verified Clerk user id of the current session or throws `unauthorized`. */
export async function requireUserId(): Promise<string> {
  const userId = await currentUserId();
  if (!userId) throw new ApiError("unauthorized");
  return userId;
}

/**
 * CSRF defence for cookie-authenticated mutations: the Origin header must
 * match this site. Browsers always send Origin on cross-site POST/DELETE.
 */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  if (!origin) throw new ApiError("forbidden");
  const allowed = new Set<string>([new URL(siteUrl()).origin]);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
    allowed.add(`${proto}://${host}`);
  }
  if (!allowed.has(origin)) throw new ApiError("forbidden");
}

/** Creates the profile row on first use and returns it. */
export async function ensureProfile(userId: string, displayName: string | null = null): Promise<Profile> {
  return rpc<Profile>("cq_ensure_profile", { p_user: userId, p_display_name: displayName });
}
