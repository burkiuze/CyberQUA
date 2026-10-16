import { getI18n } from "@/lib/i18n/server";
import { requireUserId } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { MAX_ACTIVE_KEYS } from "@/lib/plans";
import { KeysManager, type KeyRow } from "@/components/dashboard/keys-manager";

export default async function KeysPage() {
  const { dict } = await getI18n();
  const userId = await requireUserId();
  const { data } = await supabaseAdmin()
    .from("api_keys")
    .select("id, name, type, key_prefix, allowed_origins, created_at, last_used_at, revoked_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow-accent">[ {dict.dashboard.keys} ]</p>
        <h1 className="mt-2 text-2xl font-semibold">{dict.keys.title}</h1>
        <p className="mt-2 text-sm text-fg-muted">{dict.keys.subtitle}</p>
      </div>
      <KeysManager initialKeys={(data ?? []) as KeyRow[]} maxKeys={MAX_ACTIVE_KEYS} />
    </div>
  );
}
