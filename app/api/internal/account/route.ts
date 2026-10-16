import { internalRoute, json } from "@/lib/api/internal";
import { assertSameOrigin, requireUserId } from "@/lib/auth";
import { rpc } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Permanently deletes all CyberQUA data of the signed-in user: API keys (and
 * their cached records), usage logs, quota counters and the profile. The
 * client then deletes the Clerk user itself.
 */
export const DELETE = internalRoute(async (req) => {
  assertSameOrigin(req);
  const userId = await requireUserId();
  await rpc<string[]>("cq_delete_account", { p_user: userId });
  return json({ deleted: true });
});
