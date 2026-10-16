import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.nav.login, robots: { index: false } };
}

export default async function LoginPage() {
  const { dict } = await getI18n();
  return (
    <div className="w-full max-w-md">
      <p className="eyebrow-accent">[ {dict.nav.login} ]</p>
      <h1 className="mt-3 text-2xl font-semibold">{dict.auth.loginTitle}</h1>
      <p className="mt-2 text-sm text-fg-muted">{dict.auth.loginSubtitle}</p>
      <div className="mt-6">
        <SignIn path="/login" routing="path" signUpUrl="/register" fallbackRedirectUrl="/dashboard" />
      </div>
    </div>
  );
}
