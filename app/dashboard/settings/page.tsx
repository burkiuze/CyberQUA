import { UserProfile } from "@clerk/nextjs";
import { getI18n } from "@/lib/i18n/server";
import { ensureProfile } from "@/lib/auth";
import { currentUserId } from "@/lib/session";
import { DeleteAccount, LanguageForm } from "@/components/dashboard/settings-forms";

export default async function SettingsPage() {
  const { dict } = await getI18n();
  const userId = await currentUserId();
  if (!userId) return null;
  const profile = await ensureProfile(userId);
  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow-accent">[ {dict.dashboard.settings} ]</p>
        <h1 className="mt-2 text-2xl font-semibold">{dict.settings.title}</h1>
      </div>

      <section className="card p-5">
        <LanguageForm current={profile.locale} />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">{dict.settings.security}</h2>
        <p className="text-sm text-fg-muted">{dict.settings.securityDesc}</p>
        <div className="max-w-full overflow-x-auto">
          <UserProfile routing="hash" />
        </div>
      </section>

      <section className="border border-danger/50 p-5">
        <p className="eyebrow text-danger">{dict.settings.danger}</p>
        <h2 className="mt-2 font-semibold">{dict.settings.deleteTitle}</h2>
        <p className="mt-1 mb-4 text-sm text-fg-muted">{dict.settings.deleteDesc}</p>
        <DeleteAccount />
      </section>
    </div>
  );
}
