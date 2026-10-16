import { getI18n } from "@/lib/i18n/server";
import { currentUserId } from "@/lib/session";
import { listKeys } from "@/lib/dashboard";
import { MAX_ACTIVE_KEYS } from "@/lib/plans";
import { KeysManager } from "@/components/dashboard/keys-manager";

export default async function KeysPage() {
  const { dict } = await getI18n();
  const userId = await currentUserId();
  if (!userId) return null;
  const keys = await listKeys(userId);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow-accent">[ {dict.dashboard.keys} ]</p>
        <h1 className="mt-2 text-2xl font-semibold">{dict.keys.title}</h1>
        <p className="mt-2 text-sm text-fg-muted">{dict.keys.subtitle}</p>
      </div>
      <KeysManager initialKeys={keys} maxKeys={MAX_ACTIVE_KEYS} />
    </div>
  );
}
