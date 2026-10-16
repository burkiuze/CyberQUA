import { z } from "zod";
import { ApiError, internalRoute, json } from "@/lib/api/internal";
import { readJsonBody } from "@/lib/api/body";
import { zodDetails } from "@/lib/api/with-api-auth";
import { assertSameOrigin, ensureProfile, requireUserId } from "@/lib/auth";
import { rpc } from "@/lib/db";
import { LOCALE_COOKIE } from "@/lib/i18n/locale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ locale: z.enum(["tr", "en"]) }).strict();

export const POST = internalRoute(async (req) => {
  assertSameOrigin(req);
  const userId = await requireUserId();
  await ensureProfile(userId);
  const parsed = schema.safeParse(await readJsonBody(req, 1024));
  if (!parsed.success) throw new ApiError("invalid_request", zodDetails(parsed.error));
  await rpc("cq_set_locale", { p_user: userId, p_locale: parsed.data.locale });
  return json({ locale: parsed.data.locale }, 200, {
    "set-cookie": `${LOCALE_COOKIE}=${parsed.data.locale}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`,
  });
});
