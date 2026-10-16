import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { ApiError } from "@/lib/api/errors";
import { supabaseAdmin } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/env";
import type { PlanId } from "@/lib/plans";
import type { Locale } from "@/lib/i18n/locale";

export interface Profile {
  id: string;
  display_name: string | null;
  plan: PlanId;
  locale: Locale;
  created_at: string;
}

/** Returns the Clerk user id of the current session or throws `unauthorized`. */
export async function requireUserId(): Promise<string> {
  const { userId } = await auth();
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

/** Creates the profile row on first use (also done by the Clerk webhook). */
export async function ensureProfile(userId: string): Promise<Profile> {
  const db = supabaseAdmin();
  const { data: existing } = await db
    .from("profiles")
    .select("id, display_name, plan, locale, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (existing) return existing as Profile;

  const user = await currentUser();
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || null;
  const { data, error } = await db
    .from("profiles")
    .upsert({ id: userId, display_name: displayName }, { onConflict: "id", ignoreDuplicates: true })
    .select("id, display_name, plan, locale, created_at")
    .maybeSingle();
  if (error) throw new Error("profile_create_failed");
  if (data) return data as Profile;
  const { data: again } = await db
    .from("profiles")
    .select("id, display_name, plan, locale, created_at")
    .eq("id", userId)
    .single();
  return again as Profile;
}
