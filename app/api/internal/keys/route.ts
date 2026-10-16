import { z } from "zod";
import { ApiError, internalRoute, json } from "@/lib/api/internal";
import { readJsonBody } from "@/lib/api/body";
import { zodDetails } from "@/lib/api/with-api-auth";
import { generateApiKey, hashApiKey, keyPrefix, normalizeOrigin } from "@/lib/api/keys";
import { assertSameOrigin, ensureProfile, requireUserId } from "@/lib/auth";
import { listKeys, type KeyRow } from "@/lib/dashboard";
import { rpc } from "@/lib/db";
import { MAX_ACTIVE_KEYS } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = internalRoute(async () => {
  const userId = await requireUserId();
  return json({ keys: await listKeys(userId) });
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

  const key = generateApiKey(type);
  const result = await rpc<{ error?: string; record?: KeyRow }>("cq_create_key", {
    p_user: userId,
    p_name: name,
    p_type: type,
    p_prefix: keyPrefix(key),
    p_hash: hashApiKey(key),
    p_origins: origins,
    p_max_active: MAX_ACTIVE_KEYS,
  });
  if (result.error === "key_limit_reached") throw new ApiError("key_limit_reached");
  if (!result.record) throw new Error("key_create_failed");
  // The full key is returned exactly once and never stored.
  return json({ key, record: result.record }, 201);
});

const deleteSchema = z.object({ id: z.uuid() });

export const DELETE = internalRoute(async (req) => {
  assertSameOrigin(req);
  const userId = await requireUserId();
  const parsed = deleteSchema.safeParse({ id: new URL(req.url).searchParams.get("id") });
  if (!parsed.success) throw new ApiError("invalid_request", zodDetails(parsed.error));
  // Revocation also drops the cached key record, so it takes effect immediately.
  const result = await rpc<{ found: boolean }>("cq_revoke_key", { p_user: userId, p_id: parsed.data.id });
  if (!result.found) throw new ApiError("not_found");
  return json({ revoked: true });
});
