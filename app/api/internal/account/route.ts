import { clerkClient } from "@clerk/nextjs/server";
import { internalRoute, json } from "@/lib/api/internal";
import { assertSameOrigin, requireUserId } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { apiKeyCacheKey } from "@/lib/api/deps";
import { cacheDel } from "@/lib/redis";
import { quotaKey } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Permanently deletes the account: API keys, usage logs, profile and the Clerk user. */
export const DELETE = internalRoute(async (req) => {
  assertSameOrigin(req);
  const userId = await requireUserId();
  const db = supabaseAdmin();

  const { data: keys } = await db.from("api_keys").select("key_hash").eq("user_id", userId);
  // profiles → api_keys → usage_logs cascade on delete.
  const { error } = await db.from("profiles").delete().eq("id", userId);
  if (error) throw new Error("account_delete_failed");
  await cacheDel(...(keys ?? []).map((k) => apiKeyCacheKey(k.key_hash as string)), quotaKey(userId));

  const clerk = await clerkClient();
  await clerk.users.deleteUser(userId);
  return json({ deleted: true });
});
