import { z } from "zod";
import { ApiError, internalRoute, json } from "@/lib/api/internal";
import { readJsonBody } from "@/lib/api/body";
import { zodDetails } from "@/lib/api/with-api-auth";
import { generateApiKey, hashApiKey, keyPrefix, normalizeOrigin } from "@/lib/api/keys";
import { apiKeyCacheKey } from "@/lib/api/deps";
import { assertSameOrigin, ensureProfile, requireUserId } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { cacheDel } from "@/lib/redis";
import { MAX_ACTIVE_KEYS } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PUBLIC_COLUMNS = "id, name, type, key_prefix, allowed_origins, created_at, last_used_at, revoked_at";

export const GET = internalRoute(async () => {
  const userId = await requireUserId();
  const { data, error } = await supabaseAdmin()
    .from("api_keys")
    .select(PUBLIC_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error("keys_list_failed");
  return json({ keys: data ?? [] });
});

const createSchema = z
  .object({
    name: z.string().trim().min(1).max(50),
    type: z.enum(["secret", "publishable"]),
    allowed_origins: z.array(z.string().trim().min(1).max(255)).max(10).optional().default([]),
  })
  .strict();

export const POST = internalRoute(async (req) => {
  assertSameOrigin(req);
  const userId = await requireUserId();
  await ensureProfile(userId);

  const parsed = createSchema.safeParse(await readJsonBody(req, 8 * 1024));
  if (!parsed.success) throw new ApiError("invalid_request", zodDetails(parsed.error));
  const { name, type } = parsed.data;

  let origins: string[] = [];
  if (type === "publishable") {
    const normalized = parsed.data.allowed_origins.map((o) => ({ raw: o, value: normalizeOrigin(o) }));
    const invalid = normalized.filter((o) => !o.value);
    if (invalid.length > 0 || normalized.length === 0) {
      throw new ApiError("invalid_request", [
        {
          field: "allowed_origins",
          message:
            normalized.length === 0
              ? "At least one origin is required for publishable keys"
              : `Invalid origin(s): ${invalid.map((o) => o.raw).join(", ")}`,
        },
      ]);
    }
    origins = [...new Set(normalized.map((o) => o.value!))];
  }

  const db = supabaseAdmin();
  const { count, error: countError } = await db
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("revoked_at", null);
  if (countError) throw new Error("keys_count_failed");
  if ((count ?? 0) >= MAX_ACTIVE_KEYS) throw new ApiError("key_limit_reached");

  const key = generateApiKey(type);
  const { data, error } = await db
    .from("api_keys")
    .insert({
      user_id: userId,
      name,
      type,
      key_prefix: keyPrefix(key),
      key_hash: hashApiKey(key),
      allowed_origins: origins,
    })
    .select(PUBLIC_COLUMNS)
    .single();
  if (error) {
    if (error.message.includes("active_key_limit")) throw new ApiError("key_limit_reached");
    throw new Error("key_create_failed");
  }
  // The full key is returned exactly once and never stored.
  return json({ key, record: data }, 201);
});

const deleteSchema = z.object({ id: z.uuid() });

export const DELETE = internalRoute(async (req) => {
  assertSameOrigin(req);
  const userId = await requireUserId();
  const parsed = deleteSchema.safeParse({ id: new URL(req.url).searchParams.get("id") });
  if (!parsed.success) throw new ApiError("invalid_request", zodDetails(parsed.error));

  const db = supabaseAdmin();
  const { data: existing } = await db
    .from("api_keys")
    .select("id, key_hash, revoked_at")
    .eq("id", parsed.data.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!existing) throw new ApiError("not_found");

  if (!existing.revoked_at) {
    const { error } = await db
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", parsed.data.id)
      .eq("user_id", userId);
    if (error) throw new Error("key_revoke_failed");
  }
  // Revocation takes effect immediately: drop the cached key record.
  await cacheDel(apiKeyCacheKey(existing.key_hash as string));
  return json({ revoked: true });
});
