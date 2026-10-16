import type { NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { supabaseAdmin } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Keeps profiles in sync with Clerk users (user.created / user.updated / user.deleted). */
export async function POST(req: NextRequest) {
  const secret = serverEnv.clerkWebhookSecret();
  if (!secret) return new Response("webhook not configured", { status: 503 });
  let evt: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    evt = await verifyWebhook(req, { signingSecret: secret });
  } catch {
    return new Response("invalid signature", { status: 400 });
  }

  const db = supabaseAdmin();
  if (evt.type === "user.created" || evt.type === "user.updated") {
    const u = evt.data;
    const displayName = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || null;
    const { error } = await db.from("profiles").upsert({ id: u.id, display_name: displayName }, { onConflict: "id" });
    if (error) return new Response("db error", { status: 500 });
  } else if (evt.type === "user.deleted" && evt.data.id) {
    const { error } = await db.from("profiles").delete().eq("id", evt.data.id);
    if (error) return new Response("db error", { status: 500 });
  }
  return new Response("ok", { status: 200 });
}
